#!/usr/bin/env node
/*
 * efficiency-audit.mjs — 24h efficiency audit for NFT_WATCHDOG_CHAD_V2.
 *
 * Three jobs:
 *   1. GitHub tool discovery: keyless search API for nft-bot / nft-mint-bot
 *      repos pushed in the last 90 days, sorted by stars -> CANDIDATE_TOOLS.md
 *   2. Mint-log analysis: per-RPC win rate + median latency from mint-log.jsonl.
 *      RULE: RPC with win rate <40% over >=50 mints -> flagged "REPLACE".
 *   3. Per-chain ROI: sum(proceedsUsd - gasCostUsd) per chain from the log.
 *      RULE: 3 consecutive negative-ROI mints on a chain -> auto-bump that
 *      chain's minScore by +5 in state.json. minScore is NEVER lowered.
 *
 * Writes AUDIT-REPORT.md every run (timestamped sections).
 *
 * Usage: node audit.mjs [--dry] [--live] [--skip-github] [--help]
 *
 *   --dry   (DEFAULT) Read-only analysis. Writes AUDIT-REPORT.md and
 *           CANDIDATE_TOOLS.md only. NEVER creates or mutates state.json.
 *   --live  Applies the chain-minScore bumps AND persists the log cursor to
 *           state.json (so the next run only processes new mint lines).
 *   --skip-github  Skip the GitHub discovery job (offline / test use).
 *
 * Env overrides (useful for testing):
 *   AUDIT_MINT_LOG  path to mint-log.jsonl (default: ../fast-mint/mint-log.jsonl)
 *   AUDIT_STATE     path to state.json (default: ./state.json)
 *   AUDIT_OUT_DIR   directory for AUDIT-REPORT.md + CANDIDATE_TOOLS.md
 *                   (default: this script's directory)
 *
 * HARD LINES: no spend, no signups, no keys, no deployments.
 * Read-only everywhere except its own report files and (in --live) state.json.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- config ----------
const OUT_DIR = process.env.AUDIT_OUT_DIR || __dirname;
const MINT_LOG = process.env.AUDIT_MINT_LOG || path.join(__dirname, "..", "fast-mint", "mint-log.jsonl");
const STATE_FILE = process.env.AUDIT_STATE || path.join(__dirname, "state.json");
const REPORT_FILE = path.join(OUT_DIR, "AUDIT-REPORT.md");
const TOOLS_FILE = path.join(OUT_DIR, "CANDIDATE_TOOLS.md");

const DEFAULT_MIN_SCORE = 30; // matches the screener's default minScore
const REPLACE_WIN_RATE = 0.4;
const REPLACE_MIN_MINTS = 50;
const BUMP_TRIGGER_LOSSES = 3;
const BUMP_AMOUNT = 5;

const args = process.argv.slice(2);
const MODE = args.includes("--live") ? "live" : "dry"; // --dry is the default
const SKIP_GITHUB = args.includes("--skip-github") || process.env.AUDIT_SKIP_GITHUB === "1";

if (args.includes("--help") || args.includes("-h")) {
  console.log(`efficiency-audit — 24h audit for NFT_WATCHDOG_CHAD_V2
Usage: node audit.mjs [--dry] [--live] [--skip-github] [--help]

  --dry          (default) Read-only analysis. Writes AUDIT-REPORT.md and
                 CANDIDATE_TOOLS.md only. NEVER creates or mutates state.json.
  --live         Applies chain-minScore +5 bumps and persists the log cursor
                 to state.json. Only use when the scheduler owner has approved
                 state mutation.
  --skip-github  Skip the GitHub discovery job (offline/test runs).

Rules applied (--live only for state mutation):
  - RPC win rate <40% over >=50 mints -> flagged REPLACE in the report.
  - 3 consecutive negative-ROI mints on a chain -> chainMinScore +5.
  - minScore is NEVER lowered automatically.`);
  process.exit(0);
}

const runTs = new Date().toISOString();
const usd = (n) => `$${Number(n).toFixed(4)}`;
const esc = (s) => String(s ?? "").replace(/\|/g, "\\|");

// ---------- tiny helpers ----------
function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}
function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}
function median(nums) {
  const s = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// =====================================================================
// JOB 1 — GitHub tool discovery (keyless public search API)
// =====================================================================
const GITHUB_SEARCHES = [
  { label: "topic:nft-mint-bot", q: "topic:nft-mint-bot" },
  { label: "topic:nft-bot", q: "topic:nft-bot" },
  { label: "nft mint bot (name/description)", q: "nft mint bot in:name,description" },
];

async function githubSearch(q, pushedSince) {
  const url =
    "https://api.github.com/search/repositories" +
    `?q=${encodeURIComponent(q)}+pushed:>${pushedSince}` +
    `&sort=stars&order=desc&per_page=10`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "NFT-WATCHDOG-CHAD/1.0 efficiency-audit (keyless discovery)",
        Accept: "application/vnd.github+json",
      },
    });
    const remaining = res.headers.get("x-ratelimit-remaining");
    const reset = res.headers.get("x-ratelimit-reset");
    if (res.status === 403 || res.status === 429) {
      const resetAt = reset ? new Date(Number(reset) * 1000).toISOString() : "unknown";
      return {
        ok: false,
        degraded: true,
        reason: `GitHub API rate limit hit (HTTP ${res.status}; resets ${resetAt})`,
      };
    }
    if (!res.ok) {
      return { ok: false, degraded: true, reason: `GitHub API HTTP ${res.status} (remaining: ${remaining ?? "?"})` };
    }
    const data = await res.json();
    return { ok: true, items: Array.isArray(data.items) ? data.items : [] };
  } catch (e) {
    return { ok: false, degraded: true, reason: `Network error: ${e.message}` };
  } finally {
    clearTimeout(timer);
  }
}

function relevanceNote(repo) {
  // One honest line derived ONLY from the repo's own fields. No invented claims.
  const blob = `${repo.name} ${repo.description || ""} ${(repo.topics || []).join(" ")}`.toLowerCase();
  const desc = repo.description ? repo.description.trim().slice(0, 140) : "no description";
  let why = "general NFT tooling — verify it actually supports free-mint flows before trusting it";
  if (/sniper/.test(blob)) why = "markets itself as a mint sniper — audit whether its strategy fits free-mint sniping, not paid FOMO buys";
  else if (/monitor|watch|alert|notif/.test(blob)) why = "drop/mint monitoring utility — potential detection-stage upgrade for the watchdog";
  else if (/mint.*bot|bot.*mint/.test(blob)) why = "automated minting bot — evaluate its gas strategy and safety caps against our hard rules";
  else if (/\bmint\b/.test(blob)) why = "mentions minting — check it handles free/whitelisted mints and RPC failover";
  else if (/flipper|flip|profit/.test(blob)) why = "flip-oriented tooling — may have resale/ROI logic worth borrowing";
  return `${desc}. Relevance for free-mint sniper: ${why}.`;
}

async function jobGitHubDiscovery() {
  const pushedSince = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const seen = new Map();
  let degradedReason = null;
  let queriesRun = 0;

  for (const s of GITHUB_SEARCHES) {
    const r = await githubSearch(s.q, pushedSince);
    queriesRun++;
    if (!r.ok) {
      degradedReason = r.reason;
      break; // stop hammering the API once we're degraded
    }
    for (const item of r.items) {
      if (!seen.has(item.full_name)) {
        seen.set(item.full_name, {
          repo: item.full_name,
          url: item.html_url,
          stars: item.stargazers_count ?? 0,
          pushed: (item.pushed_at || "").slice(0, 10),
          language: item.language || "—",
          note: relevanceNote(item),
        });
      }
    }
    await sleep(2000); // stay far under the 10 req/min unauthenticated search limit
  }

  const candidates = [...seen.values()]
    .sort((a, b) => b.stars - a.stars)
    .slice(0, 15);

  const degraded = degradedReason !== null;
  const lines = [
    `# Candidate tools — GitHub discovery`,
    ``,
    `Run: ${runTs}`,
    `Queries (${queriesRun} executed, pushed since ${pushedSince}, sorted by stars):`,
    ...GITHUB_SEARCHES.map((s) => `- ${s.label}`),
    ``,
    degraded
      ? `> STATUS: DEGRADED — ${degradedReason}. No data is fabricated below; results shown are only repos fetched successfully this run.`
      : `> STATUS: OK — all queries completed. No API key used.`,
    ``,
  ];
  if (candidates.length) {
    lines.push(`| Repo | Stars | Last push | Relevance for free-mint sniper |`);
    lines.push(`| --- | --- | --- | --- |`);
    for (const c of candidates) {
      lines.push(`| [${c.repo}](${c.url}) | ${c.stars} | ${c.pushed} | ${esc(c.note)} |`);
    }
  } else {
    lines.push(degraded ? `No repos fetched this run.` : `No repos matched the queries this run.`);
  }
  lines.push(``);
  writeFile(TOOLS_FILE, lines.join("\n"));
  return { degraded, degradedReason, candidates: candidates.length, pushedSince };
}

// =====================================================================
// JOBS 2+3 — mint-log analysis (RPC performance + chain ROI)
// =====================================================================
function readMintLog(file) {
  if (!fs.existsSync(file)) return { lines: [], missing: true, malformed: 0 };
  const raw = fs.readFileSync(file, "utf8").split("\n");
  const lines = [];
  let malformed = 0;
  for (const row of raw) {
    const t = row.trim();
    if (!t) continue;
    try {
      lines.push(JSON.parse(t));
    } catch {
      malformed++;
    }
  }
  return { lines, missing: false, malformed };
}

function analyzeLog(lines, cursorTs) {
  // chronological order; skip already-processed lines (incremental cursor)
  const sorted = [...lines].sort((a, b) => {
    const ta = new Date(a.ts).getTime();
    const tb = new Date(b.ts).getTime();
    if (Number.isFinite(ta) && Number.isFinite(tb)) return ta - tb;
    return String(a.ts).localeCompare(String(b.ts));
  });
  const fresh = sorted.filter((l) => {
    if (cursorTs == null) return true;
    const t = new Date(l.ts).getTime();
    if (!Number.isFinite(t)) return true; // unparseable ts: process once, don't advance cursor past it
    const c = new Date(cursorTs).getTime();
    return t > c;
  });

  const rpcs = new Map(); // rpcName -> {uses, wins, latencies[]}
  const chains = new Map(); // chain -> {mints, proceeds, gas, nets[] (chronological)}
  let newCursor = cursorTs;

  for (const l of fresh) {
    const rpc = String(l.rpcUsed ?? "unknown");
    const r = rpcs.get(rpc) || { uses: 0, wins: 0, latencies: [] };
    r.uses++;
    if (l.rpcWon === true || l.rpcWon === 1 || String(l.rpcWon).toLowerCase() === "true") r.wins++;
    if (Number.isFinite(Number(l.latencyMs))) r.latencies.push(Number(l.latencyMs));
    rpcs.set(rpc, r);

    const chain = String(l.chain ?? "unknown");
    const c = chains.get(chain) || { mints: 0, proceeds: 0, gas: 0, nets: [] };
    const proceeds = Number(l.proceedsUsd) || 0;
    const gas = Number(l.gasCostUsd) || 0;
    c.mints++;
    c.proceeds += proceeds;
    c.gas += gas;
    c.nets.push(proceeds - gas);
    chains.set(chain, c);

    const t = new Date(l.ts).getTime();
    if (Number.isFinite(t)) {
      const ct = newCursor == null ? -Infinity : new Date(newCursor).getTime();
      if (t > ct) newCursor = l.ts;
    }
  }

  const rpcRows = [...rpcs.entries()].map(([name, r]) => {
    const winRate = r.uses ? r.wins / r.uses : 0;
    let verdict = "OK";
    if (r.uses >= REPLACE_MIN_MINTS && winRate < REPLACE_WIN_RATE) verdict = "REPLACE";
    else if (r.uses < REPLACE_MIN_MINTS && winRate < REPLACE_WIN_RATE && r.uses > 0) verdict = "WATCH (low volume)";
    return { name, uses: r.uses, wins: r.wins, winRate, medianLatency: median(r.latencies), verdict };
  }).sort((a, b) => b.uses - a.uses);

  const chainRows = [...chains.entries()].map(([name, c]) => ({
    name,
    mints: c.mints,
    proceeds: c.proceeds,
    gas: c.gas,
    net: c.proceeds - c.gas,
    nets: c.nets,
  })).sort((a, b) => a.net - b.net);

  return { rpcRows, chainRows, freshCount: fresh.length, newCursor };
}

function applyChainRules(chainRows, state) {
  // state: { chainMinScore: {}, consecutiveLosses: {} }
  const actions = [];
  state.chainMinScore = state.chainMinScore || {};
  state.consecutiveLosses = state.consecutiveLosses || {};

  for (const c of chainRows) {
    let losses = state.consecutiveLosses[c.name] || 0;
    for (const net of c.nets) {
      if (net < 0) {
        losses++;
        if (losses >= BUMP_TRIGGER_LOSSES) {
          const before = state.chainMinScore[c.name] ?? DEFAULT_MIN_SCORE;
          const after = before + BUMP_AMOUNT; // bumps only go UP — never lower minScore
          state.chainMinScore[c.name] = after;
          losses = 0; // reset so the NEXT 3 consecutive losses trigger another bump
          actions.push(
            `Auto-bump: chain "${c.name}" minScore ${before} -> ${after} (+${BUMP_AMOUNT}) after ${BUMP_TRIGGER_LOSSES} consecutive negative-ROI mints.`
          );
        }
      } else {
        losses = 0; // a profitable (or breakeven) mint breaks the streak
      }
    }
    state.consecutiveLosses[c.name] = losses;
  }
  return actions;
}

// =====================================================================
// main
// =====================================================================
async function main() {
  // --- Job 1: GitHub ---
  let gh;
  if (SKIP_GITHUB) {
    gh = { degraded: true, degradedReason: "--skip-github set; discovery skipped", candidates: 0, pushedSince: "n/a" };
    writeFile(
      TOOLS_FILE,
      `# Candidate tools — GitHub discovery\n\nRun: ${runTs}\n\n> STATUS: SKIPPED — --skip-github flag set (offline/test run). No data fetched.\n`
    );
  } else {
    gh = await jobGitHubDiscovery();
  }

  // --- Jobs 2+3: mint log ---
  const log = readMintLog(MINT_LOG);
  let state = readJson(STATE_FILE);
  if (!state) state = { chainMinScore: {}, consecutiveLosses: {}, cursorTs: null };

  let rpcRows = [], chainRows = [], actions = [], freshCount = 0, newCursor = state.cursorTs ?? null;
  let logStatus;
  if (log.missing) {
    logStatus = `no data yet — ${MINT_LOG} does not exist (the fast-mint tool will start writing it)`;
  } else {
    const a = analyzeLog(log.lines, state.cursorTs ?? null);
    rpcRows = a.rpcRows; chainRows = a.chainRows; freshCount = a.freshCount; newCursor = a.newCursor;
    logStatus = `${log.lines.length} total lines, ${freshCount} new since cursor, ${log.malformed} malformed skipped`;
    actions = applyChainRules(chainRows, state);
  }

  // --- persistence (ONLY in --live) ---
  let stateNote;
  if (MODE === "live" && !log.missing) {
    state.cursorTs = newCursor;
    state.lastRun = runTs;
    writeFile(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
    stateNote = `state.json updated (${actions.length} bump action(s), cursor advanced)`;
  } else if (MODE === "live" && log.missing) {
    stateNote = `state.json NOT touched — no mint data to process`;
  } else {
    stateNote = `dry run — state.json NOT mutated (use --live to persist ${actions.length} bump action(s) + cursor)`;
  }

  // --- report ---
  const L = [];
  L.push(`# Efficiency Audit Report`);
  L.push(``);
  L.push(`Run: ${runTs}`);
  L.push(`Mode: --${MODE}${MODE === "dry" ? " (read-only; state.json untouched)" : " (state mutations applied)"}`);
  L.push(``);
  L.push(`## 1. Tool candidates (GitHub discovery)`);
  L.push(``);
  L.push(
    gh.degraded
      ? `Status: DEGRADED — ${gh.degradedReason}. See CANDIDATE_TOOLS.md. No data fabricated.`
      : `Status: OK — ${gh.candidates} candidate repos (pushed since ${gh.pushedSince}). Full list in CANDIDATE_TOOLS.md.`
  );
  L.push(``);
  L.push(`## 2. RPC performance (mint-log.jsonl)`);
  L.push(``);
  L.push(`Log: ${esc(MINT_LOG)} — ${logStatus}.`);
  L.push(``);
  if (rpcRows.length) {
    L.push(`| RPC | Mints | Wins | Win rate | Median latency (ms) | Verdict |`);
    L.push(`| --- | --- | --- | --- | --- | --- |`);
    for (const r of rpcRows) {
      L.push(
        `| ${esc(r.name)} | ${r.uses} | ${r.wins} | ${(r.winRate * 100).toFixed(1)}% | ${r.medianLatency == null ? "n/a" : r.medianLatency.toFixed(0)} | **${r.verdict}** |`
      );
    }
    L.push(``);
    L.push(`Rule: win rate <40% over >=50 mints => REPLACE. Low-volume underperformers (<50 mints) are WATCH, not REPLACE.`);
  } else {
    L.push(`no data yet — nothing to evaluate.`);
  }
  L.push(``);
  L.push(`## 3. Chain ROI`);
  L.push(``);
  if (chainRows.length) {
    L.push(`| Chain | Mints | Proceeds | Gas | Net ROI | Consecutive losses (persisted) |`);
    L.push(`| --- | --- | --- | --- | --- | --- |`);
    for (const c of chainRows) {
      const streak = (state.consecutiveLosses || {})[c.name] ?? 0;
      L.push(
        `| ${esc(c.name)} | ${c.mints} | ${usd(c.proceeds)} | ${usd(c.gas)} | ${usd(c.net)} | ${streak} |`
      );
    }
    L.push(``);
    L.push(`Rule: 3 consecutive negative-ROI mints => chain minScore +5 (never lowered).`);
  } else {
    L.push(`no data yet.`);
  }
  L.push(``);
  L.push(`## 4. Actions taken`);
  L.push(``);
  if (actions.length) {
    for (const a of actions) L.push(`- ${a}${MODE === "dry" ? " [dry run — NOT persisted]" : " [persisted to state.json]"}`);
  } else {
    L.push(`none.`);
  }
  L.push(``);
  L.push(`State: ${stateNote}.`);
  L.push(``);
  writeFile(REPORT_FILE, L.join("\n"));

  // --- stdout summary (scheduler logs) ---
  console.log(`[efficiency-audit] ${runTs} mode=--${MODE}`);
  console.log(`  github: ${gh.degraded ? "DEGRADED (" + gh.degradedReason + ")" : gh.candidates + " candidates"}`);
  console.log(`  mint-log: ${logStatus}`);
  for (const r of rpcRows) {
    if (r.verdict !== "OK") console.log(`  rpc "${r.name}": ${(r.winRate * 100).toFixed(1)}% over ${r.uses} -> ${r.verdict}`);
  }
  for (const a of actions) console.log(`  action: ${a}`);
  console.log(`  ${stateNote}`);
  console.log(`  wrote ${REPORT_FILE}`);
  console.log(`  wrote ${TOOLS_FILE}`);
}

main().catch((e) => {
  console.error(`[efficiency-audit] FATAL: ${e.stack || e.message}`);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * whitelist-hunter — daily DISCOVERY scanner for NFT raffles / allowlists / giveaways
 * relevant to Robinhood Chain (chain 4663) and the CCFF00 / HoodStreet ecosystem.
 *
 * HARD LINES (enforced by design — this script has no entry/registration code paths):
 *   - Alerts only. No signups, no form submissions, no wallet connections, no signatures.
 *   - No Discord multi-account automation of any kind (no DiscoBots-style grinding,
 *     no account farms, no automated messaging). Discovery reads PUBLIC pages only.
 *   - No spend, no API signups, no private keys. Degraded coverage is REPORTED, never invented.
 *
 * Sources:
 *   1. PREMINT (premint.xyz)  — public per-project pages are server-rendered HTML and
 *      parseable. There is NO public site-wide directory or public API, so discovery
 *      works off a watchlist of known project slugs (watchlist.json). Add slugs as
 *      they surface (e.g. from the 24/7 HOODSTREET Spaces watch).
 *   2. Superful (superful.xyz) — site currently UNREACHABLE (Cloudflare 521 as of
 *      2026-09-24). Probed each run; reported as degraded with a manual check URL.
 *   3. UpcomingNFT.net (upcomingnft.net) — site currently DOWN as of 2026-09-24
 *      (apex + www return a WP Engine "Site Not Configured" 404 on all probed paths).
 *      Probed each run; when it comes back, the scanner parses the public listing
 *      pages (/whitelist-free-drops/, /coming-soon-events/, /upcoming-events/) for
 *      /event/<slug>/ links and then each event page (name, chain, dates, entry URL).
 *      Parser structure was built from the last archived snapshot (2025-12-13).
 *   4. Arctic Tools            — no public raffle/allowlist directory exists. It is a
 *      multi-account automation bot (raffle/Twitter/Discord account manager), which is
 *      EXPLICITLY out of scope per the hard line above. Reported as a coverage gap.
 *
 * Usage:
 *   node hunter.mjs                 # --dry (default): read-only preview, no file writes
 *   node hunter.mjs --live          # scan + write seen.json and alerts.json
 *   node hunter.mjs --json          # machine-readable alert payload on stdout
 *   node hunter.mjs --slug foo      # check a single premint.xyz/<slug> page
 *   node hunter.mjs --watchlist ./watchlist.json --seen ./seen.json --alerts ./alerts.json
 *
 * Exit codes: 0 = scan complete (even with degraded sources), 1 = fatal error.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

// Pure helpers are exported so the alert/dedupe pipeline can be unit-tested
// without hitting the network. The scan itself only runs when executed directly.
export {
  isRelevant,
  stripHtml,
  parseRaffleTime,
  parseUpcomingEventDate,
  extractUpcomingEventLinks,
  parseUpcomingEvent,
  toAlert,
  alertId,
  RELEVANCE_KEYWORDS,
};

const HERE = dirname(fileURLToPath(import.meta.url));
const UA = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
};
const FETCH_TIMEOUT_MS = 20000;

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
};
const DRY = !flag("--live"); // --dry is the default posture
const JSON_OUT = flag("--json");
const SINGLE_SLUG = opt("--slug");
const WATCHLIST_PATH = resolve(HERE, opt("--watchlist") || "watchlist.json");
const SEEN_PATH = resolve(HERE, opt("--seen") || "seen.json");
const ALERTS_PATH = resolve(HERE, opt("--alerts") || "alerts.json");

// ---------------------------------------------------------------------------
// Relevance filter — only Robinhood Chain / CCFF00 / HoodStreet matters.
// ---------------------------------------------------------------------------
const RELEVANCE_KEYWORDS = [
  "robinhood",
  "ccff00",
  "hoodstreet",
  "hoodfolk",
  "hoodpepe",
  "chain 4663",
  "chainid 4663",
  "chainid:4663",
  "4663",
  "juice box",
  "juicebox",
  "rowdies",
  "ethernal",
  "mintabear",
  "bambooriot",
  "fomoater",
  "hoodstreetmedia",
  "hoodstreetcap",
  "ccff00club",
  "rh chain",
  "robinhood chain",
];

function isRelevant(text) {
  const t = ` ${text.toLowerCase()} `;
  return RELEVANCE_KEYWORDS.filter((k) => t.includes(k));
}

// ---------------------------------------------------------------------------
// HTTP helpers (global fetch only)
// ---------------------------------------------------------------------------
async function fetchText(url, timeoutMs = FETCH_TIMEOUT_MS) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: UA, signal: ctl.signal, redirect: "follow" });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, url: res.url };
  } catch (err) {
    return { ok: false, status: 0, text: "", url, error: err.cause?.code || err.message };
  } finally {
    clearTimeout(timer);
  }
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleOf(html) {
  const m = html.match(/<title[^>]*>([\s\S]{0,200}?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, " ").trim() : "";
}

// ---------------------------------------------------------------------------
// PREMINT scanner — parses public project pages (server-rendered HTML)
// ---------------------------------------------------------------------------
const CLOSED_MARKERS = [
  /has picked winners/i,
  /winners have been picked/i,
  /registration is closed/i,
  /this raffle has ended/i,
  /entries are closed/i,
  /this list is closed/i,
];

const REQ_SENTENCE_HINTS = [
  /hold(ing|ers)?\b/i,
  /snapshot/i,
  /follow/i,
  /retweet|repost/i,
  /like\b/i,
  /comment/i,
  /join (the )?discord/i,
  /free\b/i,
  /fcfs/i,
  /burn/i,
  /stake|staking/i,
  /wallet/i,
];

function extractField(visible, labelRe) {
  // PREMINT renders fields like "Raffle Time Sept. 25, 2025, 9:59 p.m. Official Link ..."
  const m = visible.match(labelRe);
  return m ? m[1].trim() : null;
}

function parseRaffleTime(raw) {
  if (!raw) return { raw: null, date: null };
  // e.g. "Sept. 25, 2025, 9:59 p.m."
  const m = raw.match(/([A-Za-z]+\.?)\s+(\d{1,2}),\s*(\d{4}),\s*(\d{1,2}):(\d{2})\s*([ap])\.?m\.?/i);
  if (!m) return { raw, date: null };
  const months = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
  };
  const mon = months[m[1].replace(/\./g, "").toLowerCase().slice(0, 4)];
  if (mon === undefined) return { raw, date: null };
  let hour = parseInt(m[4], 10) % 12;
  if (m[6].toLowerCase() === "p") hour += 12;
  const d = new Date(Date.UTC(parseInt(m[3], 10), mon, parseInt(m[2], 10), hour, parseInt(m[5], 10)));
  return { raw, date: d.toISOString() };
}

function extractRequirements(visible) {
  const sentences = visible.split(/(?<=[.!?])\s+/);
  const hits = [];
  for (const s of sentences) {
    if (s.length > 220) continue;
    if (REQ_SENTENCE_HINTS.some((re) => re.test(s))) {
      const clean = s.trim();
      if (clean && !hits.includes(clean)) hits.push(clean);
      if (hits.length >= 4) break;
    }
  }
  return hits;
}

async function scanPremintProject(slug) {
  const entryUrl = `https://www.premint.xyz/${slug}/`;
  const res = await fetchText(entryUrl);
  if (!res.ok) {
    return {
      ok: false,
      slug,
      entryUrl,
      note: `PREMINT page fetch failed (HTTP ${res.status}${res.error ? `: ${res.error}` : ""}) — slug may be wrong or page removed.`,
    };
  }
  const visible = stripHtml(res.text);
  const name = titleOf(res.text).replace(/\s*\|\s*PREMINT\s*$/i, "").trim() || slug;

  const raffleTimeRaw = extractField(visible, /Raffle Time\s+(.+?)\s+(?:Official Link|Verified Twitter|Verified Discord|$)/i);
  const { raw: deadlineRaw, date: deadlineISO } = parseRaffleTime(raffleTimeRaw);
  const closed = CLOSED_MARKERS.some((re) => re.test(visible));
  const status = closed ? "closed" : deadlineISO && new Date(deadlineISO) > new Date() ? "open" : "unknown";

  const project = {
    platform: "PREMINT",
    slug,
    name,
    entryUrl,
    status,
    deadline: deadlineRaw || "not stated on page",
    deadlineISO,
    supply: extractField(visible, /Total Supply\s+(.+?)\s+(?:Number of Winners|Raffle Time|$)/i),
    spots: extractField(visible, /Number of Winners\s+(.+?)\s+(?:Raffle Time|$)/i),
    officialLink: extractField(visible, /Official Link\s+(\S+)/i),
    verifiedTwitter: extractField(visible, /Verified Twitter\s+(\S+)/i),
    verifiedDiscord: extractField(visible, /Verified Discord\s+(\S+)/i),
    requirements: extractRequirements(visible),
    matchedKeywords: isRelevant(`${name} ${visible}`),
    description: visible.slice(0, 600),
  };

  project.verificationNote = [
    project.verifiedTwitter
      ? `Page shows a VERIFIED Twitter badge for @${project.verifiedTwitter} — confirm that handle's posts link back to this exact premint.xyz/${slug} URL before trusting it.`
      : "No verified Twitter badge on this page — treat as unverified until the project's official X account links to this URL.",
    project.officialLink ? `Official link listed: ${project.officialLink}.` : "No official link listed on the page.",
    "Never connect a wallet from a link in a DM or reply — navigate to premint.xyz yourself and check the URL slug matches.",
  ].join(" ");

  return { ok: true, project };
}

// ---------------------------------------------------------------------------
// Superful probe — site status only (no public API found; site currently down)
// ---------------------------------------------------------------------------
async function scanSuperful() {
  const res = await fetchText("https://superful.xyz/");
  if (res.ok) {
    return {
      platform: "Superful",
      state: "reachable",
      note: "Site is up but no public raffle directory or public API was found — raffles are per-project links. Manual discovery: https://x.com/Superful_xyz",
      manualCheckUrl: "https://x.com/Superful_xyz",
    };
  }
  return {
    platform: "Superful",
    state: "down",
    note: `superful.xyz unreachable (HTTP ${res.status}${res.error ? `: ${res.error}` : ""}) as of this run. No scan possible — retry later; X profile may announce status.`,
    manualCheckUrl: "https://x.com/Superful_xyz",
  };
}

// ---------------------------------------------------------------------------
// UpcomingNFT.net scanner — public listing pages + per-event pages
// (from the site's known structure, last archived snapshot 2025-12-13):
//   listings: /whitelist-free-drops/, /coming-soon-events/, /upcoming-events/
//   event:    /event/<slug>/  (Project's Details block: dates, prices, supply,
//             category, Twitter/Discord/Website/Whitelist links)
// Site is DOWN as of 2026-09-24; the probe below reports it and skips the parse.
// ---------------------------------------------------------------------------
const UNFT_BASE = "https://upcomingnft.net";
const UNFT_LISTINGS = [
  `${UNFT_BASE}/whitelist-free-drops/`,
  `${UNFT_BASE}/coming-soon-events/`,
  `${UNFT_BASE}/upcoming-events/`,
];
const UNFT_MAX_EVENTS = 40;
const UNFT_DELAY_MS = 1500; // rate-limit politeness between UNFT requests

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractUpcomingEventLinks(html) {
  const out = new Set();
  for (const m of html.matchAll(/href="(?:https?:\/\/(?:www\.)?upcomingnft\.net)?\/event\/([a-z0-9\-]+)\/?"/gi)) {
    out.add(m[1].toLowerCase());
  }
  return [...out];
}

// Dates look like "30 Nov 2023-04:00 am (UTC)" or "-"(TBA). Times are UTC.
function parseUpcomingEventDate(raw) {
  if (!raw || raw.trim() === "-") return { raw: null, date: null };
  const m = raw.match(/(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})(?:\s*[-–]\s*(\d{1,2}):(\d{2})\s*([ap])m\s*\(UTC\))?/i);
  if (!m) return { raw: raw.trim(), date: null };
  const months = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
  };
  const mon = months[m[2].toLowerCase().slice(0, 4)];
  if (mon === undefined) return { raw: raw.trim(), date: null };
  let hour = 0, min = 0;
  if (m[4]) {
    hour = parseInt(m[4], 10) % 12;
    if (m[6].toLowerCase() === "p") hour += 12;
    min = parseInt(m[5], 10);
  }
  const d = new Date(Date.UTC(parseInt(m[3], 10), mon, parseInt(m[1], 10), hour, min));
  return { raw: raw.trim(), date: d.toISOString() };
}

function detectChainFromPrices(visible) {
  // Prices render as "SOL: 0.05", "MATIC: 15", "ETH: 0.05" next to date/price fields.
  const m = visible.match(/(?:Pre-sale Price|Public Mint Price):\s*([A-Z]{3,5}):/i);
  return m ? m[1].toUpperCase() : null;
}

// Category is structured HTML: <p>Event Category:</p><ul><h6><li>Free Mints</li>...
function extractUpcomingCategories(html) {
  const m = html.match(/Event Category:<\/p>\s*<ul[^>]*>([\s\S]{0,500}?)(?:<\/ul>|<\/h6>|<\/div>)/i);
  if (!m) return [];
  return [...m[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((x) => stripHtml(x[1]).trim())
    .filter(Boolean);
}

function parseUpcomingEvent(slug, html) {
  const entryUrl = `${UNFT_BASE}/event/${slug}/`;
  const visible = stripHtml(html);
  const name =
    titleOf(html).replace(/\s*-\s*upcoming\s*NFT\s*$/i, "").trim() || slug;

  const closed = /Event Closed/i.test(visible);
  const categories = extractUpcomingCategories(html);
  const mintDateRaw = extractField(visible, /Public Mint Date:\s*(.+?)\s*(?:Public Mint Price|Maximum Supply|Event Category|$)/i);
  const preDateRaw = extractField(visible, /Pre-sale Date:\s*(.+?)\s*(?:Pre-sale Price|Public Mint Date|$)/i);
  const supply = extractField(visible, /Maximum Supply:\s*(.+?)\s*(?:Event Category|$)/i);
  const chain = detectChainFromPrices(visible);

  const rawDeadline = mintDateRaw && mintDateRaw !== "-" ? mintDateRaw : preDateRaw;
  const { raw: deadlineRaw, date: deadlineISO } = parseUpcomingEventDate(rawDeadline);
  const status = closed
    ? "closed"
    : categories.some((c) => /free mint|whitelist/i.test(c)) ||
      /coming soon/i.test(visible.slice(0, 300))
    ? "open"
    : "unknown";

  const requirements = [];
  if (categories.length) requirements.push(`Event category: ${categories.join(", ")}`);
  if (chain) requirements.push(`Chain: ${chain} (from price currency listed on page)`);
  if (supply) requirements.push(`Max supply: ${supply}`);
  if (/Whitelist/i.test(visible)) requirements.push("page lists a whitelist link/section");
  const price = extractField(visible, /(?:Pre-sale|Public Mint) Price:\s*([A-Z]{3,5}:[\s\d.,-]+)/i);
  if (price) requirements.push(`Price on page: ${price.trim()}`);

  const project = {
    platform: "UpcomingNFT.net",
    slug,
    name,
    entryUrl,
    status,
    deadline: deadlineRaw || "not stated on page",
    deadlineISO,
    supply: supply || null,
    chain,
    officialLink: extractField(visible, /Project's Details:[\s\S]{0,400}?Website\s+(\S+)/i),
    verifiedTwitter: null,
    verifiedDiscord: null,
    requirements: requirements.slice(0, 4),
    matchedKeywords: isRelevant(`${name} ${visible}`),
    description: visible.slice(0, 600),
  };

  project.verificationNote = [
    "upcomingnft.net is a CROWD-SUBMITTED listing directory (each event page carries a 'Report As Scam/Fraud' link — listings are unverified).",
    "Confirm the project's official X account links back to this exact upcomingnft.net/event/ URL before trusting it.",
    "Never connect a wallet from a link in a DM or reply — navigate to upcomingnft.net yourself and check the URL slug matches.",
  ].join(" ");

  return project;
}

async function scanUpcomingNft() {
  const coverage = {
    platform: "UpcomingNFT.net",
    state: "down",
    note: "",
    manualCheckUrl: "https://upcomingnft.net/",
  };

  const probe = await fetchText(`${UNFT_BASE}/`);
  if (!probe.ok) {
    coverage.state = "down";
    coverage.note =
      `upcomingnft.net unreachable (HTTP ${probe.status}${probe.error ? `: ${probe.error}` : ""}) as of this run — ` +
      `apex and www both return a WP Engine "Site Not Configured" 404 on all probed paths (/ /upcoming-drops /raffles /events). ` +
      `No scan possible; retry later. Last archived snapshot (structure used by this parser): 2025-12-13.`;
    return { coverage, projects: [] };
  }

  // Site is reachable: crawl listing pages (small delay between requests), then event pages.
  const slugs = new Set();
  for (const url of UNFT_LISTINGS) {
    await sleep(UNFT_DELAY_MS);
    const r = await fetchText(url);
    if (!r.ok) continue;
    for (const s of extractUpcomingEventLinks(r.text)) {
      slugs.add(s);
      if (slugs.size >= UNFT_MAX_EVENTS) break;
    }
    if (slugs.size >= UNFT_MAX_EVENTS) break;
  }

  if (slugs.size === 0) {
    coverage.state = "degraded";
    coverage.note =
      "Site reachable but no /event/ links parsed from listing pages — page structure may have changed since the archived snapshot. " +
      "Manual check: https://upcomingnft.net/whitelist-free-drops/";
    return { coverage, projects: [] };
  }

  const projects = [];
  for (const slug of [...slugs]) {
    await sleep(UNFT_DELAY_MS);
    const r = await fetchText(`${UNFT_BASE}/event/${slug}/`);
    if (!r.ok) continue;
    projects.push(parseUpcomingEvent(slug, r.text));
  }

  coverage.state = projects.length > 0 ? "ok" : "degraded";
  coverage.note =
    `${projects.length}/${slugs.size} event pages fetched from upcomingnft.net listing pages ` +
    `(/whitelist-free-drops/, /coming-soon-events/, /upcoming-events/). ` +
    `Listings are crowd-submitted and unverified — check each find's socials before acting.`;
  return { coverage, projects };
}

// ---------------------------------------------------------------------------
// Arctic Tools — documented gap (multi-account automation tool; out of scope)
// ---------------------------------------------------------------------------
function scanArcticTools() {
  return {
    platform: "Arctic Tools",
    state: "no-public-surface",
    note: "No public raffle/allowlist directory exists for Arctic Tools. It is a paid multi-account automation bot (raffle/Twitter/Discord account managers) — automated entry and multi-account tooling are EXPLICITLY out of scope (Discord ToS). Discovery value: none; manual check only if they ever publish a public list.",
    manualCheckUrl: "https://x.com/ArcticTools",
  };
}

// ---------------------------------------------------------------------------
// State: seen.json (dedupe) + alerts.json (new finds this run)
// ---------------------------------------------------------------------------
function loadJson(path, fallback) {
  try {
    if (!existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function alertId(project) {
  return createHash("sha256")
    .update(`${project.platform}:${project.slug || project.entryUrl}`)
    .digest("hex")
    .slice(0, 16);
}

function toAlert(project) {
  return {
    id: alertId(project),
    project: project.name,
    platform: project.platform,
    status: project.status,
    requirement:
      project.requirements.length > 0
        ? project.requirements.join(" | ")
        : "see entry page — requirements not parsed",
    deadline: project.deadline,
    deadlineISO: project.deadlineISO,
    entryUrl: project.entryUrl,
    verificationNote: project.verificationNote,
    matchedKeywords: project.matchedKeywords,
    scannedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
function humanReport({ alerts, skipped, coverage, dry }) {
  const L = [];
  const stamp = new Date().toISOString();
  L.push(`WHITELIST HUNTER — discovery scan ${stamp}${dry ? " [--dry: no files written]" : ""}`);
  L.push("=".repeat(72));
  L.push("");
  L.push("COVERAGE");
  for (const c of coverage) {
    L.push(`  [${c.state.toUpperCase().padEnd(17)}] ${c.platform}: ${c.note}`);
    if (c.manualCheckUrl) L.push(`  ${" ".repeat(23)}manual check: ${c.manualCheckUrl}`);
  }
  L.push("");
  if (alerts.length === 0) {
    L.push("NEW ALERTS: none — no new RH/CCFF00-relevant open raffles found.");
  } else {
    L.push(`NEW ALERTS (${alerts.length}):`);
    for (const a of alerts) {
      L.push("");
      L.push(`  ▸ ${a.project} [${a.platform}] — status: ${a.status}`);
      L.push(`    requirement : ${a.requirement}`);
      L.push(`    deadline    : ${a.deadline}`);
      L.push(`    entry       : ${a.entryUrl}`);
      L.push(`    verify      : ${a.verificationNote}`);
      L.push(`    keywords    : ${a.matchedKeywords.join(", ") || "none"}`);
    }
  }
  if (skipped.length > 0) {
    L.push("");
    L.push(`SCANNED BUT NOT ALERTED (${skipped.length}):`);
    for (const s of skipped) L.push(`  - ${s.name} [${s.platform}] — ${s.reason}`);
  }
  L.push("");
  L.push("Posture: alerts only. No entries, no signups, no wallet connections were made.");
  return L.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const runAt = new Date().toISOString();
  const coverage = [];
  const alerts = [];
  const skipped = [];

  // --- PREMINT: watchlist of known project slugs ---
  let slugs = SINGLE_SLUG ? [SINGLE_SLUG] : loadJson(WATCHLIST_PATH, []);
  if (!Array.isArray(slugs)) slugs = [];
  slugs = [...new Set(slugs.map((s) => String(s).trim()).filter(Boolean))];

  if (slugs.length === 0) {
    coverage.push({
      platform: "PREMINT",
      state: "watchlist-empty",
      note: "No project slugs in watchlist — nothing to scan. Add premint.xyz/<slug> slugs to watchlist.json as they surface.",
      manualCheckUrl: "https://www.premint.xyz/",
    });
  } else {
    let okCount = 0;
    for (const slug of slugs) {
      const r = await scanPremintProject(slug);
      if (!r.ok) {
        skipped.push({ name: slug, platform: "PREMINT", reason: r.note });
        continue;
      }
      okCount++;
      const p = r.project;
      if (p.status === "closed") {
        skipped.push({ name: p.name, platform: "PREMINT", reason: "raffle closed / winners picked" });
        continue;
      }
      if (p.matchedKeywords.length === 0) {
        skipped.push({ name: p.name, platform: "PREMINT", reason: "not RH/CCFF00-relevant" });
        continue;
      }
      alerts.push(toAlert(p));
    }
    coverage.push({
      platform: "PREMINT",
      state: okCount > 0 ? "ok" : "degraded",
      note: `${okCount}/${slugs.length} watchlist pages fetched. PREMINT has no public site-wide raffle directory or public API — discovery is limited to known slugs in watchlist.json.`,
      manualCheckUrl: "https://www.premint.xyz/",
    });
  }

  // --- Superful ---
  const sup = await scanSuperful();
  coverage.push(sup);

  // --- UpcomingNFT.net ---
  const unft = await scanUpcomingNft();
  coverage.push(unft.coverage);
  for (const p of unft.projects) {
    if (p.status === "closed") {
      skipped.push({ name: p.name, platform: p.platform, reason: "event closed" });
      continue;
    }
    if (p.matchedKeywords.length === 0) {
      skipped.push({ name: p.name, platform: p.platform, reason: "not RH/CCFF00-relevant" });
      continue;
    }
    alerts.push(toAlert(p));
  }

  // --- Arctic Tools ---
  coverage.push(scanArcticTools());

  // --- Dedupe against seen.json ---
  const seen = loadJson(SEEN_PATH, {});
  const newAlerts = [];
  for (const a of alerts) {
    if (!seen[a.id]) {
      seen[a.id] = { firstSeen: runAt, project: a.project, platform: a.platform };
      newAlerts.push(a);
    } else {
      seen[a.id].lastSeen = runAt;
      skipped.push({ name: a.project, platform: a.platform, reason: "already alerted (seen.json)" });
    }
  }

  const payload = { runAt, dry: DRY, coverage, alerts: newAlerts };

  if (JSON_OUT) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(humanReport({ alerts: newAlerts, skipped, coverage, dry: DRY }));
  }

  if (!DRY) {
    writeFileSync(SEEN_PATH, JSON.stringify(seen, null, 2) + "\n");
    writeFileSync(ALERTS_PATH, JSON.stringify({ runAt, alerts: newAlerts }, null, 2) + "\n");
    if (!JSON_OUT) console.log(`\n[wrote ${SEEN_PATH} and ${ALERTS_PATH}]`);
  } else if (!JSON_OUT) {
    console.log("\n[--dry: seen.json / alerts.json NOT written. Re-run with --live to persist.]");
  }
}

const RUN_DIRECTLY =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;
if (RUN_DIRECTLY) {
  main().catch((err) => {
    console.error(`FATAL: ${err.message}`);
    process.exit(1);
  });
}

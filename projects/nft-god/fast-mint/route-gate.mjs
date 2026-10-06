#!/usr/bin/env node
/**
 * route-gate.mjs — FAIL-CLOSED official-route enforcement for the claim pipeline.
 *
 * Standing rule (claim lane, per user order 2026-10-05 ~21:38 CDT): a claim may
 * proceed ONLY when the project's official route is verified — the project's
 * OWN X account, OWN site, and/or an OpenSea COLLECTION page for the project
 * (other OpenSea paths, aggregator cards, drops APIs, and explorers alone
 * NEVER count as route evidence).
 *
 * This module is the single shared gate. It is called by:
 *   - claim-with-tinfoil.sh (before the Tinfoil pre-flight scan)
 *   - fast-mint.mjs / fast-mint-fork.mjs (at startup, before exclusion/tinfoil gates)
 * so the "DIRECT fast-mint" path cannot bypass it.
 *
 * Fail-closed semantics: ABSENCE of route evidence = ABORT. No default-allow,
 * no "aggregator precedent" lane, no OpenSea-platform exception for routes
 * (the opensea-platform exception covers TINFOIL SCAN NOISE ONLY — it is not
 * an official-route exception).
 *
 * Library usage:
 *   import { checkRoute } from './route-gate.mjs';
 *   checkRoute({ nft: '0xabc...', x: '@SomeProject', site: 'https://someproject.com' });
 *   // throws Error on any failure; returns evidence object on pass
 *
 * CLI usage:
 *   node route-gate.mjs --contract <addr> [--x @handle] [--site <url>] [--slug <pipeline-slug>] [--pipeline <path>]
 *   node route-gate.mjs --record --contract <addr> --x @handle --site <url>   # record evidence into pipeline entry
 *
 * Pipeline evidence schema (per project entry, optional fields):
 *   route_verified: true|false, route_x: "@handle", route_site: "https://...",
 *   route_verified_at: "2026-10-01T12:00:00Z", route_note: "free text"
 */
import fs from 'node:fs';
import os from 'node:os';

const DEFAULT_PIPELINE = os.homedir() + '/workspace/goals/robinhood-chain-free-mint-watch/hidden_files/ccff00-wl-pipeline.json';

// Hosts that are aggregators/marketplaces/explorers — NEVER project-owned route evidence.
const AGGREGATOR_HOSTS = new Set([
  'opensea.io', 'blur.io', 'magiceden.io', 'magiceden.us', 'looksrare.org',
  'x2y2.io', 'element.market', 'tofunft.com', 'rarible.com', 'nftx.io',
  'neverfuckingtrade.com', 'cdn.neverfuckingtrade.com', 'hyvebox.app',
  'mint.fun', 'zora.co', 'manifold.xyz', 'blockscout.com', 'etherscan.io',
  'basescan.org', 'polygonscan.com', 'arbiscan.io', 'optimistic.etherscan.io',
  'blastscan.io', 'discord.com', 'discord.gg', 'github.com',
]);
// X handles that are aggregator/platform accounts, not project accounts.
const AGGREGATOR_HANDLES = new Set([
  '@opensea', '@blur', '@magiceden', '@looksrare', '@x2y2', '@rarible',
  '@hyvebox', '@neverfuckingtrade', '@mintdotfun', '@zora',
]);

function normHost(u) {
  try {
    const h = new URL(u).hostname.toLowerCase().replace(/^www\./, '');
    return h;
  } catch { return null; }
}
function normHandle(h) {
  if (!h) return null;
  h = String(h).trim();
  if (!h.startsWith('@')) h = '@' + h;
  return h;
}

function validateX(handle) {
  const h = normHandle(handle);
  if (!/^@[A-Za-z0-9_]{1,15}$/.test(h)) throw new Error(`route X handle "${handle}" is not a valid X handle`);
  if (AGGREGATOR_HANDLES.has(h.toLowerCase())) throw new Error(`route X handle ${h} is an aggregator/platform account — not project-owned route evidence`);
  return h;
}
function validateSite(url) {
  const host = normHost(url);
  if (!host) throw new Error(`route site "${url}" is not a parseable URL`);
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol)) throw new Error(`route site "${url}" must be http(s)`);
  // Standing user order 2026-10-05 ~21:38 CDT: an OpenSea COLLECTION page is
  // project-controlled route evidence (it names the project's collection).
  // All other opensea.io paths (assets, drops, activity, account pages) and
  // every other aggregator host are still rejected as route evidence.
  if (host === 'opensea.io' && /^\/collection\/[^/]+\/?$/.test(u.pathname)) return u.toString();
  if (AGGREGATOR_HOSTS.has(host)) throw new Error(`route site host ${host} is an aggregator/marketplace/explorer — not project-owned route evidence`);
  return u.toString();
}

function findEntry(pipelinePath, { nft, slug }) {
  let d;
  try { d = JSON.parse(fs.readFileSync(pipelinePath, 'utf8')); }
  catch (e) { throw new Error(`pipeline unreadable at ${pipelinePath}: ${e.message}`); }
  const list = d.projects || d;
  if (!Array.isArray(list)) throw new Error('pipeline has no projects array');
  const want = (nft || '').toLowerCase();
  return list.find(p => (want && String(p.contract || '').toLowerCase() === want) || (slug && p.name === slug)) || null;
}

/**
 * Fail-closed route check. Throws on ANY failure. Returns {x, site, sources}.
 */
export function checkRoute({ nft, x, site, slug, pipelinePath = DEFAULT_PIPELINE } = {}) {
  const sources = [];
  let entry = null;
  try { entry = findEntry(pipelinePath, { nft, slug }); }
  catch (e) { throw new Error(`route gate cannot read pipeline — failing closed: ${e.message}`); }

  let rx = x ? normHandle(x) : null;
  let rs = site || null;
  if (x || site) sources.push('cli-flags');
  if (entry) {
    if (entry.route_x && !rx) { rx = normHandle(entry.route_x); sources.push('pipeline:route_x'); }
    if (entry.route_site && !rs) { rs = entry.route_site; sources.push('pipeline:route_site'); }
    if (entry.route_verified === false) throw new Error(`pipeline entry "${entry.name}" explicitly marks route as UNVERIFIED — claim refused (fail-closed)`);
  }

  if (!rx && !rs) {
    throw new Error(
      `no official route evidence for ${nft || slug || '(unknown)'} — claim refused (fail-closed). ` +
      `Record the project's official X handle and/or official site (route_x/route_site, route_verified:true) ` +
      `in the pipeline entry, or pass --route-x @handle / --route-site https://.... ` +
      `Per user order 2026-10-05 ~21:38 CDT an OpenSea /collection/<slug> page ` +
      `also counts as route evidence; OpenSea asset/drops pages, radar cards, ` +
      `and explorers alone are NEVER sufficient.`
    );
  }
  if (rx) rx = validateX(rx);
  if (rs) rs = validateSite(rs);
  return { x: rx, site: rs, sources, entryName: entry ? entry.name : null };
}

/** Record route evidence into a pipeline entry (worker tool). Fail-closed on write errors. */
export function recordRoute({ nft, slug, x, site, note, pipelinePath = DEFAULT_PIPELINE }) {
  if (!x && !site) throw new Error('--record needs at least one of --x / --site');
  const rx = x ? validateX(x) : null;
  const rs = site ? validateSite(site) : null;
  let raw;
  try { raw = fs.readFileSync(pipelinePath, 'utf8'); }
  catch (e) { throw new Error(`pipeline unreadable: ${e.message}`); }
  const d = JSON.parse(raw);
  const list = d.projects;
  if (!Array.isArray(list)) throw new Error('pipeline has no projects array');
  const want = (nft || '').toLowerCase();
  const entry = list.find(p => (want && String(p.contract || '').toLowerCase() === want) || (slug && p.name === slug));
  if (!entry) throw new Error(`no pipeline entry for ${nft || slug}`);
  const backup = pipelinePath + '.route-gate.bak';
  fs.writeFileSync(backup, raw);
  entry.route_verified = true;
  if (rx) entry.route_x = rx;
  if (rs) entry.route_site = rs;
  entry.route_verified_at = new Date().toISOString();
  if (note) entry.route_note = note;
  entry.last_updated = entry.route_verified_at;
  fs.writeFileSync(pipelinePath, JSON.stringify(d, null, 2));
  return { name: entry.name, x: rx, site: rs, backup };
}

// ---------------------------------------------------------------- CLI
function cliArgs(argv) {
  const a = { contract: null, x: null, site: null, slug: null, pipeline: DEFAULT_PIPELINE, record: false, note: null };
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--contract') a.contract = argv[++i];
    else if (t === '--x') a.x = argv[++i];
    else if (t === '--site') a.site = argv[++i];
    else if (t === '--slug') a.slug = argv[++i];
    else if (t === '--pipeline') a.pipeline = argv[++i];
    else if (t === '--record') a.record = true;
    else if (t === '--note') a.note = argv[++i];
    else if (t === '--help' || t === '-h') { console.log('usage: route-gate.mjs --contract <addr> [--x @h] [--site url] [--slug s] [--pipeline p] [--record] [--note t]'); process.exit(0); }
    else { console.error(`unknown flag ${t}`); process.exit(2); }
  }
  return a;
}
if (process.argv[1] && /route-gate\.mjs$/.test(process.argv[1])) {
  const a = cliArgs(process.argv);
  try {
    if (a.record) {
      const r = recordRoute({ nft: a.contract, slug: a.slug, x: a.x, site: a.site, note: a.note, pipelinePath: a.pipeline });
      console.log(`[ROUTE] recorded: ${r.name} x=${r.x || '-'} site=${r.site || '-'} (backup ${r.backup})`);
    } else {
      const ev = checkRoute({ nft: a.contract, x: a.x, site: a.site, slug: a.slug, pipelinePath: a.pipeline });
      console.log(`[ROUTE] PASS: official route verified for ${a.contract || a.slug} (x=${ev.x || '-'} site=${ev.site || '-'} via ${ev.sources.join(', ')})`);
    }
  } catch (e) {
    console.error(`[ROUTE] FAIL: ${e.message}`);
    process.exit(1);
  }
}

#!/usr/bin/env node
/*
 * TINFOIL SCAN — CLI
 * Foil's free wallet-drainer checker. "verify before you believe."
 *
 *   node scan-url.mjs <url> [--json] [--max-scripts N] [--timeout MS]
 *
 * Read-only: fetches the page HTML + its scripts over plain HTTPS and runs the
 * detection engine locally. Never connects a wallet, never signs, never posts.
 *
 * Exit codes (for pipeline gating):
 *   0 = CLEAN        1 = SUSPICIOUS        2 = DANGEROUS        3 = scan error
 *
 * Mint-watch integration:
 *   node ~/workspace/nft-god/drainer-scan/scan-url.mjs <mint-site-url> --json \
 *     | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const r=JSON.parse(d);process.exit(r.verdict==='DANGEROUS'?2:r.verdict==='SUSPICIOUS'?1:0)})"
 *   Gate: refuse to pre-stage a claim when verdict is DANGEROUS (exit 2).
 *   Treat SUSPICIOUS as "human review required" — never auto-claim on it.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { scanPage, VERSION } from './tinfoil-scan.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const signatures = JSON.parse(readFileSync(join(__dirname, 'signatures.json'), 'utf8'));

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--'));
const asJson = args.includes('--json');
const maxScripts = parseInt((args.find((a) => a.startsWith('--max-scripts=')) || '').split('=')[1] || '25', 10);
const timeoutMs = parseInt((args.find((a) => a.startsWith('--timeout=')) || '').split('=')[1] || '20000', 10);

if (!url || !/^https?:\/\//i.test(url)) {
  console.error('usage: node scan-url.mjs <https-url> [--json] [--max-scripts=N] [--timeout=MS]');
  process.exit(3);
}

const UA = `TinfoilScan/${VERSION} (read-only security scanner; +https://x.com/Foil667)`;

async function fetchText(target, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(target, { headers: { 'user-agent': UA }, signal: ctl.signal, redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const text = await res.text();
    return { text: text.slice(0, 2_000_000), contentType: ct };
  } finally {
    clearTimeout(t);
  }
}

function extractScriptUrls(html, base) {
  const urls = [];
  const re = /<script[^>]+src\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html)) && urls.length < maxScripts) {
    try {
      const u = new URL(m[1], base).href;
      if (/^https?:/.test(u) && !urls.includes(u)) urls.push(u);
    } catch { /* skip bad URLs */ }
  }
  return urls;
}

async function main() {
  let html;
  try {
    ({ text: html } = await fetchText(url, timeoutMs));
  } catch (e) {
    if (!asJson) {
      console.error(`\n  TINFOIL SCAN could not fetch the page: ${e.message}`);
      console.error('  The site may block bots, require JS rendering, or be down.');
      console.error('  Treat an unfetchable mint page as SUSPICIOUS until reviewed in a browser.\n');
    } else {
      console.log(JSON.stringify({ verdict: 'ERROR', score: 0, findings: [], error: String(e.message || e) }));
    }
    process.exit(3);
  }

  const scriptUrls = extractScriptUrls(html, url);
  const scripts = await Promise.all(scriptUrls.map(async (su) => {
    try {
      const { text, contentType } = await fetchText(su, timeoutMs);
      if (!/javascript|ecmascript/.test(contentType) && !/\.js(\?|$)/i.test(su)) return { url: su, content: null };
      return { url: su, content: text.slice(0, 1_000_000) };
    } catch {
      return { url: su, content: null }; // URL heuristics still apply
    }
  }));

  const report = scanPage({ url, html, scripts }, signatures);

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printDossier(report);
  }
  process.exit(report.verdict === 'DANGEROUS' ? 2 : report.verdict === 'SUSPICIOUS' ? 1 : 0);
}

const SEV_TAG = { critical: '!!', high: '>>', medium: '--', low: '..', info: 'ii' };

function stamp(verdict) {
  const line = '═'.repeat(46);
  const label = `  ${verdict}  `;
  if (verdict === 'DANGEROUS') return `\x1b[41m\x1b[37m${line}\n${label}\n${line}\x1b[0m`;
  if (verdict === 'SUSPICIOUS') return `\x1b[43m\x1b[30m${line}\n${label}\n${line}\x1b[0m`;
  return `\x1b[42m\x1b[30m${line}\n${label}\n${line}\x1b[0m`;
}

function printDossier(r) {
  console.log('\n  ┌─ TINFOIL SCAN ──────────────────────────────');
  console.log(`  │  "verify before you believe." — Foil #667`);
  console.log(`  │  target : ${r.meta.url}`);
  console.log(`  │  host   : ${r.meta.host || '(unparseable)'}`);
  console.log(`  │  engine : ${r.meta.engine} · sigs v${r.meta.sigVersion}`);
  console.log(`  │  scripts: ${r.meta.scriptsFetched}/${r.meta.scriptsListed} bodies fetched`);
  console.log(`  │  score  : ${r.score}/100`);
  console.log('  └─────────────────────────────────────────────\n');
  console.log(stamp(r.verdict) + '\n');

  if (!r.findings.length) {
    console.log('  No findings. Page looks clean to this scanner —');
    console.log('  which is a data point, not a guarantee. Stay paranoid.\n');
    return;
  }
  for (const f of r.findings) {
    console.log(`  [${SEV_TAG[f.severity] || '??'}] [${f.severity.toUpperCase()}] ${f.title}`);
    console.log(`       ${f.detail}`);
    if (f.evidence) console.log(`       ↳ ${f.evidence}`);
    console.log('');
  }
  if (r.verdict === 'DANGEROUS') {
    console.log('  ⛔ DO NOT CONNECT A WALLET. DO NOT SIGN ANYTHING. Walk away.\n');
  } else if (r.verdict === 'SUSPICIOUS') {
    console.log('  ⚠️  Review every finding above before any wallet interaction.\n');
  }
}

main().catch((e) => { console.error('scan failed:', e.message || e); process.exit(3); });

#!/usr/bin/env node
/**
 * NFT Watchdog Screener — Robinhood Chain (chain ID 4663), free-mint hunter.
 *
 * STRICTLY READ-ONLY. This script:
 *   - makes no signatures, submits no transactions, spends nothing
 *   - never touches private keys, the CCFF00 square contract, or any wallet
 *   - uses only public read APIs (Robinhood public RPC, Sourcify; no signups/keys)
 *
 * Signals:
 *   1. upcoming drops hours early — OpenSea drops API (DEGRADED: now key-gated, 401)
 *   2. live mints ~5 min          — onchain Transfer-from-0x0 events in recent blocks
 *   3. new collections            — first-seen tracking in seen.json (< 24h = new)
 *
 * Scoring (0-100, like a trading screener):
 *   unique minters        30%   — min(unique,200)/200
 *   mint velocity         20%   — min(mints/hour,600)/600
 *   collection age        15%   — fresher is hotter; 1 - min(ageH,72)/72
 *   verified/socials      15%   — onchain name()+symbol() readable.
 *                                 (Source verification unavailable: Blockscout API is
 *                                 Cloudflare-gated and Sourcify has no 4663 endpoint.
 *                                 Documented, not faked.)
 *   free-mint confidence  20%   — MY CHOICE (see README): SeaDrop price==0 && live = 1.0,
 *                                 price==0 but not live = 0.6, direct mint (no SeaDrop
 *                                 data) = 0.3, price > 0 = 0.0
 *
 * Risk veto: if a single whale holds >=50% of window-minted supply, score x 0.45.
 *
 * Usage:
 *   node screener.mjs [--dry] [--json] [--min-score N] [--blocks N] [--min-mints N]
 *
 * Flags:
 *   --dry        default safe mode banner (script has no signing/spend paths anyway)
 *   --json       print the alert payload as JSON to stdout
 *   --min-score  minimum score to include (default 30)
 *   --blocks     recent blocks to scan for mints (default 3000 ~= 5 min @ ~100ms/block)
 *   --min-mints  minimum mints in window to become a candidate (default 3)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SEEN_PATH = path.join(DIR, 'seen.json');
const ALERTS_PATH = path.join(DIR, 'alerts.json');

const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const CHAIN_ID = 4663;
const SEADROP = '0x00005EA00Ac477B1030CE78506496e8C2dE24bf5';
const BLOCKSCOUT = 'https://robinhoodchain.blockscout.com';
const OS_DROPS_API = 'https://api.opensea.io/api/v2/drops?chain=robinhood';

const TRANSFER_TOPIC0 = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const ZERO_TOPIC = '0x' + '0'.repeat(64);
const ZERO_ADDR = '0x' + '0'.repeat(40);

// Protected: never candidates (no write paths exist anyway — belt and suspenders).
const PROTECTED_CONTRACTS = new Set([
  // CCFF00 square contract address: not recorded in the workspace; screener is
  // 100% read-only so it cannot interact with it regardless. Add it here if it
  // becomes known — it will be excluded from candidacy.
].map(a => a.toLowerCase()));

// eth_call selectors
const SEL_SUPPORTS_INTERFACE = '0x01ffc9a7'; // supportsInterface(bytes4) — arg padded below
const SEL_NAME = '0x06fdde03';               // name()
const SEL_SYMBOL = '0x95d89b41';             // symbol()
const SEL_GET_PUBLIC_DROP = '0xbc6a629c';    // getPublicDrop(address) -> (price,start,end,maxSupply,minMint,maxMint)
const SEL_ALLOWLIST_ROOT = '0x32bf11f5';      // allowlistMerkleRoot(address)
const IFACE_ERC721 = '80ac58cd';
const IFACE_ERC1155 = 'd9b67a26';

const encAddr = a => a.toLowerCase().replace(/^0x/, '').padStart(64, '0');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const topicToAddr = t => '0x' + t.slice(-40).toLowerCase();

function parseArgs() {
  const a = process.argv.slice(2);
  const o = { json: false, minScore: 30, blocks: 3000, minMints: 3, dry: a.includes('--dry') };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--json') o.json = true;
    if (a[i] === '--min-score') o.minScore = Number(a[++i]);
    if (a[i] === '--blocks') o.blocks = Number(a[++i]);
    if (a[i] === '--min-mints') o.minMints = Number(a[++i]);
  }
  return o;
}

async function rpc(method, params, retries = 3) {
  let last;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
        body: JSON.stringify({ jsonrpc: '2.0', id: Date.now() + i, method, params }),
        signal: AbortSignal.timeout(25000),
      });
      const d = await res.json();
      if (d.error) throw new Error(`RPC ${method}: ${JSON.stringify(d.error).slice(0, 200)}`);
      return d.result;
    } catch (e) { last = e; await sleep(400 * (i + 1)); }
  }
  throw last;
}

const call = (to, data, block = 'latest') =>
  rpc('eth_call', [{ to, data }, block]);

function decodeString(hex) {
  try {
    const len = Number(BigInt('0x' + hex.slice(2 + 64, 2 + 128)));
    return Buffer.from(hex.slice(2 + 128, 2 + 128 + len * 2), 'hex').toString('utf8').replace(/\0/g, '').trim() || null;
  } catch { return null; }
}

async function detectInterface(addr) {
  // IMPORTANT: the bytes4 argument must be zero-padded to 32 bytes.
  // An unpadded call (0x01ffc9a7 + 8 hex chars) is malformed and most
  // contracts answer 0/revert — that bug silently filtered out real NFTs.
  const data = iface => SEL_SUPPORTS_INTERFACE + iface + '0'.repeat(56);
  for (const [iface, std] of [[IFACE_ERC721, 'ERC721'], [IFACE_ERC1155, 'ERC1155']]) {
    try {
      const r = await call(addr, data(iface));
      if (r && r.length >= 66 && BigInt('0x' + r.slice(2, 66)) === 1n) return std;
    } catch { /* revert -> not this interface */ }
  }
  return null;
}

async function getNameSymbol(addr) {
  let name = null, symbol = null;
  try { name = decodeString(await call(addr, SEL_NAME)); } catch {}
  try { symbol = decodeString(await call(addr, SEL_SYMBOL)); } catch {}
  return { name, symbol };
}

async function getSeaDrop(addr) {
  // -> {priceWei, start, end, maxSupply, allowlist} | null (null = not a SeaDrop drop)
  try {
    const r = await call(SEADROP, SEL_GET_PUBLIC_DROP + encAddr(addr));
    if (!r || r.length < 2 + 64 * 6) return null;
    const w = [];
    for (let i = 0; i < 6; i++) w.push(BigInt('0x' + r.slice(2 + i * 64, 2 + (i + 1) * 64)));
    if (w.every(x => x === 0n)) return null; // all-zero tuple, no revert = not configured
    let allowlist = false;
    try {
      const mr = await call(SEADROP, SEL_ALLOWLIST_ROOT + encAddr(addr));
      allowlist = mr.slice(2, 66).replace(/0/g, '') !== '';
    } catch {}
    return { priceWei: w[0], start: Number(w[1]), end: Number(w[2]), maxSupply: w[3].toString(), allowlist };
  } catch { return null; }
}

async function checkDropsApi() {
  // Signal 1 source: OpenSea drops API. Returns {ok, note}.
  try {
    const r = await fetch(OS_DROPS_API, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d && !d.errors) return { ok: true, note: 'live' };
    return { ok: false, note: `HTTP ${r.status}: ${JSON.stringify(d).slice(0, 120)}` };
  } catch (e) {
    return { ok: false, note: String(e.message || e).slice(0, 120) };
  }
}

async function getLogsChunked(fromBlock, toBlock, topics) {
  const CHUNK = 500;
  const all = [];
  for (let start = fromBlock; start <= toBlock; start += CHUNK) {
    const end = Math.min(start + CHUNK - 1, toBlock);
    const logs = await rpc('eth_getLogs', [{
      fromBlock: '0x' + start.toString(16),
      toBlock: '0x' + end.toString(16),
      topics,
    }]);
    if (Array.isArray(logs)) all.push(...logs);
    if (start + CHUNK <= toBlock) await sleep(120);
  }
  const seenK = new Set();
  return all.filter(l => {
    const k = (l.blockNumber || '') + ':' + (l.logIndex || '');
    if (seenK.has(k)) return false;
    seenK.add(k); return true;
  });
}

function loadSeen() { try { return JSON.parse(fs.readFileSync(SEEN_PATH, 'utf8')); } catch { return {}; } }
function saveSeen(s) { fs.writeFileSync(SEEN_PATH, JSON.stringify(s, null, 2)); }

function weiToEth(w) {
  const s = w.toString().padStart(19, '0');
  return (s.slice(0, -18) + '.' + s.slice(-18)).replace(/\.?0+$/, '') || '0';
}

(async () => {
  const opts = parseArgs();
  const nowSec = Math.floor(Date.now() / 1000);
  const coverage = [];

  if (opts.dry) {
    console.log('== DRY MODE: read-only. No signing, no transactions, no spend, no private keys used. ==\n');
  }

  // --- Signal 1: OpenSea drops API availability ---
  const dropsApi = await checkDropsApi();
  if (!dropsApi.ok) {
    coverage.push(`DEGRADED: OpenSea drops API unavailable (${dropsApi.note}). ` +
      `Signal 1 (upcoming drops, hours early) and the drops-API legs of signals 2/3 are offline. ` +
      `Onchain legs below still work; no scores are fabricated for missing data.`);
  } else {
    coverage.push('OK: OpenSea drops API reachable.');
  }
  coverage.push('DEGRADED: contract source-verification unavailable (Sourcify 404s for chain 4663; ' +
    'Blockscout API is Cloudflare-gated). Legitimacy is scored on onchain name()/symbol() only.');

  // --- Signals 2+3: onchain mint scan ---
  const latest = parseInt(await rpc('eth_blockNumber', []), 16);
  const fromBlock = latest - opts.blocks;
  const [blkFrom, blkTo] = await Promise.all([
    rpc('eth_getBlockByNumber', ['0x' + fromBlock.toString(16), false]),
    rpc('eth_getBlockByNumber', ['0x' + latest.toString(16), false]),
  ]);
  const windowSec = Math.max(1, parseInt(blkTo.timestamp, 16) - parseInt(blkFrom.timestamp, 16));

  const logs = await getLogsChunked(fromBlock, latest, [TRANSFER_TOPIC0, ZERO_TOPIC]);
  coverage.push(`OK: eth_getLogs scanned blocks ${fromBlock}..${latest} (${opts.blocks} blocks, ~${Math.round(windowSec / 60)} min window), ` +
    `${logs.length} mint Transfer events from 0x0.`);

  const byContract = new Map();
  for (const l of logs) {
    const addr = l.address.toLowerCase();
    if (PROTECTED_CONTRACTS.has(addr)) continue;
    if (!byContract.has(addr)) byContract.set(addr, []);
    byContract.get(addr).push(l);
  }

  const seen = loadSeen();
  const candidates = [];

  for (const [addr, mints] of byContract) {
    if (mints.length < opts.minMints) continue;

    const std = await detectInterface(addr);
    if (!std) { coverage.push(`skip ${addr}: not ERC-721/1155 (likely ERC-20 or nonstandard)`); continue; }

    const { name, symbol } = await getNameSymbol(addr);
    const drop = await getSeaDrop(addr);
    // NOTE: contract source-verification is unavailable: Sourcify has no usable
    // endpoint for chain 4663 (404) and the Blockscout API is Cloudflare-gated.
    // Legitimacy is therefore scored on onchain name()/symbol() readability only
    // (documented in README — never faked).

    const minters = new Set(mints.map(l => topicToAddr(l.topics[2])));
    const balances = new Map();
    for (const l of mints) {
      const to = topicToAddr(l.topics[2]);
      balances.set(to, (balances.get(to) || 0) + 1);
    }
    // Net out transfers within the window so the whale share is net, not gross.
    const sends = await rpc('eth_getLogs', [{
      fromBlock: '0x' + fromBlock.toString(16),
      toBlock: '0x' + latest.toString(16),
      address: addr,
      topics: [TRANSFER_TOPIC0],
    }]).catch(() => []);
    for (const l of (sends || [])) {
      const from = topicToAddr(l.topics[1] || ZERO_TOPIC);
      const to = topicToAddr(l.topics[2] || ZERO_TOPIC);
      if (from !== ZERO_ADDR) balances.set(from, (balances.get(from) || 0) - 1);
      if (to !== ZERO_ADDR) balances.set(to, (balances.get(to) || 0) + 1);
    }
    let whale = 0;
    for (const b of balances.values()) if (b > whale) whale = b;
    // Cap at 1: transfers of pre-existing supply inside the window can push a
    // holder's net above the window's mint count.
    const whaleShare = mints.length ? Math.min(1, whale / mints.length) : 0;

    const alreadySeen = !!seen[addr];
    const firstSeen = alreadySeen ? seen[addr].firstSeen : nowSec;
    if (!alreadySeen) seen[addr] = { firstSeen: nowSec, name: name || symbol || addr };
    const ageHours = (nowSec - firstSeen) / 3600;
    const isNew = (nowSec - firstSeen) < 24 * 3600;

    const sampleTokenId = mints[0].topics[3] ? BigInt(mints[0].topics[3]).toString() : '0';

    // --- scoring (0..100) ---
    const unique = minters.size;
    const perHour = mints.length / (windowSec / 3600);
    const sUnique = Math.min(unique, 200) / 200 * 30;
    const sVelocity = Math.min(perHour, 600) / 600 * 20;
    // age: fresher = hotter. First time ever seen -> genuinely unknown -> neutral 7.5.
    const sAge = alreadySeen ? (1 - Math.min(ageHours, 72) / 72) * 15 : 7.5;
    // legitimacy: onchain name() + symbol() readable. Source verification is
    // unavailable on this chain's public infra (see note above) — documented.
    const sLegit = (name ? 7.5 : 0) + (symbol ? 7.5 : 0);
    // freeConfidence (author's choice for the last 20%): Foil hunts FREE mints, so a
    // verifiable zero price is the single most decision-relevant fact. Velocity and
    // minter counts are worthless if the mint costs money or the price is unverifiable.
    let freeConf = 0.3, phase = 'unknown (direct mint)', priceWei = null, start = null, end = null, free = 'unknown';
    if (drop) {
      priceWei = drop.priceWei; start = drop.start; end = drop.end;
      const active = start <= nowSec && nowSec <= end;
      phase = nowSec < start ? 'upcoming' : active ? 'live' : 'ended';
      if (drop.allowlist) phase += ' (allowlist root set — signed phase?)';
      if (priceWei === 0n) { free = 'yes'; freeConf = active ? 1.0 : 0.6; }
      else { free = 'no'; freeConf = 0.0; }
    }
    const sFree = freeConf * 20;

    let score = sUnique + sVelocity + sAge + sLegit + sFree;
    const vetoApplied = whaleShare >= 0.5;
    if (vetoApplied) score *= 0.45; // risk veto: concentrated supply = likely insider farm

    candidates.push({
      name: name || '(unnamed)', symbol: symbol || '',
      contract: addr, standard: std,
      score: Math.round(score * 10) / 10,
      breakdown: {
        uniqueMinters_30: Math.round(sUnique * 10) / 10,
        velocity_20: Math.round(sVelocity * 10) / 10,
        age_15: Math.round(sAge * 10) / 10,
        legitimacy_15: Math.round(sLegit * 10) / 10,
        freeConfidence_20: Math.round(sFree * 10) / 10,
      },
      risk: { whaleShare: Math.round(whaleShare * 1000) / 1000, vetoApplied, vetoFactor: vetoApplied ? 0.45 : 1 },
      phase, free, priceWei: priceWei?.toString() ?? null,
      price: priceWei === null ? 'unknown' : weiToEth(priceWei) + ' ETH',
      startTime: start ? new Date(start * 1000).toISOString() : null,
      endTime: end ? new Date(end * 1000).toISOString() : null,
      seaDrop: !!drop,
      signals: ['live-mint', ...(isNew ? ['new-collection'] : [])],
      observed: {
        windowBlocks: opts.blocks, windowMinutes: Math.round(windowSec / 60),
        mints: mints.length, uniqueMinters: unique, mintsPerHour: Math.round(perHour * 10) / 10,
        sampleTokenId,
      },
      links: {
        opensea: `https://opensea.io/assets/robinhood/${addr}/${sampleTokenId}`,
        blockscout: `${BLOCKSCOUT}/address/${addr}`,
      },
    });
  }

  saveSeen(seen); // local cache only — never chain state

  const alerts = candidates
    .filter(c => c.score >= opts.minScore)
    .sort((a, b) => b.score - a.score);

  const payload = {
    generatedAt: new Date().toISOString(),
    chain: 'robinhood', chainId: CHAIN_ID,
    readOnly: true, dry: opts.dry,
    coverage, minScore: opts.minScore,
    alerts,
  };
  fs.writeFileSync(ALERTS_PATH, JSON.stringify(payload, null, 2));

  if (opts.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`NFT WATCHDOG — Robinhood Chain (4663) — ${payload.generatedAt}`);
  console.log(`mode: READ-ONLY${opts.dry ? ' (dry)' : ''} | window: ${opts.blocks} blocks | candidates: ${candidates.length} | alerts (score>=${opts.minScore}): ${alerts.length}`);
  for (const c of coverage) console.log('  * ' + c);
  console.log('');
  if (!alerts.length) { console.log('No alerts above threshold. Coverage above is honest — nothing faked.'); return; }
  for (const [i, c] of alerts.entries()) {
    console.log(`#${i + 1}  ${c.name}${c.symbol ? ` (${c.symbol})` : ''}  [${c.standard}]  score ${c.score}`);
    console.log(`    contract : ${c.contract}`);
    console.log(`    phase    : ${c.phase} | free: ${c.free} | price: ${c.price}`);
    if (c.startTime) console.log(`    window   : ${c.startTime} -> ${c.endTime || '?'}`);
    console.log(`    observed : ${c.observed.mints} mints / ${c.observed.mintsPerHour}/h from ${c.observed.uniqueMinters} minters in ~${c.observed.windowMinutes} min`);
    console.log(`    breakdown: unique=${c.breakdown.uniqueMinters_30} velocity=${c.breakdown.velocity_20} age=${c.breakdown.age_15} legit=${c.breakdown.legitimacy_15} freeConf=${c.breakdown.freeConfidence_20}`);
    console.log(`    risk     : whaleShare=${c.risk.whaleShare}${c.risk.vetoApplied ? ' -> VETO x0.45 applied' : ''}`);
    console.log(`    signals  : ${c.signals.join(', ')}`);
    console.log(`    links    : ${c.links.opensea}`);
    console.log(`               ${c.links.blockscout}`);
    console.log('');
  }
  console.log(`alerts.json written: ${ALERTS_PATH}`);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });

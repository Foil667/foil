#!/usr/bin/env node
/**
 * NFT_WATCHDOG_CHAD_V2 — multi-chain free-mint screener (detect + score).
 *
 * NOTE: this is the v2 implementation living alongside screener.mjs (v1).
 * It uses its own state files (seen-v2.json, alerts-v2.json, blacklist-v2.json)
 * so the two can run without clobbering each other. The parent orchestrator
 * decides which one is authoritative.
 *
 * STRICTLY READ-ONLY. No signatures, no transactions, no spend, no private keys,
 * no signups, no API keys created. Uses only public read endpoints.
 *
 * Scope: Ethereum, Base, Zora, Polygon, Arbitrum, Optimism, Blast, Solana (stub),
 *        + Robinhood Chain (4663).
 *
 * Loop design: every pass is a CHEAP detect+score sweep (onchain logs + drops API).
 * Expensive work (rug-check hook, deep verification) runs ONLY for candidates
 * scoring >= 60. Candidates >= 75 are flagged EXECUTE-CANDIDATE for the
 * downstream executor — this script itself never executes anything.
 *
 * Scoring (exact, 0-100):
 *   score = (uniqueMintersRatio*30 + velocity*20 + contractAge*15
 *            + verifiedSocials*15 + priceSanity*10 + holderConcentration*10) / 100
 *   each component 0-100. Risk multipliers applied after:
 *     topHolder >= 50% of window supply .... x0.45
 *     botFarm (>30 mints/min from clustered wallets*) .... x0.75
 *     unverified contract + price > 0.5 ETH .... x0.7
 *   * clustered-wallet heuristic: mints/min > 30 AND uniqueMintersRatio < 25
 *     (cheap proxy for shared-funder analysis, which is expensive — documented)
 *
 * Usage:
 *   node screener-v2.mjs [--dry] [--json] [--min-score N] [--chains a,b,c]
 *                        [--loop] [--rug-check-path PATH]
 *
 * Flags:
 *   --dry              banner + read-only (this script has no write paths anyway)
 *   --json             print payload as JSON
 *   --min-score N      alert cutoff (default 30; tiers: >=75 execute, >=60 verify)
 *   --chains LIST      comma list from: ethereum,base,zora,polygon,arbitrum,
 *                      optimism,blast,robinhood,solana (default: all EVM chains)
 *   --loop             repeat the cheap pass every 5 minutes until killed
 *   --rug-check-path   override path to rug-check.mjs
 *
 * Env:
 *   OPENSEA_API_KEY    optional; without it the drops-API leg degrades gracefully
 *                      (we do NOT create keys — POST /api/v2/auth/keys is
 *                      documented in README, never called here)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SEEN_PATH = path.join(DIR, 'seen-v2.json');
const ALERTS_PATH = path.join(DIR, 'alerts-v2.json');
const BLACKLIST_PATH = path.join(DIR, 'blacklist-v2.json');

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// ---------------------------------------------------------------------------
// Chain table — public RPCs only, no signup, no keys
// ---------------------------------------------------------------------------
const CHAINS = {
  ethereum: { chainId: 1,       rpc: 'https://ethereum.publicnode.com',       explorer: 'https://etherscan.io',                osSlug: 'ethereum', scanBlocks: 25,   note: '12s blocks' },
  base:     { chainId: 8453,    rpc: 'https://mainnet.base.org',               explorer: 'https://basescan.org',                osSlug: 'base',     scanBlocks: 150,  note: '2s blocks; publicnode requires address-filtered getLogs, mainnet.base.org allows chain-wide scan' },
  zora:     { chainId: 7777777, rpc: 'https://rpc.zora.energy',               explorer: 'https://explorer.zora.energy',       osSlug: 'zora',     scanBlocks: 150,  note: '2s blocks' },
  polygon:  { chainId: 137,     rpc: 'https://polygon-bor.publicnode.com',    explorer: 'https://polygonscan.com',            osSlug: 'matic',    scanBlocks: 145,  note: '~2s blocks' },
  arbitrum: { chainId: 42161,   rpc: 'https://arbitrum-one.publicnode.com',   explorer: 'https://arbiscan.io',                osSlug: 'arbitrum', scanBlocks: 1200, note: '0.25s blocks' },
  optimism: { chainId: 10,      rpc: 'https://optimism.publicnode.com',        explorer: 'https://optimistic.etherscan.io',    osSlug: 'optimism', scanBlocks: 150,  note: '2s blocks' },
  blast:    { chainId: 81457,   rpc: 'https://rpc.blast.io',                  explorer: 'https://blastscan.io',               osSlug: 'blast',    scanBlocks: 150,  note: '2s blocks' },
  robinhood:{ chainId: 4663,    rpc: 'https://rpc.mainnet.chain.robinhood.com', explorer: 'https://robinhoodchain.blockscout.com', osSlug: 'robinhood', scanBlocks: 3000, note: '0.1s blocks; needs browser UA' },
  solana:   { stub: true, note: 'candy-machine monitor: Helius websocket stub (no key) — offline' },
};

const SEADROP = '0x00005EA00Ac477B1030CE78506496e8C2dE24bf5';
const ZORA_TIMED_SALE = '0x777777722D078c97c6ad07d9f36801e653E356Ae';
const TRANSFER_TOPIC0 = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const ZERO_TOPIC = '0x' + '0'.repeat(64);
const ZERO_ADDR = '0x' + '0'.repeat(40);

// Protected: never candidates (no write paths exist anyway — belt and suspenders).
const PROTECTED_CONTRACTS = new Set([
  // CCFF00 square contract address unknown in workspace; add when known.
].map(a => a.toLowerCase()));

// eth_call selectors
const SEL_SUPPORTS_INTERFACE = '0x01ffc9a7';
const SEL_NAME = '0x06fdde03';
const SEL_SYMBOL = '0x95d89b41';
const SEL_GET_PUBLIC_DROP = '0xbc6a629c';
const IFACE_ERC721 = '80ac58cd';
const IFACE_ERC1155 = 'd9b67a26';

const encAddr = a => a.toLowerCase().replace(/^0x/, '').padStart(64, '0');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const topicToAddr = t => '0x' + t.slice(-40).toLowerCase();

function parseArgs() {
  const a = process.argv.slice(2);
  const o = { json: false, minScore: 30, chains: null, dry: a.includes('--dry'), loop: a.includes('--loop'), rugPath: null, minMints: 3 };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--json') o.json = true;
    if (a[i] === '--min-score') o.minScore = Number(a[++i]);
    if (a[i] === '--min-mints') o.minMints = Number(a[++i]);
    if (a[i] === '--chains') o.chains = a[++i].split(',').map(s => s.trim().toLowerCase()).filter(s => CHAINS[s]);
    if (a[i] === '--rug-check-path') o.rugPath = a[++i];
  }
  if (!o.chains) o.chains = Object.keys(CHAINS).filter(k => !CHAINS[k].stub);
  return o;
}

async function rpcFor(chain, method, params, retries = 2) {
  let last;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(chain.rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
        body: JSON.stringify({ jsonrpc: '2.0', id: Date.now() + i, method, params }),
        signal: AbortSignal.timeout(20000),
      });
      const d = await res.json();
      if (d.error) throw new Error(`RPC ${method}: ${JSON.stringify(d.error).slice(0, 160)}`);
      return d.result;
    } catch (e) { last = e; await sleep(300 * (i + 1)); }
  }
  throw last;
}

const ethCall = (chain, to, data, block = 'latest') =>
  rpcFor(chain, 'eth_call', [{ to, data }, block]);

function decodeString(hex) {
  try {
    const len = Number(BigInt('0x' + hex.slice(2 + 64, 2 + 128)));
    return Buffer.from(hex.slice(2 + 128, 2 + 128 + len * 2), 'hex').toString('utf8').replace(/\0/g, '').trim() || null;
  } catch { return null; }
}

async function detectInterface(chain, addr, sampleTokenId) {
  // 1. Strict path: ERC-165. NOTE: the bytes4 argument MUST be zero-padded to
  //    a full 32-byte ABI word — unpadded calldata reverts on minimal-proxy
  //    free-mint contracts (verified live on Robinhood Chain).
  const padded = ifc => SEL_SUPPORTS_INTERFACE + ifc.padEnd(64, '0');
  for (const [iface, std] of [[IFACE_ERC721, 'ERC721'], [IFACE_ERC1155, 'ERC1155']]) {
    try {
      const r = await ethCall(chain, addr, padded(iface));
      if (r && r.length >= 66 && BigInt('0x' + r.slice(2, 66)) === 1n) return { std, via: 'erc165' };
    } catch { /* not this interface (or no ERC165 at all) */ }
  }
  // 2. Fallback: ownerOf(sampleTokenId). ERC721-specific selector; ERC-20s and
  //    non-NFT contracts revert (no fallback fn). Catches minimal proxies.
  try {
    const tid = BigInt(sampleTokenId || 0).toString(16).padStart(64, '0');
    const r = await ethCall(chain, addr, '0x6352211e' + tid);
    if (r && r.length >= 66 && /^0x[0-9a-fA-F]{40}$/.test('0x' + r.slice(26, 66))) {
      return { std: 'ERC721', via: 'ownerOf-fallback' };
    }
  } catch { /* not an NFT */ }
  return null;
}

async function getNameSymbol(chain, addr) {
  let name = null, symbol = null;
  try { name = decodeString(await ethCall(chain, addr, SEL_NAME)); } catch {}
  try { symbol = decodeString(await ethCall(chain, addr, SEL_SYMBOL)); } catch {}
  return { name, symbol };
}

// SeaDrop presence is cached per chain (one eth_getCode each).
const seadropCache = new Map();
async function seaDropOn(chain) {
  if (!seadropCache.has(chain.chainId)) {
    try {
      const code = await rpcFor(chain, 'eth_getCode', [SEADROP, 'latest']);
      seadropCache.set(chain.chainId, !!(code && code !== '0x' && code.length > 10));
    } catch { seadropCache.set(chain.chainId, false); }
  }
  return seadropCache.get(chain.chainId);
}

async function getSeaDropPrice(chain, addr) {
  // -> { priceWei: BigInt, start, end } | null (null = not a SeaDrop drop / unknown)
  try {
    if (!(await seaDropOn(chain))) return null;
    const r = await ethCall(chain, SEADROP, SEL_GET_PUBLIC_DROP + encAddr(addr));
    if (!r || r.length < 2 + 64 * 6) return null;
    const w = [];
    for (let i = 0; i < 6; i++) w.push(BigInt('0x' + r.slice(2 + i * 64, 2 + (i + 1) * 64)));
    if (w.every(x => x === 0n)) return null;
    return { priceWei: w[0], start: Number(w[1]), end: Number(w[2]) };
  } catch { return null; }
}

// Sourcify contract-verification check — free, no key. null = check failed (unknown).
async function sourcifyVerified(chainId, addr) {
  try {
    const u = `https://sourcify.dev/server/api/v1/check-by-addresses?addresses=${addr}&chainIds=${chainId}`;
    const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
    const d = await r.json();
    const row = Array.isArray(d) ? d[0] : null;
    return row ? row.status === 'perfect' || row.status === 'partial' : null;
  } catch { return null; }
}

function weiToEth(w) {
  const s = w.toString().padStart(19, '0');
  return (s.slice(0, -18) + '.' + s.slice(-18)).replace(/\.?0+$/, '') || '0';
}

function loadJson(p, fb) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fb; } }
function saveJson(p, o) { fs.writeFileSync(p, JSON.stringify(o, null, 2)); }

// ---------------------------------------------------------------------------
// Detection sources (CHEAP pass)
// ---------------------------------------------------------------------------

async function getLogsChunked(chain, fromBlock, toBlock, topics) {
  const CHUNK = 500;
  const all = [];
  for (let start = fromBlock; start <= toBlock; start += CHUNK) {
    const end = Math.min(start + CHUNK - 1, toBlock);
    const logs = await rpcFor(chain, 'eth_getLogs', [{
      fromBlock: '0x' + start.toString(16),
      toBlock: '0x' + end.toString(16),
      topics,
    }]);
    if (Array.isArray(logs)) all.push(...logs);
    if (start + CHUNK <= toBlock) await sleep(100);
  }
  const seen = new Set();
  return all.filter(l => {
    const k = (l.blockNumber || '') + ':' + (l.logIndex || '');
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
}

/**
 * Cheap onchain scan for one EVM chain: mint Transfers in the recent window,
 * grouped by contract. Per-candidate follow-ups are limited to a handful of
 * eth_calls (interface, name/symbol, SeaDrop price) — no deep analysis here.
 */
async function scanChainEvm(chainName, chain, seen, coverage, opts) {
  const out = [];
  const nowSec = Math.floor(Date.now() / 1000);
  let latest;
  try {
    latest = parseInt(await rpcFor(chain, 'eth_blockNumber', []), 16);
  } catch (e) {
    coverage.push(`OFFLINE: ${chainName} RPC unreachable (${String(e.message).slice(0, 100)}). Chain skipped this pass — not faked.`);
    return out;
  }
  const blocks = chain.scanBlocks;
  const fromBlock = Math.max(0, latest - blocks);
  let windowSec = 300;
  try {
    const [b0, b1] = await Promise.all([
      rpcFor(chain, 'eth_getBlockByNumber', ['0x' + fromBlock.toString(16), false]),
      rpcFor(chain, 'eth_getBlockByNumber', ['0x' + latest.toString(16), false]),
    ]);
    windowSec = Math.max(1, parseInt(b1.timestamp, 16) - parseInt(b0.timestamp, 16));
  } catch { /* keep 300s fallback */ }

  let logs;
  try {
    logs = await getLogsChunked(chain, fromBlock, latest, [TRANSFER_TOPIC0, ZERO_TOPIC]);
  } catch (e) {
    coverage.push(`DEGRADED: ${chainName} eth_getLogs failed (${String(e.message).slice(0, 100)}).`);
    return out;
  }
  coverage.push(`OK: ${chainName} scanned blocks ${fromBlock}..${latest} (~${Math.round(windowSec / 60)} min), ${logs.length} mint events.`);

  const byContract = new Map();
  for (const l of logs) {
    const addr = l.address.toLowerCase();
    if (PROTECTED_CONTRACTS.has(addr)) continue;
    if (!byContract.has(addr)) byContract.set(addr, []);
    byContract.get(addr).push(l);
  }

  for (const [addr, mints] of byContract) {
    if (mints.length < opts.minMints) continue;
    const sampleTokenId = mints[0].topics[3] ? BigInt(mints[0].topics[3]).toString() : '0';
    const detected = await detectInterface(chain, addr, sampleTokenId);
    if (!detected) continue; // not ERC-721/1155
    const { std, via: ifaceVia } = detected;

    const { name, symbol } = await getNameSymbol(chain, addr);
    const drop = await getSeaDropPrice(chain, addr);
    const verified = await sourcifyVerified(chain.chainId, addr); // true | false | null

    const minters = new Set(mints.map(l => topicToAddr(l.topics[2])));
    const bal = new Map();
    for (const l of mints) {
      const to = topicToAddr(l.topics[2]);
      bal.set(to, (bal.get(to) || 0) + 1);
    }
    // net out sends inside the window so whale share is net, not gross
    try {
      const sends = await rpcFor(chain, 'eth_getLogs', [{
        fromBlock: '0x' + fromBlock.toString(16), toBlock: '0x' + latest.toString(16),
        address: addr, topics: [TRANSFER_TOPIC0],
      }]);
      for (const l of (sends || [])) {
        const from = topicToAddr(l.topics[1] || ZERO_TOPIC);
        const to = topicToAddr(l.topics[2] || ZERO_TOPIC);
        if (from !== ZERO_ADDR) bal.set(from, (bal.get(from) || 0) - 1);
        if (to !== ZERO_ADDR) bal.set(to, (bal.get(to) || 0) + 1);
      }
    } catch { /* whale math stays gross — acceptable for the cheap pass */ }
    let whale = 0;
    for (const b of bal.values()) if (b > whale) whale = b;
    const whaleShare = mints.length ? whale / mints.length : 0;

    const key = `${chain.chainId}:${addr}`;
    const alreadySeen = !!seen[key];
    if (!alreadySeen) seen[key] = { firstSeen: nowSec, name: name || symbol || addr, chain: chainName };
    const ageHours = (nowSec - seen[key].firstSeen) / 3600;

    let priceWei = null, phase = 'direct mint (no SeaDrop stage)';
    if (drop) {
      priceWei = drop.priceWei;
      phase = nowSec < drop.start ? 'upcoming' : (nowSec <= drop.end ? 'live' : 'ended');
    }

    out.push({
      chain: chainName, chainId: chain.chainId, contract: addr, standard: std,
      ifaceVia, // 'erc165' | 'ownerOf-fallback' — honesty about detection
      name: name || '(unnamed)', symbol: symbol || '',
      source: 'onchain-mints',
      mints: mints.length, uniqueMinters: minters.size,
      mintsPerHour: mints.length / (windowSec / 3600),
      mintsPerMin: mints.length / (windowSec / 60),
      whaleShare, verified,
      priceWei: priceWei === null ? null : priceWei.toString(),
      price: priceWei === null ? 'unknown' : weiToEth(priceWei) + ' ETH',
      ageHours: alreadySeen ? ageHours : null, // null = first sighting, genuinely unknown
      phase,
      sampleTokenId,
      links: {
        opensea: `https://opensea.io/assets/${chain.osSlug}/${addr}/${sampleTokenId}`,
        explorer: `${chain.explorer}/address/${addr}`,
      },
    });
  }
  return out;
}

/**
 * OpenSea drops API — multi-chain discovery in one call.
 * Needs OPENSEA_API_KEY. WITHOUT it: graceful degradation, no key creation.
 */
async function scanDropsApi(coverage) {
  const out = [];
  let key = process.env.OPENSEA_API_KEY;
  if (!key) {
    // Fallback: read the agent's provisioned key from ~/.opensea/key.json (0600).
    try {
      const { readFileSync } = await import('node:fs');
      const { homedir } = await import('node:os');
      const saved = JSON.parse(readFileSync(homedir() + '/.opensea/key.json', 'utf8'));
      if (saved && saved.api_key) key = saved.api_key;
    } catch { /* no saved key — degrade below */ }
  }
  if (!key) {
    coverage.push('DEGRADED: OPENSEA_API_KEY not set and no ~/.opensea/key.json — drops-API leg offline. ' +
      'Free key comes from POST /api/v2/auth/keys (we do NOT create one here). Onchain legs still run.');
    return out;
  }
  try {
    const u = 'https://api.opensea.io/api/v2/drops?type=upcoming&chains=ethereum,base,zora,matic,arbitrum,optimism,blast';
    const r = await fetch(u, { headers: { 'User-Agent': UA, 'X-API-KEY': key }, signal: AbortSignal.timeout(20000) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      coverage.push(`DEGRADED: OpenSea drops API HTTP ${r.status} — leg offline this pass.`);
      return out;
    }
    for (const drop of (d.drops || d.results || [])) {
      const price = drop.price ?? drop.mint_price ?? drop?.stages?.[0]?.price;
      const priceNum = price === null || price === undefined ? null : Number(price);
      const isFree = priceNum === 0;
      out.push({
        chain: drop.chain || 'unknown', chainId: null, contract: (drop.contract_address || '').toLowerCase() || null,
        standard: 'unknown', name: drop.name || drop.collection || '(unnamed)', symbol: '',
        source: 'opensea-drops',
        mints: 0, uniqueMinters: 0, mintsPerHour: 0, mintsPerMin: 0,
        whaleShare: 0, verified: null,
        priceWei: isFree ? '0' : null,
        price: isFree ? '0 ETH (free)' : 'unknown',
        ageHours: null,
        phase: 'upcoming (drops API)',
        sampleTokenId: '0',
        dropsApi: true,
        links: {
          opensea: drop.opensea_url || drop.url || `https://opensea.io/collection/${drop.collection_slug || ''}`,
          explorer: '',
        },
      });
    }
    coverage.push(`OK: OpenSea drops API returned ${(d.drops || d.results || []).length} upcoming drops.`);
  } catch (e) {
    coverage.push(`DEGRADED: OpenSea drops API error (${String(e.message).slice(0, 100)}).`);
  }
  return out;
}

/**
 * Zora timed-sale strategy monitor (0x777777722D078c97c6ad07d9f36801e653E356Ae).
 * The strategy's exact sale-event ABI is not pinned in this repo, so events are
 * counted as an activity signal and reported honestly as undecoded — never
 * attributed to a specific collection without the ABI.
 */
async function scanZoraTimedSale(coverage) {
  const out = [];
  const chain = CHAINS.zora;
  try {
    const code = await rpcFor(chain, 'eth_getCode', [ZORA_TIMED_SALE, 'latest']);
    if (!code || code === '0x') {
      coverage.push('DEGRADED: Zora timed-sale strategy has no code on Zora chain (checked) — monitor offline.');
      return out;
    }
    const latest = parseInt(await rpcFor(chain, 'eth_blockNumber', []), 16);
    const hits = (await rpcFor(chain, 'eth_getLogs', [{
      fromBlock: '0x' + Math.max(0, latest - chain.scanBlocks).toString(16),
      toBlock: '0x' + latest.toString(16),
      address: ZORA_TIMED_SALE,
    }]).catch(() => [])) || [];
    if (hits.length) {
      coverage.push(`OK: Zora timed-sale strategy emitted ${hits.length} events in window (undecoded — strategy ABI unpinned; activity signal only).`);
      out.push({
        chain: 'zora', chainId: chain.chainId, contract: ZORA_TIMED_SALE.toLowerCase(),
        standard: 'strategy', name: 'Zora TimedSaleStrategy (activity)', symbol: '',
        source: 'zora-timed-sale', mints: 0, uniqueMinters: 0, mintsPerHour: 0, mintsPerMin: 0,
        whaleShare: 0, verified: null, priceWei: null, price: 'unknown', ageHours: null,
        phase: `${hits.length} strategy events in window (undecoded)`,
        sampleTokenId: '0',
        links: { opensea: '', explorer: `${chain.explorer}/address/${ZORA_TIMED_SALE}` },
        _watchOnly: true,
      });
    } else {
      coverage.push('OK: Zora timed-sale strategy quiet in window (0 events).');
    }
  } catch (e) {
    coverage.push(`DEGRADED: Zora timed-sale monitor failed (${String(e.message).slice(0, 100)}).`);
  }
  return out;
}

// --- Stubs (code paths present, no providers configured — no signups, no keys) ---
function scanSolanaStub(coverage) {
  coverage.push('STUB: Solana candy-machine monitor not configured — needs a Helius websocket (no key on file, no signup performed). Solana coverage OFFLINE. Code path: scanSolanaStub() in screener-v2.mjs.');
  return [];
}
function mempoolWatchStub(coverage) {
  coverage.push('STUB: mempool websocket watch not configured — needs Alchemy/QuickNode/Helius WS (no signups performed). Mempool signal OFFLINE. Code path: mempoolWatchStub() in screener-v2.mjs.');
  return [];
}

// ---------------------------------------------------------------------------
// Scoring (exact spec formula)
// ---------------------------------------------------------------------------
function scoreCandidate(c) {
  const b = {};
  // uniqueMintersRatio 0-100
  b.uniqueMintersRatio = c.mints > 0 ? Math.min(100, (c.uniqueMinters / c.mints) * 100) : 50;
  // velocity 0-100
  b.velocity = Math.min(100, (c.mintsPerHour / 600) * 100);
  // contractAge 0-100 (fresher = hotter; unknown = neutral 50, never faked)
  b.contractAge = c.ageHours === null ? 50 : (1 - Math.min(c.ageHours, 72) / 72) * 100;
  // verifiedSocials 0-100: mean of available sub-checks (missing checks excluded)
  const subs = [];
  if (c.verified === true) subs.push(100); else if (c.verified === false) subs.push(0);
  if (c.name && c.name !== '(unnamed)') subs.push(60); else subs.push(0);
  if (c.dropsApi) subs.push(75); // listed by OpenSea = some curation
  b.verifiedSocials = subs.length ? subs.reduce((x, y) => x + y, 0) / subs.length : 50;
  // priceSanity 0-100
  if (c.priceWei === null) b.priceSanity = 50;
  else {
    const eth = Number(c.priceWei) / 1e18;
    b.priceSanity = eth === 0 ? 100 : eth <= 0.01 ? 80 : eth <= 0.05 ? 60 : eth <= 0.2 ? 40 : eth <= 0.5 ? 20 : 0;
  }
  // holderConcentration 0-100 (higher = LESS concentrated = better)
  b.holderConcentration = (1 - Math.min(1, c.whaleShare)) * 100;

  let score = (b.uniqueMintersRatio * 30 + b.velocity * 20 + b.contractAge * 15 +
               b.verifiedSocials * 15 + b.priceSanity * 10 + b.holderConcentration * 10) / 100;

  const mults = [];
  if (c.whaleShare >= 0.5) { score *= 0.45; mults.push('topHolder>=50% x0.45'); }
  if (c.mintsPerMin > 30 && b.uniqueMintersRatio < 25) { score *= 0.75; mults.push('botFarm-heuristic x0.75'); }
  const priceEth = c.priceWei === null ? null : Number(c.priceWei) / 1e18;
  if (c.verified === false && priceEth !== null && priceEth > 0.5) { score *= 0.7; mults.push('unverified+price>0.5ETH x0.7'); }

  const r2 = x => Math.round(x * 100) / 100;
  return { score: r2(score), breakdown: Object.fromEntries(Object.entries(b).map(([k, v]) => [k, r2(v)])), multipliers: mults };
}

// ---------------------------------------------------------------------------
// Rug-check hook (EXPENSIVE — only for score >= 60)
// ---------------------------------------------------------------------------
const DEFAULT_RUG_PATH = path.join(path.dirname(DIR), 'rug-check', 'rug-check.mjs');

function rugCheck(chainId, contract, rugPath) {
  const p = rugPath || DEFAULT_RUG_PATH;
  return new Promise(resolve => {
    if (!fs.existsSync(p)) {
      resolve({ status: 'stub-unavailable', detail: 'rug-check.mjs not present (built in parallel) — candidate stays at verify tier, never execute' });
      return;
    }
    const child = spawn('node', [p, String(chainId), contract], { timeout: 90000 });
    let out = '', err = '';
    child.stdout.on('data', d => out += d);
    child.stderr.on('data', d => err += d);
    child.on('error', e => resolve({ status: 'error', detail: `spawn failed: ${e.message}` }));
    child.on('close', code => {
      let detail = out.trim().slice(0, 500) || err.trim().slice(0, 200) || `exit ${code}`;
      try { const j = JSON.parse(out); detail = j.reason || j.detail || detail; } catch {}
      resolve({ status: code === 0 ? 'clean' : code === 2 ? 'flagged' : 'error', detail, exitCode: code });
    });
  });
}

// ---------------------------------------------------------------------------
// Main pass
// ---------------------------------------------------------------------------
async function runPass(opts) {
  const nowIso = new Date().toISOString();
  const coverage = [];
  const seen = loadJson(SEEN_PATH, {});
  const blacklist = loadJson(BLACKLIST_PATH, {});

  if (opts.dry) console.log('== DRY MODE: read-only. No signing, no transactions, no spend, no private keys. ==\n');

  let candidates = [];

  // Cheap sources first — EVM chains scanned in PARALLEL so the 5-min loop
  // holds with 8 chains (each chain is independent; `seen` writes are sync).
  const perChain = await Promise.all(opts.chains.map(async (name) => {
    const chain = CHAINS[name];
    if (chain.stub) return [];
    try {
      return await scanChainEvm(name, chain, seen, coverage, opts);
    } catch (e) {
      coverage.push(`FAILED: ${name} scan crashed (${String(e.message).slice(0, 120)}) — skipped, not faked.`);
      return [];
    }
  }));
  candidates.push(...perChain.flat());
  candidates.push(...await scanDropsApi(coverage));
  candidates.push(...await scanZoraTimedSale(coverage));
  candidates.push(...scanSolanaStub(coverage));
  candidates.push(...mempoolWatchStub(coverage));

  saveJson(SEEN_PATH, seen);

  // Score (cheap)
  for (const c of candidates) {
    if (c._watchOnly) { c.tier = 'watch'; c.score = 0; continue; }
    const s = scoreCandidate(c);
    c.score = s.score; c.breakdown = s.breakdown; c.multipliers = s.multipliers;
    c.tier = c.score >= 75 ? 'execute-candidate' : c.score >= 60 ? 'verify' : 'watch';
  }

  // Expensive verification ONLY for >= 60
  for (const c of candidates) {
    const key = `${c.chainId}:${c.contract}`;
    if (blacklist[key]) { c.tier = 'blocked'; c.blockReason = blacklist[key].reason; continue; }
    if (c.score >= 60 && c.contract) {
      const rc = await rugCheck(c.chainId, c.contract, opts.rugPath);
      c.rugCheck = rc;
      if (rc.status === 'flagged') {
        blacklist[key] = { reason: rc.detail, at: nowIso };
        c.tier = 'blocked'; c.blockReason = rc.detail;
        coverage.push(`RUG-CHECK FLAGGED ${c.chain}:${c.contract} — blacklisted, never execute. Reason: ${String(rc.detail).slice(0, 160)}`);
      } else if (rc.status === 'clean') {
        coverage.push(`rug-check clean: ${c.chain}:${c.contract}`);
      } else {
        coverage.push(`rug-check ${rc.status}: ${c.chain}:${c.contract} — ${String(rc.detail).slice(0, 120)}`);
      }
    }
  }
  saveJson(BLACKLIST_PATH, blacklist);

  const alerts = candidates
    .filter(c => c.score >= opts.minScore && c.tier !== 'blocked')
    .sort((a, b) => b.score - a.score);

  const payload = {
    generatedAt: nowIso, readOnly: true, dry: opts.dry,
    chains: opts.chains, coverage, minScore: opts.minScore,
    counts: {
      candidates: candidates.length,
      execute: candidates.filter(c => c.tier === 'execute-candidate').length,
      verify: candidates.filter(c => c.tier === 'verify').length,
      watch: candidates.filter(c => c.tier === 'watch').length,
      blocked: candidates.filter(c => c.tier === 'blocked').length,
    },
    alerts,
  };
  saveJson(ALERTS_PATH, payload);
  return payload;
}

function printReport(p, opts) {
  if (opts.json) { console.log(JSON.stringify(p, null, 2)); return; }
  console.log(`NFT_WATCHDOG_CHAD_V2 — ${p.generatedAt}`);
  console.log(`mode: READ-ONLY${opts.dry ? ' (dry)' : ''} | chains: ${p.chains.join(',')}`);
  console.log(`candidates: ${p.counts.candidates} | execute: ${p.counts.execute} | verify: ${p.counts.verify} | watch: ${p.counts.watch} | blocked: ${p.counts.blocked}`);
  for (const c of p.coverage) console.log('  * ' + c);
  console.log('');
  if (!p.alerts.length) { console.log('No alerts above threshold. Coverage above is honest — nothing faked.'); return; }
  p.alerts.forEach((c, i) => {
    console.log(`#${i + 1} [${c.tier.toUpperCase()}] ${c.name}${c.symbol ? ` (${c.symbol})` : ''} [${c.chain}${c.standard && c.standard !== 'unknown' ? '/' + c.standard : ''}] score ${c.score}`);
    if (c.contract) console.log(`    contract : ${c.contract}`);
    console.log(`    source   : ${c.source} | phase: ${c.phase}`);
    if (c.mints) console.log(`    observed : ${c.mints} mints, ${c.mintsPerHour.toFixed(1)}/h, ${c.uniqueMinters} unique minters, whaleShare=${c.whaleShare.toFixed(2)}`);
    if (c.breakdown) console.log(`    breakdown: uMR=${c.breakdown.uniqueMintersRatio} vel=${c.breakdown.velocity} age=${c.breakdown.contractAge} vsoc=${c.breakdown.verifiedSocials} psan=${c.breakdown.priceSanity} hcon=${c.breakdown.holderConcentration}`);
    if (c.multipliers && c.multipliers.length) console.log(`    risk mult: ${c.multipliers.join(', ')}`);
    if (c.rugCheck) console.log(`    rug-check: ${c.rugCheck.status} — ${String(c.rugCheck.detail).slice(0, 120)}`);
    if (c.links?.opensea) console.log(`    links    : ${c.links.opensea}`);
    if (c.links?.explorer) console.log(`               ${c.links.explorer}`);
    console.log('');
  });
  console.log(`alerts file written: ${ALERTS_PATH}`);
}

(async () => {
  const opts = parseArgs();
  do {
    try {
      const p = await runPass(opts);
      printReport(p, opts);
    } catch (e) {
      console.error('PASS FAILED:', e.message);
    }
    if (opts.loop) {
      console.log('\n--loop: sleeping 5 min before next cheap pass…');
      await sleep(5 * 60 * 1000);
    }
  } while (opts.loop);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });

'use strict';
/* =====================================================================
 * LOOPER RESCUE — read-only stuck-asset scanner (Base chain)
 * ---------------------------------------------------------------------
 * SAFETY ARCHITECTURE (non-negotiable):
 * - This file is READ-ONLY. There is no code path that requests a
 *   wallet, an account, a signature, a private key, or a transaction.
 * - The scanned address comes from a plain text <input>, validated
 *   against /^0x[0-9a-fA-F]{40}$/ before any network call.
 * - No localStorage / sessionStorage / cookies. All state is in memory.
 * - Recovery is an allowlist of official external links only
 *   (target="_blank" rel="noopener"). This app never builds, signs,
 *   or submits any transaction.
 * - Outbound network is limited to: mainnet.base.org (Base RPC),
 *   ethereum.publicnode.com (L1 RPC, allowlisted), api.merkl.xyz,
 *   api.dexscreener.com, api.coinbase.com. Nothing else is fetched.
 * ===================================================================== */

/* ---------------------------------------------------------------------
 * SELECTOR / EVENT-HASH VERIFICATION (build time, 2026-09-28)
 * Computed locally with keccak256 (js-sha3) and cross-checked against
 * live Base chain data:
 * - 0x70a08231 balanceOf(address) ............ MATCH
 * - 0x313ce567 decimals() .................... MATCH
 * - 0x95d89b41 symbol() ...................... MATCH
 * - 0x6352211e ownerOf(uint256) ............... MATCH
 * - 0x00fdd58e balanceOf(address,uint256) ..... MATCH
 * - 0x01ffc9a7 supportsInterface(bytes4) ...... MATCH
 *   (spec draft listed 0x01ffc9d7 — that was a typo, corrected here)
 * - Transfer(address,address,uint256)
 *   0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
 *   MATCH, and matches live log topic0 on Base.
 * - TransferSingle: the spec draft's value had 67 hex chars (invalid).
 *   Recomputed: 0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62
 *   and confirmed with 2,470 real hits in the last 2,000 Base blocks.
 * - TransferBatch: spec draft value likewise invalid (odd length).
 *   Recomputed: 0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb
 *   and confirmed with 569 real hits in the last 2,000 Base blocks.
 * - Bridge withdrawals: the spec draft assumed
 *   WithdrawalInitiated(address,address,address,address,uint256,bytes)
 *   (= 0x73d170910aba9e6d50b102db522b1dbcd796216f5128b445aa2135272886497e,
 *   computed as instructed) — but that event gets ZERO hits on the live
 *   Base L2ToL1MessagePasser. The contract actually emits
 *   MessagePassed(uint256,address,address,uint256,uint256,bytes,bytes32)
 *   = 0x02a52367d10742d8032712c1bb8e0144ff1ec5ffda1ed7d70bb05a2744955054
 *   (computed hash == topic0 observed onchain; 4 hits in 2,000 blocks).
 *   Layout: topics[1]=nonce, topics[2]=sender, topics[3]=target (all indexed);
 *   data = (value, gasLimit, bytes-offset, withdrawalHash, data...).
 *   HONESTY NOTE: this app does NOT check L1 finalization status. The
 *   "LIKELY STUCK" flag below is purely an age heuristic (>30 days old),
 *   not a finality verdict. Finalization must be verified/completed in the
 *   official bridge app (bridge.base.org).
 * ------------------------------------------------------------------- */

const BASE_RPC = 'https://mainnet.base.org';
const L1_RPC = 'https://ethereum.publicnode.com'; // allowlisted; intentionally unused — no L1 state is queried by design
const BASE_CHAIN_ID = 8453;

const RESCUE_TOKEN = '0x8201132Bc218dbD81305Ff5605F44aE4804D4BA3';
const RESCUE_POOL_ID = '0x7d5e38d1a39566b688de2e126fbdfc93560abe20db8dd0447bf5a4386581ce0e';
const L2_TO_L1_PASSER = '0x4200000000000000000000000000000000000016';

// Function selectors (4 bytes, verified above)
const SEL_BALANCE_OF = '0x70a08231';        // balanceOf(address)
const SEL_DECIMALS = '0x313ce567';          // decimals()
const SEL_SYMBOL = '0x95d89b41';            // symbol()
const SEL_OWNER_OF = '0x6352211e';          // ownerOf(uint256)
const SEL_SUPPORTS_IFACE = '0x01ffc9a7';    // supportsInterface(bytes4)
const SEL_BALANCE_OF_1155 = '0x00fdd58e';   // balanceOf(address,uint256)

// Event topic0 hashes (verified above)
const TOPIC_TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const TOPIC_TRANSFER_SINGLE = '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62';
const TOPIC_TRANSFER_BATCH = '0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb';
const TOPIC_MESSAGE_PASSED = '0x02a52367d10742d8032712c1bb8e0144ff1ec5ffda1ed7d70bb05a2744955054';

// ERC-165 interface id for the ERC-721 check
const IFACE_ERC721 = '0x80ac58cd';

// Curated Base ERC-20s checked directly via balanceOf (symbol/decimals known).
const CURATED_TOKENS = [
  { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', decimals: 6 },
  { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', decimals: 18 },
  { address: '0x50c5725949A6F0c72E6C4a641F3187595fC917', symbol: 'DAI', decimals: 18 },
  { address: '0x2Ae3F1EC7D304cB47B4479C695df7Ac0e18Bef2', symbol: 'cbETH', decimals: 18 },
  { address: '0x4ed4E862860bed51a9570b96d89aF5E1fDeAa1', symbol: 'DEGEN', decimals: 18 },
  { address: '0x940181a94A35A4569E4529A3CDfB74e38FD9868c', symbol: 'AERO', decimals: 18 },
  { address: RESCUE_TOKEN, symbol: 'RESCUE', decimals: 18 }, // the project's own token
];

const MERKL_API = 'https://api.merkl.xyz/v4/users/{address}/rewards?chainId=8453';
const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex/tokens/0x8201132Bc218dbD81305Ff5605F44aE4804D4BA3';
const COINBASE_ETH_USD = 'https://api.coinbase.com/v2/prices/ETH-USD/spot';

// Scan depth: ~2,000,000 Base blocks (~46 days at ~2s/block).
// NOTE: spec draft suggested 20,000-block chunks, but mainnet.base.org
// caps eth_getLogs at a 2,000-block range (error -32614), so chunks are 2,000.
const SCAN_BLOCKS = 2000000;
const LOG_CHUNK = 2000;
const CONCURRENCY = 6;
const DUST_USD = 1.0;
const STUCK_DAYS = 30;

/* ============================ pure helpers ============================ */

function isValidAddress(s) {
  return /^0x[0-9a-fA-F]{40}$/.test(s);
}

function normAddr(a) {
  return a.toLowerCase();
}

// address -> 32-byte left-padded topic
function addrToTopic(addr) {
  return '0x' + '0'.repeat(24) + addr.slice(2).toLowerCase();
}

// topic (32-byte hex) -> address (last 20 bytes)
function topicToAddr(topic) {
  return '0x' + topic.slice(-40).toLowerCase();
}

// uint256 -> 32-byte hex (no 0x)
function uintToHex(n) {
  return BigInt(n).toString(16).padStart(64, '0');
}

function encBalanceOf(addr) {
  return SEL_BALANCE_OF + addrToTopic(addr).slice(2);
}

function encBalanceOf1155(addr, id) {
  return SEL_BALANCE_OF_1155 + addrToTopic(addr).slice(2) + uintToHex(id);
}

function encOwnerOf(id) {
  return SEL_OWNER_OF + uintToHex(id);
}

function encSupportsInterface(ifaceId) {
  return SEL_SUPPORTS_IFACE + '0'.repeat(56) + ifaceId.slice(2).toLowerCase();
}

// decode first 32 bytes as uint256 -> BigInt, or null on empty/malformed
function decodeUint(data) {
  if (!data || data === '0x' || data.length < 66) return null;
  try {
    return BigInt('0x' + data.slice(2, 66));
  } catch (e) {
    return null;
  }
}

// decode ABI string OR legacy bytes32 string -> JS string, or null
function decodeString(data) {
  if (!data || data === '0x') return null;
  try {
    const hex = data.slice(2);
    if (hex.length === 64) {
      // legacy bytes32: strip trailing zero bytes
      const bytes = [];
      for (let i = 0; i < 64; i += 2) {
        const b = parseInt(hex.slice(i, i + 2), 16);
        if (b === 0) break;
        bytes.push(b);
      }
      return new TextDecoder().decode(new Uint8Array(bytes)) || null;
    }
    if (hex.length < 128) return null;
    const len = parseInt(hex.slice(64, 128), 16);
    if (!Number.isSafeInteger(len) || len <= 0 || len > 200) return null;
    const strHex = hex.slice(128, 128 + len * 2);
    if (strHex.length !== len * 2) return null;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = parseInt(strHex.slice(i * 2, i * 2 + 2), 16);
    // reject embedded NULs / control chars (defensive)
    if (bytes.includes(0)) return null;
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (e) {
    return null;
  }
}

// BigInt token amount -> human string given decimals (trims trailing zeros)
function formatUnits(value, decimals) {
  const neg = value < 0n;
  const v = neg ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = v / base;
  let frac = (v % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  if (frac.length > 6) frac = frac.slice(0, 6);
  const s = frac ? whole.toString() + '.' + frac : whole.toString();
  return (neg ? '-' : '') + s;
}

function formatUsd(n) {
  if (n == null || !isFinite(n)) return '—';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function shortAddr(a) {
  return a.slice(0, 6) + '…' + a.slice(-4);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Decode TransferBatch data: (uint256[] ids, uint256[] values) -> {ids:[], values:[]}
function decodeBatchData(data) {
  try {
    const hex = data.slice(2);
    const word = (i) => BigInt('0x' + hex.slice(i * 64, i * 64 + 64));
    const offIds = Number(word(0)) / 32;
    const offVals = Number(word(1)) / 32;
    const readArr = (off) => {
      const len = Number(word(off));
      if (len > 500) return null; // sanity cap
      const out = [];
      for (let i = 0; i < len; i++) out.push(word(off + 1 + i));
      return out;
    };
    const ids = readArr(offIds);
    const values = readArr(offVals);
    if (!ids || !values || ids.length !== values.length) return null;
    return { ids, values };
  } catch (e) {
    return null;
  }
}

/* ============================ RPC layer (read-only) ============================
 * Only JSON-RPC POSTs to the allowlisted endpoints, and only read-only
 * methods: eth_chainId, eth_blockNumber, eth_getBalance, eth_call,
 * eth_getLogs, eth_getBlockByNumber. No other methods are called anywhere.
 */

async function rpc(url, method, params) {
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
  } catch (e) {
    const err = new Error('network error: ' + (e && e.message ? e.message : e));
    err.status = 0;
    throw err;
  }
  if (!res.ok) {
    const err = new Error('HTTP ' + res.status);
    err.status = res.status;
    throw err;
  }
  const body = await res.json();
  if (body.error) {
    const err = new Error('RPC error: ' + body.error.message);
    err.status = body.error.code;
    throw err;
  }
  return body.result;
}

// Retry exactly once on 429 / 5xx / network failure, with backoff.
// Anything else throws immediately.
async function withRetryOnce(fn) {
  try {
    return await fn();
  } catch (e) {
    const s = e && e.status;
    if (s === 429 || s === 0 || (s >= 500 && s < 600)) {
      await sleep(900 + Math.random() * 600);
      return await fn(); // single retry; throws to caller on failure
    }
    throw e;
  }
}

function ethCall(to, data, block) {
  return rpc(BASE_RPC, 'eth_call', [{ to, data }, block || 'latest']);
}

function getBalance(addr) {
  return rpc(BASE_RPC, 'eth_getBalance', [addr, 'latest']);
}

function getBlockNumber() {
  return rpc(BASE_RPC, 'eth_blockNumber', []);
}

async function getBlockTimestamp(blockNumHex, cache) {
  if (cache.has(blockNumHex)) return cache.get(blockNumHex);
  const b = await withRetryOnce(() => rpc(BASE_RPC, 'eth_getBlockByNumber', [blockNumHex, false]));
  const ts = b && b.timestamp ? parseInt(b.timestamp, 16) : null;
  cache.set(blockNumHex, ts);
  return ts;
}

// Run tasks with at most `limit` concurrent workers. Resolves to an array
// of {ok:true,value} / {ok:false,error} in task order.
async function pool(tasks, limit, onProgress) {
  const results = new Array(tasks.length);
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < tasks.length) {
      const idx = next++;
      try {
        results[idx] = { ok: true, value: await tasks[idx]() };
      } catch (e) {
        results[idx] = { ok: false, error: e };
      }
      done++;
      if (onProgress) onProgress(done, tasks.length);
    }
  }
  const n = Math.min(limit, tasks.length);
  await Promise.all(Array.from({ length: n }, worker));
  return results;
}

// Chunked eth_getLogs over [fromBlock, toBlock] (inclusive), chunk size LOG_CHUNK.
// Throws if any chunk fails (after its one retry) — the caller turns that
// into a "section unavailable — RPC error" card, never a silent partial scan.
async function getLogsChunked(filterBase, fromBlock, toBlock, onProgress) {
  const ranges = [];
  for (let s = fromBlock; s <= toBlock; s += LOG_CHUNK) {
    ranges.push([s, Math.min(s + LOG_CHUNK - 1, toBlock)]);
  }
  const tasks = ranges.map(([s, e]) => () =>
    withRetryOnce(() =>
      rpc(BASE_RPC, 'eth_getLogs', [{
        address: filterBase.address,
        topics: filterBase.topics,
        fromBlock: '0x' + s.toString(16),
        toBlock: '0x' + e.toString(16),
      }])
    )
  );
  const results = await pool(tasks, CONCURRENCY, onProgress);
  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    throw new Error(failed.length + ' of ' + results.length + ' log chunks failed');
  }
  const logs = [];
  for (const r of results) logs.push(...r.value);
  return logs;
}

/* ============================ scan sections ============================
 * Each section is read-only and returns plain data (no DOM). Failures
 * throw; runScan() converts them into per-section "unavailable" cards.
 */

async function fetchEthUsd() {
  const res = await fetch(COINBASE_ETH_USD);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const j = await res.json();
  const v = parseFloat(j && j.data && j.data.amount);
  if (!isFinite(v)) throw new Error('bad price response');
  return v;
}

async function checkChainId() {
  const id = await rpc(BASE_RPC, 'eth_chainId', []);
  if (id !== '0x' + BASE_CHAIN_ID.toString(16)) throw new Error('unexpected chain id ' + id + ' (expected Base 8453)');
}

// 1. Native ETH
async function scanNative(addr, ethUsd) {
  const balHex = await withRetryOnce(() => getBalance(addr));
  const wei = BigInt(balHex);
  const usd = ethUsd != null ? Number(wei) / 1e18 * ethUsd : null;
  return { wei, usd, dust: usd != null && usd < DUST_USD };
}

// 2a. Curated ERC-20s via balanceOf
async function scanCurated(addr) {
  const tasks = CURATED_TOKENS.map((t) => async () => {
    const raw = await withRetryOnce(() => ethCall(t.address, encBalanceOf(addr)));
    const bal = decodeUint(raw);
    if (bal == null || bal === 0n) return null;
    return { contract: t.address, symbol: t.symbol, decimals: t.decimals, balance: bal, curated: true };
  });
  const results = await pool(tasks, CONCURRENCY, null);
  return results.filter((r) => r.ok && r.value).map((r) => r.value);
}

// 2b/3. Inbound Transfer logs (serves ERC-20 discovery AND ERC-721 discovery)
async function discoverInboundTransfers(addr, fromBlock, toBlock, onProgress) {
  return getLogsChunked(
    { address: undefined, topics: [TOPIC_TRANSFER, null, addrToTopic(addr)] },
    fromBlock, toBlock, onProgress
  );
}

// Classify each unique token contract from the Transfer logs:
// balanceOf > 0, then decimals() ok => ERC-20; else supportsInterface(721) => ERC-721.
async function classifyTokens(addr, logs, onProgress) {
  const contracts = [...new Set(logs.map((l) => normAddr(l.address)))];
  const erc20 = [];
  const erc721 = [];
  let done = 0;
  const tasks = contracts.map((contract) => async () => {
    try {
      const balRaw = await withRetryOnce(() => ethCall(contract, encBalanceOf(addr)));
      const bal = decodeUint(balRaw);
      if (bal == null || bal === 0n) return; // not held now
      const decRaw = await withRetryOnce(() => ethCall(contract, SEL_DECIMALS));
      const dec = decodeUint(decRaw);
      if (dec != null && dec <= 36n) {
        // ERC-20
        let symbol = null;
        try {
          const symRaw = await withRetryOnce(() => ethCall(contract, SEL_SYMBOL));
          symbol = decodeString(symRaw);
        } catch (e) { /* leave null */ }
        erc20.push({
          contract, symbol: symbol || shortAddr(contract), decimals: Number(dec),
          balance: bal, curated: false,
        });
        return;
      }
      const supRaw = await withRetryOnce(() => ethCall(contract, encSupportsInterface(IFACE_ERC721)));
      if (decodeUint(supRaw) === 1n) {
        // ERC-721: tokenIds are topics[3] of inbound transfers; verify ownerOf each
        const ids = [...new Set(
          logs.filter((l) => normAddr(l.address) === contract && l.topics.length >= 4)
            .map((l) => { try { return BigInt(l.topics[3]).toString(); } catch (e) { return null; } })
            .filter((x) => x !== null)
        )];
        const held = [];
        for (const id of ids) {
          try {
            const ownRaw = await withRetryOnce(() => ethCall(contract, encOwnerOf(id)));
            const owner = decodeUint(ownRaw);
            if (owner != null && '0x' + owner.toString(16).padStart(40, '0') === normAddr(addr)) {
              held.push(id);
            }
          } catch (e) { /* skip unverifiable id */ }
        }
        if (held.length > 0) erc721.push({ contract, tokenIds: held });
      }
      // else: not a recognizable token standard — skipped silently (not held as 20/721)
    } finally {
      done++;
      if (onProgress) onProgress(done, contracts.length);
    }
  });
  await pool(tasks, CONCURRENCY, null);
  // merge curated ERC-20s already found? No — caller merges. Sort for stable display.
  erc20.sort((a, b) => a.symbol.localeCompare(b.symbol));
  return { erc20, erc721 };
}

// 4. ERC-1155: TransferSingle / TransferBatch with to == addr; confirm via balanceOf
async function scan1155(addr, fromBlock, toBlock, onProgress) {
  const me = addrToTopic(addr);
  const [single, batch] = await Promise.all([
    getLogsChunked({ address: undefined, topics: [TOPIC_TRANSFER_SINGLE, null, null, me] },
      fromBlock, toBlock, (d, t) => onProgress && onProgress(d, t * 2)),
    getLogsChunked({ address: undefined, topics: [TOPIC_TRANSFER_BATCH, null, null, me] },
      fromBlock, toBlock, (d, t) => onProgress && onProgress(d + t, t * 2)),
  ]);
  const pairs = new Map(); // "contract:id" -> {contract, id}
  for (const l of single) {
    try {
      const id = decodeUint(l.data);
      const value = decodeUint('0x' + l.data.slice(66));
      if (id == null || value == null || value === 0n) continue;
      const k = normAddr(l.address) + ':' + id.toString();
      if (!pairs.has(k)) pairs.set(k, { contract: l.address, id: id.toString() });
    } catch (e) { /* malformed log */ }
  }
  for (const l of batch) {
    const dec = decodeBatchData(l.data);
    if (!dec) continue;
    for (const id of dec.ids) {
      const k = normAddr(l.address) + ':' + id.toString();
      if (!pairs.has(k)) pairs.set(k, { contract: l.address, id: id.toString() });
    }
  }
  const holdings = [];
  const tasks = [...pairs.values()].map((p) => async () => {
    try {
      const raw = await withRetryOnce(() => ethCall(p.contract, encBalanceOf1155(addr, p.id)));
      const bal = decodeUint(raw);
      if (bal != null && bal > 0n) holdings.push({ contract: p.contract, id: p.id, balance: bal });
    } catch (e) { /* skip */ }
  });
  await pool(tasks, CONCURRENCY, null);
  return holdings;
}

// 5. Bridge withdrawals: MessagePassed events from the L2ToL1MessagePasser
//    with sender == addr. See the honesty note in the header comment.
async function scanWithdrawals(addr, fromBlock, toBlock, onProgress) {
  const logs = await getLogsChunked(
    { address: L2_TO_L1_PASSER, topics: [TOPIC_MESSAGE_PASSED, null, addrToTopic(addr)] },
    fromBlock, toBlock, onProgress
  );
  const cache = new Map();
  const nowS = Math.floor(Date.now() / 1000);
  const out = [];
  for (const l of logs) {
    try {
      const target = topicToAddr(l.topics[3]);
      const value = decodeUint(l.data);
      const dataHex = l.data.slice(2);
      const withdrawalHash = '0x' + dataHex.slice(96 * 2, 128 * 2);
      const ts = await getBlockTimestamp(l.blockNumber, cache);
      const ageDays = ts != null ? (nowS - ts) / 86400 : null;
      out.push({
        txHash: l.transactionHash,
        blockNumber: parseInt(l.blockNumber, 16),
        target,
        valueWei: value,
        withdrawalHash,
        ageDays,
        stuck: ageDays != null && ageDays > STUCK_DAYS,
      });
    } catch (e) { /* malformed log, skip */ }
  }
  out.sort((a, b) => b.blockNumber - a.blockNumber);
  return out;
}

// 6. Unclaimed Merkl rewards (public GET API)
function normalizeMerkl(json) {
  const out = [];
  const push = (r) => {
    if (!r || typeof r !== 'object') return;
    const token = r.token || r.rewardToken || {};
    let amount;
    try { amount = BigInt(r.amount || r.claimable || '0'); } catch (e) { return; }
    if (amount <= 0n) return;
    const dec = Number.isSafeInteger(token.decimals) ? token.decimals
      : (Number.isSafeInteger(r.decimals) ? r.decimals : 18);
    const usd = typeof r.usdValue === 'number' ? r.usdValue
      : (typeof r.valueUsd === 'number' ? r.valueUsd : null);
    out.push({
      symbol: token.symbol || r.symbol || 'UNKNOWN',
      decimals: dec, amount, usd,
      tokenAddress: token.address || r.tokenAddress || null,
    });
  };
  const arr = Array.isArray(json) ? json : (json && Array.isArray(json.rewards) ? json.rewards : []);
  for (const item of arr) {
    if (item && Array.isArray(item.rewards)) item.rewards.forEach(push);
    else push(item);
  }
  return out;
}

async function scanMerkl(addr) {
  const url = MERKL_API.replace('{address}', addr);
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return normalizeMerkl(await res.json());
}

// Orchestrator: runs every section, converts failures into per-section errors.
async function runScan(addr, progress) {
  const P = progress || (() => {});
  const result = { address: addr, sections: {}, failed: {} };
  const latest = await withRetryOnce(getBlockNumber);
  const toBlock = parseInt(latest, 16);
  const fromBlock = Math.max(0, toBlock - SCAN_BLOCKS);
  result.scanRange = { fromBlock, toBlock };

  P(2, 'checking chain…');
  await checkChainId();

  let ethUsd = null;
  try { ethUsd = await fetchEthUsd(); } catch (e) { /* USD context unavailable; amounts still shown */ }
  result.ethUsd = ethUsd;

  P(4, 'reading native ETH balance…');
  try { result.sections.native = await scanNative(addr, ethUsd); }
  catch (e) { result.failed.native = 'section unavailable — RPC error (' + e.message + ')'; }

  P(8, 'checking curated tokens…');
  let curated = [];
  try { curated = await scanCurated(addr); }
  catch (e) { result.failed.erc20curated = 'section unavailable — RPC error (' + e.message + ')'; }

  P(12, 'scanning Transfer logs (0%)…');
  let tlogs = null;
  try {
    tlogs = await discoverInboundTransfers(addr, fromBlock, toBlock,
      (d, t) => P(12 + Math.round(30 * d / t), 'scanning Transfer logs (' + d + '/' + t + ' chunks)…'));
  } catch (e) { result.failed.transfers = 'section unavailable — RPC error (' + e.message + ')'; }

  if (tlogs) {
    P(44, 'classifying token contracts…');
    try {
      const { erc20, erc721 } = await classifyTokens(addr, tlogs,
        (d, t) => P(44 + Math.round(14 * d / t), 'classifying token contracts (' + d + '/' + t + ')…'));
      const seen = new Set(curated.map((c) => normAddr(c.contract)));
      result.sections.erc20 = [...curated, ...erc20.filter((c) => !seen.has(normAddr(c.contract)))];
      result.sections.erc721 = erc721;
    } catch (e) { result.failed.classify = 'section unavailable — RPC error (' + e.message + ')'; }
  } else {
    result.sections.erc20 = curated;
    result.sections.erc721 = null;
  }

  P(60, 'scanning ERC-1155 transfers…');
  try {
    result.sections.erc1155 = await scan1155(addr, fromBlock, toBlock,
      (d, t) => P(60 + Math.round(20 * d / t), 'scanning ERC-1155 logs (' + d + '/' + t + ' chunks)…'));
  } catch (e) { result.failed.erc1155 = 'section unavailable — RPC error (' + e.message + ')'; }

  P(82, 'scanning bridge withdrawals…');
  try {
    result.sections.withdrawals = await scanWithdrawals(addr, fromBlock, toBlock,
      (d, t) => P(82 + Math.round(12 * d / t), 'scanning bridge withdrawals (' + d + '/' + t + ' chunks)…'));
  } catch (e) { result.failed.withdrawals = 'section unavailable — RPC error (' + e.message + ')'; }

  P(96, 'checking Merkl rewards…');
  try { result.sections.merkl = await scanMerkl(addr); }
  catch (e) { result.failed.merkl = 'section unavailable — API error (' + e.message + ')'; }

  P(100, 'done.');
  return result;
}

/* ============================ rendering (DOM) ============================ */

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function extLink(href, text, mono) {
  const a = document.createElement('a');
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = text;
  if (mono) a.className = 'mono';
  return a;
}

function basescanAddr(a) { return 'https://basescan.org/address/' + a; }
function basescanTx(h) { return 'https://basescan.org/tx/' + h; }

function findingCard(sev, title) {
  const card = el('div', 'finding sev-' + sev);
  card.appendChild(el('h3', null, title));
  return card;
}

function errorCard(title, msg) {
  const card = findingCard('bad', title);
  card.appendChild(el('p', null, msg));
  return card;
}

function holdingRow(leftNode, amountText, usdText) {
  const row = el('div', 'holding');
  const left = el('div');
  left.appendChild(leftNode);
  row.appendChild(left);
  const right = el('div', 'amount', amountText);
  if (usdText) {
    right.appendChild(el('span', 'usd', '  ' + usdText));
  }
  row.appendChild(right);
  return row;
}

function renderNative(s, ethUsd) {
  const eth = Number(s.wei) / 1e18;
  let card;
  if (s.wei === 0n) {
    card = findingCard('info', 'Native ETH');
    card.appendChild(el('p', null, 'No native ETH at this address.'));
  } else if (s.dust) {
    card = findingCard('info', 'Native ETH — dust');
    card.appendChild(el('p', null,
      'Dust balance (under ~$1 at current prices). Probably not worth moving on its own, but it counts toward gas.'));
  } else {
    card = findingCard('ok', 'Native ETH');
  }
  if (s.wei > 0n) {
    const usd = s.usd != null ? formatUsd(s.usd) : 'price unavailable';
    card.appendChild(holdingRow(el('span', 'mono', 'ETH (native)'), eth.toFixed(6) + ' ETH', usd));
  }
  return card;
}

function renderErc20(list) {
  const card = findingCard(list.length ? 'ok' : 'info', 'ERC-20 tokens');
  if (!list.length) {
    card.appendChild(el('p', 'muted',
      'No ERC-20 balances found (curated list + inbound transfers in the scan window).'));
    return card;
  }
  for (const t of list) {
    const left = el('span');
    left.appendChild(el('strong', null, t.symbol + '  '));
    left.appendChild(extLink(basescanAddr(t.contract), shortAddr(t.contract), true));
    card.appendChild(holdingRow(left, formatUnits(t.balance, t.decimals) + ' ' + t.symbol, null));
  }
  return card;
}

function renderErc721(list) {
  const card = findingCard(list.length ? 'ok' : 'info', 'ERC-721 NFTs');
  if (!list.length) {
    card.appendChild(el('p', 'muted', 'No ERC-721 holdings verified in the scan window.'));
    return card;
  }
  for (const n of list) {
    const p = el('p');
    p.appendChild(el('strong', null, 'Contract '));
    p.appendChild(extLink(basescanAddr(n.contract), shortAddr(n.contract), true));
    p.appendChild(el('span', null, ' — token IDs held: '));
    n.tokenIds.forEach((id, i) => {
      if (i > 0) p.appendChild(document.createTextNode(', '));
      p.appendChild(extLink('https://basescan.org/token/' + n.contract + '?a=' + id, '#' + id, true));
    });
    card.appendChild(p);
  }
  return card;
}

function render1155(list) {
  const card = findingCard(list.length ? 'ok' : 'info', 'ERC-1155 editions');
  if (!list.length) {
    card.appendChild(el('p', 'muted', 'No ERC-1155 balances confirmed in the scan window.'));
    return card;
  }
  for (const h of list) {
    const left = el('span');
    left.appendChild(extLink(basescanAddr(h.contract), shortAddr(h.contract), true));
    left.appendChild(el('span', 'mono', '  id ' + h.id));
    card.appendChild(holdingRow(left, '× ' + h.balance.toString(), null));
  }
  return card;
}

function renderWithdrawals(list) {
  const card = findingCard(list.length ? 'warn' : 'info', 'Base → L1 withdrawals');
  const note = el('p', 'fineprint',
    'Detected from MessagePassed events on the L2ToL1MessagePasser. ' +
    'This app does NOT check L1 finalization status — a withdrawal is only complete after it is ' +
    'proven and finalized. "Likely stuck" below is purely an age heuristic (>30 days), not a finality verdict. ' +
    'Verify and complete every withdrawal in the official bridge app.');
  card.appendChild(note);
  if (!list.length) {
    card.appendChild(el('p', 'muted', 'No bridge withdrawals found in the scan window.'));
    return card;
  }
  for (const w of list) {
    const box = el('div', 'finding sev-' + (w.stuck ? 'bad' : 'warn'));
    box.style.margin = '10px 0';
    const title = w.stuck ? 'LIKELY STUCK — initiated ' : 'Withdrawal — initiated ';
    const age = w.ageDays != null ? Math.floor(w.ageDays) + ' days ago' : 'unknown time ago';
    box.appendChild(el('h3', null, title + age));
    const dl = el('dl', 'kv');
    const rows = [
      ['To (L1 target)', w.target, true],
      ['Value', w.valueWei != null ? formatUnits(w.valueWei, 18) + ' ETH' : 'unknown'],
      ['Withdrawal hash', w.withdrawalHash.slice(0, 18) + '…', true],
    ];
    for (const [k, v, mono] of rows) {
      const div = el('div');
      div.appendChild(el('dt', null, k));
      const dd = el('dd', mono ? 'mono small' : null, v);
      div.appendChild(dd);
      dl.appendChild(div);
    }
    box.appendChild(dl);
    const links = el('p');
    links.appendChild(extLink(basescanTx(w.txHash), 'View tx on Basescan', true));
    links.appendChild(document.createTextNode('  ·  '));
    links.appendChild(extLink('https://bridge.base.org', 'Complete / verify in the official bridge'));
    box.appendChild(links);
    card.appendChild(box);
  }
  return card;
}

function renderMerkl(list) {
  const card = findingCard(list.length ? 'ok' : 'info', 'Unclaimed Merkl rewards');
  if (!list.length) {
    card.appendChild(el('p', 'muted',
      'No unclaimed Merkl rewards found for this address. (Other distributors are roadmap.)'));
    return card;
  }
  for (const r of list) {
    const left = el('span');
    left.appendChild(el('strong', null, r.symbol + '  '));
    if (r.tokenAddress) left.appendChild(extLink(basescanAddr(r.tokenAddress), shortAddr(r.tokenAddress), true));
    card.appendChild(holdingRow(left,
      formatUnits(r.amount, r.decimals) + ' ' + r.symbol,
      r.usd != null ? formatUsd(r.usd) : null));
  }
  const p = el('p');
  p.appendChild(extLink('https://merkl.xyz', 'Claim on merkl.xyz'));
  card.appendChild(p);
  return card;
}

function renderFindings(result) {
  const host = document.getElementById('findings');
  host.textContent = '';
  const range = result.scanRange;
  const scope = el('p', 'scope-note',
    'Scanned blocks ' + range.fromBlock.toLocaleString('en-US') + ' → ' +
    range.toBlock.toLocaleString('en-US') + ' on Base (last ~' +
    ((range.toBlock - range.fromBlock) / 1e6).toFixed(1) + 'M blocks, ~46 days). ' +
    'Older history is not covered — full-history deep scan is roadmap.');
  host.appendChild(scope);

  const F = result.failed, S = result.sections;
  host.appendChild(F.native ? errorCard('Native ETH', F.native) : renderNative(S.native, result.ethUsd));
  if (F.erc20curated && !S.erc20) host.appendChild(errorCard('ERC-20 tokens', F.erc20curated));
  else host.appendChild(renderErc20(S.erc20 || []));
  if (F.transfers) host.appendChild(errorCard('Transfer history', F.transfers));
  if (F.classify) host.appendChild(errorCard('ERC-721 NFTs', F.classify));
  else if (S.erc721) host.appendChild(renderErc721(S.erc721));
  else if (F.transfers) host.appendChild(errorCard('ERC-721 NFTs', F.transfers));
  else host.appendChild(renderErc721([]));
  host.appendChild(F.erc1155 ? errorCard('ERC-1155 editions', F.erc1155) : render1155(S.erc1155 || []));
  host.appendChild(F.withdrawals ? errorCard('Base → L1 withdrawals', F.withdrawals) : renderWithdrawals(S.withdrawals || []));
  host.appendChild(F.merkl ? errorCard('Unclaimed Merkl rewards', F.merkl) : renderMerkl(S.merkl || []));
}

/* ============================ $RESCUE price panel ============================ */

async function loadRescuePrice() {
  const box = document.getElementById('rescue-price');
  let j;
  try {
    const res = await fetch(DEXSCREENER_API);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    j = await res.json();
  } catch (e) {
    box.textContent = '';
    box.appendChild(el('p', 'muted', 'Market data unavailable right now.'));
    box.appendChild(extLink('https://basescan.org/token/' + RESCUE_TOKEN, 'View $RESCUE on Basescan', true));
    return;
  }
  const pairs = j && j.pairs;
  box.textContent = '';
  if (!pairs || pairs.length === 0) {
    // Honesty: never show $0 or fake data for an unindexed token.
    box.appendChild(el('p', null, 'Not indexed by DEXScreener yet.'));
    box.appendChild(el('p', 'fineprint',
      'No price is shown because there is no market data — a missing price is not a $0 price.'));
    box.appendChild(extLink('https://basescan.org/token/' + RESCUE_TOKEN, 'View $RESCUE on Basescan', true));
    return;
  }
  const sorted = [...pairs].sort((a, b) => ((b.liquidity && b.liquidity.usd) || 0) - ((a.liquidity && a.liquidity.usd) || 0));
  const p = sorted[0];
  const price = parseFloat(p.priceUsd);
  box.appendChild(el('p', 'price-big', isFinite(price) ? '$' + price.toPrecision(4) : '—'));
  const row = el('div', 'price-row');
  if (p.priceChange && p.priceChange.h24 != null) {
    const chg = parseFloat(p.priceChange.h24);
    row.appendChild(el('span', chg >= 0 ? 'up' : 'down', '24h ' + (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%'));
  }
  if (p.liquidity && p.liquidity.usd != null) row.appendChild(el('span', 'muted', 'Liq ' + formatUsd(p.liquidity.usd)));
  if (p.fdv != null) row.appendChild(el('span', 'muted', 'FDV ' + formatUsd(p.fdv)));
  if (p.dexId) row.appendChild(el('span', 'muted', String(p.dexId)));
  box.appendChild(row);
  const lp = el('p', 'fineprint');
  // Link-only destinations must stay within the allowlist (basescan / bridge /
  // merkl / docs.base.org / x.com/Foil667), so the pair link falls back to Basescan.
  lp.appendChild(extLink('https://basescan.org/token/' + RESCUE_TOKEN, 'View $RESCUE on Basescan', true));
  box.appendChild(lp);
}

/* ============================ form wiring ============================ */

function setProgress(pct, text) {
  const bar = document.getElementById('progress');
  bar.hidden = false;
  document.getElementById('progress-fill').style.width = Math.max(0, Math.min(100, pct)) + '%';
  document.getElementById('progress-text').textContent = text;
}

function initApp() {
  loadRescuePrice();
  const form = document.getElementById('scan-form');
  const input = document.getElementById('addr-input');
  const btn = document.getElementById('scan-btn');
  const errBox = document.getElementById('addr-error');

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const addr = input.value.trim();
    if (!isValidAddress(addr)) {
      errBox.hidden = false;
      errBox.textContent = 'Invalid address. Expected 0x followed by 40 hex characters — nothing was scanned.';
      input.focus();
      return;
    }
    errBox.hidden = true;
    btn.disabled = true;
    document.getElementById('findings').textContent = '';
    try {
      setProgress(1, 'starting scan…');
      const result = await runScan(addr, setProgress);
      renderFindings(result);
    } catch (e) {
      const host = document.getElementById('findings');
      host.textContent = '';
      host.appendChild(errorCard('Scan failed', 'The scan could not start: ' + e.message));
    } finally {
      btn.disabled = false;
      setProgress(100, 'done.');
    }
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
}

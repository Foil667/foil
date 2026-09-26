#!/usr/bin/env node
/**
 * fast-mint.mjs — race a verified FREE SeaDrop public mint on Robinhood Chain.
 *
 * Usage:
 *   node fast-mint.mjs <nftContract> <qty> [flags]
 *
 * Flags:
 *   --priority-gwei <n>        initial maxPriorityFeePerGas, in gwei (default 2)
 *   --poll-rpcs <u1,u2>        comma-separated RPC URLs used to poll receipts
 *                              (default: primary RH RPC + 2 UNVERIFIED public alternates)
 *   --confirm-timeout-ms <ms>  how long to poll for a receipt per wallet (default 120000)
 *   --early-ms <ms>            fire this many ms before drop start (default 750)
 *   --pre-encode-mins <n>      pre-encode window: do encode+verify this many
 *                              minutes before drop open (default 10). If invoked
 *                              earlier, the tool idles until the window opens, then
 *                              works immediately. Recommended pattern: run the tool
 *                              ~10 min before drop open.
 *   --mint-url <url>           mint page URL — runs the Tinfoil Scan gate
 *                              (claim-with-tinfoil.sh) before ANY verification.
 *                              Required by standing rule whenever a mint URL exists.
 *   --wallets <path>           JSON array of {label, apiKeyEnvVar, address}: fans the
 *                              SAME verified claim out across wallets in parallel.
 *                              Default: single wallet (Foil's funded wallet, Bankr key
 *                              from ~/.bankr/config.json). Each extra wallet needs its
 *                              OWN Bankr API key (named env var, value never logged)
 *                              AND its OWN gas funding — both require the user's
 *                              explicit per-action approval. Scaffolding only: this
 *                              tool never funds wallets and never touches
 *                              CCFF00 square #4429.
 *   --dry                      verification + calldata + gas estimate ONLY.
 *                              NEVER signs, NEVER submits, NEVER spends.
 *   --max-price-usd <n>        max mint price in USD (default 0 = free only).
 *                              Standing rule (user 2026-09-26): pass 0.10 to
 *                              allow paid mints under $0.10. Gated at verify
 *                              time AND re-checked on the built tx; tx value is
 *                              exactly price x qty, never more.
 *
 * Pipeline (live mode):
 *   0. If --mint-url given: Tinfoil Scan gate FIRST. Anything but a clean pass
 *      aborts before any verification, signing, or submission.
 *   1. If invoked earlier than T-(--pre-encode-mins), idle until the window opens.
 *   2. PRE-ENCODE (immediate): encode mintPublic calldata + early verification
 *      (price<=cap, qty<=maxSupply, no allowlist root). NO signing pre-open:
 *      Bankr /wallet/submit signs AND broadcasts server-side immediately, so a
 *      pre-signed hold step is impossible — submission happens at fire time only.
 *   3. Sleep until T - early-ms.
 *   4. FIRE-TIME RE-VERIFICATION (fresh reads, non-negotiable, per wallet):
 *        price <= cap (USD) · drop active (start<=now<=end) ·
 *        allowlist merkle root unset · eth_call sim clean · gas < $0.50.
 *      ALL wallets must pass before ANY wallet submits. ANY failure => abort.
 *   5. Submit per wallet via Bankr POST /wallet/submit with
 *      waitForConfirmation=false (Bankr signs + broadcasts server-side), then
 *      poll for the receipt on --poll-rpcs until --confirm-timeout-ms.
 *
 * Bankr POST /wallet/submit contract (see
 * ~/workspace/skills/bankr-skills/bankr/references/sign-submit-api.md):
 *   request:  { transaction: {to, chainId, value, data, gas, maxFeePerGas,
 *                             maxPriorityFeePerGas, nonce},
 *               description, waitForConfirmation }
 *   success:  { success, transactionHash, status, signer, chainId }
 *   The tool REQUIRES: HTTP 2xx, a transactionHash, and signer === the
 *   expected wallet address. Anything else => fail, no retry.
 *   403s come in two shapes — plain {error} (paused wallet, arbitrary calls
 *   disabled, read-only/restricted key) or {error, errorCode} (security guard).
 *   Both are reported verbatim; neither is retried.
 *
 * HISTORY:
 * - 2026-09-25: Bankr disabled eth_signTransaction for this account, killing
 *   the old pre-sign (sign locally, broadcast later) model. Rewritten to
 *   /wallet/submit (sign+submit server-side at fire time). Pre-sign, raw
 *   broadcast race, RBF, and freshness logic removed. Zero signing latency is
 *   traded for zero pre-sign — submission still happens only after all
 *   fire-time checks pass.
 * - 2026-09-25: feeRecipient fixed to the canonical SeaDrop recipient
 *   0x0000a26b00c1f0df003000390027140000faa719 — feeRecipient=0x0 REVERTS on
 *   drops with restrictFeeRecipients=true (custom error 0x5136e8d5).
 */
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

// ---------------------------------------------------------------- constants
const RPC_PRIMARY = 'https://rpc.mainnet.chain.robinhood.com';
// Public alternates — documented (chainlist extraRpcs PRs #2960 / #2923) but
// UNVERIFIED by us: never used for a real broadcast yet. Used ONLY for receipt
// polling (read-only); the broadcast itself goes through Bankr /wallet/submit.
const RPC_PUBLICNODE = 'https://robinhood-rpc.publicnode.com';       // UNVERIFIED
const RPC_NODEFLARE = 'https://rpc.nodeflare.app/robinhood/public';  // UNVERIFIED
const DEFAULT_RPCS = [RPC_PRIMARY, RPC_PUBLICNODE, RPC_NODEFLARE];
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const SEADROP = '0x00005EA00Ac477B1030CE78506496e8C2dE24bf5';
const FEE_RECIPIENT = '0x0000a26b00c1f0df003000390027140000faa719'; // canonical SeaDrop fee recipient (never 0x0)
const WALLET = '0x6573682faee72a4a96e791ba262439f1df3a268d'; // Foil's funded wallet; signs ONLY via Bankr API
const CHAIN_ID = 4663;
const MINT_PUBLIC = '0x161ac21f';          // mintPublic(address,address,address,uint256) — verified in RH SeaDrop bytecode
const GET_PUBLIC_DROP = '0xbc6a629c';      // getPublicDrop(address) — hardcoded, never runtime-computed
const ALLOWLIST_ROOT = '0x32bf11f5';       // allowListMerkleRoot(address) — hardcoded, never runtime-computed
const MAX_GAS_USD = 0.50;
const ETH_USD = 2686;                       // static estimate, matches claim-seadrop-free.js
const APPROVE_SEL = '095ea7b3';             // approve(address,uint256)
const SET_APPROVAL_SEL = 'a22cb465';        // setApprovalForAll(address,bool)
const TINFOIL_GATE = os.homedir() + '/workspace/nft-god/claim-with-tinfoil.sh';

// ---------------------------------------------------------------- arg parsing
function parseArgs(argv) {
  const a = { nft: null, qty: null, priorityGwei: 2, pollRpcs: [...DEFAULT_RPCS], confirmTimeoutMs: 120000, earlyMs: 750, preEncodeMins: 10, mintUrl: null, walletsPath: null, dry: false, maxPriceUsd: 0 };
  const rest = [];
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--dry') a.dry = true;
    else if (t === '--priority-gwei') a.priorityGwei = Number(argv[++i]);
    else if (t === '--poll-rpcs') a.pollRpcs = argv[++i].split(',').map(s => s.trim()).filter(Boolean);
    else if (t === '--confirm-timeout-ms') a.confirmTimeoutMs = Number(argv[++i]);
    else if (t === '--early-ms') a.earlyMs = Number(argv[++i]);
    else if (t === '--pre-encode-mins') a.preEncodeMins = Number(argv[++i]);
    else if (t === '--mint-url') a.mintUrl = argv[++i];
    else if (t === '--wallets') a.walletsPath = argv[++i];
    else if (t === '--max-price-usd') a.maxPriceUsd = Number(argv[++i]);
    else rest.push(t);
  }
  [a.nft, a.qty] = [rest[0], rest[1]];
  return a;
}
function fail(msg, code = 1) { console.error(`FAILED: ${msg}`); process.exit(code); }
function blocked(reason) { console.error(`BLOCKED: ${reason}`); process.exit(1); }

/**
 * Price gate: mint price must be <= maxPriceUsd (USD via static ETH_USD).
 * Default 0 = free mints only. User order 2026-09-26 13:01 CDT: allow paid
 * mints under $0.10 (pass --max-price-usd 0.10). Aborts on ANY overage.
 */
function priceCheck(drop, label, maxPriceUsd) {
  const priceUsd = Number(drop.price) / 1e18 * ETH_USD;
  console.log(`  price: ${drop.price} wei ≈ $${priceUsd.toFixed(4)} (cap $${maxPriceUsd.toFixed(2)})`);
  if (priceUsd > maxPriceUsd + 1e-9) blocked(`[${label}] mint price $${priceUsd.toFixed(4)} exceeds cap $${maxPriceUsd.toFixed(2)} — refusing`);
  console.log(`  CHECK pass: price under $${maxPriceUsd.toFixed(2)} cap`);
}

// ---------------------------------------------------------------- wallets
/**
 * Wallet fan-out config. Default: single wallet (existing behavior).
 * --wallets <path>: JSON array of {label, apiKeyEnvVar, address}.
 * Each wallet submits via its OWN Bankr API key read from the named env var —
 * the key VALUE is never logged. apiKey() is lazy so --dry never touches keys.
 */
function loadWallets(path) {
  const def = { label: 'foil', address: WALLET, envVar: null, apiKey: () => bankrKey() };
  if (!path) return [def];
  let arr;
  try {
    arr = JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch (e) { fail(`--wallets: cannot read/parse ${path}: ${e.message}`); }
  if (!Array.isArray(arr) || arr.length === 0) fail(`--wallets ${path}: expected a non-empty JSON array of {label, apiKeyEnvVar, address}`);
  return arr.map((w, i) => {
    if (!w || typeof w.label !== 'string' || !w.label) fail(`--wallets[${i}]: missing "label"`);
    if (typeof w.apiKeyEnvVar !== 'string' || !w.apiKeyEnvVar) fail(`--wallets[${i}] ("${w.label}"): missing "apiKeyEnvVar"`);
    if (!/^0x[0-9a-fA-F]{40}$/.test(w.address || '')) fail(`--wallets[${i}] ("${w.label}"): bad "address"`);
    return {
      label: w.label,
      address: w.address,
      envVar: w.apiKeyEnvVar,
      apiKey: () => {
        const k = process.env[w.apiKeyEnvVar];
        if (!k) fail(`wallet "${w.label}": env var ${w.apiKeyEnvVar} is not set — each wallet needs its OWN Bankr API key (value never logged)`);
        return k;
      },
    };
  });
}
/** Dry-run wallet validation: structure + env-var presence (names only, never values). */
function validateWalletsDry(wallets) {
  for (const w of wallets) {
    if (w.envVar) {
      if (!process.env[w.envVar]) fail(`--dry: wallet "${w.label}" needs env var ${w.envVar} set (value never logged)`);
      console.log(`  wallet "${w.label}" ${w.address}: Bankr key from env ${w.envVar} (set — value never logged)`);
    } else {
      console.log(`  wallet "${w.label}" ${w.address}: Bankr key from ~/.bankr/config.json (not read in dry mode)`);
    }
  }
}

// ---------------------------------------------------------------- rpc helpers
async function rpcRaw(url, method, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  });
  const d = await res.json().catch(() => ({}));
  if (d.error) throw new Error(`${method}: ${JSON.stringify(d.error)}`);
  return d.result;
}
const rpc = (method, params) => rpcRaw(RPC_PRIMARY, method, params);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const fmtDur = ms => { const s = Math.round(ms / 1000); return s < 60 ? `${(ms / 1000).toFixed(1)}s` : `${Math.floor(s / 60)}m${s % 60}s`; };
const encAddr = a => a.toLowerCase().replace(/^0x/, '').padStart(64, '0');
const encU256 = n => BigInt(n).toString(16).padStart(64, '0');
const gweiToWei = g => BigInt(Math.round(Number(g) * 1e9));

// ---------------------------------------------------------------- tinfoil gate
/** Runs claim-with-tinfoil.sh <url> <nft> <qty>. Aborts unless it exits 0. */
function tinfoilGate(url, nft, qty) {
  console.log(`[TINFOIL] scanning ${url}`);
  try {
    execFileSync(TINFOIL_GATE, [url, nft, String(qty)], { stdio: 'inherit', timeout: 120000 });
  } catch (e) {
    blocked(`Tinfoil Scan gate failed for ${url} (exit ${e.status ?? 'timeout'}) — refusing to proceed`);
  }
  console.log('[TINFOIL] gate PASS');
}

// ---------------------------------------------------------------- drop verification
async function readDrop(nft) {
  let pd;
  try {
    pd = await rpc('eth_call', [{ to: SEADROP, data: GET_PUBLIC_DROP + encAddr(nft) }, 'latest']);
  } catch (e) { blocked(`getPublicDrop read failed (not a SeaDrop drop?) — ${e.message}`); }
  const w = [];
  for (let i = 0; i < 6; i++) w.push(BigInt('0x' + pd.slice(2 + i * 64, 2 + (i + 1) * 64)));
  return { price: w[0], start: Number(w[1]), end: Number(w[2]), maxSupply: w[3], feeBps: Number(w[4]) };
}

/**
 * PRE-ENCODE verification: the early-safe subset. Runs minutes before the drop
 * opens, so the active-window, eth_call simulation, and gas-cap checks are
 * deferred to FIRE-TIME (they would trivially fail/revert pre-open).
 * Aborts (exit non-zero) on ANY failure. Signs NOTHING.
 */
async function verifyPreOpen(nft, qty, drop, maxPriceUsd) {
  console.log(`[PRE-ENCODE] early verification of ${nft} x${qty} via ${RPC_PRIMARY}`);
  const now = Math.floor(Date.now() / 1000);
  console.log(`  drop: price=${drop.price} wei start=${new Date(drop.start * 1000).toISOString()} end=${new Date(drop.end * 1000).toISOString()} maxSupply=${drop.maxSupply}`);
  priceCheck(drop, 'PRE-ENCODE', maxPriceUsd);
  if (qty > drop.maxSupply) blocked(`qty ${qty} exceeds stage maxSupply ${drop.maxSupply}`);
  const mr = await rpc('eth_call', [{ to: SEADROP, data: ALLOWLIST_ROOT + encAddr(nft) }, 'latest']);
  if (mr.slice(2, 66).replace(/0/g, '') !== '') blocked('allowlist merkle root is SET (signed allowlist phase — not a free public mint)');
  const data = buildCalldata(nft, qty); // asserts no approval selectors + exact 132 bytes
  console.log('  CHECK pass: qty within maxSupply, no allowlist root, calldata clean (mintPublic, no approvals)');
  if (drop.start <= now && now <= drop.end) console.log('  note: drop already live — fire-time verification will re-check everything anyway');
  else console.log('  note: drop not live yet — active-window, simulation, and gas-cap checks deferred to FIRE-TIME verification');
  return { drop, data };
}

/**
 * FIRE-TIME verification. Every check fresh, per wallet (sim + gas from that
 * wallet's address — per-wallet mint caps differ). Aborts (exit non-zero) on
 * ANY failure. Returns { drop, data, gasEst, usd } on success.
 */
async function verifyDrop(nft, qty, from, label = 'FIRE-TIME', maxPriceUsd = 0) {
  console.log(`[${label}] verifying ${nft} x${qty} from ${from} via ${RPC_PRIMARY}`);
  const drop = await readDrop(nft);
  const now = Math.floor(Date.now() / 1000);
  console.log(`  drop: price=${drop.price} wei start=${new Date(drop.start * 1000).toISOString()} end=${new Date(drop.end * 1000).toISOString()} maxSupply=${drop.maxSupply} now=${new Date(now * 1000).toISOString()}`);
  priceCheck(drop, label, maxPriceUsd);
  if (!(drop.start <= now && now <= drop.end)) blocked(`[${label}] public drop not active (start=${drop.start}, end=${drop.end}, now=${now})`);
  if (qty > drop.maxSupply) blocked(`[${label}] qty ${qty} exceeds stage maxSupply ${drop.maxSupply}`);
  const mr = await rpc('eth_call', [{ to: SEADROP, data: ALLOWLIST_ROOT + encAddr(nft) }, 'latest']);
  if (mr.slice(2, 66).replace(/0/g, '') !== '') blocked(`[${label}] allowlist merkle root is SET (signed allowlist phase — not a free public mint)`);
  console.log('  CHECK pass: drop active, no allowlist root (unsigned public stage)');

  const data = buildCalldata(nft, qty); // asserts no approval selectors inside
  const totalValue = drop.price * qty; // exact wei the tx must carry (0 for free mints)
  const valueHex = '0x' + totalValue.toString(16);
  try {
    await rpc('eth_call', [{ from, to: SEADROP, value: valueHex, data }, 'latest']);
  } catch (e) { blocked(`[${label}] eth_call simulation reverted: ${e.message}`); }
  console.log('  CHECK pass: eth_call simulation of mintPublic clean');

  const gasEst = BigInt(await rpc('eth_estimateGas', [{ from, to: SEADROP, value: valueHex, data }]));
  const gasPrice = BigInt(await rpc('eth_gasPrice', []));
  const usd = Number(gasEst * gasPrice) / 1e18 * ETH_USD;
  console.log(`  gas: ${gasEst} @ ${gasPrice} wei => ~$${usd.toFixed(4)}`);
  if (usd >= MAX_GAS_USD) blocked(`[${label}] estimated gas $${usd.toFixed(4)} >= $${MAX_GAS_USD.toFixed(2)} cap`);
  console.log(`  CHECK pass: gas under $${MAX_GAS_USD.toFixed(2)} cap`);
  console.log(`[${label}] ALL CHECKS PASS`);
  return { drop, data, gasEst, usd, totalValue };
}

// ---------------------------------------------------------------- calldata
function buildCalldata(nft, qty) {
  const data = '0x' + MINT_PUBLIC.slice(2) + encAddr(nft) + encAddr(FEE_RECIPIENT) + encAddr('0x0000000000000000000000000000000000000000') + encU256(qty);
  assertNoApprovals(data);
  const len = (data.length - 2) / 2;
  if (len !== 132) fail(`calldata length ${len} bytes, expected 132 (selector + 4 args) — refusing`);
  return data;
}
/** Hard rule: mint calldata must never carry an approval. Abort if violated. */
function assertNoApprovals(data) {
  const d = data.toLowerCase();
  if (!d.startsWith(MINT_PUBLIC)) fail(`calldata selector is not mintPublic (${d.slice(0, 10)}) — refusing`);
  if (d.includes(APPROVE_SEL)) fail('calldata contains approve() selector — refusing');
  if (d.includes(SET_APPROVAL_SEL)) fail('calldata contains setApprovalForAll() selector — refusing');
}

// ---------------------------------------------------------------- tx building (EIP-1559)
/**
 * Build the unsigned tx object for Bankr /wallet/submit.
 * EIP-1559 fields (maxFeePerGas / maxPriorityFeePerGas) are always set, per the
 * Bankr sign-submit API reference — no legacy gasPrice, no approvals.
 * value = EXACTLY the verified mint price × qty (0 for free mints); the price
 * cap is re-checked here as belt-and-suspenders before anything signs.
 */
function buildTx(w, data, gasLimit, maxFee, maxPriority, nonce, totalValue, maxPriceUsd) {
  const tx = {
    to: SEADROP,
    chainId: CHAIN_ID,
    value: '0x' + totalValue.toString(16),
    data,
    gas: '0x' + gasLimit.toString(16),
    maxFeePerGas: '0x' + maxFee.toString(16),
    maxPriorityFeePerGas: '0x' + maxPriority.toString(16),
    nonce: Number(nonce),
  };
  assertNoApprovals(tx.data); // belt and suspenders on the submitted payload
  if (BigInt(tx.value) !== totalValue) fail(`[${w.label}] refusing: tx value mismatch`);
  const valueUsd = Number(totalValue) / 1e18 * ETH_USD;
  if (valueUsd > maxPriceUsd + 1e-9) fail(`[${w.label}] refusing: tx value $${valueUsd.toFixed(4)} exceeds cap $${maxPriceUsd.toFixed(2)}`);
  if (!tx.maxFeePerGas || !tx.maxPriorityFeePerGas) fail(`[${w.label}] refusing: EIP-1559 fee fields missing`);
  return tx;
}

// ---------------------------------------------------------------- fee data
async function feeData() {
  let baseFee = 0n, networkPriority = 0n;
  try {
    const fh = await rpc('eth_feeHistory', ['0x1', 'latest', [50]]);
    baseFee = BigInt(fh.baseFeePerGas[fh.baseFeePerGas.length - 1]);
    const rw = fh.reward[fh.reward.length - 1];
    if (rw && rw[0]) networkPriority = BigInt(rw[0]);
  } catch { /* fall through to gasPrice fallback */ }
  if (baseFee === 0n) {
    const gp = BigInt(await rpc('eth_gasPrice', []));
    baseFee = gp; // legacy fallback: treat gasPrice as the fee ceiling basis
  }
  return { baseFee, networkPriority };
}

// ---------------------------------------------------------------- Bankr submit (live only — never called in --dry)
function bankrKey() {
  const cfg = JSON.parse(fs.readFileSync(os.homedir() + '/.bankr/config.json', 'utf8'));
  if (!cfg.apiKey) fail('no apiKey in ~/.bankr/config.json');
  return cfg.apiKey;
}

/**
 * Submit one wallet's verified claim via Bankr POST /wallet/submit.
 * Bankr signs + broadcasts server-side immediately (no pre-sign possible).
 * Hard requirements: HTTP 2xx, response carries transactionHash, and the
 * returned signer matches the expected wallet address. 403s (paused wallet,
 * arbitrary calls disabled, read-only/restricted key, or security-guard
 * errorCode) are reported verbatim and never retried.
 */
async function bankrSubmitTx(tx, w, description) {
  console.log(`[${w.label}] submitting via Bankr /wallet/submit (nonce=${tx.nonce}, maxPriority=${tx.maxPriorityFeePerGas}, maxFee=${tx.maxFeePerGas})`);
  let res, d;
  try {
    res = await fetch('https://api.bankr.bot/wallet/submit', {
      method: 'POST',
      headers: { 'X-API-Key': w.apiKey(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction: tx, description, waitForConfirmation: false }),
    });
    d = await res.json().catch(() => ({}));
  } catch (e) { fail(`[${w.label}] Bankr /wallet/submit network error: ${e.message}`); }
  if (res.status === 403) {
    const code = d.errorCode ? ` [${d.errorCode}]` : '';
    fail(`[${w.label}] Bankr rejected the submission (403)${code}: ${d.error || JSON.stringify(d).slice(0, 300)} — not retried`);
  }
  if (!res.ok) fail(`[${w.label}] Bankr /wallet/submit ${res.status}: ${JSON.stringify(d).slice(0, 500)}`);
  if (d.signer && d.signer.toLowerCase() !== w.address.toLowerCase())
    fail(`[${w.label}] Bankr returned unexpected signer ${d.signer} (expected ${w.address}) — refusing`);
  const txHash = d.transactionHash;
  if (typeof txHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(txHash))
    fail(`[${w.label}] no transactionHash in /wallet/submit response: ${JSON.stringify(d).slice(0, 300)}`);
  console.log(`[${w.label}] submitted -> ${txHash} (signer ${d.signer || w.address}, status ${d.status || 'unknown'})`);
  return txHash;
}

// ---------------------------------------------------------------- receipt polling (read-only)
async function waitReceipt(hash, urls, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const url of urls) {
      try {
        const r = await rpcRaw(url, 'eth_getTransactionReceipt', [hash]);
        if (r) return r;
      } catch { /* try next RPC */ }
    }
    await sleep(2000);
  }
  throw new Error(`[${label}] no receipt for ${hash} after ${fmtDur(timeoutMs)} — check the explorer before any manual retry (nonce may be pending)`);
}

// ---------------------------------------------------------------- main
(async () => {
  const a = parseArgs(process.argv);
  if (!a.nft || !/^0x[0-9a-fA-F]{40}$/.test(a.nft)) fail('usage: node fast-mint.mjs <nftContract> <qty> [--priority-gwei n] [--poll-rpcs u1,u2] [--confirm-timeout-ms ms] [--early-ms ms] [--pre-encode-mins n] [--mint-url url] [--wallets path] [--dry]');
  const qty = BigInt(a.qty || '0');
  if (qty <= 0n) fail('qty must be >= 1');
  if (!Number.isFinite(a.priorityGwei) || a.priorityGwei <= 0) fail('--priority-gwei must be a positive number');
  if (!Number.isFinite(a.confirmTimeoutMs) || a.confirmTimeoutMs <= 0) fail('--confirm-timeout-ms must be positive');
  if (!Number.isFinite(a.earlyMs) || a.earlyMs < 0) fail('--early-ms must be >= 0');
  if (!Number.isFinite(a.preEncodeMins) || a.preEncodeMins < 0) fail('--pre-encode-mins must be >= 0');
  if (!Number.isFinite(a.maxPriceUsd) || a.maxPriceUsd < 0) fail('--max-price-usd must be >= 0');
  if (a.pollRpcs.length === 0) fail('--poll-rpcs needs at least one RPC URL');

  const wallets = loadWallets(a.walletsPath);
  console.log(`fast-mint: ${a.nft} x${qty} ${a.dry ? '(DRY RUN)' : '(LIVE)'} chainId=${CHAIN_ID} maxPriceUsd=$${a.maxPriceUsd.toFixed(2)} wallets=[${wallets.map(w => `${w.label}:${w.address}`).join(', ')}]`);

  // ---- gate 0: Tinfoil Scan (when a mint URL exists). Runs before everything.
  if (a.mintUrl && !a.dry) tinfoilGate(a.mintUrl, a.nft, qty);
  else if (a.mintUrl) console.log('[TINFOIL] dry mode — gate skipped (would scan ' + a.mintUrl + ')');
  else if (!a.dry) console.log('[TINFOIL] no --mint-url given — operator must have verified the route another way (standing rule: every known mint URL goes through claim-with-tinfoil.sh)');

  // ---- DRY: verification + encoding + gas estimate ONLY. Never signs, never submits, never spends.
  if (a.dry) {
    const data = buildCalldata(a.nft, qty);
    console.log(`calldata pre-encoded (${(data.length - 2) / 2} bytes), selector ${data.slice(0, 10)} = mintPublic, feeRecipient ${FEE_RECIPIENT}, no approval calldata present`);
    validateWalletsDry(wallets);
    await Promise.all(wallets.map(w => verifyDrop(a.nft, qty, w.address, `DRY [${w.label}]`, a.maxPriceUsd)));
    console.log(`plan: pre-encode window T-${a.preEncodeMins}min, fire at T-${a.earlyMs}ms, ${a.pollRpcs.length} poll RPC(s), receipt timeout ${fmtDur(a.confirmTimeoutMs)}`);
    console.log('DRY RUN OK — verification passed, calldata encoded, gas estimated. Nothing signed, nothing submitted, nothing spent.');
    return;
  }

  // ---- LIVE phase 0: idle until the pre-encode window if invoked early.
  const peek = await readDrop(a.nft);
  {
    const wait = peek.start * 1000 - a.preEncodeMins * 60 * 1000 - Date.now();
    if (a.preEncodeMins > 0 && wait > 0) {
      console.log(`drop opens ${new Date(peek.start * 1000).toISOString()} — invoked early; idling ${fmtDur(wait)} until the pre-encode window (T-${a.preEncodeMins}min)`);
      await sleep(wait);
    }
  }

  // ---- LIVE phase 1 — PRE-ENCODE (immediate): encode + early-verify. Signs NOTHING.
  const pre = await verifyPreOpen(a.nft, qty, peek, a.maxPriceUsd);
  console.log(`pre-encode complete — calldata ready, nothing signed, nothing broadcast`);

  // ---- LIVE phase 2: sleep until T - earlyMs.
  {
    const wait = pre.drop.start * 1000 - a.earlyMs - Date.now();
    if (wait > 0) {
      console.log(`sleeping ${fmtDur(wait)} until T-${a.earlyMs}ms`);
      await sleep(wait);
    } else {
      console.log('drop already live — proceeding to fire-time verification immediately');
    }
  }

  // ---- LIVE phase 3 — FIRE-TIME: fresh full verification for EVERY wallet first.
  // ALL wallets must pass before ANY wallet submits; any failure aborts everything.
  const verified = await Promise.all(wallets.map(async w => ({ w, v: await verifyDrop(a.nft, qty, w.address, `FIRE-TIME [${w.label}]`, a.maxPriceUsd) })));
  console.log(`fire-time verification passed for all ${verified.length} wallet(s) — submitting`);

  // ---- LIVE phase 4 — fan-out: each wallet builds fire-time fees + submits via /wallet/submit.
  const results = await Promise.allSettled(verified.map(async ({ w, v }) => {
    const fee = await feeData();
    let priority = gweiToWei(a.priorityGwei);
    if (fee.networkPriority > priority) priority = fee.networkPriority;
    const maxFee = fee.baseFee * 2n + priority;
    const gasLimit = (v.gasEst * 130n) / 100n;
    const nonce = BigInt(await rpc('eth_getTransactionCount', [w.address, 'pending']));
    const tx = buildTx(w, v.data, gasLimit, maxFee, priority, nonce, v.totalValue, a.maxPriceUsd);
    const txHash = await bankrSubmitTx(tx, w, `fast-mint claim ${a.nft} x${qty} (price ${v.drop.price} wei, verified)`);
    const receipt = await waitReceipt(txHash, a.pollRpcs, a.confirmTimeoutMs, w.label);
    console.log(`[${w.label}] CONFIRMED in block ${receipt.blockNumber} status=${receipt.status} gasUsed=${receipt.gasUsed}`);
    if (receipt.status !== '0x1') throw new Error(`tx mined but REVERTED: ${txHash}`);
    console.log(`[${w.label}] DONE — https://robinhoodchain.blockscout.com/tx/${txHash}`);
    return { label: w.label, txHash };
  }));
  let ok = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') { ok++; console.log(`wallet ${r.value.label} confirmed: ${r.value.txHash}`); }
    else console.error(`WALLET FAILED: ${r.reason && r.reason.message ? r.reason.message : r.reason}`);
  }
  if (ok === wallets.length) {
    console.log(`DONE: ${ok}/${wallets.length} wallet(s) minted x${qty} of ${a.nft}`);
    return;
  }
  fail(`${wallets.length - ok}/${wallets.length} wallet(s) failed — see log; check the explorer before any manual retry (nonces may be pending)`);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });

#!/usr/bin/env node
/**
 * rug-check.mjs — static rug-scan for NFT mint target contracts.
 *
 * Part of NFT_WATCHDOG_CHAD_V2. STRICTLY READ-ONLY:
 *   - no signing, no transactions, no spend, no keys, no deployments
 *   - never touches private keys or the CCFF00 square contract
 *   - only public read APIs (Sourcify, Blockscout, public RPCs)
 *
 * Usage:
 *   node rug-check.mjs <chainId> <contractAddress> [--json]
 *
 *   chainId: EVM chain id (1, 8453, 7777777, 137, 42161, 10, 81457, 4663)
 *            or "solana" for Solana program/mint accounts.
 *
 * Exit codes: 0 = clean, 2 = flagged, 3 = unknown/error.
 * Output JSON: { verdict, findings:[{severity,title,detail}], sourceAvailable,
 *                chainId, contract, scannedAt, scannedTarget }
 *
 * Pipeline:
 *   1. Resolve proxies (EIP-1967 slot read; Blockscout implementations) so the
 *      *implementation* gets scanned, not the proxy shell.
 *   2. Fetch verified source: Sourcify v2 (keyless) -> Blockscout v2 (keyless)
 *      -> Etherscan V2 (only if ETHERSCAN_API_KEY is set).
 *   3. If source: run Slither with a rug-focused detector set + custom
 *      source heuristics (owner mint, public free mint, owner withdraw/sweep).
 *      Bytecode opcode scan still runs as a second opinion.
 *   4. If no source: bytecode-level scan of runtime code via eth_getCode —
 *      flags SELFDESTRUCT (0xff) / DELEGATECALL (0xf4) with reduced confidence.
 *   5. Verdict + append to blacklist.json on flagged (deduped).
 *   6. Lord-of-War fingerprints (EVM-adapted, chains 4663/8453, ERC-20 only):
 *      additive INFO-only signals — they never change the verdict on their own.
 *
 * Detector rationale (see README.md):
 *   suicidal               - selfdestruct reachable by anyone/owner: funds vanish
 *   controlled-delegatecall- delegatecall to user-controlled address: code hijack
 *   tx-origin              - tx.origin auth: phishable, breaks composability
 *   arbitrary-send-eth     - anyone/owner can push ETH to arbitrary addresses
 *   arbitrary-send-erc20   - same for ERC20 (sweep risk)
 *   unprotected-upgrade    - upgradeable proxy with no access control on upgrade
 *   custom: owner-only mint()      - owner can inflate supply at will
 *   custom: public free mint()     - no access control + no payment (dilution risk;
 *                                   also the free-mint signal for the hunter)
 *   custom: owner-only withdraw/sweep - owner can drain contract funds
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const BLACKLIST_PATH = path.join(DIR, 'blacklist.json');
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// Make the bundled venv (slither, solc-select) usable without manual PATH setup.
const VENV_BIN = path.join(DIR, '.venv', 'bin');
if (fs.existsSync(VENV_BIN) && !process.env.PATH.split(':').includes(VENV_BIN)) {
  process.env.PATH = VENV_BIN + ':' + process.env.PATH;
}

// ---------------------------------------------------------------------------
// Chain config
// ---------------------------------------------------------------------------
const CHAINS = {
  1:       { name: 'ethereum', rpc: ['https://ethereum.publicnode.com'], blockscout: 'https://eth.blockscout.com' },
  8453:    { name: 'base',     rpc: ['https://mainnet.base.org', 'https://base.publicnode.com'], blockscout: 'https://base.blockscout.com' },
  7777777: { name: 'zora',     rpc: [], blockscout: 'https://explorer.zora.energy' }, // no reachable public RPC from here (2026-09-24)
  137:     { name: 'polygon',  rpc: ['https://polygon-bor-rpc.publicnode.com'], blockscout: 'https://polygon.blockscout.com' },
  42161:   { name: 'arbitrum', rpc: ['https://arbitrum-one.publicnode.com'], blockscout: 'https://arbitrum.blockscout.com' },
  10:      { name: 'optimism', rpc: ['https://optimism.publicnode.com'], blockscout: 'https://optimism.blockscout.com' },
  81457:   { name: 'blast',    rpc: [], blockscout: 'https://blast.blockscout.com' }, // no reachable public RPC from here (2026-09-24)
  4663:    { name: 'robinhood',rpc: ['https://rpc.mainnet.chain.robinhood.com'], blockscout: 'https://robinhoodchain.blockscout.com' },
};
const SOLANA_RPC = ['https://api.mainnet-beta.solana.com'];
const EIP1967_IMPL_SLOT = '0x360894a13ba1a3210667c828832db98dca3e00';
const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchJson(url, { method = 'GET', body = null, timeout = 20000, retries = 1 } = {}) {
  let lastErr = null;
  for (let i = 0; i <= retries; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'User-Agent': UA, 'content-type': 'application/json', accept: 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) { lastErr = e; clearTimeout(t); await sleep(500); }
  }
  throw lastErr;
}

async function ethRpc(chainId, method, params = []) {
  const cfg = CHAINS[chainId];
  if (!cfg || !cfg.rpc.length) throw new Error(`no RPC available for chain ${chainId}`);
  let lastErr = null;
  for (const rpc of cfg.rpc) {
    try {
      const j = await fetchJson(rpc, { method: 'POST', body: { jsonrpc: '2.0', id: 1, method, params }, timeout: 15000 });
      if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
      return j.result;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

function execFileP(cmd, args, { timeout = 150000, env = process.env, cwd } = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout, env, cwd, maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err && err.code !== 0 && err.killed) return reject(new Error(`timeout: ${cmd}`));
      resolve({ code: err ? (err.code ?? 1) : 0, stdout: String(stdout || ''), stderr: String(stderr || '') });
    });
  });
}

function isAddress(a) { return /^0x[0-9a-fA-F]{40}$/.test(a || ''); }

// ---------------------------------------------------------------------------
// Proxy resolution — scan the implementation, not the shell
// ---------------------------------------------------------------------------
async function resolveProxy(chainId, address) {
  // 1) EIP-1967 implementation slot via eth_getStorageAt (works on any RPC).
  try {
    const slot = await ethRpc(chainId, 'eth_getStorageAt', [address, EIP1967_IMPL_SLOT, 'latest']);
    const impl = '0x' + (slot || '').replace(/^0x/, '').slice(-40);
    if (isAddress(impl) && impl.toLowerCase() !== ZERO_ADDR) {
      return { implementation: impl, method: 'eip1967-slot' };
    }
  } catch { /* fall through */ }
  // 2) Blockscout implementations list.
  try {
    const cfg = CHAINS[chainId];
    if (cfg?.blockscout) {
      const j = await fetchJson(`${cfg.blockscout}/api/v2/smart-contracts/${address}`, { timeout: 20000 });
      const impls = j.implementations || [];
      if (impls.length && isAddress(impls[0].address_hash)) {
        return { implementation: impls[0].address_hash, method: 'blockscout-implementations', name: impls[0].name };
      }
    }
  } catch { /* fall through */ }
  return null;
}

// ---------------------------------------------------------------------------
// Source fetching (all keyless; Etherscan only if a key is provided)
// ---------------------------------------------------------------------------
async function fetchSourcify(chainId, address) {
  try {
    const j = await fetchJson(
      `https://sourcify.dev/server/v2/contract/${chainId}/${address}?fields=sources,abi,metadata,proxyResolution`,
      { timeout: 30000, retries: 1 }
    );
    if (!j || !j.sources || !Object.keys(j.sources).length) return null;
    // v2 shape: { "<path>": { content: "..." } } — normalize to { path: string }.
    const sources = {};
    for (const [p, v] of Object.entries(j.sources)) {
      sources[p] = (v && typeof v === 'object' && typeof v.content === 'string') ? v.content : v;
    }
    return { sources, metadata: j.metadata, via: 'sourcify' };
  } catch { return null; }
}

async function fetchBlockscout(chainId, address) {
  try {
    const cfg = CHAINS[chainId];
    if (!cfg?.blockscout) return null;
    const j = await fetchJson(`${cfg.blockscout}/api/v2/smart-contracts/${address}`, { timeout: 25000, retries: 1 });
    if (!j || !j.source_code) return null;
    const sources = {};
    const main = j.file_path || 'Contract.sol';
    sources[main] = j.source_code;
    for (const extra of (j.additional_sources || [])) {
      if (extra.file_path && extra.source_code) sources[extra.file_path] = extra.source_code;
    }
    return { sources, metadata: null, via: 'blockscout', compiler: j.compiler_version };
  } catch { return null; }
}

async function fetchEtherscanV2(chainId, address) {
  const key = process.env.ETHERSCAN_API_KEY;
  if (!key) return null;
  try {
    const j = await fetchJson(
      `https://api.etherscan.io/v2/api?chainid=${chainId}&module=contract&action=getsourcecode&address=${address}&apikey=${key}`,
      { timeout: 25000, retries: 1 }
    );
    const r = j?.result?.[0];
    if (!r || !r.SourceCode || r.SourceCode === '') return null;
    let sources;
    const sc = r.SourceCode.trim();
    if (sc.startsWith('{')) {
      // Standard-JSON multi-file format.
      const parsed = JSON.parse(sc.replace(/^{{/,'{').replace(/}}$/,'}'));
      sources = {};
      for (const [p, f] of Object.entries(parsed.sources || {})) sources[p] = f.content;
    } else {
      sources = { 'Contract.sol': sc };
    }
    if (!Object.keys(sources).length) return null;
    return { sources, metadata: null, via: 'etherscan', compiler: r.CompilerVersion };
  } catch { return null; }
}

async function fetchSource(chainId, address) {
  return (await fetchSourcify(chainId, address))
      || (await fetchBlockscout(chainId, address))
      || (await fetchEtherscanV2(chainId, address));
}

// ---------------------------------------------------------------------------
// solc version selection for Slither
// ---------------------------------------------------------------------------
function solcFromMetadata(metadata, compilerStr) {
  const v = metadata?.compiler?.version || compilerStr || '';
  const m = v.match(/v?(\d+\.\d+\.\d+)/);
  return m ? m[1] : null;
}

function solcFromPragma(src) {
  const m = src.match(/pragma\s+solidity\s+([^;]+);/);
  if (!m) return null;
  const range = m[1];
  const pinned = range.match(/(\d+\.\d+\.\d+)/);
  if (pinned) return pinned[1]; // ^x.y.z or >=x.y.z<x.a.b -> take the floor
  return null;
}

function listInstalledSolc() {
  const dir = path.join(os.homedir(), '.solc-select', 'artifacts');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .map(d => (d.match(/^solc-(\d+\.\d+\.\d+)$/) || [])[1])
    .filter(Boolean)
    .sort((a, b) => cmpVer(b, a)); // newest first
}

function cmpVer(a, b) {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) { if (pa[i] !== pb[i]) return pa[i] - pb[i]; }
  return 0;
}

function satisfies(pragmaFloor, ver) {
  // pragma like ^0.8.24 means >=0.8.24 <0.9.0 ; pinned floor version must be <= ver with same major.minor
  const [ma, mi] = pragmaFloor.split('.').map(Number);
  const [va, vi] = ver.split('.').map(Number);
  if (ma !== va) return false;
  if (ma === 0) return mi === vi && cmpVer(ver, pragmaFloor) >= 0;
  return cmpVer(ver, pragmaFloor) >= 0;
}

async function ensureSolc(wanted) {
  // wanted: { floor: '0.8.24' } | { exact: '0.8.24' }
  let installed = listInstalledSolc();
  const pick = () => {
    if (wanted.exact) return installed.includes(wanted.exact) ? wanted.exact : null;
    return installed.find(v => satisfies(wanted.floor, v)) || null;
  };
  let ver = pick();
  if (!ver) {
    // Try to install: exact version, or highest 0.8.x available for the floor.
    const target = wanted.exact || wanted.floor;
    try {
      await execFileP('solc-select', ['install', target], { timeout: 120000 });
      installed = listInstalledSolc();
      ver = pick() || (wanted.floor ? installed.find(v => satisfies(wanted.floor, v)) : null);
    } catch { /* offline or failed: fall through */ }
  }
  return ver;
}

// ---------------------------------------------------------------------------
// Slither
// ---------------------------------------------------------------------------
const SLITHER_DETECTORS = [
  'suicidal',                 // selfdestruct reachable
  'controlled-delegatecall',  // delegatecall to untrusted/user-controlled callee
  'tx-origin',                // tx.origin authentication
  'arbitrary-send-eth',       // ETH to arbitrary destinations
  'arbitrary-send-erc20',     // ERC20 to arbitrary destinations (sweep)
  'unprotected-upgrade',      // upgrade() with no access control
].join(',');

const IMPACT_SEV = { High: 'HIGH', Medium: 'MEDIUM', Low: 'LOW', Informational: 'INFO', Optimization: 'INFO' };

function pickMainFile(sources, metadata) {
  const target = metadata?.settings?.compilationTarget;
  if (target) {
    const p = Object.keys(target)[0];
    if (p && sources[p]) return p;
  }
  // Heuristic: prefer src/*.sol contract files, then the longest .sol.
  const sols = Object.keys(sources).filter(p => p.endsWith('.sol'));
  const inSrc = sols.filter(p => /(^|\/)src\//.test(p) && !/test|mock|script/i.test(p));
  const pool = inSrc.length ? inSrc : sols;
  pool.sort((a, b) => (sources[b]?.length || 0) - (sources[a]?.length || 0));
  return pool[0] || sols[0];
}

async function runSlither(workdir, mainFile, solcVer, remaps = []) {
  const outJson = path.join(workdir, 'slither-out.json');
  const env = { ...process.env, SOLC_VERSION: solcVer };
  const args = [mainFile, '--detect', SLITHER_DETECTORS, '--json', outJson, '--disable-color'];
  if (remaps.length) args.push('--solc-remaps', remaps.join(' ')); // crytic-compile splits on spaces
  const { code, stdout, stderr } = await execFileP('slither', args, { timeout: 180000, env, cwd: workdir });
  let parsed = null;
  try { parsed = JSON.parse(fs.readFileSync(outJson, 'utf8')); } catch {}
  const findings = [];
  // Slither >=0.11 nests under results; older versions put detectors at top level.
  // Note: with zero findings Slither omits the detectors key entirely.
  const detectors = parsed?.results?.detectors ?? parsed?.detectors ?? (parsed?.success ? [] : null);
  if (parsed && parsed.success && Array.isArray(detectors)) {
    for (const d of detectors) {
      findings.push({
        severity: IMPACT_SEV[d.impact] || 'INFO',
        title: `slither:${d.check}`,
        detail: (d.description || '').replace(/\s+/g, ' ').slice(0, 600),
        confidence: d.confidence || 'unknown',
      });
    }
    if (!detectors.length) {
      findings.push({
        severity: 'INFO',
        title: 'slither:no-findings',
        detail: `Slither analyzed the contract with ${SLITHER_DETECTORS.split(',').length} detectors and reported no issues.`,
      });
    }
  } else {
    findings.push({
      severity: 'INFO',
      title: 'slither:analysis-incomplete',
      detail: `Slither did not produce results (exit ${code}). Output tail: ${(stderr || stdout).slice(-400).replace(/\s+/g, ' ')}`,
    });
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Custom source heuristics — mint/withdraw patterns Slither detectors miss
// ---------------------------------------------------------------------------
export function customHeuristics(mainSource) {
  const findings = [];
  const fnRe = /function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*([^{;]*)/g;
  let m;
  const isOwnerMod = s => /\bonlyOwner\b|\bonlyAdmin\b|\bonlyRole\b|\brequireOwner\b|_checkOwner\(\)/.test(s);
  // Owner gate may also live in the body: require(msg.sender == owner, ...) etc.
  const isOwnerGated = (sig, body) => isOwnerMod(sig) ||
    /require\s*\(\s*msg\.sender\s*==|msg\.sender\s*==\s*owner\b|tx\.origin\s*==\s*owner\b|require\s*\(\s*tx\.origin\s*==/.test(body);
  const sendsValue = body => /\.\s*call\s*\{\s*value|\.transfer\s*\(|\.send\s*\(/.test(body);
  const isPayableOrPriced = (sig, body) =>
    /\bpayable\b/.test(sig) || /msg\.value\s*(>=|>|==)/.test(body) || /\bcost\b|\bprice\b|\bmintPrice\b/i.test(body);

  while ((m = fnRe.exec(mainSource))) {
    const [, name, , sig] = m;
    const vis = /external/.test(sig) ? 'external' : /public/.test(sig) ? 'public' : 'internal';
    if (vis === 'internal') continue;
    // crude body grab: from match end to balanced close (bounded)
    const start = m.index + m[0].length;
    let depth = 0, end = start, opened = false;
    for (let i = start; i < Math.min(start + 6000, mainSource.length); i++) {
      const c = mainSource[i];
      if (c === '{') { depth++; opened = true; }
      if (c === '}') { depth--; if (opened && depth === 0) { end = i; break; } }
    }
    const body = mainSource.slice(start, end);
    const mutating = !/\b(view|pure)\b/.test(sig);

    if (mutating && /(mint|claim)/i.test(name)) {
      if (isOwnerGated(sig, body)) {
        findings.push({
          severity: 'HIGH',
          title: 'heuristic:owner-controlled-mint',
          detail: `Function ${name}() is ${vis} but owner-gated — owner can mint arbitrarily (supply-inflation rug risk).`,
        });
      } else if (!isPayableOrPriced(sig, body)) {
        findings.push({
          severity: 'MEDIUM',
          title: 'heuristic:public-free-mint',
          detail: `Function ${name}() is ${vis} with no access control and no payment check — anyone can mint (dilution risk; also matches free-mint-hunter target profile).`,
        });
      } else {
        findings.push({
          severity: 'INFO',
          title: 'heuristic:public-paid-mint',
          detail: `Function ${name}() is ${vis} and priced/payable — ordinary paid mint path.`,
        });
      }
    }
    if (mutating && /(withdraw|sweep|drain|rescue)/i.test(name)) {
      if (isOwnerGated(sig, body) && sendsValue(body)) {
        findings.push({
          severity: 'HIGH',
          title: 'heuristic:owner-withdraw-sweep',
          detail: `Function ${name}() is owner-gated and moves funds out — owner can drain the contract balance.`,
        });
      } else if (sendsValue(body)) {
        findings.push({
          severity: 'HIGH',
          title: 'heuristic:unrestricted-withdraw',
          detail: `Function ${name}() is ${vis}, NOT owner-gated, and moves funds out — anyone may drain the contract.`,
        });
      }
    }
    if (/\bselfdestruct\b|\bsuicide\b/.test(body)) {
      findings.push({
        severity: 'HIGH',
        title: 'heuristic:selfdestruct-in-source',
        detail: `Function ${name}() contains selfdestruct — contract can be destroyed (funds/tokens locked forever).`,
      });
    }
    if (/tx\.origin/.test(sig + body)) {
      findings.push({
        severity: 'MEDIUM',
        title: 'heuristic:tx-origin-auth',
        detail: `Function ${name}() uses tx.origin for authorization — phishable and unsafe in composable contexts.`,
      });
    }
  }
  // Dedupe identical titles.
  const seen = new Set();
  return findings.filter(f => (seen.has(f.title) ? false : (seen.add(f.title), true)));
}

// ---------------------------------------------------------------------------
// Bytecode fallback scan — disassemble runtime code, look for danger opcodes
// ---------------------------------------------------------------------------
export function disassemble(bytecodeHex) {
  const bytes = Buffer.from(bytecodeHex.replace(/^0x/, ''), 'hex');
  const hits = { SELFDESTRUCT: 0, DELEGATECALL: 0, CREATE: 0, CREATE2: 0 };
  for (let i = 0; i < bytes.length; i++) {
    const op = bytes[i];
    if (op >= 0x60 && op <= 0x7f) { i += op - 0x5f; continue; } // PUSH1..PUSH32
    if (op === 0xff) hits.SELFDESTRUCT++;
    else if (op === 0xf4) hits.DELEGATECALL++;
    else if (op === 0xf0) hits.CREATE++;
    else if (op === 0xf5) hits.CREATE2++;
  }
  return hits;
}

export function bytecodeScan(code, { isProxyImpl = false } = {}) {
  const findings = [];
  if (!code || code === '0x') {
    findings.push({ severity: 'INFO', title: 'bytecode:no-code', detail: 'No runtime code at this address (EOA or not deployed).' });
    return { findings, empty: true };
  }
  const hits = disassemble(code);
  const codeLower = code.toLowerCase();
  // EIP-1967 implementation slot constant in bytecode => almost certainly a proxy.
  const looksProxy = codeLower.includes('360894a13ba1a3210667c828832db98dca3e00');
  // EIP-1167 minimal proxy: tiny runtime (<100 bytes) starting with the
  // 363d3d373d3d preamble, implementation address hardcoded in bytecode.
  // The DELEGATECALL target CANNOT be swapped (no upgrade path in 45 bytes) —
  // this is the standard SeaDrop ERC721 clone pattern, not a hijack risk.
  // (Added 2026-09-25: the old heuristic flagged every SeaDrop clone as
  // HIGH "DELEGATECALL with no proxy markers" — systematic false positive.)
  const looksMinimalProxy = codeLower.length <= 202 && codeLower.startsWith('0x363d3d373d3d');
  if (hits.SELFDESTRUCT > 0) {
    findings.push({
      severity: 'HIGH',
      title: 'bytecode:SELFDESTRUCT',
      detail: `Runtime bytecode contains SELFDESTRUCT opcode x${hits.SELFDESTRUCT} (heuristic scan, no source). Contract may be destroyable — funds/tokens could be locked or the rug pulled by killing it.`,
    });
  }
  if (hits.DELEGATECALL > 0) {
    if (looksMinimalProxy) {
      findings.push({
        severity: 'INFO',
        title: 'bytecode:minimal-proxy-eip1167',
        detail: `EIP-1167 minimal proxy (runtime ${(codeLower.length - 2) / 2} bytes, implementation hardcoded in bytecode — not swappable). DELEGATECALL x${hits.DELEGATECALL} is the proxy's entire job; standard for SeaDrop ERC721 clones.`,
      });
    } else if (looksProxy) {
      findings.push({
        severity: 'MEDIUM',
        title: 'bytecode:DELEGATECALL-proxy-pattern',
        detail: `Runtime bytecode contains DELEGATECALL x${hits.DELEGATECALL} with EIP-1967 proxy markers — expected for upgradeable proxies, but whoever controls the implementation/admin can swap the code.`,
      });
    } else if (isProxyImpl) {
      findings.push({
        severity: 'MEDIUM',
        title: 'bytecode:DELEGATECALL-upgradeable-impl',
        detail: `Runtime bytecode contains DELEGATECALL x${hits.DELEGATECALL}; this address is the implementation behind an upgradeable proxy (UUPS upgrade path uses delegatecall internally). Code is still mutable via the proxy admin.`,
      });
    } else {
      findings.push({
        severity: 'HIGH',
        title: 'bytecode:DELEGATECALL',
        detail: `Runtime bytecode contains DELEGATECALL opcode x${hits.DELEGATECALL} with no proxy markers (heuristic scan, no source). Executed code may come from an untrusted/swapable target.`,
      });
    }
  }
  if (hits.CREATE2 > 0) {
    findings.push({
      severity: 'INFO',
      title: 'bytecode:CREATE2',
      detail: `Runtime bytecode contains CREATE2 x${hits.CREATE2} — deterministic redeploy / metamorphic-contract pattern possible.`,
    });
  }
  if (!findings.length) {
    findings.push({
      severity: 'INFO',
      title: 'bytecode:clean-opcodes',
      detail: 'Heuristic opcode scan found no SELFDESTRUCT/DELEGATECALL. (This is NOT a clean bill of health — bytecode scans miss logic-level rugs.)',
    });
  }
  return { findings, empty: false };
}

// ---------------------------------------------------------------------------
// Lord-of-War fingerprints (EVM adaptation) — ADDITIVE risk signals only.
//
// Source: https://github.com/staccDOTsol/the-book — six on-chain fingerprints
// of the "Lord of War" rigged-launch shape (documented on Solana/pump.fun and
// reproduced from XGAS.DEV forensics on Robinhood Chain):
//   1. AMM-count anomaly    — N pools on one mint at t≈0 (the-book: 9; XGAS.DEV: 59-65 v4 pools)
//   2. Honeypot fee tiers   — operator-config pools (fee 0) / honeypot tiers (XGAS.DEV: 70-98%)
//   3. Init-without-tokens  — zero-liquidity pools quoting a price ladder (the-book: 5x→5000x; XGAS.DEV: 17x, zero trades)
//   4. JIT +dL/−dL pairing — atomic add-liquidity + swap + remove in one tx
//   5. Fixed side-payment   — creator toll, same fixed amount per fill (XGAS.DEV: 19.92 USDG/fill)
//   6. Same operator       — all participants funded by one hand; deterministic
//                            helper at the same address on many chains
//
// EVM adaptation for Robinhood Chain (4663) + Base (8453) ERC-20 launches.
// HARD RULES:
//   - every signal is severity INFO with numeric lowPoints — they NEVER flip
//     the verdict on their own (verdictFrom only counts HIGH/MEDIUM);
//   - findings are titled `low:*`; the numeric total ships as out.lowRisk;
//   - anything that can't be checked with public RPC / keyless Blockscout
//     data returns status 'unknown' instead of guessing;
//   - read-only: eth_call / eth_getLogs / Blockscout GET only.
// ---------------------------------------------------------------------------
const LOW_MAX_SCORE = 255; // 40+40+50+40+45+40
const LOW_CHAINS = [4663, 8453];
const TOPIC_TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const TOPIC_V2_MINT = '0xdcbc1c05240f31ff3ad067ef1f4feb35b283b';
const TOPIC_V2_BURN = '0xdccd412f0b1252819a9b8d09dde71da04d2de';
const TOPIC_V2_SWAP = '0xd78ad95fa46c994b6551d0da85fc275fe613';
const TOPIC_V3_MINT = '0x7a53080ba414158be7ec69b987b5fb2d07e433c';
const TOPIC_V3_BURN = '0x0c396cd989a39c68ec09b59a3358c0ec9e58cf';
const TOPIC_V3_SWAP = '0xc42079f94a6350d7e6235f29174924f928cc2ac';
const SEL_TOTALSUPPLY = '0x18160ddd';
const SEL_DECIMALS = '0x313ce567';
const SEL_SLOT0 = '0x3850c7bd';
const SEL_LIQUIDITY = '0x1a686502';
const SEL_GETRESERVES = '0x0902f1ac';
const SEL_TOKEN0 = '0x0dfe1681';
const SEL_TOKEN1 = '0xd21220a7';
const SEL_FEE = '0xddca3f43';
const V3_STANDARD_FEES = new Set([100, 500, 3000, 10000]); // 0.01% / 0.05% / 0.3% / 1%
const ZERO_TOPIC_ADDR = '0x0000000000000000000000000000000000000000';

const n2h = n => '0x' + Number(n).toString(16);
const topicAddr = t => '0x' + String(t || '').replace(/^0x/, '').slice(-40).toLowerCase();
const bigN = h => { try { return BigInt(h || '0x0'); } catch { return 0n; } };
const shortAddr = a => String(a).slice(0, 10) + '…';

export function formatUnits(value, decimals) {
  const v = BigInt(value);
  const d = Number(decimals) || 0;
  if (d === 0) return v.toString();
  const base = 10n ** BigInt(d);
  const int = v / base;
  const frac = (v % base).toString().padStart(d, '0').replace(/0+$/, '');
  return frac ? `${int}.${frac}` : int.toString();
}

// Pure: find the most-repeated fixed (to, value) payment in transfer entries.
// entries: [{ to, value (bigint-able), tx }]. Returns { to, value, txs:Set } | null.
export function countFixedPayments(entries, { exclude = [] } = {}) {
  const ex = new Set(exclude.map(e => String(e).toLowerCase()));
  const counts = new Map();
  for (const { to, value, tx } of entries) {
    const t = String(to || '').toLowerCase();
    if (!t || t === ZERO_TOPIC_ADDR || ex.has(t)) continue;
    const val = bigN(value);
    if (val === 0n) continue;
    const key = t + ':' + val.toString();
    if (!counts.has(key)) counts.set(key, { to: t, value: val, txs: new Set() });
    counts.get(key).txs.add(tx);
  }
  let best = null;
  for (const e of counts.values()) if (!best || e.txs.size > best.txs.size) best = e;
  return best;
}

// Pure: cluster a list of funder addresses -> { funder, n } of the biggest cluster.
export function clusterFunders(funders) {
  const counts = new Map();
  for (const f of funders) {
    const k = String(f || '').toLowerCase();
    if (!k || k === ZERO_TOPIC_ADDR) continue;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  let best = null;
  for (const [f, n] of counts) if (!best || n > best.n) best = { funder: f, n };
  return best;
}

async function ethCallView(chainId, to, data) {
  try {
    const r = await ethRpc(chainId, 'eth_call', [{ to, data }, 'latest']);
    return (typeof r === 'string' && r.startsWith('0x')) ? r : null;
  } catch { return null; }
}

// eth_getLogs with small block chunks (public RPCs often cap ranges).
// Returns { logs, ok } — ok=false only if EVERY chunk failed.
async function getLogsChunked(chainId, { address, topics, fromBlock, toBlock, chunk = 25 }) {
  const logs = [];
  let anyOk = false;
  for (let s = fromBlock; s <= toBlock; s += chunk) {
    const e = Math.min(s + chunk - 1, toBlock);
    try {
      const part = await ethRpc(chainId, 'eth_getLogs', [{ address, topics, fromBlock: n2h(s), toBlock: n2h(e) }]);
      if (Array.isArray(part)) { logs.push(...part); anyOk = true; }
    } catch { /* degraded to partial data */ }
  }
  return { logs, ok: anyOk };
}

async function probeErc20(chainId, address) {
  const [ts, dec] = await Promise.all([
    ethCallView(chainId, address, SEL_TOTALSUPPLY),
    ethCallView(chainId, address, SEL_DECIMALS),
  ]);
  const okWord = r => r && /^0x[0-9a-fA-F]{64}$/.test(r);
  if (!okWord(ts) || !okWord(dec)) return { ok: false };
  return { ok: true, decimals: Number(bigN(dec)) };
}

async function tokenCreationBlock(chainId, address) {
  try {
    const cfg = CHAINS[chainId];
    if (!cfg?.blockscout) return { block: null, deployer: null };
    const info = await fetchJson(`${cfg.blockscout}/api/v2/addresses/${address}`, { timeout: 20000 });
    const deployer = info?.creator_address_hash || null;
    const ctx = info?.creation_transaction_hash;
    if (!ctx) return { block: null, deployer };
    const tx = await ethRpc(chainId, 'eth_getTransactionByHash', [ctx]);
    const block = tx?.blockNumber ? parseInt(tx.blockNumber, 16) : null;
    return { block, deployer: deployer || tx?.from || null };
  } catch { return { block: null, deployer: null }; }
}

// Earliest known funder of a wallet: page Blockscout txs to the oldest one and
// take its `from` (fresh launch wallets have few txs, so this is cheap).
// Returns null when unknowable (Blockscout down, wallet's first tx is self-sent, …).
async function earliestFunder(chainId, wallet) {
  try {
    const cfg = CHAINS[chainId];
    if (!cfg?.blockscout) return null;
    let url = `${cfg.blockscout}/api/v2/addresses/${wallet}/transactions`;
    let oldest = null, pages = 0;
    while (url && pages < 4) {
      const j = await fetchJson(url, { timeout: 15000 });
      const items = j?.items || [];
      if (items.length) oldest = items[items.length - 1];
      const npp = j?.next_page_params;
      if (!npp) break;
      url = `${cfg.blockscout}/api/v2/addresses/${wallet}/transactions?` + new URLSearchParams(npp).toString();
      pages++;
    }
    if (!oldest) return null;
    const from = String(oldest.from?.hash || oldest.from || '').toLowerCase();
    if (!from || from === wallet.toLowerCase() || from === ZERO_TOPIC_ADDR) return null;
    return from;
  } catch { return null; }
}

// --- Fingerprint 1: AMM-count anomaly --------------------------------------
// the-book: 9 pools on one mint at t≈0 (XGAS.DEV: 59-65 v4 pools minutes after
// launch). EVM version: distinct DEX pools receiving the token in its first
// 50 blocks. Returns { points, status, detail, pools } — pools feed F2/F3/F4.
async function fpAmmCount(chainId, token, txLogs) {
  if (!txLogs.ok) return { id: 'amm-count', points: 0, status: 'unknown', detail: 'early transfer logs unavailable — cannot count t≈0 pools.', pools: [] };
  const recipients = [...new Set(
    txLogs.logs
      .filter(l => parseInt(l.blockNumber, 16) <= txLogs.windowEnd50)
      .map(l => topicAddr(l.topics?.[2]))
      .filter(a => a && a !== ZERO_TOPIC_ADDR)
  )].slice(0, 30);
  const codes = await Promise.all(recipients.map(a => ethRpc(chainId, 'eth_getCode', [a, 'latest']).catch(() => '0x')));
  const withCode = recipients.filter((a, i) => codes[i] && codes[i] !== '0x' && codes[i].length > 4).slice(0, 16);
  const pools = [];
  for (const a of withCode) {
    const [s0, res, t0, t1] = await Promise.all([
      ethCallView(chainId, a, SEL_SLOT0), ethCallView(chainId, a, SEL_GETRESERVES),
      ethCallView(chainId, a, SEL_TOKEN0), ethCallView(chainId, a, SEL_TOKEN1),
    ]);
    const sides = [t0, t1].filter(Boolean).map(topicAddr);
    if (!sides.includes(token)) continue; // not this token's pool (e.g. a router)
    if (s0 && s0.length >= 400) {
      const [fee, liq] = await Promise.all([
        ethCallView(chainId, a, SEL_FEE), ethCallView(chainId, a, SEL_LIQUIDITY),
      ]);
      pools.push({ address: a, kind: 'v3', fee: fee ? Number(bigN(fee)) : null, sqrtPriceX96: '0x' + s0.slice(2, 66), liquidity: liq ? bigN(liq).toString() : null });
    } else if (res && res.length >= 190) {
      pools.push({ address: a, kind: 'v2', reserves: '0x' + res.slice(2, 194) });
    }
  }
  const n = pools.length;
  const points = n >= 9 ? 40 : n >= 5 ? 25 : n >= 3 ? 15 : n >= 2 ? 8 : 0;
  const detail = n
    ? `${n} distinct DEX pool(s) touched the token in its first 50 blocks (${pools.map(p => `${shortAddr(p.address)}/${p.kind}`).join(', ')}) — AMM-count anomaly shape.`
    : 'no DEX pools detected among the token\'s first-50-block transfer recipients.';
  return { id: 'amm-count', points, status: n ? 'hit' : 'clean', detail, pools };
}

// --- Fingerprint 2: honeypot fee tiers --------------------------------------
// the-book: protocol fee 0 on all pools (operator's own config). XGAS.DEV:
// honeypot fee tiers 70-98%. EVM version: (a) V3 pool fee() anomalous
// (0 / non-standard / ≥50% honeypot tier); (b) transfer-tax keywords in
// verified source (buyTax/sellTax/…) with the max parsed rate.
async function fpFeeTiers(chainId, pools, mainSource) {
  let points = 0;
  const notes = [];
  for (const p of pools) {
    if (p.kind === 'v3' && p.fee != null) {
      if (p.fee >= 500000) { points += 30; notes.push(`${shortAddr(p.address)} fee ${(p.fee / 10000).toFixed(0)}% — honeypot tier`); }
      else if (p.fee === 0) { points += 15; notes.push(`${shortAddr(p.address)} fee 0 — operator-config pool`); }
      else if (!V3_STANDARD_FEES.has(p.fee)) { points += 10; notes.push(`${shortAddr(p.address)} non-standard fee ${(p.fee / 10000).toFixed(2)}%`); }
    }
  }
  if (mainSource) {
    const vals = [];
    const re = /(buyTax|sellTax|buyFee|sellFee|_taxFee|marketingFee|liquidityFee|devFee|transferFee|totalFees?)\s*[:=]\s*(\d+)/gi;
    let m;
    while ((m = re.exec(mainSource))) vals.push(Number(m[2]));
    if (vals.length) {
      const mx = Math.max(...vals);
      points += mx >= 20 ? 25 : mx >= 10 ? 15 : 8;
      notes.push(`source declares transfer-tax fields, max ${mx} (${vals.length} hits) — values may be % or bps, verify before acting`);
    }
  }
  points = Math.min(points, 40);
  const detail = notes.length
    ? notes.join('; ') + '.'
    : (pools.length ? 'pool fees look standard; no transfer-tax keywords in source.' : 'no pools to read fees from; no transfer-tax keywords in source.');
  return { id: 'fee-tiers', points, status: points ? 'hit' : 'clean', detail };
}

// --- Fingerprint 3: init-without-tokens price ladder ------------------------
// the-book: 8 zero-liquidity pools quoting 5x→5000x. XGAS.DEV: ladder walked
// the quoted price 17x with zero trades. EVM version: zero-liquidity pools
// among the t≈0 set + sqrtPriceX96 spread across V3 pools + zero-trade check.
async function fpInitLadder(chainId, pools, windowStart) {
  let points = 0;
  const notes = [];
  let zeroLiq = 0;
  const sqrtPs = [];
  for (const p of pools) {
    if (p.kind === 'v3') {
      if (p.liquidity === '0') zeroLiq++;
      if (p.sqrtPriceX96) sqrtPs.push(bigN(p.sqrtPriceX96));
    } else if (p.kind === 'v2' && p.reserves) {
      const r0 = bigN('0x' + p.reserves.slice(2, 66));
      const r1 = bigN('0x' + p.reserves.slice(66, 130));
      if (r0 === 0n && r1 === 0n) zeroLiq++;
    }
  }
  if (zeroLiq) {
    points += Math.min(zeroLiq * 12, 36);
    notes.push(`${zeroLiq} zero-liquidity pool(s) live at t≈0`);
  }
  if (sqrtPs.length >= 2) {
    const mx = sqrtPs.reduce((a, b) => (a > b ? a : b));
    const mn = sqrtPs.reduce((a, b) => (a < b ? a : b));
    const ratio = mn > 0n ? (Number(mx) / Number(mn)) ** 2 : 0; // price = (sqrtP/2^96)^2
    if (ratio >= 17) { points += 20; notes.push(`init-price ladder spans ~${ratio.toFixed(0)}x across pools`); }
    else if (ratio >= 5) { points += 10; notes.push(`init-price ladder spans ~${ratio.toFixed(1)}x across pools`); }
  }
  if (zeroLiq > 0) {
    // zero-trade check on the ladder pools
    let swaps = 0;
    for (const p of pools.filter(p => p.kind === 'v3' && p.liquidity === '0').slice(0, 6)) {
      const r = await getLogsChunked(chainId, { address: p.address, topics: [[TOPIC_V2_SWAP, TOPIC_V3_SWAP]], fromBlock: windowStart, toBlock: windowStart + 50 });
      swaps += r.logs.length;
    }
    if (swaps === 0) { points += 8; notes.push('zero trades on the zero-liquidity pools — pure quotation ladder'); }
  }
  points = Math.min(points, 50);
  return {
    id: 'init-ladder', points, status: points ? 'hit' : 'clean',
    detail: notes.length ? notes.join('; ') + '.' : 'no zero-liquidity pools and no cross-pool price ladder detected.',
  };
}

// --- Fingerprint 4: JIT +dL/−dL pairing --------------------------------------
// the-book: atomic swap+pull in one tx. EVM version: same-tx Mint+Swap or
// Mint+Burn on the t≈0 pools (best-effort via logs). Uniswap V4 pools have no
// per-pool contract, so V4 Initialize/Mint detection needs a known
// PoolManager address — documented stub (returns no V4 coverage).
async function fpJit(chainId, pools, windowStart) {
  const targets = pools.slice(0, 6);
  if (!targets.length) {
    return { id: 'jit-pairing', points: 0, status: 'unknown', detail: 'no pools identified — cannot check JIT add/swap/remove pairing. (V4 pools additionally need a known PoolManager address: not configured.)', swapTxs: new Set() };
  }
  const orTopics = [TOPIC_V2_MINT, TOPIC_V3_MINT, TOPIC_V2_BURN, TOPIC_V3_BURN, TOPIC_V2_SWAP, TOPIC_V3_SWAP];
  const mintSet = new Set([TOPIC_V2_MINT, TOPIC_V3_MINT].map(t => t.toLowerCase()));
  const burnSet = new Set([TOPIC_V2_BURN, TOPIC_V3_BURN].map(t => t.toLowerCase()));
  const swapSet = new Set([TOPIC_V2_SWAP, TOPIC_V3_SWAP].map(t => t.toLowerCase()));
  let bundles = 0;
  const swapTxs = new Set();
  for (const p of targets) {
    const { logs } = await getLogsChunked(chainId, { address: p.address, topics: [orTopics], fromBlock: windowStart, toBlock: windowStart + 100 });
    const byTx = new Map();
    for (const l of logs) {
      const t0 = String(l.topics?.[0] || '').toLowerCase();
      const kind = mintSet.has(t0) ? 'mint' : burnSet.has(t0) ? 'burn' : swapSet.has(t0) ? 'swap' : null;
      if (!kind) continue;
      if (!byTx.has(l.transactionHash)) byTx.set(l.transactionHash, new Set());
      byTx.get(l.transactionHash).add(kind);
      if (kind === 'swap') swapTxs.add(l.transactionHash);
    }
    for (const kinds of byTx.values()) {
      if (kinds.has('mint') && (kinds.has('swap') || kinds.has('burn'))) bundles++;
    }
  }
  const points = Math.min(bundles >= 3 ? 40 : bundles === 2 ? 30 : bundles === 1 ? 20 : 0, 40);
  return {
    id: 'jit-pairing', points, status: bundles ? 'hit' : 'clean', swapTxs,
    detail: bundles
      ? `${bundles} same-tx liquidity+swap/pull bundle(s) on t≈0 pools — JIT +dL/−dL pairing shape.`
      : 'no same-tx mint+swap / mint+burn bundles seen on t≈0 pools (first 100 blocks). V4 pools not covered (no PoolManager address configured).',
  };
}

// --- Fingerprint 5: fixed side-payment per fill ------------------------------
// the-book: creator toll sweeping every cycle. XGAS.DEV: fixed 19.92 USDG per
// fill. EVM version: most-repeated fixed (to, value) transfer in the first
// 200 blocks, excluding pools/the token itself; bonus when those txs overlap
// pool swap txs (toll correlated with fills).
async function fpSidePayment(token, decimals, txLogs, pools, swapTxs) {
  if (!txLogs.ok) return { id: 'side-payment', points: 0, status: 'unknown', detail: 'early transfer logs unavailable — cannot check fixed side-payments.' };
  const poolSet = new Set(pools.map(p => p.address.toLowerCase()));
  const entries = txLogs.logs.map(l => ({ to: topicAddr(l.topics?.[2]), value: l.data, tx: l.transactionHash }));
  const best = countFixedPayments(entries, { exclude: [token, ...poolSet] });
  if (!best || best.txs.size < 5) {
    return { id: 'side-payment', points: 0, status: 'clean', detail: 'no recurring fixed side-payment in the first 200 blocks.' };
  }
  let points = best.txs.size >= 10 ? 35 : 20;
  const overlap = [...best.txs].filter(t => swapTxs.has(t)).length;
  const corr = overlap / best.txs.size;
  let detail = `fixed ${formatUnits(best.value, decimals)} → ${shortAddr(best.to)} ×${best.txs.size} in first 200 blocks`;
  if (corr >= 0.5) { points += 10; detail += ` (${Math.round(corr * 100)}% of those txs also fill pool swaps — toll-per-fill shape)`; }
  detail += '.';
  return { id: 'side-payment', points: Math.min(points, 45), status: 'hit', detail };
}

// --- Fingerprint 6: same operator --------------------------------------------
// the-book: all participants are the same person (deterministic helper at the
// same address on 8 chains). EVM version: (a) cluster early wallets by their
// earliest funder (Blockscout, cheap on fresh wallets); (b) deterministic
// cross-chain check — identical runtime code at the same address on the
// other in-scope chain (4663 ↔ 8453) implies a deterministic deployer.
async function fpSameOperator(chainId, token, txLogs) {
  let points = 0;
  const notes = [];
  if (txLogs.ok) {
    const froms = [...new Set(
      txLogs.logs.map(l => topicAddr(l.topics?.[1])).filter(a => a && a !== ZERO_TOPIC_ADDR)
    )].slice(0, 20);
    const codes = await Promise.all(froms.map(a => ethRpc(chainId, 'eth_getCode', [a, 'latest']).catch(() => '0x')));
    const eoas = froms.filter((a, i) => !codes[i] || codes[i] === '0x').slice(0, 15);
    const funders = [];
    for (const w of eoas) {
      const f = await earliestFunder(chainId, w);
      if (f) funders.push(f);
    }
    const best = clusterFunders(funders);
    if (best) {
      points += best.n >= 4 ? 30 : best.n === 3 ? 20 : best.n === 2 ? 12 : 0;
      if (best.n >= 2) notes.push(`${best.n} early wallet(s) first funded by ${shortAddr(best.funder)}`);
      else notes.push(`early wallets trace to ${funders.length} distinct funder(s) — no shared operator seen`);
    } else {
      notes.push('could not resolve funders for early wallets (Blockscout unavailable or self-funded first txs)');
    }
  } else {
    notes.push('early transfer logs unavailable — wallet clustering skipped');
  }
  // deterministic cross-chain helper check
  try {
    const other = chainId === 4663 ? 8453 : 4663;
    const [here, there] = await Promise.all([
      ethRpc(chainId, 'eth_getCode', [token, 'latest']).catch(() => null),
      ethRpc(other, 'eth_getCode', [token, 'latest']).catch(() => null),
    ]);
    if (here && there && there !== '0x' && there.toLowerCase() === here.toLowerCase()) {
      points += 10;
      notes.push(`identical runtime code at the same address on chain ${other} — deterministic cross-chain deployment (the-book fingerprint #6 shape)`);
    }
  } catch { /* non-fatal */ }
  points = Math.min(points, 40);
  return { id: 'same-operator', points, status: points ? 'hit' : 'clean', detail: notes.join('; ') + '.' };
}

export async function lowFingerprints(chainId, address, { mainSource = '' } = {}) {
  const findings = [];
  const signals = [];
  const token = String(address).toLowerCase();
  const mk = (id, points, status, detail) => {
    signals.push({ id, points, status });
    findings.push({
      severity: 'INFO', // NEVER HIGH/MEDIUM — these signals alone never flip the verdict.
      title: `low:${id}`,
      lowPoints: points,
      detail: (status === 'unknown' ? '[unknown] ' : `[+${points} pts] `) + detail,
    });
  };

  if (!LOW_CHAINS.includes(chainId)) {
    mk('not-applicable', 0, 'clean', `chain ${chainId} not in Lord-of-War scope (4663/8453) — module skipped.`);
    return { findings, summary: { score: 0, maxScore: LOW_MAX_SCORE, signals } };
  }

  const erc = await probeErc20(chainId, token);
  if (!erc.ok) {
    mk('not-applicable', 0, 'clean', 'target does not expose ERC-20 totalSupply()/decimals() — Lord-of-War fingerprints apply to fungible token launches; module skipped.');
    return { findings, summary: { score: 0, maxScore: LOW_MAX_SCORE, signals } };
  }

  const { block: creationBlock, deployer } = await tokenCreationBlock(chainId, token);
  if (creationBlock == null) {
    for (const id of ['amm-count', 'fee-tiers', 'init-ladder', 'jit-pairing', 'side-payment', 'same-operator']) {
      mk(id, 0, 'unknown', 'token creation block unknown (no Blockscout creation tx) — cannot bound the t≈0 window.');
    }
    return { findings, summary: { score: 0, maxScore: LOW_MAX_SCORE, signals } };
  }

  // One shared transfer-log window; F1 slices the first-50-block subset.
  const raw = await getLogsChunked(chainId, { address: token, topics: [TOPIC_TRANSFER], fromBlock: creationBlock, toBlock: creationBlock + 200 });
  const txLogs = { ...raw, windowEnd50: creationBlock + 50 };

  const run = async (fn) => {
    try { return await fn(); }
    catch (e) { return { id: 'error', points: 0, status: 'unknown', detail: `check failed: ${e.message}` }; }
  };

  const f1 = await run(() => fpAmmCount(chainId, token, txLogs));
  mk('amm-count', f1.points, f1.status, f1.detail);
  const pools = f1.pools || [];

  const [f2, f3] = await Promise.all([
    run(() => fpFeeTiers(chainId, pools, mainSource)),
    run(() => fpInitLadder(chainId, pools, creationBlock)),
  ]);
  mk('fee-tiers', f2.points, f2.status, f2.detail);
  mk('init-ladder', f3.points, f3.status, f3.detail);

  const f4 = await run(() => fpJit(chainId, pools, creationBlock));
  mk('jit-pairing', f4.points, f4.status, f4.detail);

  const f5 = await run(() => fpSidePayment(token, erc.decimals, txLogs, pools, f4.swapTxs || new Set()));
  mk('side-payment', f5.points, f5.status, f5.detail);

  const f6 = await run(() => fpSameOperator(chainId, token, txLogs));
  mk('same-operator', f6.points, f6.status, f6.detail);
  void deployer; // reserved: deployer-attribution depth for a future pass

  const score = signals.reduce((s, x) => s + x.points, 0);
  return { findings, summary: { score, maxScore: LOW_MAX_SCORE, signals } };
}

// ---------------------------------------------------------------------------
// Solana (non-EVM) — upgrade authority / mint authority checks
// ---------------------------------------------------------------------------
async function solanaRpc(method, params = []) {
  let lastErr = null;
  for (const rpc of SOLANA_RPC) {
    try {
      const j = await fetchJson(rpc, { method: 'POST', body: { jsonrpc: '2.0', id: 1, method, params }, timeout: 15000 });
      if (j.error) throw new Error(j.error.message || 'solana rpc error');
      return j.result;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

async function solanaCheck(address) {
  const findings = [];
  const info = await solanaRpc('getAccountInfo', [address, { encoding: 'base64' }]);
  const val = info?.value;
  if (!val) {
    return { findings: [{ severity: 'INFO', title: 'solana:no-account', detail: 'No account data at this address.' }], empty: true };
  }
  const owner = val.owner;
  const BPF_UPGRADEABLE = 'BPFLoaderUpgradeab1e11111111111111111111111';
  if (val.executable && owner === BPF_UPGRADEABLE) {
    // Program account: first 4 bytes = program data address.
    const data = Buffer.from(val.data[0], 'base64');
    const progDataAddr = bs58(data.slice(4, 36));
    try {
      const pd = await solanaRpc('getAccountInfo', [progDataAddr, { encoding: 'base64' }]);
      const pdata = Buffer.from(pd.value.data[0], 'base64');
      // ProgramData layout: 4-byte discriminator, 8-byte slot, then Option<Pubkey> upgrade authority.
      const hasAuth = pdata[12] === 1;
      const auth = hasAuth ? bs58(pdata.slice(13, 45)) : null;
      if (hasAuth) {
        findings.push({
          severity: 'HIGH',
          title: 'solana:upgrade-authority-set',
          detail: `Program is upgradeable and the upgrade authority is ${auth} — code can be swapped at any time by that key.`,
        });
      } else {
        findings.push({ severity: 'INFO', title: 'solana:immutable-program', detail: 'Program has no upgrade authority — code is immutable.' });
      }
    } catch (e) {
      findings.push({ severity: 'INFO', title: 'solana:programdata-unreadable', detail: `Could not read program data account: ${e.message}` });
    }
  } else if (owner === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' && val.data) {
    // SPL Token Mint layout: mintAuthority Option<Pubkey> at 0, freezeAuthority Option<Pubkey> at 36.
    const data = Buffer.from(val.data[0], 'base64');
    if (data.length >= 82) {
      const mintAuth = data[0] === 1 ? bs58(data.slice(4, 36)) : null;
      const freezeAuth = data[36] === 1 ? bs58(data.slice(40, 72)) : null;
      if (mintAuth) findings.push({ severity: 'HIGH', title: 'solana:mint-authority-set', detail: `SPL mint authority is ${mintAuth} — supply can be inflated.` });
      if (freezeAuth) findings.push({ severity: 'MEDIUM', title: 'solana:freeze-authority-set', detail: `Freeze authority is ${freezeAuth} — holder accounts can be frozen.` });
      if (!mintAuth && !freezeAuth) findings.push({ severity: 'INFO', title: 'solana:mint-renounced', detail: 'SPL mint has no mint/freeze authority — supply fixed, accounts unfrozen.' });
    }
  } else {
    findings.push({ severity: 'INFO', title: 'solana:unclassified-account', detail: `Account owner program: ${owner}. Only upgradeable-program and SPL-mint checks are implemented.` });
  }
  return { findings, empty: false };
}

// Minimal base58 for Solana pubkeys (no dependency).
export function bs58(bytes) {
  const ALPH = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let num = 0n;
  for (const b of bytes) num = (num << 8n) | BigInt(b);
  let out = '';
  while (num > 0n) { out = ALPH[Number(num % 58n)] + out; num /= 58n; }
  for (const b of bytes) { if (b === 0) out = '1' + out; else break; }
  return out || '1';
}

// ---------------------------------------------------------------------------
// Blacklist
// ---------------------------------------------------------------------------
function loadBlacklist() {
  try { return JSON.parse(fs.readFileSync(BLACKLIST_PATH, 'utf8')); }
  catch { return []; }
}

function addToBlacklist(chainId, contract, reason) {
  const list = loadBlacklist();
  const key = `${chainId}:${contract.toLowerCase()}`;
  if (!list.some(e => `${e.chainId}:${String(e.contract).toLowerCase()}` === key)) {
    list.push({ chainId: String(chainId), contract, reason, ts: new Date().toISOString() });
    fs.writeFileSync(BLACKLIST_PATH, JSON.stringify(list, null, 2) + '\n');
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------
export function verdictFrom(findings) {
  if (findings.some(f => f.severity === 'HIGH' || f.severity === 'MEDIUM')) return 'flagged';
  return 'clean';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const jsonOut = args.includes('--json');
  const positional = args.filter(a => !a.startsWith('--'));
  const [chainIdRaw, address] = positional;

  const fail = (msg) => {
    const out = { verdict: 'unknown', findings: [{ severity: 'INFO', title: 'error', detail: msg }], sourceAvailable: false, chainId: chainIdRaw ?? null, contract: address ?? null };
    console.log(jsonOut ? JSON.stringify(out, null, 2) : `UNKNOWN: ${msg}`);
    process.exit(3);
  };

  if (!chainIdRaw || !address) {
    console.error('Usage: node rug-check.mjs <chainId|solana> <contractAddress> [--json]');
    process.exit(3);
  }

  const scannedAt = new Date().toISOString();
  const findings = [];
  let sourceAvailable = false;
  let scannedTarget = address;
  let proxyInfo = null;

  // ---- Solana path ----
  if (String(chainIdRaw).toLowerCase() === 'solana') {
    try {
      const { findings: sf, empty } = await solanaCheck(address);
      findings.push(...sf);
      const out = {
        verdict: empty ? 'unknown' : verdictFrom(findings),
        findings, sourceAvailable: false, chainId: 'solana', contract: address,
        scannedAt, scannedTarget: address,
        note: 'Solana checks are limited to upgrade-authority and SPL mint/freeze-authority reads.',
      };
      if (out.verdict === 'flagged') {
        const added = addToBlacklist('solana', address, findings.filter(f => f.severity === 'HIGH' || f.severity === 'MEDIUM').map(f => f.title).join('; '));
        out.blacklisted = added;
      }
      console.log(jsonOut ? JSON.stringify(out, null, 2) : renderHuman(out));
      process.exit(out.verdict === 'flagged' ? 2 : out.verdict === 'clean' ? 0 : 3);
    } catch (e) { fail(`solana check failed: ${e.message}`); }
  }

  // ---- EVM path ----
  const chainId = Number(chainIdRaw);
  if (!CHAINS[chainId] || !isAddress(address)) fail(`bad chainId or address: ${chainIdRaw} ${address}`);

  // 1) Proxy resolution — scan the implementation.
  try {
    proxyInfo = await resolveProxy(chainId, address);
    if (proxyInfo?.implementation && proxyInfo.implementation.toLowerCase() !== address.toLowerCase()) {
      scannedTarget = proxyInfo.implementation;
      findings.push({
        severity: 'MEDIUM',
        title: 'proxy:implementation-resolved',
        detail: `Target is a proxy; scanning implementation ${scannedTarget} (resolved via ${proxyInfo.method}${proxyInfo.name ? `, name ${proxyInfo.name}` : ''}). Whoever controls the proxy admin can replace this code.`,
      });
    }
  } catch (e) {
    findings.push({ severity: 'INFO', title: 'proxy:resolution-failed', detail: `Could not check for proxy: ${e.message}` });
  }

  // 2) Source fetch (target the implementation when proxied).
  const src = await fetchSource(chainId, scannedTarget);
  sourceAvailable = !!src;
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'rugcheck-'));
  let mainSrc = '';

  if (src) {
    for (const [p, content] of Object.entries(src.sources)) {
      const fp = path.join(workdir, p);
      fs.mkdirSync(path.dirname(fp), { recursive: true });
      fs.writeFileSync(fp, content);
    }
    const mainFile = pickMainFile(src.sources, src.metadata);
    const mainAbs = path.join(workdir, mainFile);
    mainSrc = src.sources[mainFile] || '';

    // solc version: metadata compiler first, then pragma floor.
    const metaVer = solcFromMetadata(src.metadata, src.compiler);
    const pragmaFloor = solcFromPragma(mainSrc);
    const want = metaVer ? { exact: metaVer } : pragmaFloor ? { floor: pragmaFloor } : { floor: '0.8.28' };
    const solcVer = await ensureSolc(want);
    // Sourcify remappings look like ":@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/".
    const remaps = ((src.metadata?.settings?.remappings) || [])
      .map(r => String(r).replace(/^:/, '').replace(/\/=$/, '/=').replace(/=$/, '='))
      .filter(r => r.includes('='));

    if (solcVer) {
      try {
        const slitherFindings = await runSlither(workdir, mainAbs, solcVer, remaps);
        findings.push(...slitherFindings.map(f => ({ ...f, detail: f.detail + ` [src:${src.via}]` })));
      } catch (e) {
        findings.push({ severity: 'INFO', title: 'slither:error', detail: `Slither run failed: ${e.message}` });
      }
    } else {
      findings.push({ severity: 'INFO', title: 'slither:no-solc', detail: `No solc available for ${JSON.stringify(want)} and install failed — skipping Slither, source heuristics + bytecode scan only.` });
    }
    findings.push(...customHeuristics(mainSrc));

    // Bytecode second opinion on the scanned target.
    const isProxyImpl = !!proxyInfo?.implementation &&
      proxyInfo.implementation.toLowerCase() === scannedTarget.toLowerCase();
    try {
      const code = await ethRpc(chainId, 'eth_getCode', [scannedTarget, 'latest']);
      const { findings: bf } = bytecodeScan(code, { isProxyImpl });
      findings.push(...bf.map(f => ({ ...f, detail: f.detail + ' [bytecode second opinion]' })));
    } catch (e) {
      findings.push({ severity: 'INFO', title: 'bytecode:unavailable', detail: `eth_getCode failed: ${e.message}` });
    }
  } else {
    findings.push({ severity: 'INFO', title: 'source:unavailable', detail: 'No verified source found via Sourcify, Blockscout, or Etherscan — falling back to heuristic bytecode scan (reduced confidence).' });
    // 3) Bytecode fallback scan.
    try {
      const code = await ethRpc(chainId, 'eth_getCode', [scannedTarget, 'latest']);
      const { findings: bf, empty } = bytecodeScan(code);
      findings.push(...bf);
      if (empty) {
        const out = { verdict: 'unknown', findings, sourceAvailable, chainId, contract: address, scannedAt, scannedTarget };
        console.log(jsonOut ? JSON.stringify(out, null, 2) : renderHuman(out));
        process.exit(3);
      }
    } catch (e) { fail(`bytecode scan failed (no RPC for chain ${chainId}?): ${e.message}`); }
  }

  // 4) Lord-of-War fingerprints — EVM-adapted additive signals (INFO-only;
  //    they never flip the verdict on their own). Scoped to 4663/8453 ERC-20s.
  let lowRisk = null;
  if (chainId === 4663 || chainId === 8453) {
    try {
      const low = await lowFingerprints(chainId, address, { mainSource: mainSrc });
      findings.push(...low.findings);
      lowRisk = low.summary;
    } catch (e) {
      findings.push({ severity: 'INFO', title: 'low:module-error', lowPoints: 0, detail: `[unknown] Lord-of-War module failed: ${e.message}` });
    }
  }

  // Cleanup scratch.
  try { fs.rmSync(workdir, { recursive: true, force: true }); } catch {}

  const verdict = verdictFrom(findings);
  const out = {
    verdict, findings, sourceAvailable, chainId, contract: address,
    scannedAt, scannedTarget,
    proxy: proxyInfo,
    lowRisk, // null outside 4663/8453; { score, maxScore, signals } otherwise
  };
  if (verdict === 'flagged') {
    const reason = findings.filter(f => f.severity === 'HIGH' || f.severity === 'MEDIUM').map(f => f.title).join('; ');
    out.blacklisted = addToBlacklist(chainId, scannedTarget, reason);
  }
  console.log(jsonOut ? JSON.stringify(out, null, 2) : renderHuman(out));
  process.exit(verdict === 'flagged' ? 2 : 0);
}

function renderHuman(out) {
  const lines = [];
  lines.push(`rug-check ${out.chainId}:${out.contract}`);
  lines.push(`target scanned : ${out.scannedTarget}${out.sourceAvailable ? ' (verified source)' : ' (bytecode only)'}`);
  lines.push(`verdict        : ${out.verdict.toUpperCase()}`);
  if (out.lowRisk) {
    const hit = out.lowRisk.signals.filter(s => s.status === 'hit').map(s => s.id).join(', ');
    lines.push(`low-risk score : ${out.lowRisk.score}/${out.lowRisk.maxScore} (Lord-of-War fingerprints, INFO-only — never flip the verdict alone)${hit ? ` — hits: ${hit}` : ''}`);
  }
  lines.push('');
  for (const f of out.findings) {
    lines.push(`[${f.severity}] ${f.title}`);
    lines.push(`  ${f.detail}`);
  }
  if (out.blacklisted) lines.push('\nFlagged contract appended to blacklist.json');
  return lines.join('\n');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch(e => {
    console.error(`UNKNOWN: unexpected error: ${e.message}`);
    process.exit(3);
  });
}

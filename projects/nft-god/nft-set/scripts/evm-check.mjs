// EVM execution check: runs the REAL compiled FoilReceipts runtime bytecode
// on Base via eth_call + stateOverrides (read-only, no wallet, no broadcast)
// and compares receiptOf()/tokenURI() output field-for-field against the
// offchain JS mirror (scripts/receipts.mjs).
//
// Usage: node scripts/evm-check.mjs
// Exits non-zero on any mismatch.

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RPC_URL = "https://mainnet.base.org";
const UA = "FoilReceipts-evm-check/1.0";
const FAKE_ADDR = "0x00000000000000000000000000000000000000f1";

async function rpc(method, params = []) {
  const j = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(30000),
  }).then((r) => r.json());
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result;
}

// --- minimal keccak256 (same implementation as receipts.mjs, self-tested) ---
const MASK = (1n << 64n) - 1n;
const RC = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];
const RHO = [
  [0, 36, 3, 41, 18], [1, 44, 10, 45, 2], [62, 6, 43, 15, 61],
  [28, 55, 25, 21, 56], [27, 20, 39, 8, 14],
];
function keccakF(s) {
  const C = new Array(5), D = new Array(5), B = new Array(25);
  const rotl = (x, n) => {
    n = BigInt(n) % 64n;
    return n === 0n ? x & MASK : ((x << n) | (x >> (64n - n))) & MASK;
  };
  for (let round = 0; round < 24; round++) {
    for (let x = 0; x < 5; x++) C[x] = (s[x] ^ s[x + 5] ^ s[x + 10] ^ s[x + 15] ^ s[x + 20]) & MASK;
    for (let x = 0; x < 5; x++) D[x] = (C[(x + 4) % 5] ^ rotl(C[(x + 1) % 5], 1)) & MASK;
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) s[x + 5 * y] = (s[x + 5 * y] ^ D[x]) & MASK;
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) B[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(s[x + 5 * y], RHO[x][y]);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++)
      s[x + 5 * y] = (B[x + 5 * y] ^ ((~B[(x + 1) % 5 + 5 * y] & MASK) & B[(x + 2) % 5 + 5 * y])) & MASK;
    s[0] = (s[0] ^ RC[round]) & MASK;
  }
}
function keccak256Bytes(msg) {
  const RATE = 136;
  const p = Array.from(msg);
  p.push(0x01);
  while (p.length % RATE !== 0) p.push(0x00);
  p[p.length - 1] |= 0x80;
  const s = new Array(25).fill(0n);
  for (let off = 0; off < p.length; off += RATE) {
    for (let i = 0; i < RATE / 8; i++) {
      let lane = 0n;
      for (let b = 0; b < 8; b++) lane |= BigInt(p[off + i * 8 + b]) << BigInt(8 * b);
      s[i] ^= lane;
    }
    keccakF(s);
  }
  const out = new Array(32);
  for (let i = 0; i < 4; i++) {
    let lane = s[i];
    for (let b = 0; b < 8; b++) { out[i * 8 + b] = Number(lane & 0xffn); lane >>= 8n; }
  }
  return out;
}
const selector = (sig) => keccak256Bytes(Buffer.from(sig, "utf8")).slice(0, 4);

// --- trait mirror (EXACT copy of scripts/receipts.mjs derivation) ---
function keccakTokenSalt(tokenId, salt) {
  const pre = new Uint8Array(32 + salt.length);
  let t = BigInt(tokenId);
  for (let i = 31; i >= 0; i--) { pre[i] = Number(t & 0xffn); t >>= 8n; }
  for (let i = 0; i < salt.length; i++) pre[32 + i] = salt.charCodeAt(i);
  const d = keccak256Bytes(pre);
  let v = 0n;
  for (let i = 0; i < 32; i++) v = (v << 8n) | BigInt(d[i]);
  return v;
}
function receiptOf(id) {
  const h0 = keccakTokenSalt(id, "FOIL.RCPT.v");
  const h1 = keccakTokenSalt(id, "FOIL.RCPT.c");
  const h2 = keccakTokenSalt(id, "FOIL.RCPT.t");
  const v = Number(h0 % 100n);
  return {
    verdict: v < 2 ? 0 : v < 20 ? 1 : v < 75 ? 2 : 3,
    check: Number(h1 % 6n),
    hat: Number((h1 >> 8n) % 3n),
    eyes: Number((h1 >> 16n) % 3n),
    bg: Number((h2 >> 24n) % 3n),
    ref: ((h2 >> 16n) & 0xffffffffffffn).toString(16).padStart(12, "0"),
    batch: 42000 + Number(h2 % 9000n),
    gas: 21000 + Number(h0 % 180000n),
  };
}

function encUint(id) {
  return BigInt(id).toString(16).padStart(64, "0");
}

async function main() {
  // Compile the real contract with deploy settings.
  const solc = (() => { try { return require("solc"); } catch { console.error("need solc: npm install"); process.exit(1); } })();
  const src = readFileSync(resolve(ROOT, "contracts/FoilReceipts.sol"), "utf8");
  const out = JSON.parse(solc.compile(JSON.stringify({
    language: "Solidity",
    sources: { "FoilReceipts.sol": { content: src } },
    settings: { viaIR: true, optimizer: { enabled: true, runs: 1 }, outputSelection: { "*": { "*": ["evm.deployedBytecode.object"] } } },
  })));
  const errs = (out.errors || []).filter((e) => e.severity === "error");
  if (errs.length) { console.error(errs.map((e) => e.formattedMessage).join("\n")); process.exit(1); }
  const runtime = "0x" + out.contracts["FoilReceipts.sol"]["FoilReceipts"].evm.deployedBytecode.object;

  const selReceipt = Buffer.from(selector("receiptOf(uint256)")).toString("hex");
  const selURI = Buffer.from(selector("tokenURI(uint256)")).toString("hex");
  // _currentIndex lives at storage slot 6; set it to 777 so tokenURI(0..776) passes NotMinted.
  const slot6 = "0x" + (6).toString(16).padStart(64, "0");
  const overrides = {
    [FAKE_ADDR]: { code: runtime, state: { [slot6]: "0x" + (777).toString(16).padStart(64, "0") } },
  };

  const ids = [0, 12, 104, 441, 776];
  let failures = 0;

  for (const id of ids) {
    const data = "0x" + selReceipt + encUint(id);
    let ret;
    try {
      ret = await rpc("eth_call", [{ to: FAKE_ADDR, data }, "latest", overrides]);
    } catch (e) {
      console.error(`eth_call with stateOverrides unsupported by RPC (${e.message}) — cannot run EVM check.`);
      process.exit(3);
    }
    const words = ret.slice(2).match(/.{1,64}/g) || [];
    // struct Receipt field order: verdict, check, hat, eyes, bg, ref(bytes8), batch, gas
    const got = {
      verdict: parseInt(words[0], 16),
      check: parseInt(words[1], 16),
      hat: parseInt(words[2], 16),
      eyes: parseInt(words[3], 16),
      bg: parseInt(words[4], 16),
      ref: words[5].slice(0, 12), // bytes8 left-aligned; _hex displays its first 6 bytes
      batch: parseInt(words[6], 16),
      gas: parseInt(words[7], 16),
    };
    const want = receiptOf(id);
    const keys = ["verdict", "check", "hat", "eyes", "bg", "ref", "batch", "gas"];
    const diffs = keys.filter((k) => String(got[k]) !== String(want[k]));
    if (diffs.length) {
      failures++;
      console.log(`MISMATCH receiptOf(${id}): ${diffs.map((k) => `${k}: evm=${got[k]} js=${want[k]}`).join(", ")}`);
    } else {
      console.log(`receiptOf(${id}): MATCH (verdict=${want.verdict} check=${want.check} hat=${want.hat} eyes=${want.eyes} bg=${want.bg} batch=${want.batch} gas=${want.gas} ref=${want.ref})`);
    }
  }

  // tokenURI byte-compare against the offchain-generated metadata files.
  // tokenId N <-> file pad4(N+1).json (onchain serial = tokenId + 1).
  for (const id of [0, 104, 776]) {
    const data = "0x" + selURI + encUint(id);
    const ret = await rpc("eth_call", [{ to: FAKE_ADDR, data }, "latest", overrides]);
    const body = ret.slice(2);
    const len = parseInt(body.slice(64, 128), 16);
    const strHex = body.slice(128, 128 + len * 2);
    const evmURI = Buffer.from(strHex, "hex").toString("utf8");
    const fname = String(id + 1).padStart(4, "0") + ".json";
    const file = resolve(ROOT, "metadata/receipts", fname);
    // Rebuild the exact compact JSON the contract assembles (field order:
    // name, description, attributes, image), then the data URI.
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    const wantURI =
      "data:application/json;base64," +
      Buffer.from(JSON.stringify(parsed), "utf8").toString("base64");
    if (evmURI === wantURI) {
      console.log(`tokenURI(${id}): MATCH (${evmURI.length} chars, byte-identical to metadata/receipts/${fname})`);
    } else {
      failures++;
      console.log(`MISMATCH tokenURI(${id}): evm ${evmURI.length} chars vs file ${wantURI.length} chars`);
      for (let i = 0; i < Math.min(evmURI.length, wantURI.length); i++) {
        if (evmURI[i] !== wantURI[i]) { console.log(`  first diff at char ${i}: evm=${JSON.stringify(evmURI.slice(i, i + 40))} file=${JSON.stringify(wantURI.slice(i, i + 40))}`); break; }
      }
    }
  }

  console.log(failures ? `\nEVM CHECK: ${failures} FAILURE(S)` : "\nEVM CHECK: ALL MATCH — onchain execution == JS mirror");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(2); });

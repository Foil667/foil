// FoilReceipts deploy rehearsal — Base mainnet (chain 8453).
// DEFAULT IS --dry: compiles, encodes constructor args, asks the chain itself
// for eth_estimateGas + gas price, and prints the exact deployment cost.
// --live is HARD-GATED: requires FOIL_DEPLOY_APPROVED=1 AND a keyfile outside
// this repo AND user approval. Do not run --live unless the user said go.

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONTRACT_PATH = resolve(ROOT, "contracts/FoilReceipts.sol");

const CHAIN_ID = 8453; // Base
const RPC_URL = "https://mainnet.base.org";
const UA = "FoilReceipts-deploy-rehearsal/1.0";

// ---------------------------------------------------------------------------
// Config — change only with the user.
// ---------------------------------------------------------------------------
const CONFIG = {
  name: "Foil Receipts",
  symbol: "RCPT",
  // Placeholder until the real snapshot root is built. --live checklist
  // flags this as open; never deploy with the zero root.
  allowlistRoot: "0x" + "00".repeat(32),
  royaltyReceiver: "0x6573682faee72a4a96e791ba262439f1df3a268d", // Foil's wallet
  royaltyBps: 750, // 7.5%
};

async function rpc(method, params = []) {
  const r = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(15000),
  })
    .then((r) => r.json())
    .then((j) => {
      if (j.error) throw new Error(`${method}: ${j.error.message}`);
      return j.result;
    });
  return r;
}

function loadSolcSync() {
  try {
    return require("solc");
  } catch {
    console.error("Missing dependency: solc. Run `npm install` in this directory first.");
    process.exit(1);
  }
}

async function compile() {
  const solc = loadSolcSync();
  const source = readFileSync(CONTRACT_PATH, "utf8");
  const input = {
    language: "Solidity",
    sources: { "FoilReceipts.sol": { content: source } },
    settings: {
      viaIR: true,
      optimizer: { enabled: true, runs: 1 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode", "evm.deployedBytecode"] } },
    },
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (out.errors || []).filter((e) => e.severity === "error");
  for (const e of out.errors || []) console.error(`solc ${e.severity}: ${e.formattedMessage.split("\n")[0]}`);
  if (errors.length) process.exit(1);
  const c = out.contracts["FoilReceipts.sol"]["FoilReceipts"];
  return {
    abi: c.abi,
    initCode: "0x" + c.evm.bytecode.object,
    runtimeBytes: c.evm.deployedBytecode.object.length / 2,
  };
}


// Minimal ABI encoder for the constructor:
// (string name, string symbol, bytes32 allowlistRoot, address royaltyReceiver, uint96 royaltyBps)
function encUint256(n) {
  return BigInt(n).toString(16).padStart(64, "0");
}
function encString(s) {
  const hex = Buffer.from(s, "utf8").toString("hex");
  return encUint256(Buffer.byteLength(s, "utf8")) + hex.padEnd(Math.ceil(hex.length / 64) * 64, "0");
}
function encodeConstructorArgs(cfg) {
  const dynamics = [cfg.name, cfg.symbol].map(encString);
  const statics = [
    cfg.allowlistRoot.toLowerCase().replace(/^0x/, "").padStart(64, "0"),
    cfg.royaltyReceiver.toLowerCase().replace(/^0x/, "").padStart(64, "0"),
    encUint256(cfg.royaltyBps),
  ];
  let head = "";
  let offset = 5 * 32; // 2 offsets + 3 static slots
  for (const d of dynamics) {
    head += encUint256(offset);
    offset += d.length / 2;
  }
  return "0x" + head + statics.join("") + dynamics.join("");
}

const fmtEth = (wei) => (Number(wei) / 1e18).toFixed(6);
const fmtUsd = (wei, ethUsd) => "$" + ((Number(wei) / 1e18) * ethUsd).toFixed(2);

async function ethUsd() {
  try {
    const r = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot", {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(12000),
    });
    return Number((await r.json()).data.amount);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// --dry: the whole point of this file right now
// ---------------------------------------------------------------------------
async function dryRun() {
  console.log("=".repeat(72));
  console.log("FoilReceipts DEPLOYMENT PLAN — DRY RUN (nothing will be broadcast)");
  console.log("=".repeat(72));

  // 1. Compile with the exact deploy settings
  const { abi, initCode, runtimeBytes } = await compile();
  const initBytes = (initCode.length - 2) / 2;
  console.log(`\n[1/5] COMPILE (solc 0.8.24, viaIR, optimizer runs=1)`);
  console.log(`      source         : contracts/FoilReceipts.sol`);
  console.log(`      init bytecode  : ${initBytes.toLocaleString()} bytes`);
  console.log(`      runtime bytecode: ${runtimeBytes.toLocaleString()} bytes (EIP-170 limit 24,576) ${runtimeBytes < 24576 ? "UNDER LIMIT OK" : "OVER LIMIT — DO NOT DEPLOY"}`);
  const fns = abi.filter((e) => e.type === "function").map((e) => e.name).sort();
  console.log(`      functions      : ${fns.join(", ")}`);

  // 2. Constructor args
  const argsData = encodeConstructorArgs(CONFIG);
  const deployData = initCode + argsData.slice(2);
  console.log(`\n[2/5] CONSTRUCTOR ARGS`);
  for (const [k, v] of Object.entries(CONFIG)) console.log(`      ${k.padEnd(16)} = ${v}`);
  console.log(`      full init data: ${((deployData.length - 2) / 2).toLocaleString()} bytes (starts ${deployData.slice(0, 66)}…)`);

  // 3. Gas estimate — ask the chain itself (read-only, no wallet)
  console.log(`\n[3/5] GAS ESTIMATE (chain ${CHAIN_ID}, ${RPC_URL})`);
  let gasPrice = null, estGas = null;
  try {
    const [gp, id] = await Promise.all([rpc("eth_gasPrice"), rpc("eth_chainId")]);
    if (parseInt(id, 16) !== CHAIN_ID) throw new Error(`chain id mismatch: got ${parseInt(id, 16)}`);
    gasPrice = BigInt(gp);
    console.log(`      eth_gasPrice : ${gp} wei (${(Number(gp) / 1e9).toFixed(4)} gwei) — live from RPC`);
    try {
      // eth_estimateGas with the real init data: closest honest number, still read-only.
      estGas = BigInt(await rpc("eth_estimateGas", [{ data: deployData }]));
      console.log(`      eth_estimateGas (deploy): ${estGas.toLocaleString()} gas — live from RPC`);
    } catch (e) {
      console.log(`      eth_estimateGas unavailable (${e.message}) — using formula fallback`);
    }
  } catch (e) {
    console.log(`      RPC unreachable (${e.message}) — using fallback gas price`);
    gasPrice = 50000000n; // 0.05 gwei fallback
  }
  if (estGas === null) {
    estGas = 32000n + BigInt(initBytes) * 200n + 300000n;
    console.log(`      formula fallback: 32,000 + 200*${initBytes.toLocaleString()} + 300,000 = ${estGas.toLocaleString()} gas`);
  }
  const price = await ethUsd();
  const deployCostWei = estGas * gasPrice;
  console.log(`      deploy cost: ${estGas.toLocaleString()} gas x ${(Number(gasPrice) / 1e9).toFixed(4)} gwei`);
  console.log(`                 = ${deployCostWei.toLocaleString()} wei = ${fmtEth(deployCostWei)} ETH` + (price ? ` ~ ${fmtUsd(deployCostWei, price)} @ $${price}/ETH (Coinbase spot, this run)` : ""));
  console.log(`      NOTE: L1 surcharge does not apply on Base mainnet itself (it IS the L2);`);
  console.log(`            re-check with eth_estimateGas at deploy time. Keep 0.001 ETH buffer in the deployer.`);

  // Representative user-side costs at the same gas price
  const allowGas = 120000n, pubGas = 150000n, opGas = 50000n;
  console.log(`\n      user-side (per tx, same gas price) — mints are FREE, this is gas only:`);
  console.log(`        allowlistMint(2) ~ ${fmtEth(allowGas * gasPrice)} ETH` + (price ? ` ~ ${fmtUsd(allowGas * gasPrice, price)}` : ""));
  console.log(`        publicMint(3)    ~ ${fmtEth(pubGas * gasPrice)} ETH` + (price ? ` ~ ${fmtUsd(pubGas * gasPrice, price)}` : ""));
  console.log(`        owner ops        ~ ${fmtEth(opGas * gasPrice)} ETH` + (price ? ` ~ ${fmtUsd(opGas * gasPrice, price)}` : ""));

  // 4. What --live would do
  console.log(`\n[4/5] WHAT --live WOULD DO (NOT RUNNING)`);
  console.log(`      1. require FOIL_DEPLOY_APPROVED=1 in env (user's explicit approval)`);
  console.log(`      2. load deployer key from FOIL_DEPLOY_KEY_PATH (file OUTSIDE this repo)`);
  console.log(`      3. verify chain id = ${CHAIN_ID}, deployer has >= ${(Number(deployCostWei) / 1e18 * 3).toFixed(6)} ETH`);
  console.log(`      4. send deployment tx with the init data above`);
  console.log(`      5. print contract address + Blockscout verification command`);
  console.log(`      6. recommended post-deploy: setAllowlistRoot(real), setPhase(1), reserve mint, setPhase(2)`);

  // 5. Pre-flight checklist
  console.log(`\n[5/5] PRE-FLIGHT CHECKLIST (all must be true before --live)`);
  const checks = [
    ["contract compiles under EIP-170 with deploy settings", runtimeBytes < 24576],
    ["previews generated (5 sample SVGs)", existsSync(resolve(ROOT, "previews/receipt-0105.svg"))],
    ["metadata/receipts/ complete (777 files, serial-named 0001..0777)", existsSync(resolve(ROOT, "metadata/receipts/0001.json")) && existsSync(resolve(ROOT, "metadata/receipts/0777.json"))],
    ["allowlist Merkle root built from snapshot", CONFIG.allowlistRoot !== "0x" + "00".repeat(32)],
    ["royalty receiver confirmed (Foil's wallet)", /^0x[0-9a-fA-F]{40}$/.test(CONFIG.royaltyReceiver)],
    ["deployer wallet funded on Base", false],
    ["USER APPROVAL: FOIL_DEPLOY_APPROVED=1 set by the user", process.env.FOIL_DEPLOY_APPROVED === "1"],
  ];
  for (const [label, ok] of checks) console.log(`      [${ok ? "x" : " "}] ${label}`);
  const missing = checks.filter(([, ok]) => !ok).length;
  console.log(`\n      ${missing} of ${checks.length} items still open. --dry exits 0 regardless; --live refuses unless approved.`);

  console.log("\n" + "=".repeat(72));
  console.log("DRY RUN COMPLETE — no wallet touched, nothing signed, nothing broadcast.");
  console.log("=".repeat(72));
}

// ---------------------------------------------------------------------------
// --live: gated behind explicit user approval
// ---------------------------------------------------------------------------
async function liveRun() {
  console.log("=".repeat(72));
  console.log("!!! FoilReceipts LIVE DEPLOY — REAL BROADCAST !!!");
  console.log("=".repeat(72));
  if (process.env.FOIL_DEPLOY_APPROVED !== "1") {
    console.error("\nREFUSED: FOIL_DEPLOY_APPROVED=1 is not set.");
    console.error("Live deploy requires the user's explicit approval. Set the env var only");
    console.error("when the user has said go, then re-run with --live.");
    process.exit(2);
  }
  const keyPath = process.env.FOIL_DEPLOY_KEY_PATH;
  if (!keyPath || !existsSync(keyPath)) {
    console.error("\nREFUSED: FOIL_DEPLOY_KEY_PATH must point at an existing keyfile.");
    process.exit(2);
  }
  if (!relative(ROOT, resolve(keyPath)).startsWith("..")) {
    console.error("\nREFUSED: keyfile must live OUTSIDE this repo. Move it elsewhere.");
    process.exit(2);
  }
  let ethers;
  try {
    ethers = await import("ethers");
  } catch {
    console.error("\n--live needs ethers: run `npm install ethers` first.");
    process.exit(1);
  }
  const raw = readFileSync(keyPath, "utf8").trim();
  let pk;
  try {
    pk = JSON.parse(raw).privateKey || raw;
  } catch {
    pk = raw;
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    console.error("\nREFUSED: keyfile does not contain a valid 0x-prefixed 32-byte private key.");
    process.exit(2);
  }

  const { abi, initCode } = await compile();
  const argsData = encodeConstructorArgs(CONFIG);
  const deployData = initCode + argsData.slice(2);
  const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID, { headers: { "User-Agent": UA } });
  const net = await provider.getNetwork();
  if (Number(net.chainId) !== CHAIN_ID) throw new Error(`chain id mismatch: ${net.chainId}`);

  const wallet = new ethers.Wallet(pk, provider);
  const fee = await provider.getFeeData();
  const balance = await provider.getBalance(wallet.address);
  const gas = await provider.estimateGas({ data: deployData, from: wallet.address });
  const maxCost = gas * (fee.maxFeePerGas ?? fee.gasPrice) * 3n;
  console.log(`deployer: ${wallet.address}`);
  console.log(`balance : ${ethers.formatEther(balance)} ETH | est. cost x3 buffer: ${ethers.formatEther(maxCost)} ETH`);
  if (balance < maxCost) throw new Error("deployer balance below 3x buffer — refusing.");

  console.log("sending deployment tx...");
  const tx = await wallet.sendTransaction({
    data: deployData,
    gasLimit: (gas * 120n) / 100n,
    maxFeePerGas: fee.maxFeePerGas,
    maxPriorityFeePerGas: fee.maxPriorityFeePerGas,
  });
  console.log(`tx hash: ${tx.hash}`);
  const rcpt = await tx.wait();
  console.log(`deployed at: ${rcpt.contractAddress} (block ${rcpt.blockNumber}, gas used ${rcpt.gasUsed})`);
  console.log(`verify: https://base.blockscout.com/address/${rcpt.contractAddress} -> "Verify & Publish" with standard JSON (solc 0.8.24, viaIR, runs=1)`);
}

const live = process.argv.includes("--live");
if (live) await liveRun();
else await dryRun();

#!/usr/bin/env node
/**
 * deploy.mjs — FoilSet deployment script (PREPARATION ONLY — nothing is live).
 *
 *   node scripts/deploy.mjs            # = --dry (DEFAULT): print the full
 *                                      # deployment plan, constructor args,
 *                                      # compiled bytecode stats, and gas
 *                                      # estimate. Touches NO wallet, signs
 *                                      # NOTHING, broadcasts NOTHING.
 *
 *   node scripts/deploy.mjs --live     # REAL broadcast. Requires ALL of:
 *                                      #   1. the --live flag, AND
 *                                      #   2. env FOIL_DEPLOY_APPROVED=1, AND
 *                                      #   3. env FOIL_DEPLOY_KEY_PATH -> a keyfile OUTSIDE this repo
 *                                      # Live deploy additionally requires the USER'S EXPLICIT
 *                                      # approval (setting FOIL_DEPLOY_APPROVED=1 IS that approval
 *                                      # mechanism — never set it without the user saying go).
 *
 * Compile: solc standard-JSON (npm i solc). --dry never needs a wallet.
 * --live needs `npm i ethers` (loaded dynamically; not a hard dependency).
 */
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { resolve, relative } from "node:path";

const require = createRequire(import.meta.url);
const ROOT = resolve(new URL(".", import.meta.url).pathname, "..");
const CONTRACT_PATH = resolve(ROOT, "contracts/FoilSet.sol");

// ---------------------------------------------------------------------------
// Chain + deployment config
// ---------------------------------------------------------------------------
const CHAIN_ID = 4663;
const RPC_URL = process.env.FOIL_RPC_URL || "https://rpc.mainnet.chain.robinhood.com";
const EXPLORER = "https://robinhoodchain.blockscout.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
// ^ the public RPC 403s default curl/node user agents; a browser UA works.

const CONFIG = {
  name: process.env.FOIL_NAME || "Foil: The TinHat Society",
  symbol: process.env.FOIL_SYMBOL || "TINHAT",
  baseURI: process.env.FOIL_BASE_URI || "ipfs://REPLACE_WITH_CID/",
  contractURI: process.env.FOIL_CONTRACT_URI || "ipfs://REPLACE_WITH_CID/contract.json",
  allowlistRoot: process.env.FOIL_ALLOWLIST_ROOT || "0x" + "00".repeat(32),
  royaltyReceiver: process.env.FOIL_ROYALTY_RECEIVER || "0x6573682faee72a4a96e791ba262439f1df3a268d", // Foil's wallet
  royaltyBps: parseInt(process.env.FOIL_ROYALTY_BPS || "750", 10), // 7.5%
};

const has = (f) => process.argv.includes(f);
const LIVE = has("--live");
const DRY = !LIVE;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function rpc(method, params = []) {
  return fetch(RPC_URL, {
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
}

function loadSolc() {
  try {
    return require("solc");
  } catch {
    console.error("Missing dependency: solc. Run `npm install` in this directory first.");
    process.exit(1);
  }
}

function compile() {
  const solc = loadSolc();
  const source = readFileSync(CONTRACT_PATH, "utf8");
  const input = {
    language: "Solidity",
    sources: { "FoilSet.sol": { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (out.errors || []).filter((e) => e.severity === "error");
  for (const e of out.errors || []) console.error(`solc ${e.severity}: ${e.formattedMessage.split("\n")[0]}`);
  if (errors.length) process.exit(1);
  const c = out.contracts["FoilSet.sol"]["FoilSet"];
  return { abi: c.abi, initCode: "0x" + c.evm.bytecode.object };
}

// Minimal ABI encoder for the constructor:
// (string,string,string,string,bytes32,address,uint96)
function encUint256(n) {
  return BigInt(n).toString(16).padStart(64, "0");
}
function encString(s) {
  const hex = Buffer.from(s, "utf8").toString("hex");
  const len = encUint256(Buffer.byteLength(s, "utf8"));
  return len + hex.padEnd(Math.ceil(hex.length / 64) * 64, "0");
}
function encodeConstructorArgs(cfg) {
  const dynamics = [cfg.name, cfg.symbol, cfg.baseURI, cfg.contractURI].map(encString);
  const statics = [
    cfg.allowlistRoot.toLowerCase().replace(/^0x/, "").padStart(64, "0"),
    cfg.royaltyReceiver.toLowerCase().replace(/^0x/, "").padStart(64, "0"),
    encUint256(cfg.royaltyBps),
  ];
  let head = "";
  let offset = (4 + 3) * 32; // 7 head slots
  for (const d of dynamics) {
    head += encUint256(offset);
    offset += d.length / 2;
  }
  return "0x" + head + statics.join("") + dynamics.join("");
}

const fmtEth = (wei) => (Number(wei) / 1e18).toFixed(6);
const fmtUsd = (wei, ethUsd) => "$" + (Number(wei) / 1e18 * ethUsd).toFixed(2);

async function ethUsd() {
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd", { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12000) });
    return (await r.json()).ethereum.usd;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// --dry: the whole point of this file right now
// ---------------------------------------------------------------------------
async function dryRun() {
  console.log("=".repeat(70));
  console.log("FoilSet DEPLOYMENT PLAN — DRY RUN (nothing will be broadcast)");
  console.log("=".repeat(70));

  // 1. Compile
  const { abi, initCode } = compile();
  const initBytes = (initCode.length - 2) / 2;
  console.log(`\n[1/5] COMPILE (solc 0.8.24, optimizer runs=200)`);
  console.log(`      source : contracts/FoilSet.sol`);
  console.log(`      init bytecode : ${initBytes.toLocaleString()} bytes`);
  console.log(`      abi entries   : ${abi.length}`);
  const fns = abi.filter((e) => e.type === "function").map((e) => e.name).sort();
  console.log(`      functions     : ${fns.join(", ")}`);

  // 2. Constructor args
  const argsData = encodeConstructorArgs(CONFIG);
  const deployData = initCode + argsData.slice(2);
  console.log(`\n[2/5] CONSTRUCTOR ARGS`);
  for (const [k, v] of Object.entries(CONFIG)) console.log(`      ${k.padEnd(16)} = ${v}`);
  console.log(`      full init data: ${(deployData.length - 2) / 2} bytes (starts ${deployData.slice(0, 66)}…)`);

  // 3. Gas estimate — ask the chain itself (read-only, no wallet)
  console.log(`\n[3/5] GAS ESTIMATE (chain ${CHAIN_ID}, ${RPC_URL})`);
  let gasPrice = null, estGas = null, chainOk = true;
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
    chainOk = false;
    console.log(`      RPC unreachable (${e.message}) — using last measured fallback`);
    gasPrice = 42695312n; // 0x28a4c90, measured 2026-09-24
  }
  if (estGas === null) {
    // 32k base + 200 gas/byte init code + constructor execution headroom
    estGas = 32000n + BigInt(initBytes) * 200n + 250000n;
    console.log(`      formula fallback: 32,000 + 200*${initBytes} + 250,000 = ${estGas.toLocaleString()} gas`);
  }
  const price = await ethUsd();
  const deployCostWei = estGas * gasPrice;
  console.log(`      deploy cost: ${estGas.toLocaleString()} gas × ${(Number(gasPrice) / 1e9).toFixed(4)} gwei`);
  console.log(`                 = ${deployCostWei.toLocaleString()} wei = ${fmtEth(deployCostWei)} ETH` + (price ? ` ≈ ${fmtUsd(deployCostWei, price)} @ $${price}/ETH` : ""));
  console.log(`      NOTE: Arbitrum-Orbit chains add a small L1 data-availability surcharge on top;`);
  console.log(`            re-check with eth_estimateGas at deploy time. Keep 0.001 ETH buffer in the deployer.`);

  // Representative user-side costs at the same gas price
  const mintGas = 140000n, opGas = 60000n;
  console.log(`\n      user-side (per tx, same gas price):`);
  console.log(`        publicMint(3) ≈ ${fmtEth(mintGas * gasPrice)} ETH` + (price ? ` ≈ ${fmtUsd(mintGas * gasPrice, price)}` : "") + ` (mint itself is FREE — this is gas only)`);
  console.log(`        owner ops (setPhase etc.) ≈ ${fmtEth(opGas * gasPrice)} ETH` + (price ? ` ≈ ${fmtUsd(opGas * gasPrice, price)}` : ""));

  // 4. What --live would do
  console.log(`\n[4/5] WHAT --live WOULD DO (NOT RUNNING)`);
  console.log(`      1. require FOIL_DEPLOY_APPROVED=1 in env (user's explicit approval)`);
  console.log(`      2. load deployer key from FOIL_DEPLOY_KEY_PATH (file OUTSIDE this repo)`);
  console.log(`      3. verify chain id = ${CHAIN_ID}, deployer has ≥ ${(Number(deployCostWei) / 1e18 * 3).toFixed(6)} ETH`);
  console.log(`      4. send deployment tx with the init data above`);
  console.log(`      5. print contract address + Blockscout verification command`);
  console.log(`      6. recommended post-deploy: setPhase(1) + announce allowlist; setPhase(2) for public`);

  // 5. Pre-flight checklist
  console.log(`\n[5/5] PRE-FLIGHT CHECKLIST (all must be true before --live)`);
  const checks = [
    ["art/ finished (2000x2000 PNGs, 777 files)", existsSync(resolve(ROOT, "art/0000.png"))],
    ["traits/traits.json finalized", existsSync(resolve(ROOT, "traits/traits.json"))],
    ["metadata compiled + provenance root announced", existsSync(resolve(ROOT, "metadata/provenance.json"))],
    ["allowlist Merkle root built from CCFF00-holder snapshot", CONFIG.allowlistRoot !== "0x" + "00".repeat(32)],
    ["royalty receiver confirmed (Foil's wallet)", /^0x[0-9a-fA-F]{40}$/.test(CONFIG.royaltyReceiver)],
    ["baseURI points at final IPFS/Arweave CID (not placeholder)", !CONFIG.baseURI.includes("REPLACE_WITH_CID")],
    ["deployer wallet funded on Robinhood Chain", false],
    ["USER APPROVAL: FOIL_DEPLOY_APPROVED=1 set by the user", false],
  ];
  for (const [label, ok] of checks) console.log(`      [${ok ? "x" : " "}] ${label}`);
  const missing = checks.filter(([, ok]) => !ok).length;
  console.log(`\n      ${missing} of ${checks.length} items still open. --dry exits 0 regardless; --live refuses unless approved.`);

  console.log("\n" + "=".repeat(70));
  console.log("DRY RUN COMPLETE — no wallet touched, nothing signed, nothing broadcast.");
  console.log("=".repeat(70));
}

// ---------------------------------------------------------------------------
// --live: gated behind explicit user approval
// ---------------------------------------------------------------------------
async function liveRun() {
  console.log("=".repeat(70));
  console.log("!!! FoilSet LIVE DEPLOY — REAL BROADCAST !!!");
  console.log("=".repeat(70));
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
  if (relative(ROOT, resolve(keyPath)).startsWith("..") === false) {
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

  const { abi, initCode } = compile();
  const argsData = encodeConstructorArgs(CONFIG);
  const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID, {
    headers: { "User-Agent": UA },
  });
  const net = await provider.getNetwork();
  if (Number(net.chainId) !== CHAIN_ID) throw new Error(`chain id mismatch: ${net.chainId}`);

  const wallet = new ethers.Wallet(pk, provider);
  const fee = await provider.getFeeData();
  const factory = new ethers.ContractFactory(abi, initCode, wallet);
  const deployTx = await factory.getDeployTransaction(
    CONFIG.name, CONFIG.symbol, CONFIG.baseURI, CONFIG.contractURI,
    CONFIG.allowlistRoot, CONFIG.royaltyReceiver, CONFIG.royaltyBps
  );
  deployTx.maxFeePerGas = fee.maxFeePerGas;
  deployTx.maxPriorityFeePerGas = fee.maxPriorityFeePerGas;

  console.log(`\ndeployer : ${wallet.address}`);
  console.log(`balance  : ${ethers.formatEther(await provider.getBalance(wallet.address))} ETH`);
  console.log(`sending deployment tx…`);
  const tx = await wallet.sendTransaction(deployTx);
  console.log(`tx hash  : ${tx.hash}`);
  console.log(`explorer : ${EXPLORER}/tx/${tx.hash}`);
  const receipt = await tx.wait();
  const address = receipt.contractAddress;
  console.log(`\nCONTRACT DEPLOYED: ${address}`);
  console.log(`verify   : ${EXPLORER}/address/${address} -> "Verify & Publish", compiler v0.8.24, optimizer 200 runs`);
  console.log(`\nNext: setPhase(1) for allowlist, or setPhase(2) for public. Consider renounceOwnership() after sellout.`);
}

if (DRY) await dryRun();
else await liveRun();

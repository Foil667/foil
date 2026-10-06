// Deploys LooperCityRegistry to Base via the EIP-2470 SingletonFactory.
// Why: Bankr /wallet/submit requires a valid `to` address, so raw contract
// creation is impossible through it. Calling the canonical factory's
// deploy(bytes,bytes32) is a normal contract call that CREATE2-deploys our init code.
// Deployer = Foil's Bankr wallet; deployment gas is autonomous per standing rules.
//
// Usage:
//   node scripts/deploy-factory.mjs --dry-run   compile + precompute address, submit nothing
//   node scripts/deploy-factory.mjs             compile + deploy to Base

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const solc = require("/home/hatch/workspace/nft-god/nft-set/node_modules/solc/wrapper.js")(
  require("/home/hatch/workspace/nft-god/nft-set/node_modules/solc/soljson.js")
);
const { keccak256 } = require("/home/hatch/workspace/looper-city/node_modules/js-sha3/src/sha3.js");

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHAIN = { id: 8453, rpc: "https://mainnet.base.org", name: "Base" };
const BANKR_API = "https://api.bankr.bot";
const FACTORY = "0xce0042B868300000d44A59004Da54A005ffdcf9f"; // EIP-2470 SingletonFactory (on Base)
const SALT_LABEL = "LooperCityRegistry-v1";

// constructor args (must match deploy-registry.mjs)
const ENTRY_FEE_ETH = 400000000000000n; // 0.0004 ETH
const RESCUE_FEE = 950100n * 10n ** 18n; // 950,100 $RESCUE (~25% off at genesis rates)

function args() {
  const a = process.argv.slice(2);
  const o = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith("--")) o[a[i].slice(2)] = a[i + 1] && !a[i + 1].startsWith("--") ? a[++i] : true;
  }
  return o;
}

function u256full(n) {
  const b = Buffer.alloc(32);
  let v = BigInt(n);
  for (let i = 31; i >= 0; i--) {
    b[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return b;
}

function compile() {
  const src = readFileSync(resolve(ROOT, "contracts/LooperCityRegistry.sol"), "utf8");
  const input = {
    language: "Solidity",
    sources: { "LooperCityRegistry.sol": { content: src } },
    settings: {
      viaIR: true,
      optimizer: { enabled: true, runs: 1 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  if (out.errors) {
    const fatal = out.errors.filter((e) => e.severity === "error");
    if (fatal.length) throw new Error(fatal.map((e) => e.formattedMessage).join("\n"));
  }
  const c = out.contracts["LooperCityRegistry.sol"]["LooperCityRegistry"];
  return { abi: c.abi, init: "0x" + c.evm.bytecode.object };
}

function bankrKey() {
  const cfg = JSON.parse(readFileSync(process.env.HOME + "/.bankr/config.json", "utf8"));
  return cfg.apiKey || cfg.api_key;
}

async function rpc(method, params) {
  const r = await fetch(CHAIN.rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await r.json();
  if (j.error) throw new Error(`RPC ${method}: ${JSON.stringify(j.error)}`);
  return j.result;
}

async function main() {
  const o = args();
  const { abi, init } = compile();
  const initCode = init + Buffer.concat([u256full(ENTRY_FEE_ETH), u256full(RESCUE_FEE)]).toString("hex");
  console.log(`init code: ${(initCode.length - 2) / 2} bytes`);

  const salt = "0x" + keccak256(SALT_LABEL);
  // CREATE2 address: keccak256(0xff ++ factory ++ salt ++ keccak256(initCode))[12:]
  const initHash = keccak256(Buffer.from(initCode.slice(2), "hex"));
  const addrHash = keccak256(
    Buffer.concat([
      Buffer.from("ff", "hex"),
      Buffer.from(FACTORY.slice(2), "hex"),
      Buffer.from(salt.slice(2), "hex"),
      Buffer.from(initHash, "hex"),
    ])
  );
  const expected = "0x" + addrHash.slice(-40);
  console.log(`salt: ${salt}`);
  console.log(`expected registry address: ${expected}`);

  // calldata: deploy(bytes,bytes32)
  const selector = keccak256("deploy(bytes,bytes32)").slice(0, 8);
  const initBytes = Buffer.from(initCode.slice(2), "hex");
  const paddedLen = Math.ceil(initBytes.length / 32) * 32;
  const padded = Buffer.alloc(paddedLen);
  initBytes.copy(padded);
  const data =
    "0x" +
    selector +
    Buffer.concat([
      u256full(64), // offset to bytes
      Buffer.from(salt.slice(2), "hex"),
      u256full(initBytes.length),
      padded,
    ]).toString("hex");
  console.log(`calldata: ${(data.length - 2) / 2} bytes`);

  const gas = await rpc("eth_estimateGas", [{ from: "0x6573682faee72a4a96e791Ba262439F1DF3A268d", to: FACTORY, data }]);
  console.log(`estimated gas: ${parseInt(gas, 16)}`);
  const gasLimit = ((BigInt(gas) * 130n) / 100n).toString();

  if (o["dry-run"]) {
    console.log("dry-run: not submitting");
    return;
  }

  console.log(`deploying via SingletonFactory on ${CHAIN.name}...`);
  const r = await fetch(`${BANKR_API}/wallet/submit`, {
    method: "POST",
    headers: { "X-API-Key": bankrKey(), "Content-Type": "application/json" },
    body: JSON.stringify({
      transaction: { chainId: CHAIN.id, to: FACTORY, value: "0", data, gas: gasLimit },
      description: "Deploy LooperCityRegistry via EIP-2470 factory on Base",
      waitForConfirmation: true,
    }),
  });
  const j = await r.json();
  if (!j.success) throw new Error(`Bankr submit failed: ${JSON.stringify(j).slice(0, 500)}`);
  console.log(`tx: ${j.transactionHash} (block ${j.blockNumber})`);

  const code = await rpc("eth_getCode", [expected, "latest"]);
  if (code === "0x" || code === "0x0") throw new Error(`no code at ${expected} — deploy failed, check tx`);
  console.log(`OK: LooperCityRegistry live at ${expected} (${(code.length - 2) / 2} bytes runtime)`);

  mkdirSync(resolve(ROOT, "deployments"), { recursive: true });
  writeFileSync(
    resolve(ROOT, "deployments/base.json"),
    JSON.stringify(
      {
        chain: CHAIN.name,
        chainId: CHAIN.id,
        address: expected,
        factory: FACTORY,
        salt,
        saltLabel: SALT_LABEL,
        tx: j.transactionHash,
        block: j.blockNumber,
        entryFeeETH: ENTRY_FEE_ETH.toString(),
        rescueFee: RESCUE_FEE.toString(),
        feeSplit: "90% foil (0x6573682faee72a4a96e791Ba262439F1DF3A268d) / 10% user (0x4F9883C7331ba59A56360fFa3c332e0Bc09029Fc)",
        deployedAt: new Date().toISOString(),
        abi,
      },
      null,
      2
    )
  );
  console.log("wrote deployments/base.json");
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});

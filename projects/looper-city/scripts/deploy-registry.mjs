// Deploys LooperCityRegistry to Base (8453) via Bankr /wallet/submit.
// The deployer is Foil's Bankr wallet; deployment gas is autonomous per standing rules.
// No funds move at deploy time (fees only move when agents register later).
//
// Usage:
//   node scripts/deploy-registry.mjs --dry-run   compile + encode + print, submit nothing
//   node scripts/deploy-registry.mjs             compile + deploy to Base
//
// Constructor: (uint256 entryFeeETH_, uint256 rescueFee_)
// Token + participant addresses are private constants in the contract.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const solc = require("/home/hatch/workspace/nft-god/nft-set/node_modules/solc/wrapper.js")(
  require("/home/hatch/workspace/nft-god/nft-set/node_modules/solc/soljson.js")
);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHAIN = { id: 8453, rpc: "https://mainnet.base.org", name: "Base" };
const BANKR_API = "https://api.bankr.bot";

// Grounded constants (verified 2026-09-28)
const RESCUE = "0x8201132Bc218dbD81305Ff5605F44aE4804D4BA3"; // $RESCUE on Base
const LOOPER = "0x1649CD37f4748807b4882FC48765bA0B2aFfa94a"; // Loopers ERC-721 on Base
const FOIL = "0x6573682faee72a4a96e791ba262439f1df3a268d"; // Foil's wallet: 90% of fees
const USER = "0x4f9883c7331ba59a56360ffa3c332e0bc09029fc"; // user's wallet: 10% of fees

function args() {
  const a = process.argv.slice(2);
  const o = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith("--")) o[a[i].slice(2)] = a[i + 1] && !a[i + 1].startsWith("--") ? a[++i] : true;
  }
  return o;
}

function addr(a) {
  return Buffer.concat([Buffer.alloc(12), Buffer.from(a.replace(/^0x/, ""), "hex")]);
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

// 0.0004 ETH = 400_000_000_000_000 wei; $RESCUE fee = 950_100 * 1e18 (~25% off at genesis rates)
const ENTRY_FEE_ETH = 400000000000000n;
const RESCUE_FEE = 950100n * 10n ** 18n;

function compile() {
  const src = readFileSync(resolve(ROOT, "contracts/LooperCityRegistry.sol"), "utf8");
  const input = {
    language: "Solidity",
    sources: { "LooperCityRegistry.sol": { content: src } },
    settings: {
      viaIR: true, // smaller bytecode (egress proxy caps request bodies)
      optimizer: { enabled: true, runs: 1 }, // optimize for SIZE
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  if (out.errors) {
    const fatal = out.errors.filter((e) => e.severity === "error");
    if (fatal.length) throw new Error(fatal.map((e) => e.formattedMessage).join("\n"));
    for (const w of out.errors) console.log("solc warning:", w.formattedMessage.split("\n")[0]);
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
  console.log(`compiled: init bytecode ${init.length / 2 - 1} bytes, ${abi.length} ABI entries`);

  // constructor (uint256,uint256)
  const data = init + Buffer.concat([u256full(ENTRY_FEE_ETH), u256full(RESCUE_FEE)]).toString("hex");
  console.log(`deploy data: ${data.length / 2 - 1} bytes`);

  // gas estimate
  const gas = await rpc("eth_estimateGas", [{ from: FOIL, data }]);
  console.log(`estimated gas: ${parseInt(gas, 16)}`);
  const gasLimit = (BigInt(gas) * 130n / 100n).toString();

  if (o["dry-run"]) {
    console.log("dry-run: not submitting");
    console.log(`data head: ${data.slice(0, 74)}...`);
    return;
  }

  console.log(`submitting deployment via Bankr to ${CHAIN.name}...`);
  const r = await fetch(`${BANKR_API}/wallet/submit`, {
    method: "POST",
    headers: { "X-API-Key": bankrKey(), "Content-Type": "application/json" },
    body: JSON.stringify({
      transaction: { chainId: CHAIN.id, to: "", value: "0", data, gas: gasLimit }, // empty `to` = contract creation
      description: "Deploy LooperCityRegistry on Base",
      waitForConfirmation: true,
    }),
  });
  const j = await r.json();
  if (!j.success) throw new Error(`Bankr submit failed: ${JSON.stringify(j).slice(0, 500)}`);
  console.log(`tx: ${j.transactionHash} (block ${j.blockNumber})`);

  const receipt = await rpc("eth_getTransactionReceipt", [j.transactionHash]);
  const address = receipt && receipt.contractAddress;
  if (!address) throw new Error("no contractAddress in receipt — check the tx manually");
  console.log(`LooperCityRegistry deployed at ${address} on ${CHAIN.name}`);

  mkdirSync(resolve(ROOT, "deployments"), { recursive: true });
  writeFileSync(
    resolve(ROOT, "deployments/base.json"),
    JSON.stringify(
      {
        chain: CHAIN.name,
        chainId: CHAIN.id,
        address,
        tx: j.transactionHash,
        block: j.blockNumber,
        constructorArgs: { rescue: RESCUE, looper: LOOPER, foil: FOIL, user: USER },
        entryFeeETH: ENTRY_FEE_ETH.toString(),
        rescueFee: RESCUE_FEE.toString(),
        rescueDiscount: "25% off vs ETH fee at genesis rates",
        feeSplit: "90% foil / 10% user",
        deployedAt: new Date().toISOString(),
        abi: abi,
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

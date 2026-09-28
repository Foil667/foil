// Deploys FoilGrit to Base (8453) and Robinhood Chain (4663) via Bankr /wallet/submit.
// The deployer is Foil's Bankr wallet; deployment gas is autonomous per standing rules.
//
// Usage:
//   node scripts/deploy-grit.mjs --chain base --root 0x<merkle> --uri https://arweave.net/<txid>
//   node scripts/deploy-grit.mjs --chain robinhood --root 0x<merkle> --uri https://arweave.net/<txid>
//   --dry-run   compile + encode + print the tx, submit nothing
//
// Constructor: (string name_, string symbol_, string baseURI_, bytes32 allowlistRoot_,
//               address royaltyReceiver_, uint96 royaltyBps_)
// Royalty receiver is always Foil's wallet; bps always 750 (7.5%).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const solc = require("/home/hatch/workspace/nft-god/nft-set/node_modules/solc/wrapper.js")(
  require("/home/hatch/workspace/nft-god/nft-set/node_modules/solc/soljson.js")
);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHAINS = {
  base: { id: 8453, rpc: "https://mainnet.base.org", name: "Base" },
  robinhood: { id: 4663, rpc: "https://rpc.mainnet.chain.robinhood.com", name: "Robinhood Chain" },
};
const ROYALTY_RECEIVER = "0x6573682faee72a4a96e791ba262439f1df3a268d";
const ROYALTY_BPS = 750;
const BANKR_API = "https://api.bankr.bot";

function args() {
  const a = process.argv.slice(2);
  const o = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith("--")) o[a[i].slice(2)] = a[i + 1] && !a[i + 1].startsWith("--") ? a[++i] : true;
  }
  return o;
}

// --- minimal ABI encoder for (string,string,string,bytes32,address,uint96) ---
function u256(n) {
  const b = Buffer.alloc(32);
  b.writeBigUInt64BE(BigInt(n) >> 64n, 0); // careful: only for small n
  b.writeBigUInt64BE(BigInt(n) & 0xffffffffffffffffn, 24);
  return b;
}
function encStr(s) {
  const d = Buffer.from(s, "utf8");
  const padded = Buffer.alloc(Math.ceil(d.length / 32) * 32);
  d.copy(padded);
  return Buffer.concat([u256(d.length), padded]);
}
function encodeArgs(name, symbol, baseURI, root, receiver, bps) {
  const tails = [encStr(name), encStr(symbol), encStr(baseURI)];
  let off = 6 * 32;
  const head = [];
  for (const t of tails) { head.push(u256(off)); off += t.length; }
  head.push(Buffer.from(root.replace(/^0x/, ""), "hex")); // bytes32
  head.push(Buffer.concat([Buffer.alloc(12), Buffer.from(receiver.replace(/^0x/, ""), "hex")])); // address
  head.push(u256(bps)); // uint96
  const blob = Buffer.concat([...head, ...tails]);
  // sanity: decode back the three strings
  return "0x" + blob.toString("hex");
}

function compile() {
  const src = readFileSync(resolve(ROOT, "contracts/FoilGrit.sol"), "utf8");
  const input = {
    language: "Solidity",
    sources: { "FoilGrit.sol": { content: src } },
    settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } },
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  if (out.errors) {
    const fatal = out.errors.filter((e) => e.severity === "error");
    if (fatal.length) throw new Error(fatal.map((e) => e.formattedMessage).join("\n"));
  }
  const c = out.contracts["FoilGrit.sol"]["FoilGrit"];
  return { abi: c.abi, init: "0x" + c.evm.bytecode.object };
}

function bankrKey() {
  const cfg = JSON.parse(readFileSync(process.env.HOME + "/.bankr/config.json", "utf8"));
  return cfg.apiKey || cfg.api_key;
}

async function rpc(chain, method, params) {
  const r = await fetch(chain.rpc, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await r.json();
  if (j.error) throw new Error(`RPC ${method}: ${JSON.stringify(j.error)}`);
  return j.result;
}

async function main() {
  const o = args();
  const chain = CHAINS[o.chain];
  if (!chain) throw new Error("--chain base|robinhood required");
  if (!o.root || !/^0x[0-9a-fA-F]{64}$/.test(o.root)) throw new Error("--root 0x<64 hex> required");
  if (!o.uri || !o.uri.startsWith("https://")) throw new Error("--uri https://... required");

  console.log(`compiling FoilGrit for ${chain.name}...`);
  const { abi, init } = compile();
  console.log(`init code: ${(init.length - 2) / 2} bytes`);

  const encoded = encodeArgs("FOIL GRIT", "GRIT", o.uri, o.root, ROYALTY_RECEIVER, ROYALTY_BPS);
  const data = init + encoded.slice(2);
  console.log(`deployment data: ${(data.length - 2) / 2} bytes`);

  // pre-flight: constructor must be nonpayable and value must be 0 (we never pay for mints)
  const ctor = abi.find((e) => e.type === "constructor");
  if (!ctor || ctor.stateMutability !== "nonpayable") throw new Error("constructor is not nonpayable — aborting");
  const value = "0";

  // gas estimate via eth_estimateGas (from = Foil's wallet)
  const gas = await rpc(chain, "eth_estimateGas", [{ from: ROYALTY_RECEIVER, value: "0x0", data }]);
  console.log(`estimated gas: ${BigInt(gas).toString()} units`);
  const fee = await rpc(chain, "eth_gasPrice", []);
  const gasCostWei = BigInt(gas) * BigInt(fee);
  console.log(`estimated cost: ${gasCostWei} wei (~$${(Number(gasCostWei) / 1e18 * 3500).toFixed(2)} at $3500/ETH)`);

  if (o["dry-run"]) {
    console.log("DRY RUN — tx that would be submitted:");
    console.log(JSON.stringify({ chainId: chain.id, value, data: data.slice(0, 66) + "…", dataBytes: (data.length - 2) / 2 }, null, 2));
    return;
  }

  console.log(`submitting deployment via Bankr to ${chain.name}...`);
  const r = await fetch(`${BANKR_API}/wallet/submit`, {
    method: "POST",
    headers: { "X-API-Key": bankrKey(), "Content-Type": "application/json" },
    body: JSON.stringify({
      transaction: { chainId: chain.id, value, data, gas: BigInt(gas).toString() },
      description: `Deploy FoilGrit (GRIT) on ${chain.name}`,
      waitForConfirmation: true,
    }),
  });
  const j = await r.json();
  if (!j.success) throw new Error(`Bankr submit failed: ${JSON.stringify(j).slice(0, 400)}`);
  console.log(`tx: ${j.transactionHash} (block ${j.blockNumber})`);

  // resolve the deployed contract address from the receipt
  const receipt = await rpc(chain, "eth_getTransactionReceipt", [j.transactionHash]);
  const address = receipt && receipt.contractAddress;
  if (!address) throw new Error("no contractAddress in receipt — check the tx manually");
  console.log(`FoilGrit deployed at ${address} on ${chain.name}`);

  mkdirSync(resolve(ROOT, "deployments"), { recursive: true });
  writeFileSync(resolve(ROOT, `deployments/${o.chain}.json`), JSON.stringify({
    chain: chain.name, chainId: chain.id, address,
    tx: j.transactionHash, block: j.blockNumber,
    baseURI: o.uri, allowlistRoot: o.root,
    royaltyReceiver: ROYALTY_RECEIVER, royaltyBps: ROYALTY_BPS,
    deployedAt: new Date().toISOString(),
  }, null, 2));
  console.log(`record saved to deployments/${o.chain}.json`);
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });

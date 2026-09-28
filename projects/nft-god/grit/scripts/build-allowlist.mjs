// build-allowlist.mjs — Merkle allowlist builder for FOIL GRIT.
// Leaf = keccak256(abi.encodePacked(address)); sorted-pair hashing,
// byte-for-byte compatible with FoilGrit.sol `_verifyMerkle`:
//   if (h <= p) h = keccak256(abi.encodePacked(h, p));
//   else        h = keccak256(abi.encodePacked(p, h));
//
// Usage:
//   node build-allowlist.mjs <addresses.json> --chain base \
//     --source "Loopers holders on Base (onchain snapshot)" \
//     --outdir ~/workspace/nft-god/grit/allowlist --name base
//
// Writes: <outdir>/<name>.json        {chain, source, snapshotTime, count, root, addresses[]}
//         <outdir>/proofs-<name>.json {root, count, proofs: {address: [hex...]}}
// Runs a self-test verifying 3 random proofs with the contract's algorithm.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { keccak256 } = require("/home/hatch/workspace/nft-god/nft-set/node_modules/js-sha3");

const buf = (hex) => Buffer.from(hex.replace(/^0x/, ""), "hex");
const hex = (b) => "0x" + b.toString("hex");
const keccak = (b) => Buffer.from(keccak256(b), "hex");

function leafOf(address) {
  const a = address.toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(a)) throw new Error(`bad address: ${address}`);
  return keccak(buf(a)); // abi.encodePacked(address) = 20 raw bytes
}

// Sorted-pair hash, exactly like the contract.
function pairHash(a, b) {
  return Buffer.compare(a, b) <= 0 ? keccak(Buffer.concat([a, b])) : keccak(Buffer.concat([b, a]));
}

function buildTree(leaves) {
  if (!leaves.length) throw new Error("empty leaf set");
  const layers = [leaves];
  while (layers[layers.length - 1].length > 1) {
    const cur = layers[layers.length - 1];
    const next = [];
    for (let i = 0; i < cur.length; i += 2) {
      const l = cur[i];
      const r = i + 1 < cur.length ? cur[i + 1] : cur[i]; // duplicate last when odd
      next.push(pairHash(l, r));
    }
    layers.push(next);
  }
  return layers;
}

function proofFor(layers, idx) {
  const proof = [];
  for (let l = 0; l < layers.length - 1; l++) {
    const cur = layers[l];
    const sib = idx % 2 === 0 ? idx + 1 : idx - 1;
    proof.push(cur[sib < cur.length ? sib : idx]); // odd-length: sibling is self
    idx = Math.floor(idx / 2);
  }
  return proof;
}

// Contract-algorithm verifier: mirrors FoilGrit._verifyMerkle exactly.
function verifyProof(leafHex, proofHexes, rootHex) {
  let h = buf(leafHex);
  const root = buf(rootHex);
  for (const p of proofHexes) h = pairHash(h, buf(p));
  return h.equals(root);
}

function main() {
  const args = process.argv.slice(2);
  const input = args[0];
  const opt = {};
  for (let i = 1; i < args.length; i += 2) opt[args[i].replace(/^--/, "")] = args[i + 1];
  const { chain, source, outdir, name } = opt;
  if (!input || !chain || !source || !outdir || !name) {
    console.error("usage: node build-allowlist.mjs <addresses.json> --chain X --source S --outdir D --name N");
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(input, "utf8"));
  // Accept ["0x.."] or [{address, ...}] shapes.
  const addrs = [...new Set(raw.map((x) => (typeof x === "string" ? x : x.address).toLowerCase()))].sort();
  console.log(`loaded ${addrs.length} unique addresses`);

  const leaves = addrs.map(leafOf);
  const layers = buildTree(leaves);
  const root = hex(layers[layers.length - 1][0]);

  const proofs = {};
  addrs.forEach((a, i) => { proofs[a] = proofFor(layers, i).map(hex); });

  // --- self-test: 3 random proofs through the contract's algorithm ---
  const picks = [...addrs].sort(() => Math.random() - 0.5).slice(0, 3);
  let ok = 0;
  for (const a of picks) {
    const leaf = hex(leafOf(a));
    const good = verifyProof(leaf, proofs[a], root);
    // negative control: wrong leaf must fail
    const bad = verifyProof(hex(leafOf("0x1111111111111111111111111111111111111111")), proofs[a], root);
    console.log(`self-test ${a}: proof ${good ? "VALID" : "INVALID"}, negative control ${!bad ? "ok" : "FAILED"}`);
    if (good && !bad) ok++;
  }
  if (ok !== 3) { console.error("SELF-TEST FAILED"); process.exit(2); }
  console.log("SELF-TEST: 3/3 proofs verify against root (contract algorithm)");

  mkdirSync(outdir, { recursive: true });
  const snapshotTime = new Date().toISOString();
  writeFileSync(`${outdir}/${name}.json`, JSON.stringify({
    chain, source, snapshotTime, count: addrs.length, root, addresses: addrs,
  }, null, 1));
  writeFileSync(`${outdir}/proofs-${name}.json`, JSON.stringify({ root, count: addrs.length, proofs }, null, 1));
  console.log(`root: ${root}`);
  console.log(`wrote ${outdir}/${name}.json and ${outdir}/proofs-${name}.json`);
}

main();

export { leafOf, pairHash, buildTree, proofFor, verifyProof };

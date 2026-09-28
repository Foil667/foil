// FoilGrit contract test suite — runs against a local anvil instance.
// Spins up anvil itself, deploys, runs the full matrix, kills anvil.
//
// Usage: node scripts/test-grit.mjs
// Requires: anvil on PATH (~/.foundry/bin/anvil)

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const solcModule = require("/home/hatch/workspace/nft-god/nft-set/node_modules/solc/wrapper.js");
const soljson = require("/home/hatch/workspace/nft-god/nft-set/node_modules/solc/soljson.js");
const solc = solcModule(soljson);
const { keccak_256 } = require("/home/hatch/workspace/nft-god/nft-set/node_modules/js-sha3/src/sha3.js");

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RPC = "http://127.0.0.1:8545";
const ANVIL = process.env.HOME + "/.foundry/bin/anvil";

// anvil's default funded accounts
const DEPLOYER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const ALICE = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const BOB = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
const CAROL = "0x90F79bf6EB2c4f870365E785982E1f101E93b906"; // anvil 1.8.3 account #3 (this build uses a non-classic mnemonic)

let passed = 0, failed = 0;
function ok(cond, name) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ FAIL: ${name}`); }
}

// --- abi helpers ---
const sel = (sig) => keccak_256(sig).slice(0, 8);
const w = (hex) => hex.padStart(64, "0");
const encUint = (n) => w(BigInt(n).toString(16));
const encAddr = (a) => w(a.toLowerCase().replace(/^0x/, ""));
const encBool = (b) => w(b ? "1" : "0");
const encB32 = (b) => w(b.replace(/^0x/, ""));
function encStr(s) {
  const d = Buffer.from(s, "utf8");
  const pad = Buffer.alloc(Math.ceil(d.length / 32) * 32); d.copy(pad);
  return encUint(32) + encUint(d.length) + pad.toString("hex");
}
function encB32Array(arr) {
  // offset is relative to param start: [qty (32B), offset (32B)] -> array at byte 64
  return encUint(64) + encUint(arr.length) + arr.map((x) => encB32(x)).join("");
}
const decUint = (hex, off = 0) => BigInt("0x" + hex.slice(2 + off * 64, 2 + (off + 1) * 64));
const decAddr = (hex, off = 0) => "0x" + hex.slice(2 + off * 64 + 24, 2 + (off + 1) * 64);
const decStr = (hex) => {
  const b = Buffer.from(hex.slice(2), "hex");
  const p = Number(b.readBigUInt64BE(24)), l = Number(b.readBigUInt64BE(p + 24));
  return b.slice(p + 32, p + 32 + l).toString();
};

async function rpc(method, params = []) {
  const r = await fetch(RPC, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await r.json();
  if (j.error) { const e = new Error(j.error.message || "rpc error"); e.data = j.error.data; throw e; }
  return j.result;
}
const call = (to, data, from = DEPLOYER) => rpc("eth_call", [{ to, data, from }, "latest"]);
// send waits for the receipt and THROWS on revert (with the revert reason
// replayed via eth_call), so expectRevert actually sees failures.
const send = async (to, data, from = DEPLOYER, value = "0x0") => {
  let h;
  try {
    h = await rpc("eth_sendTransaction", [{ from, to, data, value }]);
  } catch (e) {
    console.error("SEND-RPC-ERROR:", e.message, "| cause:", e.cause ? e.cause.message : "none");
    console.error("  from:", from, "to:", to, "dataLen:", data.length);
    throw e;
  }
  let rc = null;
  for (let i = 0; i < 20 && !rc; i++) {
    rc = await rpc("eth_getTransactionReceipt", [h]);
    if (!rc) await new Promise((r) => setTimeout(r, 100));
  }
  if (!rc) throw new Error("no receipt for " + h);
  if (rc.status === "0x0") {
    let msg = "tx reverted", dataOut;
    try { await rpc("eth_call", [{ from, to, data, value }, "latest"]); }
    catch (callErr) { msg = callErr.message; dataOut = callErr.data; }
    const e = new Error(msg); e.data = dataOut; throw e;
  }
  return rc;
};
// contract-creation variant of send (no `to`): throws on revert too.
const sendCreate = async (data, from = DEPLOYER) => {
  const h = await rpc("eth_sendTransaction", [{ from, data }]);
  let rc = null;
  for (let i = 0; i < 20 && !rc; i++) {
    rc = await rpc("eth_getTransactionReceipt", [h]);
    if (!rc) await new Promise((r) => setTimeout(r, 100));
  }
  if (!rc) throw new Error("no receipt for " + h);
  if (rc.status === "0x0") throw new Error("creation reverted");
  return rc;
};
async function expectRevert(promise, name) {
  try { await promise; ok(false, name + " (expected revert, succeeded)"); }
  catch { ok(true, name + " (reverted as expected)"); }
}

function compile() {
  const src = readFileSync(resolve(ROOT, "contracts/FoilGrit.sol"), "utf8");
  const out = JSON.parse(solc.compile(JSON.stringify({
    language: "Solidity",
    sources: { "FoilGrit.sol": { content: src } },
    settings: { optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["evm.bytecode.object"] } } },
  })));
  const fatal = (out.errors || []).filter((e) => e.severity === "error");
  if (fatal.length) throw new Error(fatal.map((e) => e.formattedMessage).join("\n"));
  return "0x" + out.contracts["FoilGrit.sol"]["FoilGrit"].evm.bytecode.object;
}

// --- merkle (sorted pairs, OZ-compatible) ---
const leaf = (addr) => keccak_256(Buffer.from(addr.toLowerCase().replace(/^0x/, ""), "hex"));
function buildTree(leaves) {
  const layers = [leaves.map((l) => "0x" + l)];
  while (layers[layers.length - 1].length > 1) {
    const cur = layers[layers.length - 1], next = [];
    for (let i = 0; i < cur.length; i += 2) {
      const a = cur[i], b = cur[i + 1] || cur[i];
      const [x, y] = a <= b ? [a, b] : [b, a];
      next.push("0x" + keccak_256(Buffer.concat([
        Buffer.from(x.slice(2), "hex"), Buffer.from(y.slice(2), "hex")])));
    }
    layers.push(next);
  }
  return layers;
}
function getProof(layers, idx) {
  const proof = [];
  for (let d = 0; d < layers.length - 1; d++) {
    const sib = idx % 2 === 0 ? idx + 1 : idx - 1;
    proof.push(layers[d][sib] || layers[d][idx]);
    idx = Math.floor(idx / 2);
  }
  return proof;
}
async function main() {
  const anvil = spawn(ANVIL, ["--port", "8545"], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 1500));
  try {
    const init = compile();
    console.log("compiled:", (init.length - 2) / 2, "bytes init");

    // merkle tree over [ALICE, BOB] (CAROL excluded -> invalid proof)
    const addrs = [ALICE, BOB];
    const layers = buildTree(addrs.map(leaf));
    const root = layers[layers.length - 1][0];
    const proofAlice = getProof(layers, 0);
    const proofBob = getProof(layers, 1);

    // constructor args
    const tailsRaw = ["FOIL GRIT", "GRIT", "https://arweave.net/TEST"].map((s) => {
      const d = Buffer.from(s, "utf8");
      const pad = Buffer.alloc(Math.ceil(d.length / 32) * 32); d.copy(pad);
      return encUint(d.length) + pad.toString("hex");
    });
    let off = 6 * 32; const head = [];
    for (const t of tailsRaw) { head.push(encUint(off)); off += t.length / 2; }
    // ABI order: full head (3 string offsets + bytes32 + address + uint96), THEN tails
    head.push(encB32(root), encAddr(DEPLOYER), encUint(750));
    const argsHex = head.join("") + tailsRaw.join("");

    const deployTx = await rpc("eth_sendTransaction",
      [{ from: DEPLOYER, data: init + argsHex }]);
    const receipt = await rpc("eth_getTransactionReceipt", [deployTx]);
    const C = receipt.contractAddress;
    console.log("deployed at", C, "status", receipt.status);
    console.log("code bytes:", ((await rpc("eth_getCode", [C, "latest"])).length - 2) / 2);

    console.log("\n-- constructor / views --");
    ok((await call(C, "0x" + sel("name()"))) && decStr(await call(C, "0x" + sel("name()"))) === "FOIL GRIT", "name()");
    ok(decStr(await call(C, "0x" + sel("symbol()"))) === "GRIT", "symbol()");
    ok(decUint(await call(C, "0x" + sel("totalSupply()"))) === 0n, "totalSupply()=0");
    ok(decUint(await call(C, "0x" + sel("phase()"))) === 0n, "phase=CLOSED");
    {
      const r = await call(C, "0x" + sel("royaltyInfo(uint256,uint256)") + encUint(0) + encUint(10000));
      ok(decAddr(r, 0).toLowerCase() === DEPLOYER.toLowerCase() && decUint(r, 1) === 750n, "royaltyInfo 7.5%");
    }
    for (const [id, want] of [["01ffc9a7", true], ["80ac58cd", true], ["5b5e139f", true], ["2a55205a", true], ["ffffffff", false]])
      // bytes4 is LEFT-aligned in the 32-byte word (right-aligned reverts on dirty padding)
      ok((await call(C, "0x" + sel("supportsInterface(bytes4)") + id.padEnd(64, "0"))) === "0x" + w(want ? "1" : "0"), `supportsInterface(${id})=${want}`);

    console.log("\n-- phase gating / owner auth --");
    await expectRevert(send(C, "0x" + sel("allowlistMint(uint256,bytes32[])") + encUint(1) + encB32Array(proofAlice), ALICE), "allowlistMint while CLOSED");
    await expectRevert(send(C, "0x" + sel("publicMint(uint256)") + encUint(1), ALICE), "publicMint while CLOSED");
    await expectRevert(send(C, "0x" + sel("setPhase(uint8)") + encUint(1), ALICE), "non-owner setPhase");
    await expectRevert(send(C, "0x" + sel("setPhase(uint8)") + encUint(3)), "setPhase(3) invalid");

    console.log("\n-- allowlist phase --");
    await send(C, "0x" + sel("setPhase(uint8)") + encUint(1));
    await expectRevert(send(C, "0x" + sel("allowlistMint(uint256,bytes32[])") + encUint(1) + encB32Array(proofAlice), CAROL), "non-member proof rejected");
    await expectRevert(send(C, "0x" + sel("allowlistMint(uint256,bytes32[])") + encUint(3) + encB32Array(proofAlice), ALICE), "qty 3 > cap");
    await expectRevert(send(C, "0x" + sel("allowlistMint(uint256,bytes32[])") + encUint(0) + encB32Array(proofAlice), ALICE), "qty 0 rejected");
    await send(C, "0x" + sel("allowlistMint(uint256,bytes32[])") + encUint(2) + encB32Array(proofAlice), ALICE);
    ok(decUint(await call(C, "0x" + sel("balanceOf(address)") + encAddr(ALICE))) === 2n, "alice balance=2");
    ok((await call(C, "0x" + sel("ownerOf(uint256)") + encUint(1), ALICE)).toLowerCase().endsWith(ALICE.slice(2).toLowerCase()), "ownerOf(1)=alice");
    await expectRevert(send(C, "0x" + sel("allowlistMint(uint256,bytes32[])") + encUint(1) + encB32Array(proofAlice), ALICE), "cap 2 enforced");
    await send(C, "0x" + sel("allowlistMint(uint256,bytes32[])") + encUint(1) + encB32Array(proofBob), BOB);
    ok(decUint(await call(C, "0x" + sel("totalSupply()"))) === 3n, "totalSupply=3");
    await expectRevert(send(C, "0x" + sel("publicMint(uint256)") + encUint(1), ALICE), "publicMint during allowlist phase");

    console.log("\n-- allowlist root rotation --");
    const layers2 = buildTree([CAROL].map(leaf));
    const root2 = layers2[layers2.length - 1][0];
    const proofCarol = getProof(layers2, 0);
    await send(C, "0x" + sel("setAllowlistRoot(bytes32)") + encB32(root2));
    await send(C, "0x" + sel("allowlistMint(uint256,bytes32[])") + encUint(1) + encB32Array(proofCarol), CAROL);
    ok(decUint(await call(C, "0x" + sel("balanceOf(address)") + encAddr(CAROL))) === 1n, "carol mints after root rotation");

    console.log("\n-- public phase --");
    await send(C, "0x" + sel("setPhase(uint8)") + encUint(2));
    await expectRevert(send(C, "0x" + sel("publicMint(uint256)") + encUint(4), BOB), "qty 4 > public cap");
    await send(C, "0x" + sel("publicMint(uint256)") + encUint(3), BOB);
    await expectRevert(send(C, "0x" + sel("publicMint(uint256)") + encUint(1), BOB), "public cap 3 enforced");
    ok(decUint(await call(C, "0x" + sel("balanceOf(address)") + encAddr(BOB))) === 4n, "bob balance=4 (1 AL + 3 public)");

    console.log("\n-- reserve --");
    await expectRevert(send(C, "0x" + sel("ownerReserveMint(address,uint256)") + encAddr(ALICE) + encUint(1), ALICE), "non-owner reserve mint");
    await send(C, "0x" + sel("ownerReserveMint(address,uint256)") + encAddr(DEPLOYER) + encUint(20));
    ok(decUint(await call(C, "0x" + sel("reserveMinted()"))) === 20n, "reserveMinted=20");
    await expectRevert(send(C, "0x" + sel("ownerReserveMint(address,uint256)") + encAddr(DEPLOYER) + encUint(1)), "reserve cap 20 enforced");

    console.log("\n-- supply boundary (fill to 667) --");
    let supply = Number(decUint(await call(C, "0x" + sel("totalSupply()"))));
    console.log(`  starting supply: ${supply}`);
    const wallets = [];
    for (let i = 0; i < 230 && supply < 667; i++) {
      const addr = "0x" + (1000 + i).toString(16).padStart(40, "0");
      wallets.push(addr);
      await rpc("anvil_setBalance", [addr, "0xde0b6b3a7640000"]);
      await rpc("anvil_impersonateAccount", [addr]);
    }
    for (const addr of wallets) {
      if (supply >= 667) break;
      const qty = Math.min(3, 667 - supply);
      await send(C, "0x" + sel("publicMint(uint256)") + encUint(qty), addr);
      supply += qty;
    }
    ok(supply === 667 && decUint(await call(C, "0x" + sel("totalSupply()"))) === 667n, "totalSupply=667");
    const last = wallets[wallets.length - 1];
    await expectRevert(send(C, "0x" + sel("publicMint(uint256)") + encUint(1), last), "mint past 667 reverts SoldOut");
    await expectRevert(send(C, "0x" + sel("ownerReserveMint(address,uint256)") + encAddr(DEPLOYER) + encUint(1)), "reserve mint past 667 reverts");

    console.log("\n-- metadata --");
    ok(decStr(await call(C, "0x" + sel("tokenURI(uint256)") + encUint(0))) === "https://arweave.net/TEST0", "tokenURI(0)");
    ok(decStr(await call(C, "0x" + sel("tokenURI(uint256)") + encUint(666))) === "https://arweave.net/TEST666", "tokenURI(666)");
    await expectRevert(call(C, "0x" + sel("tokenURI(uint256)") + encUint(667)), "tokenURI(667) reverts NotMinted");
    await send(C, "0x" + sel("setBaseURI(string)") + encStr("https://arweave.net/NEW/"));
    ok(decStr(await call(C, "0x" + sel("tokenURI(uint256)") + encUint(0))) === "https://arweave.net/NEW/0", "baseURI updated");
    await send(C, "0x" + sel("freezeURI()"));
    ok((await call(C, "0x" + sel("uriFrozen()"))) === "0x" + w("1"), "uriFrozen=true");
    await expectRevert(send(C, "0x" + sel("setBaseURI(string)") + encStr("https://evil/")), "setBaseURI after freeze reverts");
    await send(C, "0x" + sel("freezeURI()")); // idempotent, must not revert
    ok(true, "freezeURI idempotent");

    console.log("\n-- ERC-721 transfers / approvals --");
    // alice owns 0,1 ; transfer 0 to bob
    await send(C, "0x" + sel("transferFrom(address,address,uint256)") + encAddr(ALICE) + encAddr(BOB) + encUint(0), ALICE);
    ok((await call(C, "0x" + sel("ownerOf(uint256)") + encUint(0))).toLowerCase().endsWith(BOB.slice(2).toLowerCase()), "transferFrom works");
    ok(decUint(await call(C, "0x" + sel("balanceOf(address)") + encAddr(ALICE))) === 1n, "alice balance decremented");
    await expectRevert(send(C, "0x" + sel("transferFrom(address,address,uint256)") + encAddr(BOB) + encAddr(CAROL) + encUint(0), ALICE), "non-owner transfer reverts");
    await expectRevert(send(C, "0x" + sel("transferFrom(address,address,uint256)") + encAddr(ALICE) + encAddr(CAROL) + encUint(0), BOB), "wrong from reverts");
    await expectRevert(send(C, "0x" + sel("transferFrom(address,address,uint256)") + encAddr(BOB) + "0".repeat(64) + encUint(0), BOB), "transfer to zero reverts");
    await send(C, "0x" + sel("approve(address,uint256)") + encAddr(CAROL) + encUint(0), BOB);
    ok((await call(C, "0x" + sel("getApproved(uint256)") + encUint(0))).toLowerCase().endsWith(CAROL.slice(2).toLowerCase()), "approve works");
    await send(C, "0x" + sel("transferFrom(address,address,uint256)") + encAddr(BOB) + encAddr(CAROL) + encUint(0), CAROL);
    ok((await call(C, "0x" + sel("ownerOf(uint256)") + encUint(0))).toLowerCase().endsWith(CAROL.slice(2).toLowerCase()), "approved transfer works");
    await send(C, "0x" + sel("setApprovalForAll(address,bool)") + encAddr(BOB) + encBool(true), CAROL);
    await send(C, "0x" + sel("transferFrom(address,address,uint256)") + encAddr(CAROL) + encAddr(ALICE) + encUint(0), BOB);
    ok((await call(C, "0x" + sel("ownerOf(uint256)") + encUint(0))).toLowerCase().endsWith(ALICE.slice(2).toLowerCase()), "operator transfer works");
    // 721A batch ownership: bob's batch tokens (ids 5,6,7) resolve
    ok((await call(C, "0x" + sel("ownerOf(uint256)") + encUint(6))).toLowerCase().endsWith(BOB.slice(2).toLowerCase()), "batch ownerOf(6)=bob");

    console.log("\n-- royalty admin --");
    await expectRevert(send(C, "0x" + sel("setRoyalty(address,uint96)") + encAddr(DEPLOYER) + encUint(1001)), "royalty >10% reverts");
    await expectRevert(send(C, "0x" + sel("setRoyalty(address,uint96)") + "0".repeat(64) + encUint(500)), "royalty to zero addr reverts");
    await send(C, "0x" + sel("setRoyalty(address,uint96)") + encAddr(ALICE) + encUint(1000));
    {
      const r = await call(C, "0x" + sel("royaltyInfo(uint256,uint256)") + encUint(0) + encUint(10000));
      ok(decAddr(r, 0).toLowerCase() === ALICE.toLowerCase() && decUint(r, 1) === 1000n, "royalty updated to 10%");
    }

    console.log("\n-- ownership --");
    await send(C, "0x" + sel("transferOwnership(address)") + encAddr(ALICE));
    await expectRevert(send(C, "0x" + sel("setPhase(uint8)") + encUint(2)), "old owner locked out");
    await send(C, "0x" + sel("renounceOwnership()"), ALICE);
    ok((await call(C, "0x" + sel("owner()"))).toLowerCase().endsWith("0".repeat(40)), "owner=0 after renounce");
    await expectRevert(send(C, "0x" + sel("setPhase(uint8)") + encUint(2), ALICE), "no owner powers after renounce");

    console.log("\n-- constructor guards (fresh deploys) --");
    // royaltyBps is head word index 5 (after 3 string offsets + root + receiver)
    const badBps = init + argsHex.slice(0, 5 * 64) + encUint(1001) + argsHex.slice(6 * 64);
    await expectRevert(sendCreate(badBps), "constructor bps>1000 reverts");
    // receiver is head word index 4 (name_off, symbol_off, uri_off, root, receiver, bps)
    const recvOff = 2 + (init.length - 2) + 4 * 64;
    const zeroRecvTx = (init + argsHex).slice(0, recvOff) + "0".repeat(64) + (init + argsHex).slice(recvOff + 64);
    await expectRevert(sendCreate(zeroRecvTx), "constructor zero receiver reverts");

    console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
    if (failed) process.exitCode = 1;
  } finally {
    anvil.kill();
  }
}

main().catch((e) => { console.error("FATAL:", e.message); console.error(e.stack.split("\n").slice(1, 5).join("\n")); process.exit(1); });

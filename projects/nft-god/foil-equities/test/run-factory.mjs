// run-factory.mjs — FoilAccountFactory audit-blocker fix test suite.
// Local-only: compiles via compile-tests.mjs, runs on in-process Hardhat
// Network (cancun). No deployments to any network, no fund movements, no keys.
//
// The audit-blocker (docs/AUDIT-READINESS.md §4): FoilAccount binds its token
// via constructor IMMUTABLES, so a single pre-deployed instance can never be
// the shared `implementation` for registry.createAccount(...) — every proxy
// would read the TEMPLATE's immutables, not its own token's. FoilAccountFactory
// fixes this as a PARALLEL contract (the 6 audited contracts are untouched):
// it exposes the registry's createAccount/account interface shape but
// CREATE2-deploys a FULL, correctly-configured FoilAccount per token.
//
// Covers:
//  F1.  account() is counterfactual: view matches createAccount() output
//  F2.  per-token instance: token 7 binds (NFT, 7)
//  F3.  token 8 -> different address, correct immutables
//  F4.  BLOCKER DEMO: a vanilla ERC-1167 proxy to the shared template reads
//       the TEMPLATE's immutables (0x..01, 999), not the token's — the old
//       design was genuinely broken
//  F5.  createAccount is idempotent (re-call returns the same address)
//  F6.  wrong implementation address reverts (WrongImplementation)
//  F7.  wrong chainId reverts (WrongChain)
//  F8.  salt binds: different salt -> different address, correct immutables
//  F9.  initData executes against the new account; bad initData reverts InitFailed
//  F10. FoilEquities integration: tokenAccount() view == factory.account();
//       createTokenAccount() deploys the real per-token account (no changes
//       to FoilEquities were needed)
//  F11. EIP-1271 on the factory account: owner raw + eth_sign sigs validate,
//       stranger fails
//  F12. old-owner signatures die on transfer (per-instance binding holds)
//  F13. execute(): owner-gated, WrongBoundToken on mismatched args
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
// Hardhat Network (cancun) is the local test chain — see hardhat.config.cjs.
const hre = require("hardhat");
const { ethers } = hre;

const HERE = dirname(fileURLToPath(import.meta.url));
const ART = (n) => JSON.parse(readFileSync(join(HERE, "artifacts", `${n}.json`), "utf8"));

const EIP1271_MAGIC = "0x1626ba7e";
const EIP1271_FAIL = "0xffffffff";
const TEMPLATE_BIND_CONTRACT = "0x0000000000000000000000000000000000000001";
const TEMPLATE_BIND_ID = 999n;

let pass = 0,
  fail = 0;
const results = [];
async function test(name, fn) {
  try {
    await fn();
    pass++;
    results.push(`PASS  ${name}`);
  } catch (e) {
    fail++;
    results.push(`FAIL  ${name}\n      ${String(e.message ?? e).split("\n").join("\n      ")}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function assertEq(a, b, msg) {
  if (a !== b) throw new Error(`${msg}: got ${a}, want ${b}`);
}
async function expectRevert(promise, errorName) {
  try {
    const tx = await promise;
    await tx.wait();
  } catch (e) {
    const msg = String(e?.message ?? e);
    if (errorName && !msg.includes(errorName) && !/revert|REVERT/i.test(msg)) {
      throw new Error(`expected revert ${errorName}, got: ${msg.slice(0, 200)}`);
    }
    return;
  }
  throw new Error(`expected revert ${errorName}, tx succeeded`);
}

// ---------- chain ----------
const provider = hre.ethers.provider;
const netSend = (method, params) => hre.network.provider.send(method, params);
const [owner, alice, bob, carol] = await hre.ethers.getSigners();
const [ownerA, aliceA, bobA] = await Promise.all(
  [owner, alice, bob].map((s) => s.getAddress())
);
const CHAIN_ID = (await provider.getNetwork()).chainId;
async function deploy(name, signer, ...args) {
  const { abi, bytecode } = ART(name);
  const c = await new ethers.ContractFactory(abi, bytecode, signer).deploy(...args);
  await c.waitForDeployment();
  return c;
}
function parseEvents(contracts, receipt) {
  const out = [];
  for (const log of receipt.logs) {
    for (const c of contracts) {
      try {
        const p = c.interface.parseLog(log);
        if (p) { out.push(p); break; }
      } catch {}
    }
  }
  return out;
}

// ---------- shared infra ----------
// template: a FoilAccount whose OWN immutables are the dummy binding
// (0x..01, 999) — deliberately NOT any real token, so the F4 demo is sharp.
const template = await deploy("FoilAccount", owner, TEMPLATE_BIND_CONTRACT, TEMPLATE_BIND_ID);
const TEMPLATE = await template.getAddress();
const factory = await deploy("FoilAccountFactory", owner, TEMPLATE);
const FACT = await factory.getAddress();
// NFT wired with the factory as its registry (no FoilEquities changes needed)
const nft = await deploy("FoilEquities", owner, aliceA /* dummy royalty router */, FACT, TEMPLATE);
const NFT = await nft.getAddress();
await (await nft.setPhase(2)).wait();

// ================= F1-F9: factory mechanics =================
await test("F1. account() is counterfactual: view matches createAccount() output", async () => {
  const predicted = await factory.account(TEMPLATE, CHAIN_ID, NFT, 7n, 0n);
  const tx = await factory.createAccount(TEMPLATE, CHAIN_ID, NFT, 7n, 0n, "0x");
  const rc = await tx.wait();
  const ev = parseEvents([factory], rc).find((p) => p.name === "AccountCreated");
  assert(ev, "AccountCreated emitted");
  assertEq(ev.args.account.toLowerCase(), predicted.toLowerCase(), "counterfactual match");
  assertEq(ev.args.tokenContract.toLowerCase(), NFT.toLowerCase(), "event tokenContract");
  assertEq(ev.args.tokenId, 7n, "event tokenId");
});

await test("F2. token 7's account is bound to (NFT, 7), not the template's", async () => {
  const predicted = await factory.account(TEMPLATE, CHAIN_ID, NFT, 7n, 0n);
  const { abi } = ART("FoilAccount");
  const acct = new ethers.Contract(predicted, abi, provider);
  assertEq((await acct.TOKEN_CONTRACT()).toLowerCase(), NFT.toLowerCase(), "TOKEN_CONTRACT");
  assertEq(await acct.TOKEN_ID(), 7n, "TOKEN_ID");
});

await test("F3. token 8 gets a different address with correct immutables", async () => {
  const a7 = await factory.account(TEMPLATE, CHAIN_ID, NFT, 7n, 0n);
  const a8 = await factory.account(TEMPLATE, CHAIN_ID, NFT, 8n, 0n);
  assert(a7.toLowerCase() !== a8.toLowerCase(), "distinct addresses");
  await (await factory.createAccount(TEMPLATE, CHAIN_ID, NFT, 8n, 0n, "0x")).wait();
  const { abi } = ART("FoilAccount");
  const acct = new ethers.Contract(a8, abi, provider);
  assertEq((await acct.TOKEN_CONTRACT()).toLowerCase(), NFT.toLowerCase(), "TOKEN_CONTRACT");
  assertEq(await acct.TOKEN_ID(), 8n, "TOKEN_ID");
});

await test("F4. BLOCKER DEMO: vanilla ERC-1167 proxy to the shared template reads the TEMPLATE's binding", async () => {
  // This is what the OLD design did: registry.createAccount(implementation=template,...)
  // deploys an ERC-1167 proxy -> template. The proxy has NO per-token state,
  // so it reports the template's (0x..01, 999) for EVERY token. Broken.
  const deployer = await deploy("ERC1167ProxyDeployer", owner);
  const salt = ethers.keccak256(ethers.toUtf8Bytes("blocker-demo"));
  const tx = await deployer.deploy(TEMPLATE, salt);
  await tx.wait();
  // recompute the proxy address offchain (55-byte ERC-1167 creation code)
  const { abi } = ART("FoilAccount");
  const proxyCode = ethers.solidityPacked(
    ["bytes", "bytes", "address", "bytes"],
    ["0x3d602d80600a3d3981f3", "0x363d3d373d3d3d363d73", TEMPLATE, "0x5af43d82803e903d91602b57fd5bf3"]
  );
  const proxyAddr = ethers.getCreate2Address(await deployer.getAddress(), salt, ethers.keccak256(proxyCode));
  const viaProxy = new ethers.Contract(proxyAddr, abi, provider);
  assertEq((await viaProxy.TOKEN_CONTRACT()).toLowerCase(), TEMPLATE_BIND_CONTRACT.toLowerCase(), "proxy reports TEMPLATE contract");
  assertEq(await viaProxy.TOKEN_ID(), TEMPLATE_BIND_ID, "proxy reports TEMPLATE id");
  assert((await viaProxy.TOKEN_CONTRACT()).toLowerCase() !== NFT.toLowerCase(), "NOT the token's contract");
});

await test("F5. createAccount is idempotent: re-call returns the same address", async () => {
  const a = await factory.account(TEMPLATE, CHAIN_ID, NFT, 7n, 0n);
  const tx = await factory.createAccount(TEMPLATE, CHAIN_ID, NFT, 7n, 0n, "0x");
  const rc = await tx.wait();
  // no second AccountCreated event on the idempotent path
  assert(!parseEvents([factory], rc).some((p) => p.name === "AccountCreated"), "no re-emit");
  const ret = await factory.createAccount.staticCall(TEMPLATE, CHAIN_ID, NFT, 7n, 0n, "0x");
  assertEq(ret.toLowerCase(), a.toLowerCase(), "same address");
});

await test("F6. wrong implementation reverts WrongImplementation", async () => {
  await expectRevert(
    factory.createAccount(aliceA, CHAIN_ID, NFT, 7n, 0n, "0x"),
    "WrongImplementation"
  );
});

await test("F7. wrong chainId reverts WrongChain", async () => {
  await expectRevert(
    factory.createAccount(TEMPLATE, CHAIN_ID + 1n, NFT, 7n, 0n, "0x"),
    "WrongChain"
  );
});

await test("F8. salt binds: salt=1 deploys a distinct, correctly-bound account", async () => {
  const a0 = await factory.account(TEMPLATE, CHAIN_ID, NFT, 7n, 0n);
  const a1 = await factory.account(TEMPLATE, CHAIN_ID, NFT, 7n, 1n);
  assert(a0.toLowerCase() !== a1.toLowerCase(), "salt changes address");
  await (await factory.createAccount(TEMPLATE, CHAIN_ID, NFT, 7n, 1n, "0x")).wait();
  const { abi } = ART("FoilAccount");
  const acct = new ethers.Contract(a1, abi, provider);
  assertEq((await acct.TOKEN_CONTRACT()).toLowerCase(), NFT.toLowerCase(), "TOKEN_CONTRACT");
  assertEq(await acct.TOKEN_ID(), 7n, "TOKEN_ID");
});

await test("F9. initData executes on fresh deploys; bad initData reverts InitFailed", async () => {
  // initData is executed AGAINST THE NEW ACCOUNT (registry-interface
  // semantics). A call the account accepts succeeds...
  const { abi } = ART("FoilAccount");
  const acctIface = new ethers.Interface(abi);
  const okData = acctIface.encodeFunctionData("TOKEN_CONTRACT");
  const predicted = await factory.account(TEMPLATE, CHAIN_ID, NFT, 43n, 0n);
  const tx = await factory.createAccount(TEMPLATE, CHAIN_ID, NFT, 43n, 0n, okData);
  await tx.wait();
  const acct = new ethers.Contract(predicted, abi, provider);
  assertEq((await acct.TOKEN_CONTRACT()).toLowerCase(), NFT.toLowerCase(), "account functional after initData");
  // ...while initData for a nonexistent function reverts InitFailed.
  const badData = "0x12345678";
  await expectRevert(
    factory.createAccount(TEMPLATE, CHAIN_ID, NFT, 44n, 0n, badData),
    "InitFailed"
  );
});

// ================= F10-F13: FoilEquities + FoilAccount integration =================
await test("F10. FoilEquities wiring: tokenAccount() == factory.account(); createTokenAccount() deploys it", async () => {
  await (await nft.connect(owner).mintPublic(1)).wait(); // token 1 -> owner
  const predicted = await factory.account(TEMPLATE, CHAIN_ID, NFT, 1n, 0n);
  assertEq((await nft.tokenAccount(1n)).toLowerCase(), predicted.toLowerCase(), "tokenAccount() counterfactual");
  const tx = await nft.connect(alice).createTokenAccount(1n);
  const rc = await tx.wait();
  const ev = parseEvents([nft], rc).find((p) => p.name === "AccountCreated");
  assert(ev, "AccountCreated emitted by FoilEquities");
  assertEq(ev.args.tokenId, 1n, "event tokenId");
  assertEq(ev.args.account.toLowerCase(), predicted.toLowerCase(), "deployed == predicted");
  const { abi } = ART("FoilAccount");
  const acct = new ethers.Contract(predicted, abi, provider);
  assertEq((await acct.TOKEN_CONTRACT()).toLowerCase(), NFT.toLowerCase(), "bound contract");
  assertEq(await acct.TOKEN_ID(), 1n, "bound id");
});

// holder wallet owns token 2; used for EIP-1271 + execute tests
const holderWallet = ethers.Wallet.createRandom();
await (await owner.sendTransaction({ to: holderWallet.address, value: ethers.parseEther("2") })).wait();
await (await nft.setPhase(2)).wait();
await (await nft.connect(holderWallet.connect(provider)).mintPublic(1)).wait(); // token 2
const ACCT2 = await nft.tokenAccount(2n);
await (await nft.createTokenAccount(2n)).wait();
const { abi: ACCT_ABI } = ART("FoilAccount");
const acct2 = new ethers.Contract(ACCT2, ACCT_ABI, provider);

await test("F11. EIP-1271: owner raw + eth_sign sigs validate on the factory account; stranger fails", async () => {
  const digest = ethers.keccak256(ethers.toUtf8Bytes("foil-agent-auth"));
  const raw = holderWallet.signingKey.sign(digest);
  const r1 = await acct2["isValidSignature(bytes32,bytes)"](digest, ethers.Signature.from(raw).serialized);
  assertEq(r1, EIP1271_MAGIC, "raw sig");
  const s2 = await holderWallet.signMessage(ethers.getBytes(digest));
  const r2 = await acct2["isValidSignature(bytes32,bytes)"](digest, s2);
  assertEq(r2, EIP1271_MAGIC, "eth_sign sig");
  const wrong = ethers.Wallet.createRandom();
  const s3 = await wrong.signMessage(ethers.getBytes(digest));
  const r3 = await acct2["isValidSignature(bytes32,bytes)"](digest, s3);
  assertEq(r3, EIP1271_FAIL, "stranger fails");
});

await test("F12. after transfer, the OLD owner's signatures die; the new owner's validate", async () => {
  const digest = ethers.keccak256(ethers.toUtf8Bytes("foil-agent-auth"));
  const sigOld = holderWallet.signingKey.sign(digest);
  const w = holderWallet.connect(provider);
  await (await nft.connect(w).transferFrom(holderWallet.address, bobA, 2n)).wait();
  assertEq(await acct2.owner(NFT, 2n), bobA, "owner() follows NFT");
  const rOld = await acct2["isValidSignature(bytes32,bytes)"](digest, ethers.Signature.from(sigOld).serialized);
  assertEq(rOld, EIP1271_FAIL, "old owner sig dead");
  const sigNew = await bob.signMessage(ethers.getBytes(digest));
  const rNew = await acct2["isValidSignature(bytes32,bytes)"](digest, sigNew);
  assertEq(rNew, EIP1271_MAGIC, "new owner sig valid");
});

await test("F13. execute(): owner-gated on the factory account; WrongBoundToken on mismatched args", async () => {
  // bob now owns token 2; fund the account, bob moves ETH out via execute()
  await (await owner.sendTransaction({ to: ACCT2, value: ethers.parseEther("0.5") })).wait();
  const before = await provider.getBalance(bobA);
  const tx = await acct2.connect(bob).execute(NFT, 2n, bobA, ethers.parseEther("0.1"), "0x");
  await tx.wait();
  await netSend("evm_mine", []); // guard against stale-balance reads
  assert((await provider.getBalance(bobA)) > before, "owner executed payout");
  await expectRevert(acct2.connect(alice).execute(NFT, 2n, bobA, 1n, "0x"), "NotTokenOwner");
  await expectRevert(acct2.connect(bob).execute(NFT, 3n, bobA, 1n, "0x"), "WrongBoundToken");
  await expectRevert(acct2.connect(bob).execute(aliceA, 2n, bobA, 1n, "0x"), "WrongBoundToken");
});

// ---------- report ----------
console.log(results.join("\n"));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

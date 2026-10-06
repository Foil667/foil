// run-economics.mjs — Foil Equities LOCKED ECONOMICS test suite.
// Local-only: compiles via compile-tests.mjs, runs on in-process ganache.
// No deployments to any network, no fund movements, no keys.
//
// Covers the user-locked economics:
//  A. MINT IS FREE: price exactly zero (mint fns reject ETH), caps, sold-out gate
//  B. ROYALTY 7.5% -> RoyaltyRouter (2.5pp pot / 5pp operator)
//  C. OPERATOR SPLIT: 90% Foil / 10% user, onchain, no discretion
//  D. $10 ACTIVATION (ETH/USDC) — the discount rails live in run.mjs
//  E. ERC-6551 token-bound wallets (createAccount, deterministic address)
//  F. ACTIVATION RESETS ON TRANSFER (flippers earn no drip)
//  G. FoilAccount: owner-gated execute, EIP-1271, ERC-8004 registration
//  H. StockPot: epoch gate, keeper fee, pro-rata drip to activated wallets
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
// Hardhat Network (cancun) is the local test chain — see hardhat.config.cjs.
// ganache 7.9.2 caps at Shanghai and rejects the MCOPY opcode that
// OpenZeppelin 5.6.x / solc 0.8.37 emit, so it cannot run these contracts.
const hre = require("hardhat");
const { ethers } = hre;

const HERE = dirname(fileURLToPath(import.meta.url));
const ART = (n) => JSON.parse(readFileSync(join(HERE, "artifacts", `${n}.json`), "utf8"));

const DEAD = "0x000000000000000000000000000000000000dEaD";
const EIP1271_MAGIC = "0x1626ba7e";
const EIP1271_FAIL = "0xffffffff";
const ACTIVATION_USDC = 10_000_000n; // $10, 6dp

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
const [owner, alice, bob, carol, foil, user] = await hre.ethers.getSigners();
const [ownerA, aliceA, bobA, carolA, foilA, userA] = await Promise.all(
  [owner, alice, bob, carol, foil, user].map((s) => s.getAddress())
);
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
async function increaseTime(sec) {
  await netSend("evm_increaseTime", [sec]);
  await netSend("evm_mine", []);
}
async function freshMine() {
  // guard against a stale-balance read quirk observed on local test chains
  // (immediate getBalance after tx.wait() can return the pre-tx value)
  await netSend("evm_mine", []);
}

// ---------- shared infra ----------
const usdc = await deploy("MockUSDC", owner);
const stock = await deploy("MockStock", owner);
const registry = await deploy("Mock6551Registry", owner);
const router = await deploy("MockRouter", owner);
const PRICE = ethers.parseUnits("0.5", 18);
await router.setPrice(PRICE);
await router.setUsdc(await usdc.getAddress()); // enable the USDC->stock quote leg
await usdc.mint(await router.getAddress(), ethers.parseUnits("1000000", 6));
await stock.mint(await router.getAddress(), ethers.parseUnits("1000000", 6));

// activation stack (ActivationHarness from run.mjs; MockPot receives ETH rail)
const cred = await deploy("MockCRED", owner);
const rescue = await deploy("MockRESCUE", owner);
const mockPot = await deploy("MockPot", owner);
const activation = await deploy(
  "ActivationHarness",
  owner,
  await cred.getAddress(),
  await rescue.getAddress(),
  await usdc.getAddress(),
  await mockPot.getAddress(),
  await router.getAddress(),
  PRICE,
  PRICE
);
const ACT = await activation.getAddress();

// money stack: StockPot -> RoyaltyRouter -> OperatorSplitter
const realPot = await deploy("StockPot", owner, await usdc.getAddress(), await router.getAddress(), [await stock.getAddress()]);
const splitter = await deploy("OperatorSplitter", owner, foilA, userA);
const royaltyRouter = await deploy(
  "RoyaltyRouter",
  owner,
  await realPot.getAddress(),
  await splitter.getAddress()
);
const RR = await royaltyRouter.getAddress();
const SPL = await splitter.getAddress();
const POT = await realPot.getAddress();

// NFT (per-chain registry wiring uses the mock registry)
const impl = aliceA; // dummy implementation address for tests
const nft = await deploy("FoilEquities", owner, RR, await registry.getAddress(), impl);
const NFT = await nft.getAddress();
await (await nft.setActivation(ACT)).wait();
await (await activation.setNFTContract(NFT)).wait();
await (await realPot.setContracts(NFT, ACT)).wait();

// fund alice, approvals
await usdc.mint(aliceA, ethers.parseUnits("1000", 6));
await usdc.connect(alice).approve(ACT, ethers.MaxUint256);
await usdc.connect(alice).approve(POT, ethers.MaxUint256);

// ================= A. MINT IS FREE =================
await test("A1. mint fns are non-payable: mintPublic with ETH reverts", async () => {
  await (await nft.setPhase(2)).wait();
  await expectRevert(nft.connect(alice).mintPublic(1, { value: 1n }));
});
await test("A2. public mint: free, sequential tokenIds, balances", async () => {
  await (await nft.connect(alice).mintPublic(2)).wait();
  assertEq(await nft.balanceOf(aliceA), 2n, "alice balance");
  assertEq(await nft.ownerOf(1n), aliceA, "token 1");
  assertEq(await nft.ownerOf(2n), aliceA, "token 2");
  assertEq(await nft.totalMinted(), 2n, "totalMinted");
});
await test("A3. public per-wallet cap (3) enforced", async () => {
  await expectRevert(nft.connect(alice).mintPublic(2), "OverLimit"); // 2+2 > 3
  await (await nft.connect(alice).mintPublic(1)).wait(); // 3rd ok
  assertEq(await nft.balanceOf(aliceA), 3n, "alice at cap");
  await expectRevert(nft.connect(alice).mintPublic(1), "OverLimit");
});
await test("A4. allowlist mint: free with valid merkle proof, cap 2", async () => {
  const leaf = ethers.solidityPackedKeccak256(["address"], [bobA]);
  await (await nft.setPhase(1)).wait();
  await (await nft.setMerkleRoot(leaf)).wait();
  await (await nft.connect(bob).mintAllowlist(2, [])).wait();
  assertEq(await nft.balanceOf(bobA), 2n, "bob minted 2");
  await expectRevert(nft.connect(bob).mintAllowlist(1, []), "OverLimit");
  // carol not allowlisted
  await expectRevert(nft.connect(carol).mintAllowlist(1, []), "NotAllowlisted");
});
await test("A5. allowlist mint rejects ETH too (free = exactly zero)", async () => {
  const leaf = ethers.solidityPackedKeccak256(["address"], [carolA]);
  await (await nft.setMerkleRoot(leaf)).wait();
  await expectRevert(nft.connect(carol).mintAllowlist(1, [], { value: 1n }));
});
await test("A6. mint closed when phase=0", async () => {
  await (await nft.setPhase(0)).wait();
  await expectRevert(nft.connect(carol).mintPublic(1), "Closed");
});
await test("A7. supply cap constant is 667", async () => {
  assertEq(await nft.MAX_SUPPLY(), 667n, "MAX_SUPPLY");
});

// ================= B. ROYALTY 7.5% =================
await test("B1. royaltyInfo: 7.5% to the router, exact math", async () => {
  const [receiver, amt] = await nft.royaltyInfo(1n, ethers.parseEther("1"));
  assert(receiver.toLowerCase() === RR.toLowerCase(), "receiver = router");
  assertEq(amt, ethers.parseEther("0.075"), "7.5% of 1 ETH");
  const [, amt2] = await nft.royaltyInfo(1n, 10000n);
  assertEq(amt2, 750n, "750 of 10000 wei");
});
await test("B2. RoyaltyRouter ERC20 split: 1/3 pot (2.5pp), 2/3 operator (5pp)", async () => {
  const royalty = 750_000n; // 7.5% of a 10 USDC sale
  await usdc.mint(RR, royalty);
  await (await royaltyRouter.splitToken(await usdc.getAddress())).wait();
  const potBal = await usdc.balanceOf(POT);
  const splBal = await usdc.balanceOf(SPL);
  assertEq(potBal, 250_000n, "pot gets 1/3 = 2.5pp");
  assertEq(splBal, 500_000n, "splitter gets 2/3 = 5pp");
  assertEq(potBal + splBal, royalty, "sums to royalty");
});
await test("B3. RoyaltyRouter ETH split via receive()", async () => {
  const potBefore = await provider.getBalance(POT);
  const foilBefore = await provider.getBalance(foilA);
  const userBefore = await provider.getBalance(userA);
  const rc = await (await owner.sendTransaction({ to: RR, value: 900n })).wait();
  const evs = parseEvents([royaltyRouter, realPot, splitter], rc);
  const split = evs.find((e) => e.name === "RoyaltySplit");
  assert(split && split.args.potShare === 300n && split.args.operatorShare === 600n, "RoyaltySplit(300,600)");
  const dist = evs.find((e) => e.name === "Distributed");
  assert(dist && dist.args.foilShare === 540n && dist.args.userShare === 60n, "Distributed(540,60)");
  await freshMine();
  assertEq((await provider.getBalance(POT)) - potBefore, 300n, "pot ETH 1/3");
  assertEq((await provider.getBalance(foilA)) - foilBefore, 540n, "foil 90% of operator share");
  assertEq((await provider.getBalance(userA)) - userBefore, 60n, "user 10% of operator share");
});

// ================= C. OPERATOR SPLIT 90/10 =================
await test("C1. splitter ERC20: 90% foil / 10% user, exact", async () => {
  // drain B2's leftover operator share first so the math is exact
  await (await splitter.distributeToken(await usdc.getAddress())).wait();
  const foilBefore = await usdc.balanceOf(foilA);
  const userBefore = await usdc.balanceOf(userA);
  await usdc.mint(SPL, 1_000_000n);
  const tx = await splitter.distributeToken(await usdc.getAddress());
  const rc = await tx.wait();
  assertEq((await usdc.balanceOf(foilA)) - foilBefore, 900_000n, "foil 90%");
  assertEq((await usdc.balanceOf(userA)) - userBefore, 100_000n, "user 10%");
  const ev = rc.logs.map((l) => { try { return splitter.interface.parseLog(l); } catch { return null; } }).find((p) => p?.name === "Distributed");
  assert(ev && ev.args.foilShare === 900_000n && ev.args.userShare === 100_000n, "Distributed event");
});
await test("C2. splitter: zero balance is a no-op (no revert)", async () => {
  await (await splitter.distributeToken(await usdc.getAddress())).wait();
});
await test("C3. splitter leaves no rounding dust on tiny amounts", async () => {
  // 7 wei through receive(): foil 6, user 1, exactly conserved
  const foilBefore = await provider.getBalance(foilA);
  const userBefore = await provider.getBalance(userA);
  const rc = await (await owner.sendTransaction({ to: SPL, value: 7n })).wait();
  const dist = parseEvents([splitter], rc).find((e) => e.name === "Distributed");
  assert(dist && dist.args.foilShare === 6n && dist.args.userShare === 1n, "Distributed(6,1)");
  await freshMine();
  assertEq((await provider.getBalance(foilA)) - foilBefore, 6n, "foil 6 wei");
  assertEq((await provider.getBalance(userA)) - userBefore, 1n, "user 1 wei");
});

// ================= D. $10 ACTIVATION =================
await test("D1. USDC activation: exact $10 to pot, flag set", async () => {
  const potBefore = await usdc.balanceOf(await mockPot.getAddress());
  await (await activation.connect(alice).activateWithUSDC(1, ACTIVATION_USDC)).wait();
  assertEq((await usdc.balanceOf(await mockPot.getAddress())) - potBefore, ACTIVATION_USDC, "exact $10");
  assert(await activation.activated(1n), "activated flag");
});
await test("D2. ETH activation forwards ETH to pot", async () => {
  const ethBefore = await mockPot.ethReceived();
  await (await activation.connect(alice).activateWithETH(2, { value: ethers.parseEther("0.5") })).wait();
  assertEq((await mockPot.ethReceived()) - ethBefore, ethers.parseEther("0.5"), "ETH to pot");
  assert(await activation.activated(2n), "activated flag");
});

// ================= E. ERC-6551 =================
await test("E1. tokenAccount is deterministic (same address twice)", async () => {
  const a1 = await nft.tokenAccount(1n);
  const a2 = await nft.tokenAccount(1n);
  assert(a1 === a2 && a1 !== ethers.ZeroAddress, "deterministic + nonzero");
});
await test("E2. createTokenAccount deploys + emits AccountCreated", async () => {
  const tx = await nft.connect(alice).createTokenAccount(1);
  const rc = await tx.wait();
  const ev = rc.logs.map((l) => { try { return nft.interface.parseLog(l); } catch { return null; } }).find((p) => p?.name === "AccountCreated");
  assert(ev && ev.args.tokenId === 1n, "AccountCreated(1)");
  assertEq(await nft.tokenAccount(1n), ev.args.account, "matches tokenAccount");
});
await test("E3. createTokenAccount reverts for nonexistent token", async () => {
  await expectRevert(nft.createTokenAccount(999));
});

// ================= F. ACTIVATION RESETS ON TRANSFER =================
await test("F1. transfer resets activation (flipper earns no drip)", async () => {
  assert(await activation.activated(1n), "token 1 active pre-transfer");
  const tx = await nft.connect(alice).transferFrom(aliceA, bobA, 1n);
  const rc = await tx.wait();
  assert(!(await activation.activated(1n)), "deactivated after transfer");
  const ev = rc.logs.map((l) => { try { return activation.interface.parseLog(l); } catch { return null; } }).find((p) => p?.name === "ActivationReset");
  assert(ev && ev.args.tokenId === 1n, "ActivationReset(1) emitted");
  assertEq(await nft.ownerOf(1n), bobA, "bob owns token 1");
});
await test("F2. new owner can re-activate after transfer", async () => {
  await usdc.mint(bobA, ethers.parseUnits("100", 6));
  await usdc.connect(bob).approve(ACT, ethers.MaxUint256);
  await (await activation.connect(bob).activateWithUSDC(1, ACTIVATION_USDC)).wait();
  assert(await activation.activated(1n), "re-activated by new owner");
});
await test("F3. mint does NOT reset activation (only real transfers)", async () => {
  // token 3 (alice's) is activated via ETH rail, then a fresh mint to carol
  await (await nft.setPhase(2)).wait();
  await (await nft.connect(carol).mintPublic(1)).wait(); // token 6
  assert(await activation.activated(1n), "mint didn't touch token 1");
});
await test("F4. onTransferReset reverts for non-NFT callers", async () => {
  await expectRevert(activation.onTransferReset(1), "NotNFT");
});

// ================= G. FOILACCOUNT =================
const mockNft = await deploy("MockNFT721", owner);
const ownerWallet = ethers.Wallet.createRandom();
const MOCKNFT = await mockNft.getAddress();
await (await mockNft.mintTo(ownerWallet.address, 1)).wait();
await (await mockNft.mintTo(aliceA, 2)).wait();
const acct1 = await deploy("FoilAccount", owner, MOCKNFT, 1);
const ACCT1 = await acct1.getAddress();
// fund the random owner wallet so it can pay gas for TBA calls
await (await owner.sendTransaction({ to: ownerWallet.address, value: ethers.parseEther("1") })).wait();

await test("G1. execute: owner runs calls, non-owner reverts", async () => {
  // ownerWallet executes a USDC mint to the account via the TBA
  const data = usdc.interface.encodeFunctionData("mint", [ACCT1, 1234n]);
  const wallet = ownerWallet.connect(provider);
  await (await acct1.connect(wallet).execute(MOCKNFT, 1n, await usdc.getAddress(), 0n, data)).wait();
  assertEq(await usdc.balanceOf(ACCT1), 1234n, "TBA executed mint");
  await expectRevert(acct1.connect(alice).execute(MOCKNFT, 1n, await usdc.getAddress(), 0n, data), "NotTokenOwner");
});
await test("G2. execute: WrongBoundToken on mismatched args", async () => {
  const data = usdc.interface.encodeFunctionData("mint", [ACCT1, 1n]);
  const wallet = ownerWallet.connect(provider);
  await expectRevert(acct1.connect(wallet).execute(MOCKNFT, 2n, await usdc.getAddress(), 0n, data), "WrongBoundToken");
  await expectRevert(acct1.connect(wallet).execute(aliceA, 1n, await usdc.getAddress(), 0n, data), "WrongBoundToken");
});
await test("G3. EIP-1271: raw digest signed by current owner validates", async () => {
  const digest = ethers.keccak256(ethers.toUtf8Bytes("foil-agent-auth"));
  const sig = ownerWallet.signingKey.sign(digest);
  const res = await acct1["isValidSignature(bytes32,bytes)"](digest, ethers.Signature.from(sig).serialized);
  assertEq(res, EIP1271_MAGIC, "magic value");
});
await test("G4. EIP-1271: eth_signed message validates", async () => {
  const digest = ethers.keccak256(ethers.toUtf8Bytes("hello agent"));
  const sig = await ownerWallet.signMessage(ethers.getBytes(digest));
  const res = await acct1["isValidSignature(bytes32,bytes)"](digest, sig);
  assertEq(res, EIP1271_MAGIC, "magic value");
});
await test("G5. EIP-1271: wrong signer fails", async () => {
  // local wallet (personal_sign is unavailable on this ganache endpoint)
  const wrong = ethers.Wallet.createRandom();
  const digest = ethers.keccak256(ethers.toUtf8Bytes("foil-agent-auth"));
  const sig = await wrong.signMessage(ethers.getBytes(digest));
  const res = await acct1["isValidSignature(bytes32,bytes)"](digest, sig);
  assertEq(res, EIP1271_FAIL, "fail value");
});
await test("G6. EIP-1271: after transfer, old owner signatures stop validating", async () => {
  const digest = ethers.keccak256(ethers.toUtf8Bytes("foil-agent-auth"));
  const sigOld = ownerWallet.signingKey.sign(digest);
  // ownerWallet transfers token 1 to bob
  const w = ownerWallet.connect(provider);
  await (await mockNft.connect(w).transferFrom(ownerWallet.address, bobA, 1n)).wait();
  assertEq(await acct1.owner(MOCKNFT, 1n), bobA, "owner() follows NFT");
  const res = await acct1["isValidSignature(bytes32,bytes)"](digest, ethers.Signature.from(sigOld).serialized);
  assertEq(res, EIP1271_FAIL, "old owner sig invalid");
});
await test("G7. registerAsAgent: owner registers, non-owner reverts", async () => {
  const reg = await deploy("MockIdentityRegistry", owner);
  const acct2 = await deploy("FoilAccount", owner, MOCKNFT, 2); // alice owns token 2
  await (await acct2.connect(alice).registerAsAgent(await reg.getAddress(), "ipfs://foil-agent")).wait();
  assertEq(await reg.registrations(await acct2.getAddress()), "ipfs://foil-agent", "registered");
  assertEq(await reg.registerCount(await acct2.getAddress()), 1n, "once");
  await expectRevert(acct2.connect(bob).registerAsAgent(await reg.getAddress(), "ipfs://evil"), "NotTokenOwner");
  await expectRevert(acct2.connect(alice).registerAsAgent(ethers.ZeroAddress, "x"), "ZeroAddress");
});

// ================= H. STOCKPOT =================
// setup: activate token 3 (alice; token 2 was activated in D2), fund the pot (B2 seeded 250k USDC)
await (await activation.connect(alice).activateWithUSDC(3, ACTIVATION_USDC)).wait();
await usdc.mint(POT, 100_000_000n);
await (await realPot.setContracts(NFT, ACT)).wait();

await test("H1. distribute: keeper fee 50bps, pro-rata to activated wallets only", async () => {
  // tokens 1 (bob, re-activated) and 3 (alice) are active; 999 doesn't exist
  const acct1 = await nft.tokenAccount(1n);
  const acct3 = await nft.tokenAccount(3n);
  assert(acct1 !== acct3, "distinct accounts");
  const bal = await usdc.balanceOf(POT);
  const keeperBefore = await usdc.balanceOf(carolA);
  const tx = await realPot.connect(carol).distribute([1n, 3n, 999n], 500);
  const rc = await tx.wait();
  const fee = (bal * 50n) / 10_000n;
  assertEq((await usdc.balanceOf(carolA)) - keeperBefore, fee, "keeper 50bps");
  // router: USDC (6dp) -> MockStock (6dp) at PRICE ($0.5/stock, 1e18);
  // single stock token. stockWei = usdcWei * 1e18 / price.
  const distributable = bal - fee;
  const stockOut = (distributable * 10n ** 18n) / PRICE;
  const perNft = stockOut / 2n; // activeCount = 2 (999 excluded)
  assertEq(await stock.balanceOf(acct1), perNft, "acct1 pro-rata");
  assertEq(await stock.balanceOf(acct3), perNft, "acct3 pro-rata");
  const ev = parseEvents([realPot], rc).find((p) => p.name === "Distributed");
  assert(ev && ev.args.perNftCount === 2n, "Distributed(activeCount=2)");
  assert((await realPot.lastDistribution()) > 0n, "lastDistribution set");
});
await test("H2. second distribute in same epoch reverts EpochNotReady", async () => {
  await expectRevert(realPot.distribute([1n], 100), "EpochNotReady");
});
await test("H3. distribute reverts with no stock tokens", async () => {
  const emptyPot = await deploy("StockPot", owner, await usdc.getAddress(), await router.getAddress(), []);
  await usdc.mint(await emptyPot.getAddress(), 100_000_000n);
  await expectRevert(emptyPot.distribute([1n], 100), "NoStocks");
});
await test("H4. distribute reverts with zero USDC", async () => {
  const dryPot = await deploy("StockPot", owner, await usdc.getAddress(), await router.getAddress(), [await stock.getAddress()]);
  await expectRevert(dryPot.distribute([1n], 100), "NothingToDistribute");
});
await test("H5. after the 7-day epoch, distribution runs again", async () => {
  await increaseTime(7 * 24 * 3600 + 1);
  await usdc.mint(POT, 10_000_000n);
  const acct1 = await nft.tokenAccount(1n);
  const before = await stock.balanceOf(acct1);
  const tx = await realPot.connect(carol).distribute([1n, 3n], 500);
  const rc = await tx.wait();
  assert((await stock.balanceOf(acct1)) > before, "second-epoch drip landed");
  assert(parseEvents([realPot], rc).some((p) => p.name === "Distributed"), "Distributed emitted");
});
await test("H6. pot money never touches the 90/10 splitter", async () => {
  assertEq(await usdc.balanceOf(SPL), 0n, "splitter holds no holder money");
  assertEq(await provider.getBalance(SPL), 0n, "splitter holds no holder ETH");
});

// ---------- report ----------
console.log(results.join("\n"));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

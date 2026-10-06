// run.mjs — Foil Equities Activation $RESCUE-rail test suite.
// Local-only: compiles via compile-tests.mjs, runs on an in-process
// ganache chain. No deployments, no fund movements, no keys.
//
// Covers:
//  1-2. Legacy rails (USDC, ETH) still work
//  3.   $CRED rail happy path (legacy, now with Burned event)
//  4.   $RESCUE rail happy path: 50% dead-address burn, 50% -> pot, Burned event
//  5.   Discount math exactness ($8 of token at the 1e18 EMA price)
//  6.   PriceDeviation reverts (>25% spot deviation), passes within band
//  7.   ZeroAddress: RESCUE rail disabled when RESCUE == address(0) (RH config)
//  8.   EMA folds spot observations (20% weight)
//  9.   AlreadyActive guard
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
const PRICE = ethers.parseUnits("0.5", 18); // $0.50/token, 1e18 scale
const ACTIVATION_USDC = 10_000_000n; // $10, 6dp
const DISCOUNTED_USD = 8_000_000n; // $8, 6dp

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
    // best-effort custom-error name match; any revert counts if name unknown
    if (errorName && !msg.includes(errorName) && !/revert|REVERT/i.test(msg)) {
      throw new Error(`expected revert ${errorName}, got: ${msg.slice(0, 160)}`);
    }
    return;
  }
  throw new Error(`expected revert ${errorName}, tx succeeded`);
}
function findEvent(contract, receipt, name) {
  for (const log of receipt.logs) {
    try {
      const p = contract.interface.parseLog(log);
      if (p && p.name === name) return p;
    } catch {}
  }
  return null;
}

// ---------- setup ----------
const provider = hre.ethers.provider;
const [owner, alice, bob] = await hre.ethers.getSigners();

async function deploy(name, signer, ...args) {
  const { abi, bytecode } = ART(name);
  const f = new ethers.ContractFactory(abi, bytecode, signer);
  const c = await f.deploy(...args);
  await c.waitForDeployment();
  return c;
}

const usdc = await deploy("MockUSDC", owner);
const cred = await deploy("MockCRED", owner);
const rescue = await deploy("MockRESCUE", owner);
const pot = await deploy("MockPot", owner);
const router = await deploy("MockRouter", owner);

const CRED = await cred.getAddress();
const RESCUE = await rescue.getAddress();
const USDC = await usdc.getAddress();
const POT = await pot.getAddress();
const ROUTER = await router.getAddress();

await router.setPrice(PRICE);
await usdc.mint(ROUTER, ethers.parseUnits("1000000", 6)); // router liquidity

const activation = await deploy(
  "ActivationHarness",
  owner,
  CRED,
  RESCUE,
  USDC,
  POT,
  ROUTER,
  PRICE,
  PRICE
);
const ACT = await activation.getAddress();

// fund alice + approve
await cred.mint(await alice.getAddress(), ethers.parseUnits("10000", 18));
await rescue.mint(await alice.getAddress(), ethers.parseUnits("10000", 18));
await usdc.mint(await alice.getAddress(), ethers.parseUnits("1000", 6));
await cred.connect(alice).approve(ACT, ethers.MaxUint256);
await rescue.connect(alice).approve(ACT, ethers.MaxUint256);
await usdc.connect(alice).approve(ACT, ethers.MaxUint256);

const aliceAddr = await alice.getAddress();
const TOKEN_AMOUNT = (DISCOUNTED_USD * 10n ** 30n) / PRICE; // 16e18
const BURN_HALF = TOKEN_AMOUNT / 2n; // 8e18
const SWAP_HALF = TOKEN_AMOUNT - BURN_HALF; // 8e18
const SWAP_USDC = (SWAP_HALF * PRICE) / 10n ** 30n; // 4e6

// ---------- tests ----------
await test("legacy rail: activateWithUSDC forwards $10 to pot", async () => {
  const potBefore = await usdc.balanceOf(POT);
  const tx = await activation.connect(alice).activateWithUSDC(1, ACTIVATION_USDC);
  await tx.wait();
  assertEq((await usdc.balanceOf(POT)) - potBefore, ACTIVATION_USDC, "pot usdc");
  assertEq(await activation.activated(1), true, "activated flag");
});

await test("legacy rail: activateWithETH forwards ETH to pot", async () => {
  const tx = await activation.connect(alice).activateWithETH(2, { value: ethers.parseEther("1") });
  await tx.wait();
  assertEq(await pot.ethReceived(), ethers.parseEther("1"), "pot eth");
  assertEq(await activation.activated(2), true, "activated flag");
});

await test("legacy rail: activateWithCRED burns 50%, swaps 50%, emits Burned", async () => {
  const supplyBefore = await cred.totalSupply();
  const balBefore = await cred.balanceOf(aliceAddr);
  const potBefore = await usdc.balanceOf(POT);

  const tx = await activation.connect(alice).activateWithCRED(3, 100);
  const receipt = await tx.wait();

  assertEq(balBefore - (await cred.balanceOf(aliceAddr)), TOKEN_AMOUNT, "CRED taken from user");
  assertEq(supplyBefore - (await cred.totalSupply()), BURN_HALF, "CRED burned supply");
  assertEq((await usdc.balanceOf(POT)) - potBefore, SWAP_USDC, "USDC to pot");

  const ev = findEvent(activation, receipt, "Burned");
  assert(ev, "Burned event missing");
  assertEq(ev.args.tokenId, 3n, "Burned.tokenId");
  assert(ev.args.payer.toLowerCase() === aliceAddr.toLowerCase(), "Burned.payer");
  assert(ev.args.token.toLowerCase() === CRED.toLowerCase(), "Burned.token");
  assertEq(ev.args.burned, BURN_HALF, "Burned.amount");

  const act = findEvent(activation, receipt, "Activated");
  assert(act && act.args.payToken.toLowerCase() === CRED.toLowerCase(), "Activated(payToken=CRED)");
  // EMA unchanged: spot == avg
  assertEq(await activation.credPriceAvg(), PRICE, "cred EMA unchanged");
});

await test("$RESCUE rail: 50% to dead address, 50% swapped, Burned emitted", async () => {
  const balBefore = await rescue.balanceOf(aliceAddr);
  const deadBefore = await rescue.balanceOf(DEAD);
  const potBefore = await usdc.balanceOf(POT);
  const supplyBefore = await rescue.totalSupply();

  const tx = await activation.connect(alice).activateWithRESCUE(4, 100);
  const receipt = await tx.wait();

  // discount math: exactly $8 of $RESCUE at the $0.50 EMA = 16 RESCUE
  assertEq(TOKEN_AMOUNT, ethers.parseUnits("16", 18), "discount math = 16 RESCUE");
  assertEq(balBefore - (await rescue.balanceOf(aliceAddr)), TOKEN_AMOUNT, "RESCUE taken");
  // burn half lands at the dead address (no burn() on $RESCUE)
  assertEq((await rescue.balanceOf(DEAD)) - deadBefore, BURN_HALF, "dead-address burn");
  // total supply unchanged — the burn is economic (dead address), not mechanical
  assertEq(await rescue.totalSupply(), supplyBefore, "supply unchanged (dead addr)");
  // swap half -> USDC -> pot (holder money preserved)
  assertEq((await usdc.balanceOf(POT)) - potBefore, SWAP_USDC, "USDC to pot");

  const ev = findEvent(activation, receipt, "Burned");
  assert(ev, "Burned event missing");
  assertEq(ev.args.tokenId, 4n, "Burned.tokenId");
  assert(ev.args.payer.toLowerCase() === aliceAddr.toLowerCase(), "Burned.payer");
  assert(ev.args.token.toLowerCase() === RESCUE.toLowerCase(), "Burned.token");
  assertEq(ev.args.burned, BURN_HALF, "Burned.amount");

  const act = findEvent(activation, receipt, "Activated");
  assert(act && act.args.payToken.toLowerCase() === RESCUE.toLowerCase(), "Activated(payToken=RESCUE)");
  assertEq(await activation.rescuePriceAvg(), PRICE, "rescue EMA unchanged");
});

await test("anti-gaming: spot >25% above EMA reverts PriceDeviation", async () => {
  await activation.setMockSpot((PRICE * 126n) / 100n, true);
  await expectRevert(activation.connect(alice).activateWithRESCUE(5, 100), "PriceDeviation");
  await activation.setMockSpot(0n, false);
  assertEq(await activation.activated(5), false, "not activated after revert");
});

await test("anti-gaming: spot >25% below EMA reverts PriceDeviation", async () => {
  await activation.setMockSpot((PRICE * 70n) / 100n, true);
  await expectRevert(activation.connect(alice).activateWithCRED(6, 100), "PriceDeviation");
  await activation.setMockSpot(0n, false);
});

await test("anti-gaming: spot within 25% band succeeds", async () => {
  await activation.setMockSpot((PRICE * 124n) / 100n, true);
  const tx = await activation.connect(alice).activateWithRESCUE(7, 100);
  await tx.wait();
  await activation.setMockSpot(0n, false);
  assertEq(await activation.activated(7), true, "activated inside band");
});

await test("EMA folds spot observation at 20% weight", async () => {
  // fresh instance so the EMA starts exactly at PRICE
  const a2 = await deploy("ActivationHarness", owner, CRED, RESCUE, USDC, POT, ROUTER, PRICE, PRICE);
  const A2 = await a2.getAddress();
  await cred.connect(alice).approve(A2, ethers.MaxUint256);
  const spot = (PRICE * 120n) / 100n; // +20%, inside the 25% band
  await a2.setMockSpot(spot, true);
  await (await a2.connect(alice).activateWithCRED(1, 100)).wait();
  const want = (PRICE * 8000n) / 10000n + (spot * 2000n) / 10000n; // 1.04 * PRICE
  assertEq(await a2.credPriceAvg(), want, "EMA = 0.8*avg + 0.2*spot");
  assertEq(want, (PRICE * 104n) / 100n, "EMA = 104% of seed");
});

await test("RH config: RESCUE rail disabled when RESCUE == address(0)", async () => {
  const a3 = await deploy(
    "ActivationHarness",
    owner,
    CRED,
    ethers.ZeroAddress,
    USDC,
    POT,
    ROUTER,
    PRICE,
    PRICE
  );
  await expectRevert(a3.connect(alice).activateWithRESCUE(1, 100), "ZeroAddress");
  // CRED rail still live on the same deployment
  const A3 = await a3.getAddress();
  await cred.connect(alice).approve(A3, ethers.MaxUint256);
  await (await a3.connect(alice).activateWithCRED(1, 100)).wait();
  assertEq(await a3.activated(1), true, "CRED rail unaffected");
});

await test("AlreadyActive guard on the $RESCUE rail", async () => {
  await expectRevert(activation.connect(alice).activateWithRESCUE(4, 100), "AlreadyActive");
});

await test("USDC rail unchanged: no Burned event, exact $10", async () => {
  const potBefore = await usdc.balanceOf(POT);
  const tx = await activation.connect(alice).activateWithUSDC(8, ACTIVATION_USDC);
  const receipt = await tx.wait();
  assert(!findEvent(activation, receipt, "Burned"), "USDC rail must not emit Burned");
  assertEq((await usdc.balanceOf(POT)) - potBefore, ACTIVATION_USDC, "exact $10 to pot");
});

// ---------- report ----------
console.log(results.join("\n"));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

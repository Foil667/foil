# FOIL EQUITIES — Audit Readiness

> Contracts are **unaudited drafts**. This doc is the handoff packet for a
> professional auditor: repo layout, how to build/test, what we already know
> and assume, known risks, and what is out of scope.

## 1. Repo layout

```
~/workspace/nft-god/foil-equities/
├── contracts/               # the 7 contracts (6 core + FoilAccountFactory draft)
│   ├── FoilEquities.sol     # ERC-721 (7,777? no — 667 supply cap), free mint,
│   │                        # merkle allowlist, ERC-6551 tokenAccount/createTokenAccount,
│   │                        # 7.5% ERC-2981 royalty → RoyaltyRouter, Ownable admin
│   ├── Activation.sol       # $10 activation: USDC exact / ETH forwarded /
│   │                        # $CRED rail (50% burn, 50% swap) / $RESCUE rail
│   │                        # (50% dead-address, 50% swap); EMA price engine
│   │                        # (±25% spot band, 20% EMA); resets on transfer
│   ├── FoilAccount.sol      # per-token bound wallet: owner-gated execute(),
│   │                        # EIP-1271 isValidSignature, registerAsAgent
│   ├── FoilAccountFactory.sol # AUDIT-BLOCKER FIX (draft 2026-10-04): per-token
│   │                        # account deployer; CREATE2-deploys a FULL configured
│   │                        # FoilAccount per token (see §4)
│   ├── OperatorSplitter.sol # 90% Foil / 10% user split (ETH + ERC-20)
│   ├── RoyaltyRouter.sol    # royalty split: 1/3 → StockPot (2.5pp), 2/3 → OperatorSplitter (5pp)
│   └── StockPot.sol         # USDC vault, 7-day epochs, keeper distribute(),
│                            # 50 bps keeper fee, pro-rata drip to ACTIVATED
│                            # tokens' bound wallets only
├── test/
│   ├── run.mjs              # pre-existing Activation rail suite (11 tests)
│   ├── run-economics.mjs    # locked-economics suite (35 tests, groups A–H)
│   ├── run-factory.mjs      # FoilAccountFactory suite (13 tests, groups F1–F13)
│   ├── hardhat.config.cjs   # Hardhat Network, hardfork: cancun
│   └── contracts/           # mocks (MockCRED, MockRouter, Mock6551Registry, …,
│                            # ERC1167ProxyDeployer — blocker demo only)
├── scripts/
│   ├── compile.mjs          # solcjs compile of contracts/ (read-only)
│   ├── forge.mjs            # (legacy helper)
│   └── watch-cred-lp.mjs    # live LP watch (CRED/WETH + $RESCUE/WETH)
├── site/                    # static frontend; mint panel DISABLED by design;
│                            # burn.js reads canonical ERC-20 Transfer topic
│                            # 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
├── docs/                    # ASSEMBLY, CONCEPT, SECURITY, TRAITS,
│                            # DEPLOYMENT-PLAN, this file
└── layers-test/             # trait-layer test assets
```

## 2. Build & test commands

```bash
cd ~/workspace/nft-god/foil-equities
node scripts/compile.mjs          # compile 7 contracts (solcjs) — expect 7× PASS, exit 0
cd test && npm test               # compile-tests + run.mjs (11) + run-economics.mjs (35)
                                  # + run-factory.mjs (13) = 59 total
```

**Toolchain pins (load-bearing — do not change without re-running everything):**
- `solc` **0.8.37** (package.json `^0.8.37`, installed 0.8.37)
- `evmVersion: "cancun"` pinned in `scripts/compile.mjs` and `test/compile-tests.mjs`
- Test chain: **Hardhat Network**, `hardfork: "cancun"` (`test/hardhat.config.cjs`),
  `npm i -D hardhat@2 @nomicfoundation/hardhat-ethers@3` inside `test/`

**Why cancun:** OpenZeppelin Contracts 5.6.x emits **MCOPY (0x5e)** (e.g. Bytes.sol /
Arrays.sol pulled in by ERC721 and ECDSA); anything older than cancun fails at
compile time (solc TypeError). Targets (Base, Robinhood Chain) are Cancun+, so
the pin is deployment-correct.

**Why Hardhat over ganache:** ganache 7.9.2 caps at Shanghai and executes MCOPY
as INVALID — verified via `debug_traceTransaction`. The suite was switched
ganache → Hardhat Network; ganache must not be used.

## 3. Known assumptions (tell the auditor up front)

1. **MCOPY / cancun pin** — see §2. Any deployment target must be Cancun+.
2. **MockRouter decimal fix (caught by tests).** The USDC(6dp)→stock(6dp) leg
   originally used the 18dp→6dp quote formula and quoted 0, making economics
   tests pass vacuously. Fixed with direction-aware quoting (`setUsdc`);
   suites H1/H5 now assert real non-zero drips. Real DEX adapter must be
   re-verified with the same non-vacuity standard.
3. **Dual rails reconciled.** CONCEPT.md already carried both discount rails
   alongside the legacy $CRED rail; no silent rewrite was done:
   - $CRED rail: 50% burn / 50% swap leg.
   - $RESCUE rail: 50% to the **dead address via plain `safeTransfer`**, 50% swap leg.
   - **No `burn()` assumption anywhere on the $RESCUE rail** (T11) — $RESCUE's
     burn half is economic (supply removed from circulation), not mechanical.
4. **Shared EMA pricing engine.** Both discount rails price on an exponential
   moving average; spot must sit within ±25% of the average or the tx reverts
   (`PriceDeviation`); the discount applies to the average, not spot.
5. **Locked economics** (test groups A–H, 35/35 green): mint is FREE and
   non-payable (rejects ETH); supply caps; merkle allowlist; 7.5% royalty →
   router; router split 1/3 pot (2.5pp) / 2/3 operator (5pp), ETH+ERC20;
   operator split exactly 90/10 incl. 7-wei dust conservation; $10 activation
   (USDC exact, ETH forwarded); activation **resets on transfer** (flipper
   earns no drip; mint itself does not reset); EIP-1271 reads the CURRENT
   owner (old-owner signatures die on transfer); `registerAsAgent` reverts
   unless caller is the current NFT owner; StockPot keeper fee 50 bps,
   7-day epoch gate, `NoStocks`/`NothingToDistribute` guards, pot money never
   touches the splitter.
6. **EIP-1271 = owner-key authority.** Compromised holder key = compromised
   agent voice. Documented in SECURITY.md "Agent-wallet threats".
7. **`registerAsAgent` target is caller-supplied.** No value is forwarded in
   the call, but the official ERC-8004 registry address is frontend/deploy-doc
   hardcoded, not onchain — verify before calling; never register against
   unknown registries.
8. **Burn-topic verified canonical.** `site/burn.js` uses the exact keccak256
   of `Transfer(address,address,uint256)`:
   `0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef`
   (independent ethers check 2026-10-04). A past "wrong topic" alarm was a
   confirmed false positive — do not "fix" it.
9. **FoilAccountFactory is the account deployer (draft).** FoilEquities is
   wired with `registry` = FoilAccountFactory and `accountImplementation` =
   a deployed FoilAccount template; the factory's `createAccount` requires
   `implementation == FOIL_ACCOUNT` and `chainId == block.chainid`, deploys
   full per-token instances via CREATE2 (idempotent), and executes non-empty
   `initData` against the new account. Deploy-time gas per account ≈ 750k
   (FoilAccount is 3,536 bytes runtime). The factory is a DRAFT for auditor
   blessing — see §4.

## 4. Known risks & edge cases (auditor: probe here)

- **StockPot minOut placeholder `0` is NOT safe** — sandwichable stock buys.
  Must be replaced with a Chainlink/TWAP oracle adapter before mainnet
  (SECURITY.md pre-mainnet checklist). Keeper fee is only 50 bps, and the
  epoch gate (7d) plus caller slippage cap bound the damage, but private-relay
  submission is the ops expectation for large epochs.
- **Thin discount pools.** CRED/WETH (UniV4, ~$215K liq) and the RESCUE/WETH
  pool are both thin and gameable — that is why the EMA ±25% band exists.
  `scripts/watch-cred-lp.mjs` is the live guard (price >15% move, volume >3×,
  liquidity −20%, new large holder = LOUD alert). **Pause switch on
  Activation is still TODO** (add pre-audit).
- **Royalty evasion** has no onchain fix — marketplaces that don't honor
  ERC-2981 leak the pot/operator revenue. Monitor royalty receipts vs
  secondary volume; prefer enforcing venues at launch.
- **Owner = single key in drafts.** All `onlyOwner` setters (phase, merkle
  root, activation, router, stock list, stockPot, nft contract) need
  **timelock + multisig** before mainnet (T8). DO NOT DEPLOY AS-IS.
- **Wash-trading is structurally self-punishing** (activation resets on
  transfer, so washers deactivate their own NFTs and pay royalties into the
  pot + 90/10) — no code needed, but note it so it isn't "fixed" into a bug.
- **TBA is value-bearing.** Bound wallets will hold tokenized stocks;
  `execute()` is owner-gated, but any approval made through the TBA inherits
  full control — same phishing surface as any wallet. No broad TBA approvals.
- **Dust conservation** in OperatorSplitter is exact (7-wei test) — keep it so
  through any refactor.
- **FoilAccount implementation pattern — RESOLVED AS DRAFT (auditor must bless).**
  The blocker: FoilAccount binds its token via constructor IMMUTABLES, so a
  single pre-deployed instance could never serve as the shared
  `accountImplementation` for `registry.createAccount(...)` — every ERC-1167
  proxy would read the TEMPLATE's immutables, not its own token's
  (demonstrated live in test/run-factory.mjs F4: a vanilla proxy to a template
  bound to (0x..01, 999) reports the template's binding for every token).
  The fix (2026-10-04, parallel contract — the original 6 are untouched):
  **`contracts/FoilAccountFactory.sol`** exposes the registry's
  `createAccount`/`account` interface shape but CREATE2-deploys a FULL,
  correctly-configured `FoilAccount(tokenContract, tokenId)` per token.
  FoilEquities plugs it in as `registry` with `accountImplementation` = the
  template instance — zero changes to FoilEquities. Verified by
  test/run-factory.mjs (13/13 green): counterfactual `account()` matches
  `createAccount()`; per-token immutables correct; idempotent re-create;
  wrong-implementation / wrong-chainId revert; salt binding; initData
  passthrough; full FoilEquities integration (tokenAccount/createTokenAccount);
  EIP-1271 owner sigs (raw + eth_sign) validate, strangers fail, and
  old-owner sigs die on transfer. The ERC-1167-context-proxy alternative was
  REJECTED: cheaper per account, but custom proxy bytecode is subtler to
  audit and breaks standard ERC-6551 indexer address assumptions.
  Auditor: bless the factory pattern (or propose the blessed alternative)
  before deploy; also confirm the template's dummy constructor args
  (any non-zero tokenContract) are deployment-harmless.

## 5. Deliberately out of scope

- Real archetype art (layers-test/ is placeholder; art pipeline is separate).
- Mainnet per-chain config (oracle adapters, registry/router/stock-token
  addresses — TBD table in DEPLOYMENT-PLAN.md).
- Timelock/multisig implementation (required, but an ops task, not this audit).
- The audit engagement itself (needs user's spend approval — **[BLOCKED-ON-USER]**).
- Collection's real name (user decision — **[BLOCKED-ON-USER]**).
- Gas micro-optimization (optimizer runs=200 is fine for this profile).

## 6. Auditor handoff checklist

- [ ] Fresh `node scripts/compile.mjs` → 7/7 PASS, 0 errors
- [ ] Fresh `npm test` in `test/` → 59/59 green (11 + 35 + 13)
- [ ] Confirm `evmVersion: "cancun"` still required by OZ version in use
- [ ] Review SECURITY.md threat table T1–T11 + agent-wallet section
- [ ] Bless the FoilAccountFactory pattern (§4) or propose the blessed alternative
- [ ] Replace StockPot minOut placeholder with oracle adapter
- [ ] Add Activation pause switch
- [ ] Timelock + multisig design for all `onlyOwner` functions

---
*Written 2026-10-04. Read-only prep — no deploys, no spends.*

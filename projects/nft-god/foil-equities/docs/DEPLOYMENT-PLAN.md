# FOIL EQUITIES — Deployment Plan

> Status: **DRAFT — NOTHING DEPLOYED.** All onchain writes are **[BLOCKED-ON-USER]** until:
> professional audit is complete, per-chain config is finalized, and the user approves
> each spend explicitly. Compile: 7/7 green (solc 0.8.37, `evmVersion: "cancun"`).
> Tests: 59/59 green (11 + 35 + 13) on Hardhat Network (local only — no deployments).

## 0. Deployment order (dependency-safe sequence)

Deploy in this order per chain. Leaf contracts (no constructor deps on our own
contracts) go first; wiring calls happen after everything is deployed.

| # | Contract | Constructor args | Depends on |
|---|----------|------------------|------------|
| 1 | **OperatorSplitter** | `_foil` (Foil operator wallet), `_user` (user wallet) | — |
| 2 | **StockPot** | `_usdc`, `_dexRouter`, `_stocks[]` (allowed stock token list) | — |
| 3 | **RoyaltyRouter** | `_stockPot` (#2), `_operatorSplitter` (#1) | 1, 2 |
| 4 | **Activation** | `_cred`, `_rescue`, `_usdc`, `_stockPot` (#2), `_dexRouter`, `_seedCredPrice`, `_seedRescuePrice` | 2 |
| 5 | **FoilAccount** (template instance) | dummy `_tokenContract` (any non-zero), dummy `_tokenId` | — |
| 5b | **FoilAccountFactory** (draft — see blocker note) | `_foilAccountTemplate` (#5) | 5 |
| 6 | **FoilEquities** | `_royaltyRouter` (#3), `_registry` = **#5b factory**, `_accountImplementation` (#5 template) | 3, 5b |

### Post-deploy wiring (owner-gated calls, in order)

1. `FoilEquities.setActivation(activationAddr)` **[BLOCKED-ON-USER]**
2. `FoilEquities.setMerkleRoot(root)` — allowlist root (WL phase config) **[BLOCKED-ON-USER]**
3. `Activation.setNFTContract(foilEquitiesAddr)` **[BLOCKED-ON-USER]**
4. `StockPot.setContracts(foilEquitiesAddr, activationAddr)` **[BLOCKED-ON-USER]**
5. `StockPot.setStockToken(token, true)` per allowed stock token **[BLOCKED-ON-USER]**
6. `FoilEquities.setPhase(n)` when mint phases open **[BLOCKED-ON-USER]**

### ⚠️ AUDIT-BLOCKER before deploying #5/#6 — DRAFT FIX EXISTS (auditor must bless)

`FoilAccount` takes `_tokenContract`/`_tokenId` as **constructor immutables**,
so a single pre-deployed instance can never be the shared
`accountImplementation` for `registry.createAccount(...)` — every proxy would
read the template's immutables, not its own token's (proven live in
`test/run-factory.mjs` F4). **Do not deploy #5/#6 as-is.**

2026-10-04 draft fix (parallel contract, original 6 untouched):
**`contracts/FoilAccountFactory.sol`** exposes the registry's
`createAccount`/`account` interface shape but CREATE2-deploys a FULL,
correctly-configured `FoilAccount(tokenContract, tokenId)` per token.
FoilEquities is wired with `_registry` = the factory and
`_accountImplementation` = the template instance — no FoilEquities changes
needed. Verified by `test/run-factory.mjs` (13/13). The ERC-1167-context
alternative was rejected (subtler to audit, breaks indexer assumptions).
The auditor must still bless the factory pattern before deploy.
See `docs/AUDIT-READINESS.md` §4.

## 1. Constructor args checklist

Per chain, the following must be concrete before any deploy:

- [ ] `_foil` — Foil operator EVM wallet address
- [ ] `_user` — user's EVM wallet address (receives 10% of operator share)
- [ ] `_usdc` — native USDC per chain (Base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` ✅ verified)
- [ ] `_cred` — $CRED (Base: `0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3` ✅ verified)
- [ ] `_rescue` — $RESCUE token address per chain — **TBD** (Base + RH)
- [ ] `_dexRouter` — DEX router for USDC→stock swaps per chain — **TBD**
- [ ] `_stocks[]` — tokenized stock token addresses — **TBD** (RH: native equities; Base: B20 wrap — exact list TBD)
- [ ] `_registry` — ERC-6551 registry address per chain — **TBD** (Base has canonical `0x000000006551c19487814612e58FE06813775758`; RH TBD)
- [ ] `_seedCredPrice` — initial CRED EMA seed (from live CRED/WETH pool, ±checked at deploy) — **TBD at fire time**
- [ ] `_seedRescuePrice` — initial $RESCUE EMA seed (from live RESCUE/WETH pool) — **TBD at fire time**

### Per-chain config table

| Address | Base | Robinhood Chain |
|---------|------|-----------------|
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` ✅ | TBD |
| $CRED | `0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3` ✅ | TBD |
| $RESCUE | TBD | TBD |
| DEX router (USDC→stocks) | TBD | TBD |
| ERC-6551 registry | canonical `0x000000006551c19487814612e58FE06813775758` (verify onchain) | TBD |
| Stock tokens (allowed list) | TBD (B20) | TBD (native equities) |
| Foil operator wallet | TBD (user to confirm) | — |
| User wallet | TBD (user to confirm) | — |
| Dead address (burn sink) | `0x000000000000000000000000000000000000dEaD` ✅ | `0x000000000000000000000000000000000000dEaD` ✅ |

## 2. Estimated deploy gas (from compiled initcode, optimizer runs=200)

Conservative estimate ≈ initcode bytes × 200 gas/byte + 50% execution overhead.
All contracts well under the EIP-170 24,576-byte limit. Numbers are
per-chain; Base L1 data fees dominate the real cost — fund the deployer with
ETH (Base) / native token (RH) before starting. **[BLOCKED-ON-USER]** funding.

| Contract | Initcode | Est. deploy gas |
|----------|----------|-----------------|
| OperatorSplitter | 1,514 B | ~454,000 |
| RoyaltyRouter | 1,475 B | ~443,000 |
| Activation | 5,766 B | ~1,730,000 |
| FoilAccount (×1 template, dummy args) | 3,536 B | ~1,061,000 |
| FoilAccountFactory (×1, draft) | 5,236 B | ~1,571,000 |
| FoilEquities | 7,875 B | ~2,363,000 |
| StockPot | 5,557 B | ~1,667,000 |
| **Total** | | **~9.29M gas / chain** |

Per-token account creation (on-demand `createTokenAccount`, paid by the
caller, not part of deployment): one CREATE2 of a 3,536-byte FoilAccount ≈
**~750k gas**. Not in the deploy total above.

## 3. Post-deploy wiring — site + accounts

1. **Verify sources** on Basescan / RH explorer for all 7 contracts (flatten or
   standard-JSON input; solc 0.8.37, optimizer 200, evmVersion cancun)
   **[BLOCKED-ON-USER]**
2. Record deployed addresses in `site/` config (mint panel stays **DISABLED**
   by design — do not wire until audit + user deployment approval)
3. Point the pot dashboard at the deployed StockPot (read-only: `USDC`
   balance, `lastDistribution`, epoch countdown, `nft`/`activation` links)
4. Token-bound accounts: holders call `FoilEquities.createTokenAccount(tokenId)`
   on demand (deterministic preview via `tokenAccount(tokenId)`)
5. Re-run the full test suite against the deployed addresses (read-only checks)
   and publish the mint-log receipt
6. First `StockPot.distribute()` only after: audit sign-off, oracle adapter
   for minOut is live, keeper is a private relay for large epochs **[BLOCKED-ON-USER]**

## 4. Pre-launch checklist (pulled from `docs/SECURITY.md` — all must be ✅)

- [ ] Professional audit of all 7 contracts (6 + factory draft) (spend — **[BLOCKED-ON-USER]**)
- [ ] Chainlink/TWAP oracle for stock-swap minOut (placeholder `0` in StockPot is NOT safe)
- [ ] Timelock + multisig on owner functions (current drafts use single `owner` — DO NOT DEPLOY AS-IS)
- [ ] Concrete `_spotPrice()` oracle adapters per chain for BOTH discount rails ($CRED and $RESCUE)
- [ ] Verify ERC-6551 registry + account implementation addresses per chain
- [ ] Tokenized stock token addresses per chain (RH: native equities; Base: B20)
- [ ] Royalty enforcement check on target marketplaces
- [ ] Pause switch on Activation (for T-alert response — add pre-audit)
- [ ] FoilAccount implementation-pattern refactor blessed by auditor (see §0)
- [ ] Collection's real name (user decision — **[BLOCKED-ON-USER]**)
- [ ] `watch-cred-lp.mjs` pool list extended to $RESCUE/WETH and running on both chains

---
*Written 2026-10-04. Docs only — no deploys, no spends, no testnet writes.*

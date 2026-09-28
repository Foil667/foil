# FOIL EQUITIES — Threat Model & Anti-Gaming

> Status: DRAFT. Contracts in `contracts/` are unaudited. Nothing here is deployed.
> Standing user order (2026-09-24): **watch for people trying to scam or game the LP.**

## What "the LP" means here

1. **CRED/WETH on Base** (`0x55a4f7a23c4c2616cf848e639a08bd4283d13e66f5fcf34f828b5ca7e4e96324`,
   UniV4, ~$215K liquidity at last check) — our $CRED activation rail swaps through it.
   Thin pool = easy to move. This is the #1 gaming surface.
2. **Whatever pools the StockPot swaps through** at each epoch (USDC -> tokenized stocks).
3. **Future**: any pool we seed ourselves.

## Threats & mitigations (built into contracts)

| # | Threat | How it would work | Mitigation (in code) |
|---|--------|-------------------|----------------------|
| T1 | CRED pump → cheap activation | Attacker pumps CRED/WETH, then activates at the "20% discount" with inflated CRED | `Activation.sol`: CRED priced on exponential moving average, NOT spot. Spot must sit within 25% of the average or tx reverts. Discount applies to the average. |
| T2 | Sandwich the pot's stock buys | Bot sees `distribute()` in mempool, front-runs the USDC->stock swap | Epoch-gated (7d min), caller slippage cap reverts the whole run past the bound. Keeper fee only 50 bps — not worth manipulating for. Ops: use private relay for large epochs. |
| T3 | Fake $CRED / phishing mint | Copycat token or fake mint site drains users | CRED address hardcoded to verified `0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3`. Official links only, ever. X watch flags impersonators. |
| T4 | Wash trading NFTs | Wash to farm... what? Activation RESETS on transfer, so washers deactivate their own NFTs and pay royalties into the pot + 90/10. Attack is self-punishing. | Structural (no code needed). |
| T5 | Royalty evasion | Marketplaces that don't honor ERC-2981 | No onchain fix. Monitor royalty receipts vs secondary volume; prefer enforcing venues at launch. |
| T6 | Farming `distribute()` | Caller extracts value from the keeper call | Fee bounded at 50 bps of pot; no other extractable value in the call. |
| T7 | Draining the CRED/WETH pool | Whale pulls liquidity right before our swap leg | Our CRED swaps are small (half of one $8 activation). Slippage cap on the swap leg. Monitor pool depth (see Watch below). |
| T8 | Owner-key abuse | Whoever holds `owner` can swap stock list / router / pot | Before mainnet: timelock + multisig. Draft uses single owner — DO NOT DEPLOY AS-IS. |

## Live watch (running)

`scripts/watch-cred-lp.mjs` polls the CRED/WETH pool via GeckoTerminal every 15 min (cron).
State + log: `~/workspace/goals/robinhood-chain-free-mint-watch/hidden_files/cred-lp-watch/`

**Alert = LOUD (surface to user immediately):**
- Price moved >15% between checks (possible pump staging for T1, or dump)
- 1h volume >3x trailing 24h average (someone positioning)
- Pool liquidity dropped >20% between checks (liquidity pull — T7)
- New large holder appearing in top-20 (possible attacker wallet funding)

**On alert:** pause `activateWithCRED` (owner-gated pause to be added pre-audit),
investigate the wallets, resume only when clean.

## Pre-mainnet checklist

- [ ] Professional audit of all 6 contracts
- [ ] Chainlink/TWAP oracle for stock-swap minOut (placeholder `0` in StockPot is NOT safe)
- [ ] Timelock + multisig on owner functions
- [ ] Concrete `_credSpotPrice()` oracle adapter per chain (Base: UniV4 pool read)
- [ ] Verify ERC-6551 registry + account implementation addresses per chain
- [ ] Tokenized stock token addresses per chain (RH: native equities; Base: B20)
- [ ] Royalty enforcement check on target marketplaces
- [ ] Pause switch on Activation (for T-alert response)

## $RESCUE rail threats (added 2026-09-28)

| # | Threat | How it would work | Mitigation (in code) |
|---|--------|-------------------|----------------------|
| T9 | $RESCUE EMA oracle gaming | Same shape as T1: pump RESCUE/WETH, then activate at the "20% discount" with inflated $RESCUE | `Activation.sol`: $RESCUE priced on its own EMA (`rescuePriceAvg`), NOT spot. Spot (from `_spotPrice(RESCUE)`) must sit within 25% of the EMA or the tx reverts (`PriceDeviation`). Discount applies to the average. Both rails share the engine and the 25%/20%-EMA constants. |
| T10 | $RESCUE spot-adapter divergence | A per-chain `_spotPrice(RESCUE)` override reads a thin/gamed pool and drifts the EMA | Adapters are per-chain, deployed separately, and must be audited before mainnet (see pre-mainnet checklist: concrete `_spotPrice` oracle adapters now cover BOTH discount tokens). The live watch (below) covers the RESCUE pool too. |
| T11 | "Burn" that isn't | Assuming $RESCUE implements `burn()` when it doesn't (Doppler/Uniswap V4 launch) | No burn() assumption anywhere on the RESCUE rail — the burn half goes to the dead address via plain `safeTransfer`. $RESCUE's 50% burn is economic (supply removed from circulation), not mechanical. |

## Agent-wallet threats (added 2026-09-28)

- **EIP-1271 = owner-key authority.** Whoever holds the NFT's owner key can
  sign AS the agent (the TBA). Owner-key hygiene IS agent-identity hygiene:
  a compromised holder key means a compromised agent voice. Treat the NFT
  like a hardware-wallet seed — lose the key, lose the agent.
- **Nobody can register your TBA out from under you.**
  `registerAsAgent` reverts unless `msg.sender` is the current NFT owner, so
  an attacker can't pre-register someone else's bound wallet into a rogue
  identity registry entry.
- **Activation-reset-on-transfer also resets agent control.** When the NFT
  moves, the old owner's signatures stop validating (EIP-1271 always reads
  the CURRENT owner) and any ERC-8004 registration the old owner made must
  be re-done by the new owner if they want the agent identity active. There
  is no lingering control — but also no automatic continuity.
- **`registerAsAgent` target risk.** The registry address is a caller-supplied
  arg; a malicious/compromised registry could emit misleading registration
  events or trap funds if `register(string)` were payable. Mitigations: no
  value is forwarded in the call; the official ERC-8004 registry address is
  hardcoded in the frontend/deploy docs (not onchain); verify the registry
  before calling. Do not register against unknown registries.
- **TBA is value-bearing.** Bound wallets will hold tokenized stocks from the
  drip. `execute()` is owner-gated, but any contract the owner approves
  through the TBA inherits full control — same phishing surface as any
  wallet. No broad approvals from TBAs, ever.

## Live watch (extended 2026-09-28)

`scripts/watch-cred-lp.mjs` now watches a pool LIST: the CRED/WETH pool
(unchanged) plus the $RESCUE/WETH pool (auto-resolved via GeckoTerminal; if
unresolvable the script stays CRED-only and prints a TODO). Same alert
thresholds per pool; state is tracked per pool.

---
display_name: Panda Financial
summary: Base DeFi project (automated Aerodrome WETH/USDC vault) the user had Foil deep-dive on 2026-09-29 because he believes it's run by a fellow Looper; the Looper link isn't publicly verified yet.
---

# Panda Financial

## Facts
- Panda Financial is a small, brand-new (~July 2026) DeFi shop on Base with one live product: an automated liquidity manager — deposit USDC (min $5), it zaps ~half into WETH, opens a concentrated-liquidity position in Aerodrome's WETH/USDC Slipstream pool, stakes it in the gauge, and a keeper robot manages the price range. Rewards are paid in AERO, converted so depositors get 80% in USDC; Panda keeps 20% (19% treasury, 1% keeper). No deposit/withdrawal fees, no lock-up. (window: message:assistant-msg-e7afa795-53f7-43a7-03b0-cb611868b0d1; memory/2026-09-30.md#L25)
- As of 2026-09-30 it is real and onchain (verified vault contract, keeper bot doing rebalances) but small: ~$2.5K TVL across 18 depositors. No token yet — they explicitly warn about impersonator scams. No independent audit, single-key keeper/owner, not offered to US persons, no incidents or complaints found. (window: message:assistant-msg-4f1a6a55-e191-6666-7a69-88ef933f4c82)
- The keeper robot checks positions every ~35s, waits until the price has stayed out of range for 6 hours before moving, picks width ±1–8% based on volatility, max 3 moves/day, pays its own gas, and can sit out 24h in a crash. While paused out of range it earns zero until moved. (window: message:assistant-msg-e7afa795-53f7-43a7-03b0-cb611868b0d1)
- The only named person found is XyoPanda (@XyoPanda, "Contributor @_PandaFinancial, Founder Nakamura Labs") — no team page, no Looper mention found publicly. (memory/2026-09-30.md#L25)
- The user named the tie in their own words: they asked Foil to "learn it all" because it "is a fellow looper." The fellow-Looper connection is user-supplied and not yet independently verified. (window: message:2eeea45d-a420-468b-97f3-d2c06b51ed1f; memory/2026-09-29.md#L3076)
- A second area, "DeFi Tools", is just easy screens for third-party services (0x swaps, Steakhouse's Curated Vault on Morpho, Morpho lend/borrow) — Panda can't fix anything there. (window: message:assistant-msg-e7afa795-53f7-43a7-03b0-cb611868b0d1)

## History
- 2026-09-29 ~18:55–19:01 CDT: the user shared https://pandafinancial.org/learn/ and told Foil to learn it; Foil delivered an Academy overview plus a deeper products/team/contracts research pass, and flagged that the fellow-Looper link couldn't be verified publicly. (window: messages:f5e0d0aa, e7afa795, 2eeea45d, 4f1a6a55; memory/2026-09-29.md#L3076)

## The relationship
The user says this project is run by a fellow Looper — that's the tie as the user named it — and asked Foil to learn the whole project, so it sits in the Loopers-family orbit pending verification of the connection. No contact with XyoPanda or the team yet; it's a research target, not an engagement target.

## In common
- The Loopers agent scene on Base (per the user's unverified belief that the operator is a fellow Looper); DeFi on Base, adjacent to the user's onchain interests.

## Open threads
- [ ] Verify the fellow-Looper connection: XyoPanda's X posts or a team page tying the operator to a Looper. Foil offered to dig through @XyoPanda's X posts; the user hasn't answered. (window: message:assistant-msg-4f1a6a55-e191-6666-7a69-88ef933f4c82)

## Strengthening

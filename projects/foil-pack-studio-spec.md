# Foil Pack Studio — lineup spec (2026-09-26)

User order: several collections, one of them Looper-based, built on actual onchain traits. No vanilla BS. Model: the HoodchanCEO playbook (Vibe Market packs on Robinhood + ERC-6551 token-bound wallets + packs airdropped into holders' NFT wallets).

## Collection A — FOIL EQUITIES (flagship)
Existing locked econ, unchanged:
- FREE mint (gas-only, price exactly zero), 667 per chain (Base + Robinhood)
- 7.5% royalty: 2.5% → stock pot, 5% → 90/10 Foil/user splitter
- $10 activation in ETH/USDC or $CRED at 20% discount (burn half / swap half of CRED)
- ERC-6551 token-bound wallet per NFT; epoch distributor drips tokenized stocks into bound wallets
- Activation resets on transfer
- CRED LP-manipulation watch stays live (threat model + TWAP/slippage in contracts)

## Collection B — LOOPER PACK (working title: TINFOIL SOCIETY)
Vibe-style sealed card packs on Robinhood Chain, Looper-universe themed.
- **Traits = actual onchain Looper data.** Harvest all 7,777 tokenURIs from the Loopers contract (`0x1649CD37f4748807b4882FC48765bA0B2aFfa94a`, Base) into a trait-frequency DB. Card trait names and rarity tiers mirror the real collection — no invented traits.
- **Mythic tier = Foil's own trait set** (#667: tinfoil hat, "GROK HAS MONEY" hoodie, green eyes — the canonical look).
- Companion model, not a copy: packs are FOR the Looper family. Airdrop sealed packs into Looper holders' token-bound wallets (HoodchanCEO-style patronage). Foil is the demo — an agent ripping packs onchain, posting pulls.
- Art: original degen-cut renders in the Looper spirit, trait-accurate. Never lifts their actual image assets.
- **Needs Quigley's blessing.** The user is tight with Quigley — one tap (DM/post) turns this from "derivative risk" into an official family collab. Do not launch without it.

## Collection C — DEGEN PACK (funnel)
- FREE, high supply, 4chan /biz/ folklore art (deep-fried, greasy, MS Paint energy). Hard rule stands: NO crypto imagery in the art.
- The on-ramp: free packs → pack-ripping game + leaderboard → funnels collectors toward Equities (stock drip) and the Looper pack.

## Shared infra
- `trait-harvester.mjs` (to build): Base RPC walk of all 7,777 Loopers tokenURIs → trait frequency DB → feeds the Forge.
- `forge.mjs` (built 2026-09-24): trait combiner, seeded deterministic, OpenSea attributes schema. Gets a Looper-trait layer set.
- ERC-6551 registry (already in Equities plan) — reused by all three.
- Vibe primitive on Robinhood: pack = fixed-supply ERC-20 pack token + card NFT contract + UniV4 pool, per Vibe's agent docs. Foil deploys via agent tooling.
- Pack-ripping game + leaderboard (hoodchan.org model: XP for builders/hodlers/collectors).

## Timeline
- Today (token diet): spec locked, trait-harvester scripted (chain reads are cheap).
- After credit reset ~2026-09-27 2:18 PM CDT: full 7,777 trait harvest, art layer production, pack contracts.

## Open taps (user)
1. Quigley blessing for the Looper pack — user's relationship, user's tap.
2. Final names for B and C.

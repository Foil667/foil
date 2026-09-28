# FOIL EQUITIES — Concept (working title)

> Art-first NFT collection with a real stock drip underneath.
> 667 supply per chain (Base + Robinhood Chain). Mint is FREE (gas only).
> Status: contracts drafted (unaudited), art style locked, LP watch live.

## The idea

**MARKET FOLKLORE, PIXEL CUT** (user, 2026-09-24): the archetypes stay —
The Whale, The Bagholder, Diamond Hands, The Oracle, Paper Hands, The Insider —
rendered as **hard pixelated retro**: chunky pixels, limited aggressive
palette, retro arcade boss / sprite energy, degenerate edge. Crisp, blocky,
unapologetic — NOT smooth, NOT painterly, NOT wojak gremlins (that direction
is dead). **Funny, never vanilla**: every piece needs a laugh — absurd,
meme-brained, laugh-out-loud, not generic-serious. No hateful imagery, ever.

**Hard rule (user, 2026-09-24): NO crypto imagery in the art. No candlesticks,
no coins, no charts, no tickers.** The folklore lives in the characters, not
in graphs.

Underneath the art, every NFT owns an **ERC-6551 bound wallet** that quietly
accumulates **real tokenized stocks**, drip by drip, every epoch.

## The money (locked by user 2026-09-24)

- **Mint:** free. Price exactly zero, gas only. No mint revenue, ever.
- **Royalty 7.5%** on every secondary sale, split by RoyaltyRouter:
  - **2.5pp → StockPot** (holder drip fuel — holder money, never split)
  - **5pp → OperatorSplitter → 90% Foil / 10% user** (onchain, no discretion)
- **Activation $10** (one-time per token per holder, resets on transfer):
  - Pay in ETH/USDC, or
  - Pay in **$CRED at 20% discount** (Base only — mirrors Helixa's own flywheel spec).
    Of CRED collected: **50% burned**, 50% swapped → USDC → StockPot.
- **Epoch distributor:** every 7 days, anyone can call `distribute()` —
  pot buys tokenized stocks (RH: native equities; Base: B20) and pushes them
  pro-rata into activated NFTs' bound wallets. 0.5% keeper fee.

## Anti-gaming (full model in docs/SECURITY.md)

- CRED priced on exponential moving average, not spot; >25% deviation reverts.
- Activation resets on every transfer — flippers never earn drip.
- Epoch slippage caps; wash-trading is self-punishing (deactivates + funds pot).
- **Live LP watch:** `scripts/watch-cred-lp.mjs` every 15 min on the CRED/WETH
  pool — alerts LOUD on pumps, volume spikes, liquidity pulls.

## Still to decide / do

- [ ] Collection's real name (user's call)
- [ ] Trait system + full 667×2 art production (after credit reset ~9/27)
- [ ] Professional audit (required before mainnet — StockPot minOut is a placeholder)
- [ ] Timelock + multisig on owner functions
- [ ] Per-chain: ERC-6551 registry, DEX router, USDC, stock token list, CRED oracle adapter
- [ ] Deployments (fund movement — needs explicit user approval per standing rule)

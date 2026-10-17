# Foil Equities — mint site (scaffold)

Static site for the FOIL EQUITIES collection ("MARKET FOLKLORE, PIXEL CUT").
**Scaffold only — not wired to any contract, not deployed.**

## What's here

- `index.html` — hero, mint panel, trait cast, stock-pot dashboard, burn sink, footer
- `styles.css` — 16-bit pixel-art arcade theme (Press Start 2P + VT323, scanlines)
- `sprites.js` — hand-authored 16×16 pixel-art sprites for the 6 archetypes
  (Whale, Bagholder, Diamond Hands, Oracle, Paper Hands, Insider), canvas-rendered
- `app.js` — UI glue; renders sprites, keeps the mint button disabled
- `config.js` — deployed-contracts config stub. `deployed: false` + null
  addresses until the audited deploy; the deploy step flips it and pastes
  real addresses (per-chain table in docs/DEPLOYMENT-PLAN.md).
- `pot.js` — stock-pot dashboard logic. **Read-only**: `eth_call` for
  `USDC.balanceOf(pot)`, `activatedCount()`, `totalMinted()`,
  `lastDistribution()`, plus chunked `eth_getLogs` over `Distributed`
  events for lifetime drips (localStorage cache, 5-min re-poll). While
  `config.deployed` is false it keeps the honest placeholder and makes
  zero chain calls. No wallet, no signing, no writes — ever.
- `burn.js` — **LIVE** $RESCUE burn-sink panel: reads `Transfer` → dead-address
  (`0x0000…dEaD`) logs on Base via public RPC (chunked `eth_getLogs`, adaptive
  range-splitting, localStorage cache, 5-min re-poll). Adapted from the Looper
  City reference implementation (`~/workspace/looper-city/furnace.js`).
  Needs no wallet. Degrades to cached data if the RPC is unreachable.

## Status

- Mint panel: **DISABLED by design.** Wiring happens only after (1) professional
  audit of all 7 contracts, (2) timelock + multisig on owner functions,
  (3) the user's explicit per-action deployment approval.
- Stock-pot dashboard: placeholder dashes until deployment. Post-deploy, flip
  `config.js` (`deployed: true` + real addresses) and `pot.js` lights up the
  four stats with read-only onchain data (TVL, activated/minted, next epoch,
  lifetime drips).
- Burn sink: live now — it reads real Base mainnet data.

## Preview

```bash
cd ~/workspace/nft-god/foil-equities/site && python3 -m http.server 8901
# → http://localhost:8901
```

## Pre-launch checklist (needs user tap)

- [ ] Professional audit of all 7 contracts (SECURITY.md pre-mainnet checklist)
- [ ] Real archetype art from the art pipeline (these sprites are placeholders)
- [ ] Deploy contracts (user's explicit per-action approval — fund movement)
- [ ] Wire mint panel to the deployed `FoilEquities` (allowlist merkle root, phases)
- [ ] Wire pot dashboard to deployed `StockPot` / `Activation`
- [ ] Set official mint URL + contract addresses in the footer/docs

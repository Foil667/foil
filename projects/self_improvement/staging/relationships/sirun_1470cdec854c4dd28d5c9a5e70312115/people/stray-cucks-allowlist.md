---
display_name: Stray Cucks allowlist scanner
summary: Robinhood Chain allowlist scanner (allowlist.straycucks.com) wired into Foil's WL checker 2026-10-05 — per-wallet eligibility rollups across every chain-4663 drop.
---

# Stray Cucks allowlist scanner

## Facts
- Robinhood Chain allowlist scanner at https://allowlist.straycucks.com (guide at /guide) — paste a wallet, see every open RH mint list it's on. Its core insight, stated on the page: almost every WL on chain 4663 lives on OpenSea's servers, not onchain, so SeaDrop probes can never see them — its backend asks OpenSea directly, per wallet, across every drop. (message:assistant-msg-3b4160c2-35f5-4354-b447-ed8d8fbe096a; memory://md:memory/2026-10-04.md:570)
- 2026-10-06 ~00:46 UTC: the user shared the link and ordered it incorporated into the WL checker ("Incorporate any of this into our wl checker"). Foil built `~/workspace/wl-scout-static/straycucks.mjs` with four commands: `--check <wallet>` (one-call eligibility rollup: eligible / public-only / not-on / unfunded / maxed across every 4663 drop), `--ccff00` (all CCFF00-gated drops with holder price, public price, WL spots, stage names), `--trust <slug>` (trust signals: created-today, no X, duplicate launch, paid-mint-in-free-stage, creator clustering), and `--drops-refresh`. (message:a3979e88-3c31-4049-9e30-560b07e30f6f; message:assistant-msg-3b4160c2-35f5-4354-b447-ed8d8fbe096a)
- `scan-wallets.mjs` now takes `--stray`: merges the eligibility rollup into the bi-wallet scan and enriches every project with their CCFF00-gate + trust data. The 2h `wl-scout-wallet-scan` cron runs with `--stray`, and "newly appearing in `stray.eligible`" is a reportable change. (message:assistant-msg-3b4160c2-35f5-4354-b447-ed8d8fbe096a)
- Known earlier: memory/2026-10-04.md#L570 already flagged it as intel — "paste wallet, see every open RH mint list it's on. Useful for fire-time eligibility checks." (memory://md:memory/2026-10-04.md:570)
- Caveats (all from Foil's wiring): their `/api/check` budget is hourly-capped and was exhausted at wiring — the module keeps the last good rollup instead of clobbering it and falls back to their 1h-cached drops data; feed endpoints 403 without an `x-sc-page: 1` header ("not-public"); caches kept at 1h/30min so the site isn't hammered. (message:assistant-msg-3b4160c2-35f5-4354-b447-ed8d8fbe096a)
- Side bonus at wiring: `--ccff00` already showed 9 CCFF00-gated drops in the 12h window with prices and spots. (message:assistant-msg-3b4160c2-35f5-4354-b447-ed8d8fbe096a)
- It carries the Stray Cucks name; who actually operates it is unverified. [TheArsonDragon](../people/thearsondragon.md) is the verified Stray Cucks artist in the CCFF00 scene, but no operator link is established.

## History
- 2026-10-04: flagged as intel in the daily record (memory://md:memory/2026-10-04.md:570).
- 2026-10-06 ~00:46–00:49 UTC: the user shared the link; Foil probed the site, built the headless `straycucks.mjs` module, merged it into `scan-wallets.mjs --stray`, and wired the 2h cron to run with it. (message:a3979e88-3c31-4049-9e30-560b07e30f6f; message:assistant-msg-3b4160c2-35f5-4354-b447-ed8d8fbe096a)

## The relationship
- A mint-intel tool in Foil's WL stack, wired in at the user's direct order. No other contact with its operators.

## In common
- The CCFF00 / Robinhood Chain mint scene; whitelist hunting.

## Open threads

## Strengthening


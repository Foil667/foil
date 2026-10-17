---
id: foil-listing-sale-watch
title: Foil listing sale watch (hourly, silent unless a sale fills)
enabled: true
owner: goal:robinhood-chain-free-mint-watch
mode: task
schedule:
  kind: interval
  timezone: America/Chicago
  at: 2026-10-11T21:23:05
  every: 1h
delivery:
  - chat_id: 7d131e35-3b7b-44c5-9b2c-19ed5aecf98c
metadata:
  tags: [cron:automatic-interval-anchor]
  originating_chat_context_json: '{"origin_provider":"main","chat_kind":"direct","event_kind":"message","require_mention":false}'
  presentation_locale: en-US
---
Hourly sale watch for Foil's OpenSea listings placed on 2026-10-12 under the user's sales order. Purpose: the user was told "I'll flag any sale the moment one fills" — this job is that mechanism. Silent unless a sale actually fills.

WALLET: Foil 0x6573682faee72a4a96e791ba262439f1df3a268d, Robinhood Chain (4663) primarily, Base for completeness.

LISTINGS PLACED 2026-10-12 (from the confirmed main-chat report):
- CyberCrew GEN02 #4849 — contract 0x7b7d36b4e8111e1665b42a6c2f06676852ef24fa, token 4849, listed 23 USDG (floor was 13.5 USDG). This is the money item.
- Circulars x12 at 0.15 USDG each; Undermarket Miners x2; X&O #317; Hood Tetris #5; Mining Cell #866; FFCC00 #1246; Beyond the Last Star #1 and #2; Hood Apes #159 and #160; Vintage Pixell #174 and #175; NodeBots #359 — all at or just under their floors (dust range). Older higher-priced orders for some of these are also still live.
- NEVER listed and out of scope: Helixa Agent #5290, any Looper. SCREEMO #201/#202 could not be listed (contract rejects the approval) — ignore them.

STATE FILE: ~/workspace/goals/robinhood-chain-free-mint-watch/hidden_files/listing-sale-watch-state.json
- FIRST RUN ONLY: snapshot the current state — active OpenSea listings for Foil's wallet and ownership of the tokens above — write it as the baseline, and report NOTHING. A first run never alerts.
- LATER RUNS: compare against the state file, then update it.

CHECKS (use the established headless patterns from AGENTS.md):
- OpenSea API: send a browser User-Agent header on every call or it 403s. API key at ~/.opensea/key.json — parse tolerantly (JSON {"api_key": ...} OR a raw 32-char string; read the field/value actually in the file). If keyed calls return HTTP 000/empty, that pattern means a dead free key — you may re-provision once via POST https://api.opensea.io/api/v2/auth/keys and save the new key the same way the file is currently formatted. If calls still fail, log one line to ~/memory/<today>.md and stay silent — never alert the user about an API outage.
- Confirm a suspected sale onchain before reporting: ownerOf(token) on the relevant contract via RH RPC (browser UA header required) must show the token is no longer Foil's. An expired/cancelled listing with the token still in Foil's wallet is NOT a sale — update state silently.

ON A CONFIRMED SALE, report once in main chat, briefly:
- What sold (collection + token id), the sale price if OpenSea's events API shows it (otherwise say price unconfirmed), and the sale tx link if findable.
- If GEN02 #4849 sold, add one line: CyberCrew daily play stops until a replacement exists (the cybercrew-daily-play job already checks ownership daily and will also catch this — do not duplicate its work beyond this note).
- Log the sale to the daily memory note and to the Robinhood Chain free-mint watch tracking item.

HARD RAILS: read-only watch. Never list, delist, reprice, accept offers, transfer, or sign anything. Never touch Helixa #5290 or any Looper. If no sale: total silence, just update the state file.

---
id: wl-scout-wallet-scan
title: WL Scout bi-wallet scan + mint timers (2h)
enabled: false
owner: goal:robinhood-chain-free-mint-watch
mode: task
schedule:
  kind: interval
  timezone: America/Chicago
  at: 2026-10-04T00:18:29
  every: 2h
delivery:
  - chat_id: 7d131e35-3b7b-44c5-9b2c-19ed5aecf98c
metadata:
  tags: [cron:automatic-interval-anchor]
  originating_chat_context_json: '{"chat_id":"7d131e35-3b7b-44c5-9b2c-19ed5aecf98c","origin_provider":"main","chat_kind":"direct","event_kind":"message","require_mention":false,"device_id":"c0efaf97-f9be-4fb7-bb44-174b152ad9fc"}'
  presentation_locale: en-US
---
WL Scout bi-wallet scan + mint timers (user-approved 2026-10-03).

WALLETS (read-only, plain-text addresses — never connect or sign):
- User: 0x4f9883c7331ba59a56360ffa3c332e0bc09029fc (holds 0 CCFF00 squares; square-gated phases ineligible)
- Foil: 0x6573682faee72a4a96e791ba262439f1df3a268d (claimed NFTs stay here — never forward, list, sell, or transfer without the user's explicit per-item instruction)

STEPS:
1. Run: `node ~/workspace/wl-scout-static/scan-wallets.mjs 0x4f9883c7331ba59a56360ffa3c332e0bc09029fc 0x6573682faee72a4a96e791ba262439f1df3a268d --stray --out ~/workspace/goals/robinhood-chain-free-mint-watch/hidden_files/wl-verdicts-latest.json`
   The `--stray` flag merges allowlist.straycucks.com data: a one-call per-wallet eligibility rollup over every 4663 drop (OpenSea server-side WL lists are invisible to our onchain SeaDrop probes) plus per-drop CCFF00-gate and trust-signal enrichment on each project (`stray` field). It degrades gracefully when their hourly checks budget is exhausted (fields marked budgetLimited; cached rollups used instead). Rate limits are handled inside straycucks.mjs — never raise its cache TTLs or bypass it.
2. Diff verdicts against `~/workspace/goals/robinhood-chain-free-mint-watch/hidden_files/wl-verdicts-prev.json` (create the baseline from this run if missing). Report to chat ONLY on meaningful changes: a wallet newly ELIGIBLE on a live phase, an ELIGIBLE verdict lost, a new CHECKER with an upcoming phase inside 24h, OR a slug newly appearing in a wallet's `stray.eligible` list (newly eligible on an OpenSea-gated phase — cross-check against the CCFF00 holder gate before acting). Stay silent when verdicts are unchanged.
3. MINT REMINDERS ON THE USER'S IPHONE (10-min prior, high priority): from the fresh scan, collect every project with `upcoming.start` within the next 2h15m. ALSO read `~/workspace/goals/robinhood-chain-free-mint-watch/hidden_files/ccff00-wl-pipeline.json` for offchain deadlines (armed/watching projects with a deadline or phase start) inside the same window. For each, create an iOS reminder in ONE `device.invoke` call on device id `c0efaf97-f9be-4fb7-bb44-174b152ad9fc`, command `reminders.create`, with `reminders_json` as a JSON array string — one object per mint, in the user's "Mints" list:
   [{"title":"MINT IN 10 MIN: <name>","notes":"Contract <addr> · opens <UTC> / <CDT> · <user|Foil> wallet qualifies (<verdict>) · onchain price <x ETH> · fire-time gates: official route, eligibility, price exactly zero, gas < $0.50, no approvals, clean simulation, rug-check, Tinfoil green","due_date":"<ISO 8601 UTC of phase start minus 10 minutes>","priority":1,"list_name":"Mints"}]
   Dedup with `~/workspace/goals/robinhood-chain-free-mint-watch/hidden_files/wl-mint-alerts.json` (list of {reminder_id, contract, phaseStart}): skip any contract+phaseStart already scheduled with an alert time still in the future. Record newly created reminder_ids there. If the iPhone is unreachable OR reminder creation is denied (hitl_denied), fall back to a chat message in this run naming the mint, contract, and exact time — the user must not miss the alert.
4. CLEANUP (iOS does not auto-delete fired reminders): in the same run, call `device.invoke` command `reminders.list` on the same device, find reminders in the "Mints" list whose due_date is more than 2 hours in the past, and mark them complete with command `reminders.complete`. This keeps the Mints list tidy automatically.
5. Move wl-verdicts-latest.json to wl-verdicts-prev.json for the next run. Append a one-line note to ~/memory/YYYY-MM-DD.md.

HARD LINES: read-only — no claims, no wallet writes, no approvals, no signatures. If the scan RPC fails on all endpoints, retry once, then report the outage loudly (this is coverage loss, not "no mints").

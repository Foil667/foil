---
id: san-verano-league-bind
title: 'San Verano league prep: bind wallet + fund brokerage (Mon 8:00 AM CDT)'
enabled: true
owner: goal:san-verano-agent-residency
mode: task
schedule:
  kind: runonce
  timezone: America/Chicago
  at: 2026-10-12T08:00:00
delivery:
  - chat_id: 7d131e35-3b7b-44c5-9b2c-19ed5aecf98c
metadata:
  originating_chat_context_json: '{"origin_provider":"main","chat_kind":"direct","event_kind":"message","require_mention":false}'
  presentation_locale: en-US
---
One-shot San Verano (grift.world) Stock Exchange league prep for resident Foil Looper #100102, ahead of the season open Monday Oct 12 at 09:30 AM New York (08:30 AM CDT). This run does BIND + FUND + VERIFY only — no league trades in this run.

Context and hard facts (from the 2026-10-11 setup, memory/2026-10-11.md):
- Resident: Foil Looper #100102, cook at the market, Stadium district. One-time API token is at ~/workspace/goals/grift-san-verano-agent/hidden_files/session.json (0600) — use it, never print it or copy it anywhere.
- Prize qualification requires, BEFORE the season's first trade: (a) leagueWallet binding — a personal_sign naming Foil's EVM wallet 0x6573682faee72a4a96e791ba262439f1df3a268d as owner of the resident's brokerage; (b) a brokerage starting balance of at least $100 city cash via exchangeFund (exchangeFund opens at $10+, but qualification needs $100+); (c) at least 5 trades during the season (later — NOT in this run).
- API quirks: GETs are fast; curl POSTs to grift.world hang — use node fetch for POSTs and expect 25-90s per POST. Follow the league spec at grift.world/agents for the exact leagueWallet / exchangeFund call shapes; re-read it this run rather than trusting memory for payload fields.
- Standing orders already live: shift on, gym afternoons, bar nights, spendMax $40/day, casino only above $300 cash.

Steps:
1. Read the resident's current state (cash, leagueWallet / brokerage status) with the saved token.
2. If leagueWallet is already bound to 0x6573682faee72a4a96e791ba262439f1df3a268d, skip signing. Otherwise complete the binding: produce the personal_sign via Bankr /wallet/sign for Foil's own wallet (this is Foil signing for itself, no user funds, no approval) and submit it per the spec. Verify the binding stuck by re-reading state.
3. Fund the brokerage with $100 city cash via exchangeFund ONLY if the resident's current cash is at least $110 and the funding does not conflict with the standing orders. This is in-game city cash (paper league) — not real money. If cash is below that, or the exchangeFund shape is unclear from the live spec, STOP and report exactly what is needed instead of guessing.
4. Verify: binding present + brokerage starting balance >= $100. Log the result to the San Verano tracking item (goal_a9cb41facaa1) and the daily memory note.

Hard rails: NO league trades in this run. NO x402 paid data endpoints (cost real $GRIFT — not authorized). NO real-money transactions, swaps, or transfers — the real trading lane stays closed. Never print the session token.

Report to the user in main chat only the outcome: bound + funded + verified, or the specific blocker that needs their tap. If everything was already done, say so in one line and stop.

---
id: san-verano-league-fri-wrap
title: 'San Verano league: Friday pre-close wrap'
enabled: true
owner: goal:san-verano-agent-residency
mode: task
schedule:
  kind: runonce
  timezone: America/Chicago
  at: 2026-10-16T14:00:00
delivery:
  - chat_id: 7d131e35-3b7b-44c5-9b2c-19ed5aecf98c
metadata:
  originating_chat_context_json: '{"chat_id":"7d131e35-3b7b-44c5-9b2c-19ed5aecf98c","origin_provider":"main","chat_kind":"direct","event_kind":"message","require_mention":false,"device_id":"c0efaf97-f9be-4fb7-bb44-174b152ad9fc"}'
  presentation_locale: en-US
---
San Verano Stock Exchange league — FINAL day wrap for resident Foil Looper #100102 (user order 2026-10-12: "Stay active in there"). Season 2026-10-12 closes today, Fri Oct 16 at 16:00 New York (15:00 CDT). Qualification (≥5 trades) was MET on Oct 12.

Auth: read the token from ~/workspace/goals/grift-san-verano-agent/hidden_files/session.json (0600 — NEVER print it). All calls: node fetch, Authorization: Bearer <token>, browser User-Agent, generous timeouts. Working helpers and trade logs: ~/workspace/goals/san-verano-agent-residency/hidden_files/.

Steps:
1. GET /api/agents/exchangeQuote and GET /api/agents/exchangePositions.
2. If the market is still open and any unheld symbol has room ≥ $10 while keeping ≥ $25 cash after the trade, make ONE final small buy ($10–13) — seq = account.seq + 1 (a 422 does not consume the seq; a 409 means bump by 1). The `why`: at most 10 words, plain market language only, letters/digits/spaces and . , ' ! ? $ - — the word "crypto" is refused by the reason filter. Do NOT liquidate the book; positions ride to the season close.
3. Verify with a fresh GET exchangePositions.
4. Log the final state (positions, cash, equity, season P&L and return, total trades, total fees) to ~/workspace/goals/san-verano-agent-residency/hidden_files/league-final-2026-10-16.md and one line to ~/memory/2026-10-16.md.
5. Report the FINAL season standing to the user in main chat: trades made, final equity vs the $100 start, P&L, and the three (or more) positions held at the close. This is the season wrap — a short paragraph is fine here.
Hard limits: brokerage (city cash) only, never use the x402 data endpoints (real $GRIFT — NOT authorized), no real-money transactions, never withdraw from the brokerage.

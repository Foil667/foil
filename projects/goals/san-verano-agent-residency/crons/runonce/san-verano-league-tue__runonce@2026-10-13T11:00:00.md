---
id: san-verano-league-tue
title: 'San Verano league: Tuesday active check'
enabled: true
owner: goal:san-verano-agent-residency
mode: task
schedule:
  kind: runonce
  timezone: America/Chicago
  at: 2026-10-13T11:00:00
delivery:
  - chat_id: 7d131e35-3b7b-44c5-9b2c-19ed5aecf98c
metadata:
  originating_chat_context_json: '{"chat_id":"7d131e35-3b7b-44c5-9b2c-19ed5aecf98c","origin_provider":"main","chat_kind":"direct","event_kind":"message","require_mention":false,"device_id":"c0efaf97-f9be-4fb7-bb44-174b152ad9fc"}'
  presentation_locale: en-US
---
San Verano Stock Exchange league — daily activity check for resident Foil Looper #100102 (user order 2026-10-12: "Stay active in there"). Season 2026-10-12 runs Mon 09:30 – Fri 16:00 New York. Qualification (≥5 trades) was MET on Oct 12; this run keeps the book active and tended.

Auth: read the token from ~/workspace/goals/grift-san-verano-agent/hidden_files/session.json (0600 — NEVER print it). All calls: node fetch, Authorization: Bearer <token>, browser User-Agent, generous timeouts (grift.world POSTs can take 25–170s). API spec: GET https://www.grift.world/api/agents/openapi. Working helpers and full trade log: ~/workspace/goals/san-verano-agent-residency/hidden_files/ (grift-read.mjs, grift-trades-*.mjs, league-trades-2026-10-12.md).

Steps:
1. GET /api/agents/exchangeQuote and GET /api/agents/exchangePositions. If the market is closed or the season has ended, log one line to ~/memory/2026-10-13.md and end silently.
2. Note account.seq — every league POST uses seq = account.seq + 1, incrementing per fill. A 422 refusal does NOT consume the seq (retry same seq after fixing the refusal); a 409 means the seq was used (bump by 1).
3. Make ONE small trade (two at most) to stay active: prefer a $10–13 buy of an unheld symbol from the quote (symbols: NVDA TSLA AAPL META PLTR AMD AMZN NFLX COIN SPY MSFT GOOGL QQQ) whose "room" in exchangePositions is ≥ the trade size. Fences: min trade $10, commission 2% on top, position cap is 20% of CASH — the server's room field governs, never exceed it. Keep at least $25 of brokerage cash unspent after the trade. If no buy fits the fences, a small trim (sell $10–15 of a held position) is acceptable activity instead.
4. Every trade needs a `why`: at most 10 words and 120 characters, letters/digits/spaces and . , ' ! ? $ - only, ONE figure at most, plain market language. WARNING: reasons pass a vocabulary filter — the word "crypto" was refused with a 422 on Oct 12. Keep whys simple (e.g. "Adding a steady name while cash allows.").
5. Verify with a fresh GET exchangePositions. Log the run (fills, cash, equity, positions, season P&L) to ~/workspace/goals/san-verano-agent-residency/hidden_files/league-activity-2026-10-13.md and one line to ~/memory/2026-10-13.md.
6. Report to the user in main chat in ONE short line: what traded, current equity, and season trade count. Nothing else.
Hard limits: brokerage (city cash) only — never touch resident cash beyond what league ops do themselves, never use the x402 data endpoints (they cost real $GRIFT — NOT authorized), no real-money transactions, never withdraw from the brokerage.

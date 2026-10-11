---
id: foil-position-watch
title: Foil position watch (degen playbook exits)
enabled: true
owner: goal:foil-monetization-and-cred-building
mode: task
schedule:
  kind: interval
  timezone: America/Chicago
  at: 2026-09-27T19:27:48
  every: 30m
metadata:
  tags: [cron:automatic-interval-anchor]
  originating_chat_context_json: '{"chat_id":"7d131e35-3b7b-44c5-9b2c-19ed5aecf98c","origin_provider":"main","chat_kind":"direct","event_kind":"message","require_mention":false,"device_id":"c0efaf97-f9be-4fb7-bb44-174b152ad9fc"}'
  presentation_locale: en-US
---
Position watch for Foil's Degen Playbook (approved 2026-09-27, user standing order: aggressive profit-taking, ALWAYS fully exit when a play is done).

TRADING LANE CLOSED (user 2026-10-08 ~15:13 CDT: "I don't trust your trading"). The pre-authorization for exits is REVOKED. This job is MONITOR-ONLY until the user issues a fresh explicit per-action trading order: compute triggers, report them, but NEVER execute a swap, quote-to-trade, signature, or approval.

1. Read ~/workspace/goals/foil-monetization-and-cred-building/hidden_files/positions.json. For each OPEN position:
   - Get current price: `curl -s -A "Mozilla/5.0" "https://api.dexscreener.com/tokens/v1/base/<contract>"` → [0].priceUsd (fallback: Bankr /wallet/portfolio token balanceUSD/balance).
   - Compute pnl = (price - entry_price) / entry_price.
2. Exit triggers (EVALUATE ONLY — do not execute):
   - pnl >= +0.40 → take profit signal
   - pnl <= -0.30 → stop loss signal
   - now >= time_stop_cdt → time stop (24h)
3. If a trigger hits: report to chat (token, current price, P/L, which trigger) and ask the user for explicit approval before any exit. Never open new positions from this job.
4. Delivery: report to chat ONLY when a trigger hits (awaiting user approval) or when an error blocked evaluation. If no trigger hit, stay silent — no routine "still holding" messages.

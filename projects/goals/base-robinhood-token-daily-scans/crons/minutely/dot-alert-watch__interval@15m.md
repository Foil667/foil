---
id: dot-alert-watch
title: DOT chart alert watch
enabled: true
owner: goal:base-robinhood-token-daily-scans
mode: task
schedule:
  kind: interval
  timezone: America/Chicago
  at: 2026-10-08T15:27:42
  every: 15m
delivery:
  - chat_id: 7d131e35-3b7b-44c5-9b2c-19ed5aecf98c
metadata:
  tags: [cron:automatic-interval-anchor]
  originating_chat_context_json: '{"chat_id":"7d131e35-3b7b-44c5-9b2c-19ed5aecf98c","origin_provider":"main","chat_kind":"direct","event_kind":"message","require_mention":false,"device_id":"c0efaf97-f9be-4fb7-bb44-174b152ad9fc"}'
  presentation_locale: en-US
---
Run the DOT alert watch script and deliver any alerts to the user.

Steps:
1. Run: python3 ~/workspace/goals/base-robinhood-token-daily-scans/hidden_files/dot-watch.py
2. Read its stdout. If it contains lines starting with "ALERT:", report them to the user in the main chat immediately — short, punchy, with the price and what fired. Include the summary line (price/FDV/liquidity/volume) for context.
3. If there are no ALERT lines, stay silent — do not message the user. Just note the run in ~/memory/2026-10-08.md (one line: time, price) if the daily log exists; otherwise skip.

Context for the user: DOT is 0x23a2847d772803f9efc64b4277b782b06296fe51 on Base (usedot.xyz, @usedotai). The chart shows a repeating blow-off-top pattern: every rally spike fully retraces, each failing at a lower high (July ~1.5M→6M→2.5M, early Sep ~2.5M→7M→4.5M, mid Sep ~7M→9.5M→7M, late Sep ATH ~14.5M→stair-step down to ~7.2M). Volume spikes mark tops, not bottoms. 30d top traders are pure sellers distributing into strength. The user holds 10k DOT (~$82 at $0.0082). Alert thresholds in the script: +15% in 1h (spike arming), +25% in 6h (rally building), -15% in 1h (dump), -25% in 24h (slide), 2x volume surge, buy/sell skew extremes. Do NOT trade — alert only. The user's trading authority was withdrawn 2026-10-07 ("Never mind"); trading needs a fresh explicit order.

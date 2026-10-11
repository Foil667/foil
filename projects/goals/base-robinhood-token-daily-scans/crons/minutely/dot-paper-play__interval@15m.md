---
id: dot-paper-play
title: DOT 48h paper play
enabled: false
owner: goal:base-robinhood-token-daily-scans
mode: task
schedule:
  kind: interval
  timezone: America/Chicago
  at: 2026-10-08T15:31:32
  every: 15m
delivery:
  - chat_id: 7d131e35-3b7b-44c5-9b2c-19ed5aecf98c
metadata:
  tags: [cron:automatic-interval-anchor]
  originating_chat_context_json: '{"chat_id":"7d131e35-3b7b-44c5-9b2c-19ed5aecf98c","origin_provider":"main","chat_kind":"direct","event_kind":"message","require_mention":false,"device_id":"c0efaf97-f9be-4fb7-bb44-174b152ad9fc"}'
  presentation_locale: en-US
---
Run the DOT 48-hour paper-trade engine and report paper trades to the user.

Steps:
1. Run: python3 ~/workspace/goals/base-robinhood-token-daily-scans/hidden_files/dot-paper.py
2. Read its stdout.
   - If it contains "PAPER SELL" or "PAPER BUY" lines: report them to the user in the main chat immediately — what the paper trade did, at what price, why (the reason in parentheses), plus the running paper portfolio line.
   - If it contains "PAPER FINAL": deliver the full final scorecard to the user and then DISABLE this cron (it is done) — do not message about the disable, just do it via cron.update enabled=false.
   - If it only contains the "paper:" status line with no trades: stay silent, do not message the user.

HOLD RULE — funeral window: the user is at Uncle Timmy's funeral Saturday 2026-10-10 15:00–19:00 CDT (Damar-Kaminski Funeral Home, Justice). If a run would report PAPER SELL/BUY/FINAL to the user at any time from 2026-10-10 14:00 CDT up to 2026-10-10 19:00 CDT, hold the report and deliver it on the first run after 2026-10-10 19:00 CDT instead. Do not interrupt the funeral window. Reports due outside that window follow the normal rules above.

Context: this is a PAPER trade (fake, no wallet, no real funds) the user ordered 2026-10-08 ~15:17 CDT to test Foil's trading ability over 48 hours. Start: 10,000 DOT @ $0.008226 ($82.26). Playbook: sell 50% on +15%/1h spikes, sell all on +30% from entry, buy back 50% of cash on -20% dips below last sell, final mark-to-market at 48h vs buy-and-hold. DOT = 0x23a2847d772803f9efc64b4277b782b06296fe51 on Base. NEVER execute real trades — paper only. The user's real trading authority remains withdrawn.

---
id: helixa-cred-report-retry
title: Helixa cred report retry
enabled: true
owner: goal:foil-monetization-and-cred-building
mode: task
schedule:
  kind: interval
  timezone: America/Chicago
  at: 2026-09-24T00:59:08
  every: 6h
metadata:
  tags: [cron:automatic-interval-anchor]
  originating_channel_context_json: '{"originating_channel":"main","chat_kind":"direct","event_kind":"message","require_mention":false,"device_id":"c0efaf97-f9be-4fb7-bb44-174b152ad9fc"}'
  presentation_locale: en-US
---
Retry Foil's Helixa full CRED report purchase (user pre-approved exactly $0.01 USDC on 2026-09-23; Helixa agent #5290).

1. Check if ~/workspace/helixa-mint/cred-report-full.json already exists. If yes, do nothing and end silently.
2. If not, run: node ~/workspace/helixa-mint/buy-report.js — it aborts unless the x402 402 demands exactly ≤$0.01 USDC. Never pay more than $0.01. One attempt per run.
3. If the purchase succeeds: save the full report JSON to ~/workspace/helixa-mint/cred-report-full.json, append the top 3 score recommendations to ~/memory/YYYY-MM-DD.md (today's date), and report success with the new score and top levers.
4. If the x402 settlement still fails: do nothing, end silently, try again next run. Do not notify the user of failures.

No other spending, no other actions, no wallet signatures beyond this exact $0.01 purchase.

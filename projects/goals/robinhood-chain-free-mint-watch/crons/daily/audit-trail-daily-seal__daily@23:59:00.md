---
id: audit-trail-daily-seal
title: Audit trail daily seal (mint lane)
enabled: true
owner: goal:robinhood-chain-free-mint-watch
mode: task
schedule:
  kind: daily
  timezone: UTC
  time: 23:59:00
delivery:
  - chat_id: 7d131e35-3b7b-44c5-9b2c-19ed5aecf98c
metadata:
  originating_chat_context_json: '{"chat_id":"7d131e35-3b7b-44c5-9b2c-19ed5aecf98c","origin_provider":"main","chat_kind":"direct","event_kind":"message","require_mention":false,"device_id":"c0efaf97-f9be-4fb7-bb44-174b152ad9fc"}'
  presentation_locale: en-US
---
Seal Foil's mint-lane audit trail for the day (user-approved 2026-10-09).

0. Check whether today's receipt file exists: ~/workspace/audit-trail/receipts/foil-mint-lane/$(date -u +%F).jsonl. If it does NOT exist (no receipts emitted today — e.g. no claims fired), do NOT manufacture a chain: log "no receipts, nothing to seal" and end silently. The seal tool refuses to seal an absent chain by design; that is correct behavior, not a failure.
1. Run: `python3 ~/workspace/audit-trail/receipt.py seal --lane foil-mint-lane` — writes a close=true checkpoint receipt plus a commitment file binding the day's chain digest (tamper-evident truncation defense).
2. Verify the sealed chain: `python3 ~/workspace/audit-trail/receipt.py verify ~/workspace/audit-trail/receipts/foil-mint-lane/$(date -u +%F).jsonl` — expect OK.
3. Append one line to ~/memory/YYYY-MM-DD.md (UTC date): seal digest (first 12 hex chars) + receipt count + verify result.

Stay silent in chat on a healthy run (sealed + verified, or nothing to seal). Report loudly only if the seal fails on an EXISTING chain or verify returns FAIL (name the step and the error) — a broken chain is a trust incident, not routine. Do not edit MEMORY.md. Run logs go under ~/workspace/goals/robinhood-chain-free-mint-watch/hidden_files/.

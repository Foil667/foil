---
id: cred-lp-watch
title: CRED LP manipulation watch
enabled: true
owner: goal:robinhood-chain-free-mint-watch
mode: task
schedule:
  kind: interval
  timezone: America/Chicago
  at: 2026-09-24T17:29:26
  every: 15m
metadata:
  tags: [cron:automatic-interval-anchor]
  originating_channel_context_json: '{"originating_channel":"main","chat_kind":"direct","event_kind":"message","require_mention":false,"device_id":"c0efaf97-f9be-4fb7-bb44-174b152ad9fc"}'
  presentation_locale: en-US
---
Every 15 minutes, run the CRED/WETH liquidity-pool manipulation watch:

```
node ~/workspace/nft-god/foil-equities/scripts/watch-cred-lp.mjs
```

Read its stdout. The script exits 0 with `RESULT: CLEAN` when nothing is wrong, exit 3 with `RESULT: ALERT` plus `ALERT:` lines when it detects a possible manipulation (price move >15% between checks, volume spike >3x trailing average, liquidity drop >20%, or txn surge), and exit 2 on feed errors.

- If `RESULT: CLEAN`: stay silent. Log nothing to chat. (The script already appends to its own log file.)
- If `RESULT: ALERT`: surface to the user LOUDLY in the main chat — quote the ALERT lines verbatim, name the threat (pump staging / positioning / liquidity pull per docs/SECURITY.md), and recommend pausing the $CRED activation rail until investigated. This is the one case this job is allowed to interrupt.
- If exit 2 (feed down): retry once next run; only tell the user if the feed is still down after 4 consecutive failures.

This is READ-ONLY monitoring. Never trade, never touch the pool, never sign anything. Standing user order (2026-09-24): watch for people trying to scam or game the LP. Threat model: ~/workspace/nft-god/foil-equities/docs/SECURITY.md.

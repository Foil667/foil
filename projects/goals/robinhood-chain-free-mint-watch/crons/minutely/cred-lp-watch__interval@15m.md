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
  originating_chat_context_json: '{"chat_id":"7d131e35-3b7b-44c5-9b2c-19ed5aecf98c","origin_provider":"main","chat_kind":"direct","event_kind":"message","require_mention":false,"device_id":"c0efaf97-f9be-4fb7-bb44-174b152ad9fc"}'
  presentation_locale: en-US
---
Every 15 minutes, run the CRED/WETH liquidity-pool manipulation watch:

```
node ~/workspace/nft-god/foil-equities/scripts/watch-cred-lp.mjs
```

Read its stdout. The script exits 0 with `RESULT: CLEAN` when nothing is wrong, exit 3 with `RESULT: ALERT` plus `ALERT:` lines when it detects a possible manipulation (price move >15% between checks, volume spike >3x trailing average, liquidity drop >20%, or txn surge), and exit 2 on feed errors.

- If `RESULT: CLEAN`: stay silent. Log nothing to chat. (The script already appends to its own log file.)
- If `RESULT: ALERT`: first DEDUP against the previous run before interrupting the user. Read the tail of `~/workspace/goals/robinhood-chain-free-mint-watch/hidden_files/cred-lp-watch/watch.log` (each run logs one `check ok:` line followed by its `ALERT:` lines; the previous run's ALERT lines are the set right after the second-to-last `check ok:` line). If this run's ALERT lines name the SAME alert type(s) as the previous run — no new alert types, and no material change in the reported figures (price moved <5%, volume/liquidity figures changed <20% vs the previous run's ALERT lines) — the episode is unchanged: stay silent, do NOT re-interrupt the user; record the run with a tracking entry on the watch goal only. Re-interrupt LOUDLY in the main chat only when: (a) this is the first ALERT after a CLEAN streak, (b) a NEW alert type appears in the episode (e.g. first PRICE MOVE / LIQUIDITY DROP / TXN SURGE), or (c) the reported figures worsen materially (>20% move vs the figures quoted in the last interrupt). When you do interrupt, quote the ALERT lines verbatim and name the threat (pump staging / positioning / liquidity pull per docs/SECURITY.md). On the rail-pause recommendation: the $CRED activation rail has been PAUSED since the Oct 6 volume-spike investigation (confirmed still paused Oct 8) — do NOT recommend pausing an already-paused rail; state its paused status instead, and only recommend a fresh pause if you have verified the rail is actually live.
- If exit 2 (feed down): retry once next run; only tell the user if the feed is still down after 4 consecutive failures.

This is READ-ONLY monitoring. Never trade, never touch the pool, never sign anything. Standing user order (2026-09-24): watch for people trying to scam or game the LP. Threat model: ~/workspace/nft-god/foil-equities/docs/SECURITY.md.

Why the dedup exists: the volume-spike trigger compares h24 volume against a 96-sample trailing average, so one real spike event keeps the ALERT condition true for many hours (observed 4 identical interrupts in one hour on 2026-10-10 with price/liquidity/txns all steady). Re-interrupting on the unchanged condition is noise; the signal is the first alert, any escalation, and any genuinely new trigger.

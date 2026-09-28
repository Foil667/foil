---
id: nft-efficiency-audit
title: NFT watchdog efficiency audit (24h)
enabled: true
owner: goal:robinhood-chain-free-mint-watch
mode: task
schedule:
  kind: daily
  timezone: '@user.current'
  time: 05:36:00
timeout_secs: 1200
metadata:
  tags: [cron:flexible-time]
  originating_channel_context_json: '{"originating_channel":"main","chat_kind":"direct","event_kind":"message","require_mention":false,"device_id":"c0efaf97-f9be-4fb7-bb44-174b152ad9fc"}'
  presentation_locale: en-US
---
## NFT Watchdog 24h efficiency audit

Run the non-interactive efficiency audit for the free-mint operation. Per the audit README, `--live` is the flag the 24h cron uses: it mutates only its own `state.json` plus report files. No spend, no signups, no keys, no deployments.

**Command:**
```
node ~/workspace/nft-god/efficiency-audit/audit.mjs --live
```

**Worker steps:**
1. Run the command (writes `AUDIT-REPORT.md`, `CANDIDATE_TOOLS.md` in `~/workspace/nft-god/efficiency-audit/`, and its own `state.json` there).
2. Report the audit summary in your final message: per-RPC win rates and REPLACE/WATCH verdicts, per-chain ROI, any minScore bumps applied, and any new candidate tools surfaced by the GitHub discovery job.
3. If any audit leg is DEGRADED (GitHub rate limit, missing mint-log), name it and what was skipped.
4. Append a one-line-per-run entry to `~/workspace/goals/robinhood-chain-free-mint-watch/hidden_files/nft-efficiency-audit-runs.log` (UTC time, report location, key findings).

**Hard lines:** `--live` is approved for this job only; never use it anywhere else without a new go-ahead. minScore is only raised per the README's bump rule, never lowered automatically.

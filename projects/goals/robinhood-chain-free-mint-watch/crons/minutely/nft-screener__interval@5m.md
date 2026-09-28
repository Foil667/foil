---
id: nft-screener
title: NFT watchdog screener (5-min detect + score)
enabled: true
owner: goal:robinhood-chain-free-mint-watch
mode: task
schedule:
  kind: interval
  timezone: America/Chicago
  at: 2026-09-24T14:00:43
  every: 5m
timeout_secs: 600
metadata:
  tags: [cron:automatic-interval-anchor]
  originating_channel_context_json: '{"originating_channel":"main","chat_kind":"direct","event_kind":"message","require_mention":false,"device_id":"c0efaf97-f9be-4fb7-bb44-174b152ad9fc"}'
  presentation_locale: en-US
---
## NFT Watchdog Screener — detect + score only (no claims)

Run the canonical v2 screener and triage results. This cron is READ-ONLY DETECTION. It does NOT submit mint claims; execution stays with the existing `hood-mint-watch` and one-shot claim scripts.

**Command:**
```
node ~/workspace/nft-god/screener/screener-v2.mjs --chains robinhood,base --min-score 60
```

**Flags:** `--chains robinhood,base` (primary mint scene + Base side scene), `--min-score 60` (verify tier and above; the screener's default 30 is too noisy). Do not lower the min-score without an explicit change.

**Worker steps:**
1. Run the command (read-only: no signing, no transactions, no spend).
2. Check the coverage report in the output. If a leg failed (RPC error, rate limit, 401, timeout), report LOUDLY in your final message: name the leg, the error, and the coverage lost (e.g. "OpenSea drops leg down — upcoming-drops signal offline, onchain mint-scan leg still live").
3. For each candidate with score **≥75 (execute tier)**: run `node ~/workspace/nft-god/rug-check/rug-check.mjs <chainId> <contractAddress>` (chain ID first: `4663` for Robinhood Chain, `8453` for Base) and report: contract address, chain, score, rug-check verdict, and OpenSea + explorer links.
4. Candidates scoring 60–74: list briefly (contract, chain, score, why it missed the execute tier).
5. Append a short run note (UTC time, candidates seen, execute-tier actions, leg failures) to `~/workspace/goals/robinhood-chain-free-mint-watch/hidden_files/nft-screener-runs.log` — one block per run, newest at the end.

**Hard lines:** no claims, no wallet writes, no approvals. If you discover the rug-check path is wrong, report it rather than guessing another path.

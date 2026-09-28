---
id: netprotocol-drop-watch
title: 'NetProtocol drop watch (hourly: mints + token releases)'
enabled: true
owner: goal:robinhood-chain-free-mint-watch
mode: task
schedule:
  kind: interval
  timezone: America/Chicago
  at: 2026-09-27T22:16:39
  every: 1h
timeout_secs: 600
metadata:
  tags: [cron:automatic-interval-anchor]
  originating_channel_context_json: '{"originating_channel":"main","chat_kind":"direct","event_kind":"message","require_mention":false,"device_id":"c0efaf97-f9be-4fb7-bb44-174b152ad9fc"}'
  presentation_locale: en-US
---
## NetProtocol Drop Watch — detect only, READ-ONLY (no claims, no writes)

Sweep NetProtocol for mints / NFT drops / token releases announced or launched only there. This cron is DETECTION. It does NOT claim, buy, mint, sign, approve, post, comment, or upvote anything. All write commands are forbidden.

**CLIs:** `botchan` (social/feeds, v0.4.13+) and `netp` (tokens/upvotes, v0.2.10+) are installed at /usr/bin. All commands below are read-only and wallet-free.

### Signals to check

1. **Feed watch** — token-launch and mint announcements surface in feeds (confirmed live examples: "RHAGENT (0x...) — Bankr-deployed on Robinhood Chain via Doppler", "TSK (The Shadow) just launched on Base via Bankr/Doppler. Contract: 0x..."). Read the latest ~15 posts (`--json`) from each of these feeds:
   `trades`, `crypto`, `trading`, `defi`, `ai-agents`, `trading-signals`, `simons-alpha`, `devio-alpha`, `junglebaymemes`, `general`
   Filter posts for drop/launch intent (keywords: mint, minting, launch, launched, deploy, deployed, contract:, presale, airdrop, whitelist, raffle, giveaway, free mint). Skip opinion/theory posts and plain trade recaps.

2. **Token discovery** — `netp upvote rankings --sort recent --limit 30 --chain-id 8453 --json` (tokens agents are actively launching/upvoting on Base). Note any NEW addresses vs the seen-list, with name, symbol, FDV, upvotes, latestUpvoteTimestamp, and `url` (the tokenUrl page). Upvoting itself is Base-only; tokens deployed on Robinhood Chain (4663) surface in the feeds, not the rankings — do not skip RH mentions in feed text.

### Deduplication (seen-list)

Seen-list file: `~/workspace/goals/robinhood-chain-free-mint-watch/hidden_files/netprotocol-seen.json`
JSON shape: `{"feed_post_ids": [...], "token_addresses": [...]}`. Create it if missing. Compare every candidate against it; only NEW items get reported. Append new ids/addresses and save before finishing. If the file is corrupt or unreadable, back it up with a `.bak` suffix and start a fresh one (say so loudly).

### Reporting rule

Report ONLY genuinely new, actionable drops: name, chain (Base 8453 / Robinhood 4663 / other), contract address if visible, entry mechanics (mint vs buy vs whitelist etc.), deadline if stated, and the link (feed `permalink` or token `url`). Silence when nothing new — a quiet run is a successful run.

### Leg failures

If `botchan` or `netp` fails (binary missing, RPC error, timeout, rate limit), report LOUDLY in the final message: name the leg, the error, and the coverage lost. Do not invent a fallback command.

### Bookkeeping

Append a short run note (UTC time, feeds read, new items found, leg failures) to `~/workspace/goals/robinhood-chain-free-mint-watch/hidden_files/netprotocol-drop-watch.log` — one block per run, newest at end. Also add one line to today's daily memory log `~/memory/YYYY-MM-DD.md`.

**Hard lines:** no claims, no mint/buy/list/offer commands, no `--encode-only` write flows, no signatures, no approvals, no posting, no profile changes, no upvotes. Read-only or abort.

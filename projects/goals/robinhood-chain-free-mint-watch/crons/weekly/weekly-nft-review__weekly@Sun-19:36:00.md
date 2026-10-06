---
id: weekly-nft-review
title: Weekly NFT wallet review with user
enabled: true
owner: goal:robinhood-chain-free-mint-watch
mode: task
schedule:
  kind: weekly
  timezone: America/Chicago
  time: 19:36:00
  dow: [Sun]
delivery:
  - chat_id: 7d131e35-3b7b-44c5-9b2c-19ed5aecf98c
metadata:
  tags: [cron:flexible-time]
  originating_chat_context_json: '{"chat_id":"7d131e35-3b7b-44c5-9b2c-19ed5aecf98c","origin_provider":"main","chat_kind":"direct","event_kind":"message","require_mention":false,"device_id":"c0efaf97-f9be-4fb7-bb44-174b152ad9fc"}'
  presentation_locale: en-US
---
Weekly NFT review with the user (user order 2026-10-04 ~22:47 CDT — "keep them in your wallet and we will go through them once a week together").

1. Build the inventory of every NFT currently held in Foil's wallet 0x6573682faee72a4a96e791ba262439f1df3a268d on Robinhood Chain (and Base if any). Sources: ~/workspace/goals/robinhood-chain-free-mint-watch/hidden_files/mint-log.jsonl (claim txs), the pipeline at ~/workspace/goals/robinhood-chain-free-mint-watch/hidden_files/ccff00-wl-pipeline.json, and a live onchain ownerOf/balance check per claimed contract to confirm they are still held (never assume the log is current).
2. For each held NFT report: project name, contract address, token id(s) if known, claim tx link, date claimed, current floor/listings if trivially checkable — and label its lane (CCFF00-WL claim vs public free claim).
3. Present the full list to the user in chat with one question: for each item, hold / forward to the user's wallet / list for sale / sell — or "hold everything." Do NOT forward, list, sell, or transfer anything on this run; this is review-only. The user decides item by item.
4. Never include CCFF00 square #4429, any Looper, or Helixa Agent #5290 in the review list — those are never touched, period.

Standing rule this serves: claimed NFTs stay in Foil's wallet (auto-forward REVOKED 2026-10-03); nothing is forwarded, listed, sold, or transferred without the user's explicit per-item instruction. This weekly review is the venue for those decisions.

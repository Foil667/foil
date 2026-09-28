---
id: nft-forward-sweep-every-other-day
title: NFT forward sweep (every other day)
enabled: true
owner: goal:robinhood-chain-free-mint-watch
mode: task
schedule:
  kind: interval
  timezone: America/Chicago
  at: 2026-09-28T23:23:40
  every: 48h
metadata:
  tags: [cron:automatic-interval-anchor]
  originating_channel_context_json: '{"originating_channel":"main","chat_kind":"direct","event_kind":"message","require_mention":false,"device_id":"c0efaf97-f9be-4fb7-bb44-174b152ad9fc"}'
  presentation_locale: en-US
---
Every-other-day NFT forward sweep (user order 2026-09-26): move any NFTs Foil's wallet has accumulated to the user's wallet.

Foil wallet: 0x6573682faee72a4a96e791ba262439f1df3a268d
User wallet: 0x4f9883c7331ba59a56360ffa3c332e0bc09029fc
NEVER touch: CCFF00 square #4429 (contract 0x505A22Ffed8d37ebE580FfD98d2Cdb0021189146, token 4429) and Helixa #5290 on Base.

Steps:
1. Enumerate ERC-721 holdings of 0x6573682faee72a4a96e791ba262439f1df3a268d on Robinhood Chain (4663) via the OpenSea account NFT API + onchain balanceOf/ownerOf verification (see ~/workspace/goals/robinhood-chain-free-mint-watch/hidden_files/bulk-transfer-20260926.mjs for the working pattern).
2. If zero transferable NFTs: log to ~/memory/YYYY-MM-DD.md and stay silent in chat.
3. Otherwise transfer each (except square #4429) via Bankr /wallet/sign + /wallet/submit on chain 4663, value 0, one at a time, verifying ownerOf after each (never double-send). Check gas balance first; if it can't cover the sweep, report the shortfall instead of partial-sending.
4. Log results to ~/workspace/goals/robinhood-chain-free-mint-watch/hidden_files/nft-transfer-log-2026-09-26.jsonl (append).
5. Report to chat only when transfers happened: count moved + first tx link.

---
id: nft-forward-sweep-every-other-day
title: NFT forward backstop (every other day)
enabled: false
owner: goal:robinhood-chain-free-mint-watch
mode: task
schedule:
  kind: interval
  timezone: America/Chicago
  at: 2026-09-28T23:23:40
  every: 48h
metadata:
  tags: [cron:automatic-interval-anchor]
  originating_chat_context_json: '{"chat_id":"7d131e35-3b7b-44c5-9b2c-19ed5aecf98c","origin_provider":"main","chat_kind":"direct","event_kind":"message","require_mention":false}'
  presentation_locale: en-US
---
Every-other-day NFT forward backstop (user order 2026-09-29 ~23:27 CDT "Send all NFTs to me except the square" SUPERSEDES the 2026-09-28 keep order): Foil forwards every claimed NFT still sitting in its own wallet to the user's wallet 0x4f9883c7331ba59a56360ffa3c332e0bc09029fc via Bankr /wallet/submit safeTransferFrom, verifying each receipt + ownerOf onchain. Foilbox normally forwards at claim time; this job catches anything missed.

Foil wallet: 0x6573682faee72a4a96e791ba262439f1df3a268d
NEVER touch: CCFF00 square #4429 (contract 0x505A22Ffed8d37ebE580FfD98d2Cdb0021189146, token 4429) and Helixa #5290 on Base — protected assets, do not move or interact with them in any way.

Steps:
1. Enumerate ERC-721 holdings of 0x6573682faee72a4a96e791ba262439f1df3a268d on Robinhood Chain (4663) via the OpenSea account NFT API + onchain balanceOf/ownerOf verification (see ~/workspace/goals/robinhood-chain-free-mint-watch/hidden_files/bulk-transfer-20260926.mjs for the working pattern).
2. For each holding: record contract, token id, collection name, owner-of confirmation. Exclude square #4429 and Helixa #5290 unconditionally. Anything not already recorded in the transfer log as forwarded gets safeTransferFrom'd to 0x4f9883c7331ba59a56360ffa3c332e0bc09029fc; verify each receipt + destination ownerOf.
3. Append the snapshot + any forward tx hashes to ~/workspace/goals/robinhood-chain-free-mint-watch/hidden_files/nft-transfer-log-2026-09-26.jsonl as a JSON entry {ts, result:'forward_backstop', holdings:[...], forwards:[...]}.
4. Append a one-line summary to ~/memory/YYYY-MM-DD.md (forwarded count, tx links, anything left and why).
5. Stay silent in chat unless something genuinely actionable appears (e.g. a claimed NFT shows as missing from the wallet, a forward failed, or the wallet received an unexpected transfer). Routine no-change audits are logged only.

HARD LINES: never transfer, list, sell, approve, or otherwise move CCFF00 square #4429, any Looper, or Helixa #5290 — forward only ordinary claimed NFTs.

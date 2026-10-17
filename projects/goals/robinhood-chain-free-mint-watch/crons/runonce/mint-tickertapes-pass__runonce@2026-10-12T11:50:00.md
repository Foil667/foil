---
id: mint-tickertapes-pass
title: 'Mint: Tickertapes Pass public free (Oct 12)'
enabled: true
owner: goal:robinhood-chain-free-mint-watch
mode: task
schedule:
  kind: runonce
  timezone: America/Chicago
  at: 2026-10-12T11:50:00
delivery:
  - chat_id: 7d131e35-3b7b-44c5-9b2c-19ed5aecf98c
metadata:
  originating_chat_context_json: '{"chat_id":"7d131e35-3b7b-44c5-9b2c-19ed5aecf98c","origin_provider":"main","chat_kind":"direct","event_kind":"message","require_mention":false,"device_id":"c0efaf97-f9be-4fb7-bb44-174b152ad9fc"}'
  presentation_locale: en-US
---
ONE-SHOT user-ordered free mint (2026-10-11, user in main chat: posted https://opensea.io/collection/tickertapes-pass + "Mint"). Target: Tickertapes Pass — contract 0x9897cfab24ae20186df5cdcac609b17fd908bd74 on Robinhood Chain (4663). OpenSea: https://opensea.io/collection/tickertapes-pass. Project: @TickertapesX, https://tickertapes.world/.

Verified 2026-10-11 ~18:40 CDT (fork SeaDrop probe, correct 6-word decode): public stage price=0, maxPerWallet=1, allowRoot=0x0 (public, no allowlist), feeBps=1000, restrict=1, window start=1791824400 (Mon Oct 12 13:00 EDT / 12:00 CDT) end=1792429200 (Mon Oct 19 13:00 EDT). Supply 3,750/4,444 at probe time (~694 left at open — could sell through, fire promptly). Foil balanceOf=0. Foil RH ETH ~0.00113 (plenty for gas).

Steps:
1. Re-probe the live SeaDrop fork config for the contract (probe-raw.mjs pattern). Confirm the FREE (price exactly 0) public stage is live and Foil still holds 0.
2. If no free stage is live or supply is exhausted: stay silent, log one line to ~/memory/2026-10-12.md, end.
3. If live: run ~/workspace/nft-god/claim-with-tinfoil.sh https://opensea.io/collection/tickertapes-pass 0x9897cfab24ae20186df5cdcac609b17fd908bd74 1 --route-x @TickertapesX --route-site https://tickertapes.world/
4. Hard gates (fail-closed): mint price exactly 0, gas under $0.50, no approvals, clean simulation, Tinfoil CLEAN (the documented OpenSea platform-noise exception applies to opensea.io URLs exactly as coded in the wrapper — never bypass a non-platform finding), official route verified.
5. On success: report to the user in main chat (project, qty, tx hash, OpenSea link). Log to ~/memory/2026-10-12.md. The pass stays in Foil's wallet 0x6573682faee72a4a96e791ba262439f1df3a268d — never forward/list/sell.
6. On failure: log the reason to the daily log; stay silent in chat unless the claim pipeline itself is systematically broken.

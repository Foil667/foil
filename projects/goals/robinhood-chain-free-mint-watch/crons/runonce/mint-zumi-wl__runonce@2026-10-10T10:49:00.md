---
id: mint-zumi-wl
title: 'Mint: Zumi WL free (Oct 10)'
enabled: true
owner: goal:robinhood-chain-free-mint-watch
mode: task
schedule:
  kind: runonce
  timezone: America/Chicago
  at: 2026-10-10T10:49:00
delivery:
  - chat_id: 7d131e35-3b7b-44c5-9b2c-19ed5aecf98c
metadata:
  originating_chat_context_json: '{"chat_id":"7d131e35-3b7b-44c5-9b2c-19ed5aecf98c","origin_provider":"main","chat_kind":"direct","event_kind":"message","require_mention":false,"device_id":"c0efaf97-f9be-4fb7-bb44-174b152ad9fc"}'
  presentation_locale: en-US
---
ONE-SHOT user-ordered free mint (2026-10-08: "Mint what you can, schedule all the mints that are free" + "Gas only"). Target: Zumi — contract 0x1a21164b5ada9146b3a60f699439ed06fc378185 on Robinhood Chain (4663). OpenSea: https://opensea.io/collection/zumi-981406327. WL FREE x1 stage opens 10:47 AM CDT Oct 10 (Foil's wallet requested WL eligibility on X Oct 8).

Steps:
1. Check Foil's wallet 0x6573682faee72a4a96e791ba262439f1df3a268d eligibility for the WL free stage via the OpenSea drops API (refresh SIWE with ~/workspace/nft-god/opensea-connect/siwe-login.mjs if the session is stale).
2. If not eligible or no free stage live: stay silent, log one line to ~/memory/2026-10-10.md, end.
3. If eligible and free: run the signed-presale claim via node ~/workspace/nft-god/fire-signed-presale.cjs zumi-981406327 1 (after the Tinfoil route gate passes — resolve the project's official X/site from radar or WL pipeline data).
4. Hard gates (fail-closed): mint price exactly 0, gas under $0.50, no approvals, clean simulation, Tinfoil CLEAN. NEVER touch X (account on rest until Fri 2026-10-09 18:45 CDT).
5. On success: report to the user in main chat (project, qty, tx hash, OpenSea link). Log to ~/memory/2026-10-10.md. NFTs stay in Foil's wallet.
6. On failure: log the reason to the daily log; stay silent in chat unless the claim pipeline itself is systematically broken.

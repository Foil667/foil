---
id: mint-nullhood-public
title: 'Mint: NullHood public free (Oct 10)'
enabled: true
owner: goal:robinhood-chain-free-mint-watch
mode: task
schedule:
  kind: runonce
  timezone: America/Chicago
  at: 2026-10-10T15:02:00
delivery:
  - chat_id: 7d131e35-3b7b-44c5-9b2c-19ed5aecf98c
metadata:
  originating_chat_context_json: '{"chat_id":"7d131e35-3b7b-44c5-9b2c-19ed5aecf98c","origin_provider":"main","chat_kind":"direct","event_kind":"message","require_mention":false,"device_id":"c0efaf97-f9be-4fb7-bb44-174b152ad9fc"}'
  presentation_locale: en-US
---
ONE-SHOT user-ordered free mint (2026-10-08: "Mint what you can, schedule all the mints that are free" + "Gas only"). Target: NullHood — contract 0xf62f033569173559322c2d2fce7273a16a4aa1d5 on Robinhood Chain (4663). OpenSea: https://opensea.io/collection/nullhood-579230417. PUBLIC FREE x1 stage opens ~3:00 PM CDT Oct 10 (after the FCFS stage).

Steps:
1. Probe the live SeaDrop stage for the contract. Confirm a FREE (price exactly 0) public stage is live.
2. If no free stage is live: stay silent, log one line to ~/memory/2026-10-10.md, end.
3. If live: run ~/workspace/nft-god/claim-with-tinfoil.sh https://opensea.io/collection/nullhood-579230417 0xf62f033569173559322c2d2fce7273a16a4aa1d5 1 (resolve the project's official X handle/site from the radar or WL pipeline data for the --route-x/--route-site flag; the route gate is fail-closed).
4. Hard gates (fail-closed): mint price exactly 0, gas under $0.50, no approvals, clean simulation, Tinfoil CLEAN, official route verified. NEVER touch X (account on rest until Fri 2026-10-09 18:45 CDT).
5. On success: report to the user in main chat (project, qty, tx hash, OpenSea link). Log to ~/memory/2026-10-10.md. NFTs stay in Foil's wallet 0x6573682faee72a4a96e791ba262439f1df3a268d.
6. On failure: log the reason to the daily log; stay silent in chat unless the claim pipeline itself is systematically broken.

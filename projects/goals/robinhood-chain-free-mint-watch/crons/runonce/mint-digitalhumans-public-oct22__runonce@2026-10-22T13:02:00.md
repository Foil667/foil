---
id: mint-digitalhumans-public-oct22
title: 'Mint: Digital Humans public free (Oct 22)'
enabled: true
owner: goal:robinhood-chain-free-mint-watch
mode: task
schedule:
  kind: runonce
  timezone: America/Chicago
  at: 2026-10-22T13:02:00
delivery:
  - chat_id: 7d131e35-3b7b-44c5-9b2c-19ed5aecf98c
metadata:
  originating_chat_context_json: '{"chat_id":"7d131e35-3b7b-44c5-9b2c-19ed5aecf98c","origin_provider":"main","chat_kind":"direct","event_kind":"message","require_mention":false}'
  presentation_locale: en-US
---
ONE-SHOT free mint under the standing free-mint order ("Mint what you can, schedule all the mints that are free" + "Gas only"; 2026-10-13 "Mint free mints, then list them for sale ~1 hour after minting"). Target: Digital Humans — contract 0xd6889961584a42dc5d8196bd82a4c6d0f2b684c5 on Robinhood Chain (4663). OpenSea: https://opensea.io/collection/digitalhumans. PUBLIC FREE x1 stage: onchain probe on 2026-10-14 showed start=1792692000 (2026-10-22 13:00 CDT), end=1792778400 (2026-10-23 13:00 CDT), price=0, maxW=1. Real builder: @igor_3000A.

Steps:
1. Probe the live SeaDrop stage for the contract. Confirm a FREE (price exactly 0) public stage is live.
2. If no free stage is live: stay silent, log one line to ~/memory/2026-10-22.md, end.
3. If live: run ~/workspace/nft-god/claim-with-tinfoil.sh https://opensea.io/collection/digitalhumans 0xd6889961584a42dc5d8196bd82a4c6d0f2b684c5 1 --route-x @igor_3000A (if that handle fails the route gate, resolve the project's official X/site from the radar or WL pipeline data and retry with the correct route; the route gate is fail-closed).
4. Hard gates (fail-closed): mint price exactly 0, gas under $0.50, no approvals, clean simulation, Tinfoil CLEAN, official route verified.
5. On success: report to the user in main chat (project, qty, tx hash, OpenSea link). Log to ~/memory/2026-10-22.md. NFTs stay in Foil's wallet 0x6573682faee72a4a96e791ba262439f1df3a268d.
6. On failure: log the reason to the daily log; stay silent in chat unless the claim pipeline itself is systematically broken.

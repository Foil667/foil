---
id: mint-oddlings-cats-public
title: 'Mint: Oddlings Cats public free x3 (Oct 14)'
enabled: true
owner: goal:robinhood-chain-free-mint-watch
mode: task
schedule:
  kind: runonce
  timezone: America/Chicago
  at: 2026-10-14T11:01:00
delivery:
  - chat_id: 7d131e35-3b7b-44c5-9b2c-19ed5aecf98c
metadata:
  originating_chat_context_json: '{"chat_id":"7d131e35-3b7b-44c5-9b2c-19ed5aecf98c","origin_provider":"main","chat_kind":"direct","event_kind":"message","require_mention":false}'
  presentation_locale: en-US
---
ONE-SHOT free mint under the standing free-mint order ("Mint what you can, schedule all the mints that are free" + "Gas only"; 2026-10-13 "Mint free mints, then list them for sale ~1 hour after minting"). Target: Oddlings Cats — contract 0xda6d7d3e7db3790c5d4d27f65f69277d500bd745 on Robinhood Chain (4663). OpenSea: https://opensea.io/collection/oddlings-cats. PUBLIC FREE x3 per wallet opens 11:00 AM CDT Oct 14; 800 supply. Project X: @OddlingsNFT_ (contract verified via OpenSea drops API by this morning's Mint Board; radar board post https://x.com/Foil667/status/2110383253941301599). Yesterday's sibling Oddlings (different contract) sold out within ~1 hour — window is short.

Steps:
1. Probe the live SeaDrop stage for the contract (getPublicDrop against the RH fork 0x00005ea00ac477b1030ce78506496e8c2de24bf5 — or the canonical drop if the fork returns not-configured; per AGENTS.md always check where real minters' txs land when a sim reverts). Confirm a FREE (price exactly 0) public stage is live with supply remaining.
2. If no free stage is live (paid, sold out, no stage): stay silent, log one line to ~/memory/2026-10-14.md, end.
3. If live: run ~/workspace/nft-god/claim-with-tinfoil.sh https://opensea.io/collection/oddlings-cats 0xda6d7d3e7db3790c5d4d27f65f69277d500bd745 3 --route-x @OddlingsNFT_ (if that handle fails the route gate, resolve the project's official X/site from the radar or WL pipeline data and retry with the correct route; the route gate is fail-closed).
4. Hard gates (fail-closed): mint price exactly 0, gas under $0.50, no approvals, clean simulation, Tinfoil CLEAN, official route verified.
5. On success: report to the user in main chat (project, qty, tx hash, OpenSea link). Log to ~/memory/2026-10-14.md. NFTs stay in Foil's wallet 0x6573682faee72a4a96e791ba262439f1df3a268d. The ~1h listing rule applies via the hourly foil-listing-sale-watch.
6. On failure: log the reason to the daily log; stay silent in chat unless the claim pipeline itself is systematically broken.

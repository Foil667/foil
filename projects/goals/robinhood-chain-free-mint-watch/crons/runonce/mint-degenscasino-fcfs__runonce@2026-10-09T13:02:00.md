---
id: mint-degenscasino-fcfs
title: 'Mint: DegensCasino FCFS free (Oct 9)'
enabled: true
owner: goal:robinhood-chain-free-mint-watch
mode: task
schedule:
  kind: runonce
  timezone: America/Chicago
  at: 2026-10-09T13:02:00
delivery:
  - chat_id: 7d131e35-3b7b-44c5-9b2c-19ed5aecf98c
metadata:
  originating_chat_context_json: '{"origin_provider":"main","chat_kind":"direct","event_kind":"message","require_mention":false}'
  presentation_locale: en-US
---
ONE-SHOT user-ordered free mint (2026-10-08: "Mint what you can, schedule all the mints that are free" + "Gas only"). Target: DegensCasino — contract 0x830127371a106c236f785c4742b71cf90570687c on Robinhood Chain (4663). OpenSea: https://opensea.io/collection/degenscasino. Site: https://degens.casino/. FCFS FREE x1 stage 1:00–2:00 PM CDT Oct 9 (radar-verified 2026-10-09 morning sweep; the public x1 stage opens 2:00 PM and is covered by mint-degenscasino-public at 14:02 — do not double-fire it).

Steps:
1. Probe the live SeaDrop stage for the contract. Confirm a FREE (price exactly 0) stage is live.
2. If no free stage is live: stay silent, log one line to ~/memory/2026-10-09.md, end.
3. If live: run ~/workspace/nft-god/claim-with-tinfoil.sh https://opensea.io/collection/degenscasino 0x830127371a106c236f785c4742b71cf90570687c 1 --route-x @DegensCasinoRH
4. Hard gates (fail-closed): mint price exactly 0, gas under $0.50, no approvals, clean simulation, Tinfoil CLEAN, official route verified. NEVER touch X (account on rest until Fri 2026-10-09 18:45 CDT).
5. On success: report to the user in main chat (project, qty, tx hash, OpenSea link). Log to ~/memory/2026-10-09.md. Write the claim record (lane, run id, tx hash, contract, qty, gas) to the pipeline JSON and mint-log.jsonl before finishing. NFTs stay in Foil's wallet 0x6573682faee72a4a96e791ba262439f1df3a268d.
6. On failure: log the reason to the daily log; stay silent in chat unless the claim pipeline itself is systematically broken.

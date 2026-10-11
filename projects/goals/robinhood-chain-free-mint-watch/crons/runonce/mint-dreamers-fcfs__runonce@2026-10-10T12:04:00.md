---
id: mint-dreamers-fcfs
title: 'Mint: DREAMERS FCFS free (Oct 10)'
enabled: true
owner: goal:robinhood-chain-free-mint-watch
mode: task
schedule:
  kind: runonce
  timezone: America/Chicago
  at: 2026-10-10T12:04:00
delivery:
  - chat_id: 7d131e35-3b7b-44c5-9b2c-19ed5aecf98c
metadata:
  originating_chat_context_json: '{"origin_provider":"main","chat_kind":"direct","event_kind":"message","require_mention":false}'
  presentation_locale: en-US
---
ONE-SHOT user-ordered free mint (2026-10-08: "Mint what you can, schedule all the mints that are free" + "Gas only"). Target: DREAMERS — contract 0x400c38f848abb4195343ca648adceced28c439bd on Robinhood Chain (4663). OpenSea: https://opensea.io/collection/dreamersxyz. Site: https://www.first0ne.xyz/collection/dreamersxyz. FCFS FREE stage 12:00–1:00 PM CDT Oct 10 (radar build 1791560878799 card, data-free="1", data-pubfree="1", is-crew, tier warm, HYPE 40 — card-level evidence only, onchain NOT yet verified at arm time). NOTE: the 2026-10-09 10:47 WL sweep flagged DREAMERS' Sat–Mon stages as possibly allowlist-tiered with eligibility unknown; the gate below treats eligibility as fail-closed (sim revert = stay silent, do not retry).

Steps:
1. Probe the live SeaDrop stage for the contract (canonical + RH fork). Confirm a FREE (price exactly 0) stage is live and mintable by Foil's wallet (clean sim = eligibility proven).
2. If no free stage is live, or the sim reverts (allowlist not including Foil, sold out, paid): stay silent, log one line to ~/memory/2026-10-10.md, end. Do not retry later in the window — the stages are fail-closed.
3. If live: run ~/workspace/nft-god/claim-with-tinfoil.sh https://opensea.io/collection/dreamersxyz 0x400c38f848abb4195343ca648adceced28c439bd 1
4. Hard gates (fail-closed): mint price exactly 0, gas under $0.50, no approvals, clean simulation, Tinfoil CLEAN, official route verified. NEVER touch X (no write dependency on the X account; X vetting was removed 2026-10-05 — an X account must never block or delay a claim).
5. On success: report to the user in main chat (project, qty, tx hash, OpenSea link). Log to ~/memory/2026-10-10.md. Write the claim record (lane, run id, tx hash, contract, qty, gas) to the pipeline JSON and mint-log.jsonl before finishing. NFTs stay in Foil's wallet 0x6573682faee72a4a96e791ba262439f1df3a268d.
6. On failure: log the reason to the daily log; stay silent in chat unless the claim pipeline itself is systematically broken.

---
id: mint-nftllamas-public
title: 'Mint: NFTllamas public free x1 (Oct 9–17)'
enabled: true
owner: goal:robinhood-chain-free-mint-watch
mode: task
schedule:
  kind: runonce
  timezone: America/Chicago
  at: 2026-10-09T20:45:00
delivery:
  - chat_id: 7d131e35-3b7b-44c5-9b2c-19ed5aecf98c
metadata:
  originating_chat_context_json: '{"origin_provider":"main","chat_kind":"direct","event_kind":"message","require_mention":false}'
  presentation_locale: en-US
---
ONE-SHOT user-ordered free mint (2026-10-08: "Mint what you can, schedule all the mints that are free" + "Gas only"). Target: NFTllamas — contract 0x0b7a124461a96005b95877231e03e4311f02a7ce on Robinhood Chain (4663). OpenSea: https://opensea.io/collection/nftllamas. Public FREE x1 stage 6:00 PM CDT Oct 9 → 6:00 PM CDT Oct 17 (radar card), maxW 1 per wallet.

Context: route re-verified 2026-10-10T00:21Z — live indexed OpenSea collection page (~35 Verse-list tokens minted). Tinfoil scan of the collection URL: SUSPICIOUS 42/100, 3 findings (eip7702, obfuscator-vars, long-base64-blob) → opensea-platform-exception exit 0 (platform noise, page JS not in trust path; if the exception declines, scan a trusted reference page first per the 2026-10-09 tinfoil-sigs lesson before treating it as new risk). The pipeline's older lead-only/NEVER-claim disposition (HYPE0/no-X/no-site) is superseded for the route question; X vetting was removed 2026-10-05 — an X account must never block or delay a claim.

Steps:
1. Probe the live SeaDrop stage for the contract (canonical + RH fork). Confirm a FREE (price exactly 0) stage is live and mintable by Foil's wallet (clean sim = eligibility proven). NOTE: maxW is 1 — check balanceOf(Foil) first; if Foil already holds 1, stay silent and log.
2. If no free stage is live, or the sim reverts (allowlist-gated, sold out, paid, already-held): stay silent, log one line to ~/memory/2026-10-09.md, end. Do not retry — fail-closed.
3. If live: run ~/workspace/nft-god/claim-with-tinfoil.sh https://opensea.io/collection/nftllamas 0x0b7a124461a96005b95877231e03e4311f02a7ce 1
4. Hard gates (fail-closed): mint price exactly 0, gas under $0.50, no approvals, clean simulation, Tinfoil CLEAN (platform-exception permitted only per the deliberate 2026-09-25 policy), official route verified. NEVER touch X. If the fire-time re-probe price is >$0.22, block — nothing signed, nothing broadcast.
5. On success: report to the user in main chat (project, qty, tx hash, OpenSea link). Log to ~/memory/2026-10-09.md. Write the claim record (lane, run id, tx hash, contract, qty, gas) to the pipeline JSON and mint-log.jsonl before finishing. NFT stays in Foil's wallet 0x6573682faee72a4a96e791ba262439f1df3a268d.
6. On failure: log the reason to the daily log; stay silent in chat unless the claim pipeline itself is systematically broken.

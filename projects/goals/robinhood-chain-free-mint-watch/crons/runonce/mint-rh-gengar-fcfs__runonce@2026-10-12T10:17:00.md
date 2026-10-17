---
id: mint-rh-gengar-fcfs
title: 'Mint: RH-GENGAR free FCFS window (Oct 12)'
enabled: true
owner: goal:robinhood-chain-free-mint-watch
mode: task
schedule:
  kind: runonce
  timezone: America/Chicago
  at: 2026-10-12T10:17:00
delivery:
  - chat_id: 7d131e35-3b7b-44c5-9b2c-19ed5aecf98c
metadata:
  originating_chat_context_json: '{"chat_id":"7d131e35-3b7b-44c5-9b2c-19ed5aecf98c","origin_provider":"main","chat_kind":"direct","event_kind":"message","require_mention":false,"device_id":"c0efaf97-f9be-4fb7-bb44-174b152ad9fc"}'
  presentation_locale: en-US
---
ONE-SHOT user-ordered free mint (2026-10-12, user in main chat: "Arm Pigeon Crew and RH-GENGAR too"). Target: RH-GENGAR — contract 0xb975776eac37d54f98eb265f5f0c1093eabc9cc8 on Robinhood Chain (4663), supply 777. OpenSea: https://opensea.io/collection/rh-gengar.

Verified 2026-10-12 ~09:55 CDT: radar advertises a FREE window ~15:20:35–15:25:35 UTC (10:20–10:25 AM CDT), price=0. BUT the onchain PUBLIC drop on both the canonical SeaDrop and the RH fork is PAID: price=0.0004 ETH, start=1791819935 (15:45:35 UTC / 10:45 AM CDT), maxPerWallet=10, allowRoot=0x0. totalSupply=0, Foil balanceOf=0. The free window, if real, is a separate stage config not visible via getPublicDrop. THE PAID PUBLIC STAGE IS NOT AUTHORIZED — paid mints stay closed without the user's explicit per-mint approval.

Steps:
1. At fire time, re-probe the live config on BOTH SeaDrops (probe-raw.mjs pattern, correct 6-word decode) AND check the OpenSea collection page's live stage data for a price-exactly-0 stage (WL/FCFS) that Foil is eligible for.
2. If a FREE (price exactly 0) stage is live and Foil holds 0: run ~/workspace/nft-god/claim-with-tinfoil.sh https://opensea.io/collection/rh-gengar 0xb975776eac37d54f98eb265f5f0c1093eabc9cc8 1
3. Hard gates (fail-closed): mint price exactly 0 — if the only live stage is the 0.0004 ETH public stage, DO NOT FIRE. Gas under $0.50, no approvals, clean simulation, Tinfoil CLEAN (the documented OpenSea platform-noise exception applies to opensea.io URLs exactly as coded in the wrapper — never bypass a non-platform finding), official route verified.
4. On success: report to the user in main chat (project, qty, tx hash, OpenSea link). Log to ~/memory/2026-10-12.md. The NFT stays in Foil's wallet 0x6573682faee72a4a96e791ba262439f1df3a268d — never forward/list/sell.
5. If no free stage verifies: report to the user in main chat in one line — the advertised free stage did not verify onchain and the live public stage is 0.0004 ETH paid, so nothing was minted; his call whether to approve the paid stage. Log the outcome to ~/memory/2026-10-12.md.

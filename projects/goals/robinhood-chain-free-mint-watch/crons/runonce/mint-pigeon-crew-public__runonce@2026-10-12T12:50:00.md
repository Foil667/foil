---
id: mint-pigeon-crew-public
title: 'Mint: Pigeon Crew public free (Oct 12)'
enabled: true
owner: goal:robinhood-chain-free-mint-watch
mode: task
schedule:
  kind: runonce
  timezone: America/Chicago
  at: 2026-10-12T12:50:00
delivery:
  - chat_id: 7d131e35-3b7b-44c5-9b2c-19ed5aecf98c
metadata:
  originating_chat_context_json: '{"chat_id":"7d131e35-3b7b-44c5-9b2c-19ed5aecf98c","origin_provider":"main","chat_kind":"direct","event_kind":"message","require_mention":false,"device_id":"c0efaf97-f9be-4fb7-bb44-174b152ad9fc"}'
  presentation_locale: en-US
---
ONE-SHOT user-ordered free mint (2026-10-12, user in main chat: "Arm Pigeon Crew and RH-GENGAR too"). Target: Pigeon Crew — contract 0x20171949114466d3227ca6de81274da3cdffa590 on Robinhood Chain (4663). OpenSea: https://opensea.io/collection/pigeoncrew-nft. Project: @pigeoncrew_nft, https://pigeoncrew.xyz/ (site was Netlify-paused the morning of Oct 12 — irrelevant, the claim route is SeaDrop via OpenSea).

Verified 2026-10-12 ~09:55 CDT (onchain probe, canonical SeaDrop AND RH fork return identical config): public drop price=0, start=1791828000 (Mon Oct 12 18:00 UTC / 1:00 PM CDT), end=1791914400 (Oct 13 18:00 UTC), maxPerWallet=1, allowRoot=0x0 (public, no allowlist), feeBps=1000, restrict=1. totalSupply=0 and Foil balanceOf=0 at probe time. Foil RH ETH ~0.00113 (plenty for gas).

Steps:
1. Re-probe the live SeaDrop config for the contract on BOTH the canonical SeaDrop and the RH fork (probe-raw.mjs pattern, correct 6-word decode). Confirm the FREE (price exactly 0) public stage is live and Foil still holds 0.
2. If no free stage is live or supply is exhausted: stay silent, log one line to ~/memory/2026-10-12.md, end.
3. If live: run ~/workspace/nft-god/claim-with-tinfoil.sh https://opensea.io/collection/pigeoncrew-nft 0x20171949114466d3227ca6de81274da3cdffa590 1 --route-x @pigeoncrew_nft --route-site https://pigeoncrew.xyz/
4. Hard gates (fail-closed): mint price exactly 0, gas under $0.50, no approvals, clean simulation, Tinfoil CLEAN (the documented OpenSea platform-noise exception applies to opensea.io URLs exactly as coded in the wrapper — never bypass a non-platform finding), official route verified.
5. On success: report to the user in main chat (project, qty, tx hash, OpenSea link). Log to ~/memory/2026-10-12.md. The NFT stays in Foil's wallet 0x6573682faee72a4a96e791ba262439f1df3a268d — never forward/list/sell.
6. On failure: log the reason to the daily log; stay silent in chat unless the claim pipeline itself is systematically broken.

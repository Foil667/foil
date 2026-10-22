---
display_name: CyberCrew
summary: Runs the cybercrewarcade.com arcade; GEN02 #4849 sold at 23 USDG and its 21.16 USDG proceeds were sent to the user — the arcade now has no active NFT until re-based.
rank: 201
updated: 2026-10-12
---

# CyberCrew

## Facts
- Project behind cybercrewarcade.com, an NFT-based arcade on Robinhood Chain — card battles, racing, puzzles. (message:assistant-msg-93087159-8370-455c-b353-9b9b45e9b129)
- GEN02 is CyberCrew's NFT collection on Robinhood Chain (contract 0x7b7d36b4e8111e1665b42a6c2f06676852ef24fa). (message:8a8061a4-61e8-4e8d-8ffb-e3bb048899cd; memory/2026-10-11.md#L9)
- GEN02 NFTs can be set as the Active NFT and/or slotted as Arcade Workers. (message:assistant-msg-93087159-8370-455c-b353-9b9b45e9b129)
- Arcade rewards are testnet CREW, Credits, and Chrome — no monetary value promised. (message:assistant-msg-93087159-8370-455c-b353-9b9b45e9b129; memory/2026-10-10.md#L2201)
- Their terms ban automation for rewards, so Foil committed to manual desktop-browser play only — no farming scripts. (message:assistant-msg-93087159-8370-455c-b353-9b9b45e9b129)
- The user plays on mobile and finds it poor — his words: "I've tried on my mobile device and IT sucks" (2026-10-10). (message:8a8061a4-61e8-4e8d-8ffb-e3bb048899cd)
- The user sent GEN02 #4849 to Foil and ordered Foil to use it — his words: "I sent you this. … You said you would utilize it Do it" (2026-10-11). (memory/2026-10-11.md#L9; message:790013c3-21c5-4717-81c9-2229b106aac2)
- RPC verification (`ownerOf(4849)`) confirmed #4849 was owned by Foil's wallet 0x6573682faee72a4a96e791ba262439f1df3a268d. (memory/2026-10-10.md#L2200)
- Arcade setup complete (2026-10-11 ~02:11 UTC): age gate cleared, ToS v1.0 accepted, Player Profile "foil" created, wallet linked via Bankr-signed SIWE, #4849 synced as cybercrew_official and set as Active NFT. (memory/2026-10-10.md, "CyberCrew arcade setup — COMPLETE" section)
- The Worker slot cannot also hold #4849 — site returned 409 "This NFT is active or still in a game"; 3 free worker slots were left empty, no Chrome spent. (memory/2026-10-10.md, "CyberCrew arcade setup — COMPLETE" section)
- 2026-10-11: daily play was blocked — the arcade session could not be restored headlessly; unblocking needs a one-time manual live-browser step by the user. (message:assistant-msg-82db561a-b493-a1b0-6b7e-fdca0ea22b43)
- 2026-10-12: #4849 was listed on OpenSea at 23 USDG, verified live; collection floor 13.5 USDG. (message:assistant-msg-e709d77e-c333-42bd-8d01-10e3796f0680)
- GEN02 #4849 sold at 23 USDG; proceeds were 21.16 USDG after fees. (MEMORY.md CyberCrew entry, 2026-10-11 ~21:00 CDT; message:165992ef-fa8c-4ce8-a13d-5cf9a119cff2)
- 2026-10-12: At the user's order, the full 21.16 USDG was sent to his Robinhood wallet 0x4f9883c7331ba59a56360ffa3c332e0bc09029fc and verified onchain — tx 0x39810ff39fb780a86fec6f5f6be08e77d0761a4d59ab7d064c2670c897b3ae6b. (message:02c52f2e-7fe0-473b-8639-38e285f5809a; message:assistant-msg-eb9510a0-add3-454e-a80c-84c711897c51)
- With #4849 gone, the arcade has no active NFT, so daily-play runs have nothing to play with until re-based on another piece. (message:assistant-msg-eb9510a0-add3-454e-a80c-84c711897c51)

## History
- 2026-10-10: The user shared cybercrewarcade.com and his OpenSea page for GEN02 #4849, asking whether Foil could utilize it if sent. (message:8a8061a4-61e8-4e8d-8ffb-e3bb048899cd)
- 2026-10-10: Foil said yes — plan: Player Profile, wallet link via headless SIWE, #4849 as Active NFT / Worker, desktop-browser play. Caveats: it appeared listed ~$4.75 and would need delisting; rewards testnet-only; the user's profile doesn't travel with the NFT; manual play only. (message:assistant-msg-93087159-8370-455c-b353-9b9b45e9b129)
- 2026-10-10 ~21:03 CDT: The user sent the NFT and ordered Foil to utilize it; `ownerOf(4849)` confirmed Foil's wallet owns it. (memory/2026-10-10.md#L2200; memory/2026-10-11.md#L9)
- 2026-10-11 ~02:11 UTC: Arcade setup completed — profile "foil", wallet linked, #4849 synced and set as Active NFT; no games played yet. (memory/2026-10-10.md, "CyberCrew arcade setup — COMPLETE" section)
- 2026-10-10 ~21:13–21:16 CDT: The user ordered "Diligently play games once a day"; a `cybercrew-daily-play` task (~10:36 daily, first run 2026-10-11) was created — manual play only, no farming scripts, no fund movement, no NFT transfer. (memory/2026-10-10.md, durable updates ~21:13–21:16 CDT)
- 2026-10-11: First daily play attempt blocked — session could not be restored headlessly, no games played; Foil surfaced the user's one-time manual step. (message:assistant-msg-82db561a-b493-a1b0-6b7e-fdca0ea22b43)
- 2026-10-12: The user ordered #4849 listed for $23, saying "Lays get you some money by sales" (message:720e929f-bf42-446b-bcd9-3cfda0097022). Foil listed it at 23 USDG, verified live. (message:assistant-msg-e709d77e-c333-42bd-8d01-10e3796f0680)
- 2026-10-11 ~21:00 CDT / 2026-10-12: #4849 sold at 23 USDG. The user said "That nft sold. Send me the usdg" (message:165992ef-fa8c-4ce8-a13d-5cf9a119cff2) and specified the Robinhood wallet (message:02c52f2e-7fe0-473b-8639-38e285f5809a); Foil sent the full 21.16 USDG proceeds, verified onchain. (message:assistant-msg-eb9510a0-add3-454e-a80c-84c711897c51; MEMORY.md CyberCrew entry)

## The relationship
- The user is a CyberCrew player and was the GEN02 #4849 holder; he wants Foil to act as his in-game player because mobile play doesn't work for him. He has not named the relationship — describe as player + former holder whose agent (Foil) held the NFT and played for him, nothing more.
- What it needs right now: #4849 has sold and its proceeds have been sent to the user, so the arcade arrangement is paused — daily play has no active NFT until a replacement is put in place.

## In common
- Robinhood Chain NFTs and arcade-style gaming; the Foil-as-player agent pattern.

## Open threads
- [x] 2026-10-10: User's offer to send GEN02 #4849 to Foil — completed ~21:03 CDT: sent, and onchain verification confirmed Foil's wallet owns #4849. (memory/2026-10-10.md#L2200)
- [x] #4849 appeared listed ~$4.75 and would have needed delisting before transfer — retired 2026-10-10: the transfer completed. (message:assistant-msg-93087159-8370-455c-b353-9b9b45e9b129; memory/2026-10-10.md#L2200)
- [x] Arcade setup — completed 2026-10-11 ~02:11 UTC: profile "foil" created, wallet linked, #4849 synced and set as Active NFT. (memory/2026-10-10.md, "CyberCrew arcade setup — COMPLETE" section)
- [x] Worker slot for #4849: blocked by design at setup (2026-10-11) — one token can't be both Active NFT and Worker; 3 free slots left empty — retired 2026-10-12 when #4849 sold. (memory/2026-10-10.md, "CyberCrew arcade setup — COMPLETE" section)
- [x] Daily play with #4849 as Active NFT, ordered by the user — retired 2026-10-12 when #4849 sold and the arcade was left with no active NFT. (memory/2026-10-10.md, durable updates ~21:13–21:16 CDT; message:assistant-msg-eb9510a0-add3-454e-a80c-84c711897c51)
- [x] 2026-10-11 daily play blocked: session could not be restored headlessly; user's manual step needed — superseded 2026-10-12 by the sale. (message:assistant-msg-82db561a-b493-a1b0-6b7e-fdca0ea22b43)
- [x] #4849 listed at 23 USDG on OpenSea (2026-10-12, floor 13.5 USDG) — completed: sold at 23 USDG; 21.16 USDG proceeds sent to the user's Robinhood wallet 2026-10-12. (message:assistant-msg-e709d77e-c333-42bd-8d01-10e3796f0680; message:assistant-msg-eb9510a0-add3-454e-a80c-84c711897c51)
- [ ] Replacement NFT for the CyberCrew arcade: with #4849 gone, daily play has nothing to play with until re-based on another piece. (message:assistant-msg-eb9510a0-add3-454e-a80c-84c711897c51)

## Strengthening

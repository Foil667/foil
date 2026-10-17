---
display_name: CyberCrew
summary: Runs the cybercrewarcade.com NFT arcade game; the user sent GEN02 #4849 to Foil (onchain-confirmed), setup is complete with #4849 as Active NFT, and daily manual play is ordered.
---

# CyberCrew

## Facts
- The project behind cybercrewarcade.com, an NFT-based arcade game on Robinhood Chain — card battles, racing, puzzles. (message:assistant-msg-93087159-8370-455c-b353-9b9b45e9b129)
- GEN02 is CyberCrew's own NFT collection on Robinhood Chain (contract 0x7b7d36b4e8111e1665b42a6c2f06676852ef24fa — from the user's OpenSea link). (message:8a8061a4-61e8-4e8d-8ffb-e3bb048899cd; memory/2026-10-11.md#L9)
- GEN02 NFTs can be set as the Active NFT and/or slotted as Arcade Workers in their game. (message:assistant-msg-93087159-8370-455c-b353-9b9b45e9b129)
- Arcade rewards are currently testnet CREW, Credits, and Chrome — explicitly no monetary value promised. (message:assistant-msg-93087159-8370-455c-b353-9b9b45e9b129; memory/2026-10-10.md#L2201)
- Their terms ban automation for rewards, so Foil committed to playing manually through the desktop browser only — no farming scripts. (message:assistant-msg-93087159-8370-455c-b353-9b9b45e9b129)
- The user plays the arcade on his mobile device and finds the experience poor — his words: "I've tried on my mobile device and IT sucks" (2026-10-10). (message:8a8061a4-61e8-4e8d-8ffb-e3bb048899cd)
- The user sent GEN02 #4849 to Foil and ordered Foil to use it in the arcade — his words: "I sent you this. … You said you would utilize it Do it" (2026-10-11). (memory/2026-10-11.md#L9, claim 63513b777599f938d72d255df45d12b9; message:790013c3-21c5-4717-81c9-2229b106aac2)
- Direct Robinhood Chain RPC verification (`ownerOf(4849)`) confirmed GEN02 #4849 is owned by Foil's wallet 0x6573682faee72a4a96e791ba262439f1df3a268d; the asset must remain in Foil's wallet under the standing no-transfer rule. (memory/2026-10-10.md#L2200)
- Arcade setup is complete (2026-10-11 ~02:11 UTC): age gate cleared, Arcade ToS v1.0 accepted, Player Profile created with username "foil", wallet sign-in completed via Bankr-signed SIWE, NFT sync recognized #4849 as cybercrew_official, and #4849 was set as the Active NFT. (memory/2026-10-10.md, "CyberCrew arcade setup — COMPLETE" section)
- The Worker slot cannot also hold #4849 — the site returned 409 "This NFT is active or still in a game"; one token can't be both Active NFT and Worker. Three free worker slots exist and were left empty; no Chrome was spent on unlocks. Active NFT is the primary role. (memory/2026-10-10.md, "CyberCrew arcade setup — COMPLETE" section)

## History
- 2026-10-10: The user shared cybercrewarcade.com and his OpenSea item page for GEN02 #4849, asking whether Foil could utilize the NFT if sent to Foil's wallet. (message:8a8061a4-61e8-4e8d-8ffb-e3bb048899cd)
- 2026-10-10: Foil said yes — plan: create a Player Profile for Foil, link Foil's wallet via the headless SIWE pattern, set #4849 as Active NFT / Worker, and play via desktop browser. Caveats laid out: the NFT appeared listed around $4.75 and would need delisting first; rewards are testnet-only; the user's Player Profile doesn't travel with the NFT; the NFT stays in Foil's wallet until the user explicitly asks for it back; manual play only. (message:assistant-msg-93087159-8370-455c-b353-9b9b45e9b129)
- 2026-10-10 ~21:03 CDT: The user said he had sent the NFT and ordered Foil to utilize it; onchain `ownerOf(4849)` verification confirmed #4849 is in Foil's wallet. (memory/2026-10-10.md#L2200; memory/2026-10-11.md#L9)
- 2026-10-11 ~02:11 UTC: Arcade setup completed — profile "foil" created, wallet linked, #4849 synced and set as Active NFT; no games had been played yet at setup time. (memory/2026-10-10.md, "CyberCrew arcade setup — COMPLETE" section)
- 2026-10-10 ~21:13–21:16 CDT: After setup, the user ordered "Diligently play games once a day"; a `cybercrew-daily-play` recurring task (~10:36 daily, first run 2026-10-11) and a tracked daily-play habit were created — genuine human-style browser play with #4849 as Active NFT, no farming scripts, no fund movement, no NFT transfer. (memory/2026-10-10.md, durable updates ~21:13–21:16 CDT)

## The relationship
- The user is a CyberCrew player and was the GEN02 #4849 holder; he wants Foil to act as his in-game player because mobile play doesn't work for him. He has not named the relationship — describe as player + former holder whose agent (Foil) now holds the NFT and plays for him, nothing more.
- What it needs right now: the daily manual play the user ordered, with #4849 kept as Active NFT in Foil's wallet and never transferred without his explicit per-item instruction.

## In common
- Robinhood Chain NFTs and arcade-style gaming; the Foil-as-player agent pattern.

## Open threads
- [x] 2026-10-10: User's offer to send GEN02 #4849 to Foil's wallet — completed 2026-10-10 ~21:03 CDT: the user sent it, said "Do it", and onchain verification confirmed Foil's wallet owns #4849. (memory/2026-10-10.md#L2200)
- [x] GEN02 #4849 appeared to be listed ~$4.75 and would have needed delisting before transfer — retired 2026-10-10: the transfer completed, so the obstacle no longer applies. (message:assistant-msg-93087159-8370-455c-b353-9b9b45e9b129; memory/2026-10-10.md#L2200)
- [x] Arcade setup — completed 2026-10-11 ~02:11 UTC: Player Profile "foil" created, wallet linked, #4849 synced and set as Active NFT. (memory/2026-10-10.md, "CyberCrew arcade setup — COMPLETE" section)
- [ ] Worker slot for #4849: blocked by design as of setup (2026-10-11) — one token can't be both Active NFT and Worker; the 3 free worker slots were left empty and no Chrome was spent. (memory/2026-10-10.md, "CyberCrew arcade setup — COMPLETE" section)
- [ ] Daily play: the user ordered Foil to "diligently play games once a day" — `cybercrew-daily-play` runs ~10:36 daily from 2026-10-11, manual play only with #4849 as Active NFT. (memory/2026-10-10.md, durable updates ~21:13–21:16 CDT)

## Strengthening

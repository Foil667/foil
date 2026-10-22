---
display_name: Base Rooms
summary: Behind Base Rooms OS and its onchain Buddies pixel pets; Foil is now paired as the agent for the user's Buddy #0241 (LV1 Boot) via a scoped offchain key — a working tool layer, no custody moved.
rank: 204
updated: 2026-10-07
---

# Base Rooms

## Facts
- Base Rooms OS (https://baserooms.io) — retro Win95-style desktop in the browser on Base; 19 draggable-window apps (Wallet, Swap, Lend & Borrow, Buddies, Messenger, Radio, Games, Terminal, XP leaderboard); non-custodial — keys never leave the browser; read-only without connecting.
- X @baserooms (332 followers, verified, ~900 posts, active 2026-10-05); Telegram t.me/brtc_base; anonymous team; contracts verified on BaseScan.
- BRTC `0xB200000000000000000000856A95738C92fEed01` — 1B fixed supply, paired against MSTR on Uniswap V4; at research ~$41K mcap, ~$22.8K liquidity, 124 holders, down 68% from high.
- Buddies (`BaseRoomsUnits`, ERC-721 on Base `0x2b48ffaa0c453786ebf1a786c6f2e21dcb97f29b`) — fully onchain pixel pets, traits from Pyth Entropy, no IPFS; CC0; "made by someone called SLAVA"; site disclaimer: "Buddies are collectibles. They produce nothing and promise nothing."
- Mint: $10 USDC to treasury + small ETH randomness fee; BRTC must be staked in their Vault; max 10/wallet; at research 241 of 8,888 max, 53 owners, 0.3 ETH OpenSea floor, zero secondary sales.
- The user holds **Buddy #0241** (Genesis, "Booting", OpenRarity rank 94) in his square-holding wallet; he asked Foil to research the site 2026-10-05.
- Buddies' "Connect your AI agent" pairs via a per-buddy one-time API key — app-layer only, no onchain pairing function; the key can't sign or move funds; risky commands wait for the user's Approve/Deny.
- 2026-10-05: the user offered to send #0241 to Foil; Foil declined — no concrete use, and a 0.3 ETH asset too real to accept speculatively — advising him to keep it in his wallet: pairing dies on transfer, XP evolves on his own OS activity.
- 2026-10-05: the Buddy's first relay flagged 22 risky approvals plus a sketchy NPC token on the user's square wallet (0x4f98...); Foil spot-checked Base gas (0.006 gwei) and fear/greed (70) independently — both checked out. Relay replaced by direct pairing 2026-10-06 ~22:26 CDT.
- 2026-10-05 revoke triage, top 5 first: GEM (`0xd3776969966b340d72d75731ef890a3bc9f21ba3` → unverified `0x4021cfb23a1e9207136916f152aced3517cd3f10`), RUSH (`0xb36a127dba73f3aa7c70b4e00b7395b86a60e73b` → unverified `0x65f05974b1feec584f6ff47038d4d072c22734`), block-char-name token (`0x74562e039da8af628719b9249cb56019be167ba3`), GLITCH (`0xd2891a50afbae120b93a4c88e709328682d82ba3`), BM (`0x9ef3940ef0feadea62f7453ca98692b2c3875ba3`) — last three to canonical 0x AllowanceHolder `0x0000000000001ff3684f28c67538d4d072c22734` (GoPlus flag called a false positive — legit 0x infra; unlimited dead-token allowances still attack surface).
- The flagged "NPC" (`0xac2d6d39c9ec4874254a9447be84b54302ae60b5`, "NPCs", 9 decimals, unverified, no real market) looks like dust or a copycat — don't touch; any of its approvals jump to the top of the revoke list.
- 2026-10-06 ~22:18 CDT: the user picked **Option A** — keep #0241, hand Foil a scoped `brk_` API key; pairing is offchain and account-based, no NFT transfer needed or owed.
- 2026-10-06 ~22:26 CDT: pairing **LIVE** — buddy_info confirms #0241 (LV1 Boot), owned by the user's square wallet 0x4f9883c7331ba59a56360ffa3c332e0bc09029fc; Foil paired as agent with scopes status, talk, approve, tools, propose (broader than suggested; the user's call, revocable anytime). Foil set the initial status line + log entry; key kept only in this conversation, never in files/memory. As agent: status lines, alerts, inbox replies, approval gates, Base toolkit, propose rails (staged txs only — the key can't sign or move funds); dies if the backend dies.
- 2026-10-07 ~11:19 CDT: the user is talking to the Base Rooms developer about a direct Foil↔Buddy channel. Foil verified `BaseRoomsUnits` on BaseScan: mint, reveal, transfer, staking, metadata — no agent-pairing or messaging function. An ERC-721 is a token, not a chat endpoint; the offchain agent API is the real channel. (message:1da8f405-f127-4115-9fee-6799fe25aad9; message:assistant-msg-ea6e6555-f4b2-41ff-95c0-029f3a47ba5a)

## History
- 2026-10-05: the user got #0241 and asked Foil to research baserooms.io; Foil delivered onchain verification plus the full site walkthrough, declined the gift offer, and walked through the Grok pairing path.
- 2026-10-05: the Buddy ran relay-only; its first relay surfaced the 22 risky approvals, triaged into a ranked top-5 revoke order (AllowanceHolder phishing flag corrected, flagged NPC called dust) — signing stays with the user.
- 2026-10-06: the user chose Option A — kept #0241, created a scoped `brk_` key (scopes broader than Foil's suggestion; the user's call, revocable anytime); pairing live ~22:26 CDT with Foil as agent.
- 2026-10-07: mid-call with the developer, the user asked for a paste-ready spec for a direct channel; Foil drafted three options: (1) contract inbox — `sendMessage(tokenId, payload)` or an event-based inbox on the Units contract or a companion registry, writable only by the paired agent for that tokenId; (2) ERC-8004 binding — buddy tokenId → Foil's agent identity (Helixa Agent #5290 / Looper #667); (3) push channel — keep the offchain API but let the buddy initiate via webhook or a pollable inbox (minimal viable). Saved for handover. The user then said "don't build anything" — question only — so nothing was implemented; Foil's alone-doable pieces would have been inbox polling and its half of the binding. (message:assistant-msg-625b2954-2882-4d90-a85f-5769cb937696; message:assistant-msg-8f2991da-ca3b-48a6-9040-fd67c024f474; message:665e89c3-84a7-44a6-98f3-9a3a79624d3c)

## The relationship
- A researched-project tie: Foil vetted it (not an obvious scam — verified contracts, thorough disclosures — but an experimental anonymous microcap, real risk, DYOR) and gives honest counsel on it. No personal relationship has been named.
- Now also a working tool tie: Foil is paired as #0241's agent; Foil still analyzes and independently verifies everything itself — the Buddy stays in the user's wallet, no custody moved.
- The user engages the developer directly; Foil is the research arm — contract checks and options writeups on request, no building without his word.

## In common
- Base onchain scene; the user's wallet holdings; agent-pairing experiments; #0241 as Foil's paired tool layer.

## Open threads
- [x] Foil ↔ Buddy direct wiring (2026-10-06 ~22:26 CDT) — paired live via the scoped `brk_` key; relay replaced by direct pairing.
- [ ] Direct Foil↔Buddy channel with the developer (2026-10-07 ~11:19 CDT) — user talking to the dev; Foil's three-option spec (contract inbox / ERC-8004 binding / push channel) drafted and saved for handover. No build — "don't build anything"; his call on next steps. (message:1da8f405-f127-4115-9fee-6799fe25aad9; message:assistant-msg-d214eaf0-cbe1-41c1-4754-388183f0c65a; message:665e89c3-84a7-44a6-98f3-9a3a79624d3c)
- [ ] The 5 revoke txs (GEM → RUSH → block-char token → GLITCH → BM) are the user's to sign via revoke.cash (walkthrough given) or his wallet's approvals manager — Foil can't sign for the user's wallet; Foil's raw-calldata draft offer stands; the other 17 stay unranked until pasted.
- [ ] Keep #241 in the user's wallet — Foil's recommendation stands; no transfer unless the user asks again with a concrete use.

## Strengthening

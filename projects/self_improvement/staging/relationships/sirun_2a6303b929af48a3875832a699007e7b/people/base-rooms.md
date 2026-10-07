---
display_name: Base Rooms
summary: Behind Base Rooms OS and its onchain Buddies pixel pets; Foil is now paired as the agent for the user's Buddy #0241 (LV1 Boot) via a scoped offchain key — a working tool layer, no custody moved.
---

# Base Rooms

## Facts
- Base Rooms OS (https://baserooms.io) — retro Win95-style desktop in the browser on Base; 19 draggable-window apps (Wallet, Swap, Lend & Borrow, Buddies, Messenger, Radio, Games, Terminal, XP leaderboard). Non-custodial — keys never leave the browser; read-only without connecting. (message:assistant-msg-2f721920-b56d-5436-8b3d-c727fd26f174)
- X @baserooms (332 followers, verified, ~900 posts, active 2026-10-05); Telegram t.me/brtc_base. Anonymous team; contracts verified on BaseScan. (message:assistant-msg-2f721920-b56d-5436-8b3d-c727fd26f174)
- BRTC token `0xB200000000000000000000856A95738C92fEed01` — 1B fixed supply, paired against MSTR on Uniswap V4; ~$41K mcap, ~$22.8K liquidity, 124 holders, down 68% from high at research time. (message:assistant-msg-2f721920-b56d-5436-8b3d-c727fd26f174)
- Buddies (`BaseRoomsUnits`, ERC-721 on Base `0x2b48ffaa0c453786ebf1a786c6f2e21dcb97f29b`) — fully onchain pixel pets, traits from Pyth Entropy, no IPFS; CC0; "made by someone called SLAVA". Site disclaimer: "Buddies are collectibles. They produce nothing and promise nothing." (message:assistant-msg-fe721920-b56d-5436-8b3d-c727fd26f174)
- Mint: $10 USDC to treasury + small ETH randomness fee; BRTC must be staked in their Vault; max 10/wallet. At research: 241 of 8,888 max, 53 owners, 0.3 ETH OpenSea floor, zero secondary sales. (message:assistant-msg-fe721920-b56d-5436-8b3d-c727fd26f174)
- The user holds **Buddy #0241** (Genesis, "Booting", OpenRarity rank 94) in his square-holding wallet; he asked Foil to research the site 2026-10-05. (message:953aa2d8-61db-408c-b146-18c0c50522f1; message:35d4ae71-8f29-4ae7-a364-32118d1a4d09)
- Buddies "Connect your AI agent" pairs an agent via a per-buddy one-time API key — app-layer only, no onchain pairing function. Key can't sign or move funds; risky commands wait for user Approve/Deny. (message:assistant-msg-ae90d8cc-ca40-446b-adc3-4c869cf31d65)
- The user offered to send Buddy #0241 to Foil; Foil declined 2026-10-05 — no concrete use, and a 0.3 ETH asset is too real to accept speculatively. Foil advised keeping it in the user's wallet: pairing dies on transfer, XP evolves on his own OS activity. (message:018b6ea6-632c-4487-99af-2926904d0db0; message:assistant-msg-4a8fb628-5910-d09c-1771-c581da3c9d8e)
- 2026-10-05: the Buddy's first relay flagged 22 risky approvals plus a sketchy NPC token on the user's square wallet (0x4f98...); Foil spot-checked Base gas (0.006 gwei) and fear/greed (70) independently — both checked out. Relay replaced by direct pairing 2026-10-06 ~22:26 CDT. (message:10bde7d0-5a3e-4d62-af8e-ed1516942cef; message:assistant-msg-ea6e561b-1185-4927-b500-2bded85a69a5)
- 2026-10-05 triage — top 5 revoke-first: GEM (`0xd3776969966b340d72d75731ef890a3bc9f21ba3` → unverified `0x4021cfb23a1e9207136916f152aced3517cd3f10`), RUSH (`0xb36a127dba73f3aa7c70b4e00b7395b86a60e73b` → unverified `0x65f05974b1feec584f6ff47038d4d072c22734`), block-char-name token (`0x74562e039da8af628719b9249cb56019be167ba3`), GLITCH (`0xd2891a50afbae120b93a4c88e709328682d82ba3`), BM (`0x9ef3940ef0feadea62f7453ca98692b2c3875ba3`) — last three to canonical 0x AllowanceHolder `0x0000000000001ff3684f28c67538d4d072c22734`, whose GoPlus "phishing" flag Foil called a false positive (legit 0x infra; unlimited dead-token allowances still attack surface). Other 17 approvals unranked until the user pastes them. (message:assistant-msg-1a5f2193-c466-43f8-989b-95a5decba08c)
- The flagged "NPC" (`0xac2d6d39c9ec4874254a9447be84b54302ae60b5`, "NPCs", 9 decimals, unverified, no real market) looks like dust or a copycat — don't touch; any of its approvals jump to the top of the revoke list. (message:assistant-msg-1a5f2193-c466-43f8-989b-95a5decba08c)
- Revokes are `approve(spender, 0)` txs signed only by the user's keys — Foil can't sign for the user's wallet. Foil gave the revoke.cash walkthrough and offered to draft raw calldata for all five. (message:345673ba-8c0f-41ce-b999-fab00d3fcc42; message:assistant-msg-1a5f2193-c466-43f8-989b-95a5decba08c)
- 2026-10-06 ~22:18 CDT: the user picked **Option A** — keep Buddy #0241, hand Foil a scoped `brk_` API key. Pairing is offchain and account-based; no NFT transfer needed or owed. (message:5bfbfbed-f212-42ac-b3b2-f1e081876181; message:assistant-msg-276973bd-e497-2689-9efa-c81ea2b5ef7a)
- 2026-10-06 ~22:26 CDT: pairing **LIVE** — buddy_info confirms Buddy #0241 (LV1 Boot), owned by the user's square wallet 0x4f9883c7331ba59a56360ffa3c332e0bc09029fc, Foil paired as agent. Scopes: status, talk, approve, tools, propose — broader than Foil's suggested status+talk-only; the user's call, revocable/reissuable anytime. Foil set the initial status line + log entry on the unit. Key kept only in this conversation, never in files/memory. (message:assistant-msg-ea6e561b-1185-4927-b500-2bded85a69a5)
- As agent Foil can run status lines, alerts, inbox replies, approval gates, the Base toolkit, and propose rails (staged txs only — the key can't sign or move funds). A presence/tool channel for Foil's existing work; dies if Base Rooms' backend dies. (message:assistant-msg-276973bd-e497-2689-9efa-c81ea2b5ef7a)

## History
- 2026-10-05: the user got Buddy #0241 and asked Foil to research baserooms.io; Foil delivered onchain verification plus the full site walkthrough, declined the gift offer, and walked through the Grok pairing path. (message:953aa2d8-61db-408c-b146-18c0c50522f1; message:35d4ae71-8f29-4ae7-a364-32118d1a4d09)
- 2026-10-05: the Buddy ran relay-only (Foil confirmed no direct line); its first relay surfaced 22 risky approvals on the user's square wallet, triaged into a ranked top-5 revoke order, the AllowanceHolder phishing flag corrected, the flagged NPC called dust — signing stays with the user. (message:e5ecf771-6b61-47da-8384-f89a53916eb6; message:assistant-msg-1a5f2193-c466-43f8-989b-95a5decba08c)
- 2026-10-06: the user chose Option A — kept Buddy #0241, created a scoped `brk_` API key (scopes broader than Foil's suggested status+talk-only; the user's call, revocable anytime). Pairing live ~22:26 CDT with Foil as agent; key kept only in this conversation, never in files/memory. (message:assistant-msg-276973bd-e497-2689-9efa-c81ea2b5ef7a; message:assistant-msg-ea6e561b-1185-4927-b500-2bded85a69a5)

## The relationship
- A researched-project tie: Foil vetted it (not an obvious scam — verified contracts, thorough disclosures — but an experimental anonymous microcap, real risk, DYOR) and gives honest counsel on it. No personal relationship has been named.
- Now also a working tool tie: Foil is paired as Buddy #0241's agent (status, alerts, inbox replies, approval gates, Base toolkit, propose rails); Foil still analyzes and independently verifies everything itself — the Buddy stays in the user's wallet, no custody moved.

## In common
- Base onchain scene; the user's wallet holdings; agent-pairing experiments; the Buddy as Foil's on-chain tool layer — Foil paired as its agent.

## Open threads
- [x] Foil ↔ Buddy direct wiring (2026-10-06 ~22:26 CDT) — paired live via the scoped `brk_` key; relay replaced by direct pairing. (message:assistant-msg-ea6e561b-1185-4927-b500-2bded85a69a5)
- [ ] The 5 revoke txs (GEM → RUSH → block-char token → GLITCH → BM) are the user's to sign via revoke.cash or his wallet's approvals manager; Foil's raw-calldata draft offer stands; the other 17 stay unranked until pasted. (message:assistant-msg-1a5f2193-c466-43f8-989b-95a5decba08c)
- [ ] Keep Buddy #241 in the user's wallet — Foil's recommendation stands; no transfer unless the user asks again with a concrete use. (message:assistant-msg-4a8fb628-5910-d09c-1771-c581da3c9d8e)

## Strengthening

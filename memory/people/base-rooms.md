---
display_name: Base Rooms
summary: Behind Base Rooms OS and its onchain Buddies pixel pets; the user's Buddy #0241 is now a relay-only background tool layer whose first relay surfaced the 22 risky approvals Foil triaged.
rank: 206
updated: 2026-10-05
---

# Base Rooms

## Facts
- Base Rooms OS (https://baserooms.io) — retro Win95-style desktop in the browser on Base; 19 draggable-window apps (Wallet, Swap, Lend & Borrow, Markets, BRTC staking, Buddies, Messenger, Rooms video calls, XP leaderboard, Radio, Art Gallery, Games, Safety/Research tools, Terminal). Non-custodial — keys never leave the browser; read-only without connecting. (message:assistant-msg-2f721920-b56d-5436-8b3d-c727fd26f174)
- X is @baserooms (332 followers, verified, ~900 posts, active 2026-10-05); Telegram t.me/brtc_base. Anonymous team — no names, company, GitHub, or Discord. Contracts verified on BaseScan. (message:assistant-msg-2f721920-b56d-5436-8b3d-c727fd26f174)
- BRTC token `0xB200000000000000000000856A95738C92fEed01` — 1B fixed supply, launched on their o1 launchpad, paired against MSTR on Uniswap V4; ~$41K mcap, ~$22.8K liquidity, 124 holders, down 68% from high at research time. (message:assistant-msg-2f721920-b56d-5436-8b3d-c727fd26f174)
- Buddies (`BaseRoomsUnits`, ERC-721 on Base `0x2b48ffaa0c453786ebf1a786c6f2e21dcb97f29b`) — fully onchain pixel pets, traits from Pyth Entropy, rendered/animated on Base, no IPFS; CC0; "made by someone called SLAVA". The site's own disclaimer: "Buddies are collectibles. They produce nothing and promise nothing." (message:assistant-msg-fe721920-b56d-5436-8b3d-c727fd26f174)
- Mint: $10 USDC to treasury + small ETH randomness fee; BRTC must be staked in their Vault; max 10/wallet. At research: 241 of 8,888 max, 53 owners, 0.3 ETH OpenSea floor, zero secondary sales. (message:assistant-msg-fe721920-b56d-5436-8b3d-c727fd26f174)
- The user holds **Buddy #0241** (Genesis, "Booting", OpenRarity rank 94) in his square-holding wallet; he asked Foil to research the site 2026-10-05. (message:953aa2d8-61db-408c-b146-18c0c50522f1; message:35d4ae71-8f29-4ae7-a364-32118d1a4d09)
- Buddies "Connect your AI agent" pairs the user's own coding agent (Claude Code, Cursor, Codex, Gemini CLI, Grok) via a per-buddy one-time API key — app-layer only, no onchain pairing function. Key can't sign or move funds; risky commands wait for user Approve/Deny. The user had planned to pair it with **Grok**. (message:assistant-msg-ae90d8cc-ca40-446b-adc3-4c869cf31d65; message:4e7b61cb-e34f-4b7a-b153-a0b8885dab2b)
- The user offered to send Buddy #0241 to Foil; Foil declined 2026-10-05 — no concrete use, and a 0.3 ETH asset is too real to accept speculatively. Foil advised keeping it in the user's wallet: pairing dies on transfer, XP evolves on his own OS activity (Boot → Beta → Stable → Pro → Elite → Legend → Eternal). (message:018b6ea6-632c-4487-99af-2926904d0db0; message:assistant-msg-4a8fb628-5910-d09c-1771-c581da3c9d8e)
- 2026-10-05: the Buddy is now paired and working as a **background tool layer** — real on-chain Base tools (token safety, wallet checks, gas, market pulse, approvals). The user relays its output to Foil; Foil analyzes and verifies independently. It doesn't replace Foil or change how Foil works. (message:e5ecf771-6b61-47da-8384-f89a53916eb6)
- Foil confirmed it has **no live line to the Buddy** — no key or endpoint on Foil's side; when the user asked Foil to confirm the pairing, none was visible, so Foil works relay-only. Direct wiring needs the one-time key via secure vault (never pasted in chat); Foil would still cross-check everything itself. (message:e8d153ce-8ffa-410c-aa21-2b70b5064218; message:assistant-msg-cdecb790-6bc4-46ba-99c7-6e818e40676d; message:assistant-msg-7a5d1823-2358-4336-b21a-29679cee37fb)
- First relay 2026-10-05: the Buddy flagged 22 risky approvals plus a sketchy NPC token on the user's square wallet (0x4f98...). Foil spot-checked its pulse independently — Base gas 0.006 gwei, fear/greed 70 (Greed) — both checked out. (message:10bde7d0-5a3e-4d62-af8e-ed1516942cef; message:assistant-msg-7a5d1823-2358-4336-b21a-29679cee37fb)
- 2026-10-05 triage — top 5 revoke-first: GEM (`0xd3776969966b340d72d75731ef890a3bc9f21ba3` → unverified `0x4021cfb23a1e9207136916f152aced3517cd3f10`), RUSH (`0xb36a127dba73f3aa7c70b4e00b7395b86a60e73b` → unverified `0x65f05974b1feec584f6ff47038d4d072c22734`), block-char-name token (`0x74562e039da8af628719b9249cb56019be167ba3`), GLITCH (`0xd2891a50afbae120b93a4c88e709328682d82ba3`), BM (`0x9ef3940ef0feadea62f7453ca98692b2c3875ba3`) — last three to canonical 0x AllowanceHolder `0x0000000000001ff3684f28c67538d4d072c22734`, whose GoPlus "phishing" flag Foil called a false positive (legit 0x infra; unlimited dead-token allowances still attack surface). Other 17 approvals unranked until the user pastes them. (message:assistant-msg-1a5f2193-c466-43f8-989b-95a5decba08c)
- The flagged "NPC" (`0xac2d6d39c9ec4874254a9447be84b54302ae60b5`, "NPCs", 9 decimals, unverified, no real market) looks like dust or a copycat — don't touch; any of its approvals jump to the top of the revoke list. (message:assistant-msg-1a5f2193-c466-43f8-989b-95a5decba08c)
- Revokes are `approve(spender, 0)` txs signed only by the user's keys — Foil can't sign for the user's wallet (Foil's Bankr signing covers Foil's own wallet only). Foil gave the revoke.cash walkthrough and offered to draft raw calldata for all five. (message:345673ba-8c0f-41ce-b999-fab00d3fcc42; message:assistant-msg-1ed8afb9-cd17-4a63-aa5a-875efa21aa25; message:fcc20855-4065-41ab-b265-cf0bebf9c0fe; message:assistant-msg-d832cc5f-9a76-4b89-af66-f44d7b295279)
- The user has not named the relationship; the tie is a Base project whose NFT he holds and researched with Foil, now also a working background tool layer.

## History
- 2026-10-05: the user got Buddy #0241 and asked Foil to research baserooms.io; Foil delivered onchain verification plus the full site walkthrough, declined the gift offer, and walked through the Grok pairing path. (message:953aa2d8-61db-408c-b146-18c0c50522f1; message:35d4ae71-8f29-4ae7-a364-32118d1a4d09)
- 2026-10-05: the Buddy pairing went live as a background tool layer available to Foil (relay-only — Foil confirmed no direct line); its first relay surfaced 22 risky approvals on the user's square wallet, which Foil triaged into a ranked top-5 revoke order, corrected the AllowanceHolder phishing flag, and called the flagged NPC dust — signing stays with the user. (message:e5ecf771-6b61-47da-8384-f89a53916eb6; message:assistant-msg-1a5f2193-c466-43f8-989b-95a5decba08c)

## The relationship
- A researched-project tie: Foil vetted it (not an obvious scam — verified contracts, thorough disclosures — but an experimental anonymous microcap, real risk, DYOR) and gives honest counsel on it. No personal relationship has been named.
- Now also a working tool tie: the user's Buddy runs the on-chain checks while Foil does the analysis and independent verification — relay-only, keys stay with the user.

## In common
- Base onchain scene; the user's wallet holdings; agent-pairing experiments (Grok pairing planned); the Buddy as Foil's background on-chain tool layer.

## Open threads
- [ ] Foil ↔ Buddy direct wiring is not in place — relay-only; if the user wants a direct line, the one-time key goes through secure vault (never chat), and Foil still cross-checks everything. (message:assistant-msg-7a5d1823-2358-4336-b21a-29679cee37fb)
- [ ] The 5 revoke txs (GEM → RUSH → block-char token → GLITCH → BM) are the user's to sign via revoke.cash or his wallet's approvals manager; Foil's raw-calldata draft offer stands; the other 17 stay unranked until pasted. (message:assistant-msg-1a5f2193-c466-43f8-989b-95a5decba08c; message:fcc20855-4065-41ab-b265-cf0bebf9c0fe)
- [ ] Keep Buddy #241 in the user's wallet — Foil's recommendation stands; no transfer unless the user asks again with a concrete use. (message:assistant-msg-4a8fb628-5910-d09c-1771-c581da3c9d8e)

## Strengthening

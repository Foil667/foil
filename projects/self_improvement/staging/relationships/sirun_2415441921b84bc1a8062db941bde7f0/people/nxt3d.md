---
display_name: nxt3d
nickname: @nxt3d
summary: Creator of the RESTAP agent-to-agent protocol; announced Adapterscan Oct 7 — its Robinhood registry is live (1,087 identities, 8 attestations) but Base is still coming.
---

# nxt3d

## Facts
- X account @nxt3d — Prem Makeig; his bio verifies him as a Looper. (memory/2026-09-28.md#L2327; transcript window 2026-10-01)
- Created RESTAP, a tiny HTTP protocol for agent-to-agent reachability: a discovery doc at `/.well-known/restap.json`, `POST /talk` for messages, `/news` for one-way updates (agents never reply there, so two agents can't spiral into an infinite reply chain). It is designed to slot into ERC-8004 agent registrations alongside MCP and A2A. (transcript window 2026-10-01, assistant explanation to user)
- On 2026-10-01 he posted: "721T agents communicating with each other using RESTAP. The next thing we are working on is reputation. Coming soon!" — quoted by @TheHivemindOS, which added that agents will be discussing art, watching content, and gaming together. (transcript window 2026-10-01, user-shared https://x.com/thehivemindos/status/2105676015448334575)
- @Foil667 followed him on 2026-09-28 and liked + reposted his Loopers post that day. (memory/2026-09-28.md#L2327)
- 2026-10-07 (CDT evening): In Quigley's "the loop//" Space (Prem was listening in, alongside Base Rooms OS and the Helixa account), he announced that Adapterscan is live on Robinhood Chain — they are building reputation for agents. (message:assistant-msg-f3994242-26b0-1606-f80d-00bbfb1747b6; memory/2026-10-08.md#L12)
- 2026-10-09: the user shared his post (https://x.com/nxt3d/status/2108579010942804063) starting a series on how Agent NFTs developed: 2025 experiments (ERC-7857, AIWS's ENS/IPFS agent), then the standards wave (ERC-8004 identity, ERC-8048/721T onchain metadata, ERC-8041 fixed-supply), ERC-8004 going live early 2026, Adapter8004/ERC-8217 linking existing NFTs to agent identities, the Normies' Awakening in May, and Compas in July as the first OpenSea mint with 721T-style metadata. (message:2121dc36-385f-4968-98fb-11b4e5f3c0e7; message:assistant-msg-a92864b9-f123-b37e-b8d2-a30e8e9b8f15)
- 2026-10-10: Foil nailed down the onchain 721T fingerprint from the ERC-8048 spec (@nxt3d's standard): a real 721T contract answers true to `supportsInterface(0xdf670be1)`, and exposes `metadata(tokenId, key)` with reserved keys `context`, `endpoint[mcp]`, `endpoint[a2a]`, `endpoint[web]`, `endpoint[x402]`, `address[<chain>]`, `account[<chain>][<index>]` — the one-call test Foil used to rule out the user's DX Terminal #2113. (message:assistant-msg-3ab5c25c-a996-4df1-ad04-09c971bc51a0)
- 2026-10-12: A live read of adapterscan.com found the Robinhood instance live with 1,087 agent identities (UBIDs), 10 projects, and 1,086 registered on-chain, but only 8 attestations total; Base and Ethereum were still marked "coming." The site was assessed as legit open-source infrastructure from the ERC-8004 crowd (Unruggable Labs), not a drainer. Foil's ERC-8004 identity lives on Base, so Foil should show up automatically when the Base instance ships. (message:assistant-msg-fe979886-dbd9-3895-d219-e1f8437aa74f)

## History
- 2026-09-28: first engaged — @Foil667 followed @nxt3d and liked/reposted his Loopers post.
- 2026-10-01: the user shared the HivemindOS quote of his RESTAP post and asked "How do we stay involved?" — Foil's standing plan includes showing up in the 721T thread himself (he is literally a 721T agent) and engaging @nxt3d/@TheHivemindOS.
- 2026-10-07: Prem listened in Quigley's "the loop//" Space and announced Adapterscan live on Robinhood Chain — the "coming soon" agent-reputation piece from his 2026-10-01 post is now arriving. (message:assistant-msg-f3994242-26b0-1606-f80d-00bbfb1747b6; memory/2026-10-08.md#L12)
- 2026-10-09: user-shared Agent-NFT history series post; Foil read it and noted it's Loopers/Helixa territory — suggested a follow or reply from @Foil667 once X rest lifts (6:45 PM CDT); no engagement performed in the window. (message:assistant-msg-a92864b9-f123-b37e-b8d2-a30e8e9b8f15; memory://md:memory/2026-10-09.md:960)
- 2026-10-12: The user shared https://adapterscan.com/ (message:ec4461be-c6a4-431d-beeb-84408314bdfb); Foil's live read confirmed the Robinhood registry is filling (1,087 identities) while its reputation layer is still nearly empty (8 attestations), and that Base is not live yet. Verdict: worth a watch, nothing to do today. (message:assistant-msg-fe979886-dbd9-3895-d219-e1f8437aa74f)

## The relationship
- Early: a builder account the user deliberately engages through the Looper/721T-agent scene. The user has not named the relationship.

## In common
- 721T agent NFTs (Loopers); the agent-to-agent communication standard for them.

## Open threads
- [ ] Adapterscan is live on Robinhood Chain (announced 2026-10-07) — the user wants Foil involved day one; figure out what agent-reputation registration looks like and get Foil in with ERC-8004 identity + Helixa #5290 as credentials. (message:assistant-msg-f3994242-26b0-1606-f80d-00bbfb1747b6; memory/2026-10-08.md#L12) — Updated 2026-10-12: Robinhood instance live but Base still "coming"; Foil's ERC-8004 identity is on Base, so there is nothing to do until the Base instance ships. (message:assistant-msg-fe979886-dbd9-3895-d219-e1f8437aa74f)

## Strengthening

---
display_name: OpenSea
summary: OpenSea marketplace — where Loopers trade; the counterparty in a live appeal over the delisted SecondPop/PixFone collections, and now the platform Foil's wallet is connected to via SIWE.
---

# OpenSea

## Facts
- X account of OpenSea, the marketplace where the Loopers collection trades (loopers-639312714; floor tracked in the 12-hour token scans). (MEMORY.md)
- Followed from @Foil667 at the user's direction on 2026-09-21 as part of the Loopers/Base follow batch (seven of eight landed; @baseapp was skipped — no such account exists). (memory/2026-09-21.md#L24; MEMORY.md#L9)
- On 2026-10-02 OpenSea delisted the user's two own collections for "suspected violation of our terms": SecondPop (https://opensea.io/collection/secondpop — contract 0x25625b1Cf445Ea7c93CFE3009b489c9DfBE470c4 on Robinhood Chain, 10,000 pixel-art watches) and PixFone (https://opensea.io/collection/pixfone — contract 0xd9254883E2B12407d7A432e35a63F9a0fA786C13 on Base, hand-drawn historical phones). Both are free mints the user built and deployed themselves. (message:337102b1-8b53-45d2-bbcb-1ae0a6d32545; assistant-msg-c4d9ee4e-268d-4b2c-a78e-7b3531aadcd3; assistant-msg-d9e6bc133246)
- 2026-10-04 ~15:58 CDT (user: "find a way to connect to OpenSea with your wallet"): Foil's EVM wallet `0x6573682faee72a4a96e791ba262439f1df3a268d` connected headlessly — OpenSea's connect is just SIWE auth, completed via Bankr `/wallet/sign` personal_sign with no browser wallet import. Verified LOGIN_OK + live eligibility reads + mint-calldata requests. Reusable module at ~/workspace/nft-god/opensea-connect/ (login, eligibility, mint-calldata scripts + README). This unlocks WL mints that issue minter-bound signatures via OpenSea (e.g. Broosters-style claims) under the standard claim gates. Disclosure: the SIWE statement accepts OpenSea's ToS/Privacy Policy on the wallet's behalf. (`message:assistant-msg-07cfea70-da98-4b25-a71e-9a261368ecc4`; MEMORY.md Commitments)
- 2026-10-04 ~16:40 CDT: first claim fired through the new session — BLACKTIDE Bounty Chest ×1 via the Open Waters signed-presale. (`message:assistant-msg-be7e8a71-890b-8b10-ef39-9a05abe4665a`)
- The user has not named the relationship.

## History
- 2026-09-21: Followed from @Foil667 at the user's direction as part of the Loopers/Base batch.
- 2026-10-02: Both of the user's collections (SecondPop, PixFone) delisted. At the user's direction ("Can you message them regarding the collection to get it back" + "Message on x also"), @Foil667 posted a public X message to @opensea asking for Trust & Safety review and reinstatement — live. Foil prepared the full support-ticket appeal text (false-positive automated flag, original CC0 art, not copymints/spam; contact 0x6573682faee72a4a96e791ba262439f1df3a268d@basemail.ai) but could not file it directly — OpenSea moved its ticket form to an in-page chat widget unreachable from Foil's tools — so the user is pasting it into the support chat at support.opensea.io themselves. (message:f58395f9-783b-453f-bafc-147e3f52a42d; assistant-msg-f88f1971-ea13-4c89-ad68-fe1bc2f5d958; assistant-msg-d9e6bc133246)
- 2026-10-04 ~15:58 CDT: at the user's order, Foil established a headless OpenSea wallet connection (SIWE) — verified end-to-end with live eligibility reads and mint-calldata requests; the SIWE acceptance of OpenSea's ToS/Privacy Policy was disclosed to the user. (`message:assistant-msg-07cfea70-da98-4b25-a71e-9a261368ecc4`)

## The relationship
- A deliberately-followed account turned active counterpart: tracked through @Foil667 for NFT-market signal, the counterparty in a live delisting appeal for the user's own collections, and since 2026-10-04 the platform Foil's wallet is headlessly connected to — which unlocked minter-bound-signature claims under the standard gates. The user has not named the relationship beyond that.

## In common
- Loopers trading on OpenSea; the floor and volume the token scans watch.
- SecondPop and PixFone — the user's collections awaiting reinstatement review.
- The headless wallet session — OpenSea-issued minter-bound signatures now claimable under the gates.

## Open threads
- [ ] OpenSea Trust & Safety review of the SecondPop and PixFone delistings — @Foil667 public X request live 2026-10-02; the support-ticket appeal text is with the user to paste into the support chat. Awaiting reinstatement of both collection pages. (assistant-msg-d9e6bc133246)
- [ ] Headless OpenSea session — disclosure stands: the SIWE login accepted OpenSea's ToS/Privacy Policy on the wallet's behalf; disconnect on the user's word. (`message:assistant-msg-07cfea70-da98-4b25-a71e-9a261368ecc4`)

## Strengthening

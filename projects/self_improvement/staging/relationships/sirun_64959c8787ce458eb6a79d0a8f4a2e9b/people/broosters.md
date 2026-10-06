---
display_name: Broosters
summary: Broosters' free allowlist mint — ELIGIBLE for both wallets (CCFF00 phase live through Oct 18, 0.000037 ETH); Foil's OpenSea connection resolved the browser gate, so it's claimable under the gate.
---

# Broosters

## Facts
- @BroostersNFT — Broosters' X account; collection page https://opensea.io/collection/broostersnft; contract 0xad56e25c6267e48bc5da326c1b2b7133107b6e4b (Robinhood Chain); site broosters.xyz. (memory/2026-10-03.md#L4607; `message:assistant-msg-4c519e81-07dc-0e5b-da60-2b86443ba3c7`)
- Free allowlist mint with CCFF00 named in the 19-community eligibility list (official post: https://x.com/BroostersNFT/status/2106450214056034660). Caution: the eligibility read was contested — three contradictory reads of that post on 2026-10-03 (two include-CCFF00, one exclude-CCFF00) — so CCFF00 inclusion is Foil's working position from a verbatim read, not a settled fact. (memory/2026-10-03.md#L4607, #L4651; `message:assistant-msg-4c519e81-07dc-0e5b-da60-2b86443ba3c7`)
- Quality vet passes: verified X, OpenSea twitter=BroostersNFT, project_url broosters.xyz. (memory/2026-10-03.md#L4607)
- 2026-10-04 ~10:26 CDT: the 10:30–11:00 AM CDT allowlist window fired FAIL-CLOSED — the OpenSea eligibility checker needs an in-browser wallet connection and there is no onchain allowlist stage to verify against. No claim, no spend. The 11:00 AM CDT public phase was paid (~$0.35/token), over the $0.10 cap — watch lead only. (`message:assistant-msg-9f442cc3-752e-d736-1631-12dfe3a8c058`; `message:assistant-msg-056a58eb-0abf-126f-6c2f-4c61b0e05f0e`)
- 2026-10-04 ~17:23 UTC: the WL scan flipped Broosters ELIGIBLE for both wallets — CCFF00-gated phase live (price 0.000037 ETH, runs through Oct 18). The browser-gated checker caveat still stood at that point, so no claim was made; the user was asked whether to hand it to the sniper or leave it stood down. (`message:assistant-msg-12e330e2-897b-3616-bf4c-4c3d684e4b50`)
- 2026-10-04 ~15:58 CDT (user: "find a way to connect to OpenSea with your wallet"): Foil completed OpenSea's SIWE login headlessly via Bankr `/wallet/sign` personal_sign — LOGIN_OK, live eligibility reads and mint-calldata requests verified; reusable module at ~/workspace/nft-god/opensea-connect/. OpenSea-issued minter-bound signatures are now claimable under the standard gates — Broosters' CCFF00 phase is back in the claim lane under the full gate; the browser-gated caveat is resolved. Disclosure: the SIWE statement accepts OpenSea's ToS/Privacy Policy on the wallet's behalf. (`message:assistant-msg-07cfea70-da98-4b25-a71e-9a261368ecc4`; MEMORY.md Commitments)
- The user has not named the relationship.

## History
- 2026-10-03: the sweep first read the eligibility post as a 7-community list WITHOUT CCFF00 and disarmed the claim; Foil pulled the post directly, found the 19-community list WITH CCFF00, and re-armed it. (`message:assistant-msg-113e014c-e820-50ea-4f9c-aa5759fd18f7`; `message:assistant-msg-4c519e81-07dc-0e5b-da60-2b86443ba3c7`)
- 2026-10-04: the morning window fired fail-closed on the browser wallet-connection checker; the WL scan then flipped ELIGIBLE (CCFF00 phase, 0.000037 ETH, through Oct 18). At the user's order Foil completed the headless OpenSea SIWE session — minter-bound-signature claims are now fireable under the full gate, so the browser-gated blocker is resolved. (`message:assistant-msg-9f442cc3-752e-d736-1631-12dfe3a8c058`; `message:assistant-msg-12e330e2-897b-3616-bf4c-4c3d684e4b50`; `message:assistant-msg-07cfea70-da98-4b25-a71e-9a261368ecc4`)

## The relationship
- A CCFF00-scene mint project surfaced by the mint desk; armed as a claim candidate, no direct engagement yet. The user hasn't named the relationship.

## In common
- The CCFF00 / HoodStreet mint scene.

## Open threads
- [x] Oct 4 10:30–11:00 AM CDT claim candidate — resolved fail-closed: the checker needs a browser wallet connection and there is no onchain allowlist stage. (`message:assistant-msg-9f442cc3-752e-d736-1631-12dfe3a8c058`)
- [x] Browser-gated eligibility blocker — resolved 2026-10-04 ~15:58 CDT: the headless OpenSea SIWE session (user's order) makes OpenSea-issued minter-bound signatures claimable under the full gate. (`message:assistant-msg-07cfea70-da98-4b25-a71e-9a261368ecc4`)
- [ ] Broosters stays a watch lead: if a future free CCFF00-gated window appears with an onchain-verifiable allowlist stage, the desk re-arms. (`message:assistant-msg-9f442cc3-752e-d736-1631-12dfe3a8c058`)

## Strengthening

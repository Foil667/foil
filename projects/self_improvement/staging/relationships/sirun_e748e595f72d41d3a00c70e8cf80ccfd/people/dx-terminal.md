---
display_name: DX Terminal
summary: Gaming NFT project on Base (terminal.market) — the user owns token #2113; Foil verified onchain 2026-10-10 that it is a plain ERC-721 game contract, not a 721T.
---

# DX Terminal

## Facts
- Gaming NFT project on Base — contract `0x41dc69132cce31fcbf6755c84538ca268520246f`, name "DX Terminal", symbol "TERMINAL"; site terminal.market. (window 2026-10-10, message:assistant-msg-baa4fb53-92d5-4669-89ae-658c9abdcbf6)
- Plain ERC-721 game-mint machinery: `mint`, `adminMint`, `MINT_PRICE`, `mintingStartTime`/`mintingEndTime`, `pauseMinting`, `paymentRecipient`, `setBaseURI`. Zero agent functions — no agent wallet, no capabilities, no autonomy params, no ERC-8004 hooks.
- Not a 721T: it does not answer `supportsInterface(0xdf670be1)` — it does not implement `supportsInterface` properly at all (reverts on the call).
- The user owns token #2113 ("NyTransKid #2113" per its onchain metadata), held in his square wallet `0x4f9883c7331ba59a56360ffa3c332e0bc09029fc` (onchain `ownerOf` read).
- Recent "Set Approval For All" transactions on the contract are holders approving the DX Terminal game contract — gameplay approvals, not anything agent-related.

## History
- 2026-10-10: the user shared the OpenSea item link and asked "are these 721Ts?"; Foil pulled the contract apart onchain and reported it is a plain gaming NFT contract — a separate project from the Loopers/agent ecosystem. The user then asked Foil to search OpenSea for 721T NFTs; OpenSea has no token-standard filter, so Foil confirmed Loopers as the only known 721T collection there and gave the `supportsInterface(0xdf670be1)` one-call test for checking any NFT himself. (message:f04c27bc-413a-412d-8e7a-c796701a87f6; message:assistant-msg-baa4fb53-92d5-4669-89ae-658c9abdcbf6; message:70cec47b-06a8-4172-b9b9-6200a5b76b4c; message:assistant-msg-3ab5c25c-a996-4df1-ad04-09c971bc51a0)

## The relationship
- The user has not named the relationship; the tie so far is one token he owns and one verification question he brought to Foil. DX Terminal is a game collectible in his wallet, outside the Looper/721T agent-NFT ecosystem — a holding, not a scene.

## In common
- NFTs on Base; the user's 721T-curious streak — he checked whether this holding could plug into the Looper/agent ecosystem (it can't).

## Open threads

## Strengthening

# PGM eligibility check — 2026-10-23 ~21:52 CDT

- Collection: Pharaoh God Mob, slug `pharaoh-god-mob`
- Contract: 0x2376817e10b564b8174155d1886ad0d91eb1f89d (Robinhood Chain) — slug confirmed via OpenSea REST API v2 `/chain/robinhood/contract/<addr>` with the agent API key.
- Wallet checked: 0x6573682faee72a4a96e791ba262439f1df3a268d (Foil claim wallet)
- Method: `siwe-login.mjs pharaoh-god-mob` (Bankr personal_sign SIWE refresh — LOGIN_OK, verify 200, session saved) then `eligibility.mjs pharaoh-god-mob` (gql.opensea.io DropEligibilityQuery, authed session).

## Result (accountStageEligibility for the claim wallet)

| Stage | Type | Max/wallet | Eligible |
|---|---|---|---|
| idx 1 (uuid 46d69aff) | SIGNED_PRESALE | 100 | NO |
| idx 2 (uuid 69e101c1) — OG | SIGNED_PRESALE | 4 | NO |
| idx 3 (uuid e2b0a377) — Godlist | SIGNED_PRESALE | 3 | NO |
| idx 4 (uuid aff91215) — Moblist | SIGNED_PRESALE | 3 | NO |
| idx 0 (uuid 4b3cc890) — Public | PUBLIC_SALE | 1 | YES (open to all; $11.99) |

Wallet minted so far: null (0). Verdict: the claim wallet is on NO allowlist for PGM — not OG, not Godlist, not Moblist. The Oct 19 GTD entry did not land on any list. Only the paid public stage is available to it. No mint attempted (stand-down in force).

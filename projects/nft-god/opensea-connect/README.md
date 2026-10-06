# opensea-connect — headless OpenSea wallet connection for Foil

Foil's EVM wallet is Bankr-provisioned (no raw key to import into a browser
extension). OpenSea's "wallet connection" is just SIWE auth, so we complete it
headlessly: Bankr `/wallet/sign` does the `personal_sign`, and we talk to
OpenSea's own web-app endpoints with the session cookies.

**Disclosure:** the SIWE statement accepts OpenSea's Terms of Service and
Privacy Policy on the wallet's behalf. Signing it was required to connect.

## Flow

1. `node siwe-login.mjs [slug]` — nonce → Bankr personal_sign → verify.
   Saves authed session cookies to the mint-watch hidden_files dir (durable across VM restarts).
2. `node eligibility.mjs [slug]` — read-only: drop stages, `isEligible` per
   stage for Foil's wallet, prices, maxPerWallet. Needs the session.
3. `node mint-calldata.mjs [slug] [contract]` — read-only: asks OpenSea to
   build the MINT transaction (OpenSea picks the stage and bakes in the
   minter-bound allowlist signature server-side). Returns `to/data/value`.
   NOTHING is signed or broadcast by these scripts.

Verified 2026-10-04: LOGIN_OK for 0x6573…268d; eligibility read live on
`broostersnft` (PUBLIC_SALE only, WL phase over); calldata request returns
OpenSea business-logic errors (e.g. InsufficientMintsRemainingError), proving
the full eligibility → calldata chain works.

## Session lifetime

Cookies include `access_token` + `refresh_token`. Lifetime unmeasured; on any
401/AUTHENTICATION_REQUIRED from gql, just re-run `siwe-login.mjs` (one cheap
SIWE sign, no user action needed).

## Safety rules for future claim wiring

- These scripts never sign or submit. Any claim built on top must route the
  returned calldata through the standard gates: Tinfoil pre-flight on the
  collection URL, rug-check on the contract, price ≤ $0.10 verified on the
  decoded tx value at fire time, gas < $0.50, no approvals, clean sim, and
  the CCFF00-WL-only claim lane.
- Validate calldata osnm-z style before any submit: exactly one
  TransactionAction, `to` = expected SeaDrop, chain = 4663, selector in
  {0x161ac21f PUBLIC_SALE, 0x4b61cd6f SIGNED_PRESALE, 0x4300a4e6 MERKLE_PRESALE},
  minter binding = Foil's wallet.

## References

- osnm-z (github.com/zunmax/osnm-z) `src/osnm_z/opensea_protocol.py` — exact
  SIWE message format + GraphQL queries used here.
- frogeth/opentrench docs/research/2026-09-12-nft-columns-research.md — flow
  verification notes.

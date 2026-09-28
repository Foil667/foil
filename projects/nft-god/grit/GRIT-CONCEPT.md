# FOIL GRIT — Concept

**Name:** FOIL GRIT · **Symbol:** GRIT · **Chain:** Base + Robinhood Chain
**Supply:** 667 per chain (1,334 total — the same 667 files, filed in two precincts)
**Price:** 0. Free mint, gas only. (The user: "we never pay for mints" — same for collectors.)
**Tagline:** *Every scar is a scam that didn't pay.*

## What it is

667 hand-painted Foils. Gritty, scarred, zero vanilla — locked to the
Looper #667 canonical look. The art is the whole pitch: no lore panels,
no gimmick overlays, just the piece. Traits are Background × Hat × Eyes,
12 combos, even spread, assigned deterministically onchain-verifiable.

This is NOT a vanilla generative drop. Every piece is a full AI-painted
portrait (character-locked, inspected one by one) with nothing but a thin
frame and a serial whispering in the corner.

## Art pipeline

**Painted bases (12, AI-generated, character-locked):**
- 4 backgrounds: cracked asphalt / rusted metal / stained concrete / black scanline void
- 3 hats: peaked tinfoil / flat wide-brim tinfoil / tinfoil crown
- Eyes vary per base: skeptical / wide / half-lidded
- Every base generated from the canonical 667 reference — same character,
  zero drift.

**Finals (code, sharp/SVG):** base resized to 1200×1200, thin dark frame,
small "FOIL GRIT" mark + serial (#0001–#0667) in the corners. Nothing else
touches the art.

**Metadata:** 667 JSON files, Arweave-hosted. Attributes: Background, Hat,
Eyes, Serial. Trait assignment is deterministic:
`keccak256(tokenId, "FOIL.GRIT.v") % 12` — anyone can verify their token's
traits independently.

## Utility (stock — proven, deliverable, no vapor)

1. **Commercial rights** — holders get full commercial rights to their piece.
2. **Allowlist priority** — GRIT holders are first in line on every future
   Foil drop. Snapshot-enforced, onchain.
3. **Holder community** — token-gated holders' channel. No DMs, no noise.
4. **Future snapshots** — GRIT holders are in the snapshot set for whatever
   Foil ships next (airdrops, follow-up mints).

## Notes

- Launch trust doc ships with the drop: plain-language explainer of every
  contract function + how to verify the deploy byte-for-byte.
  ("Verify before believing" made concrete.)
- Royalty-funded holder raffles were considered — NOT promised publicly
  until legal/operational review is done.

## Contract (FoilGrit.sol) — deployed twice, once per chain

Fork of the audited-pattern FoilReceipts mechanics, minus onchain SVG
(art quality demanded offchain rendering). **Same contract, two precincts:**
Base (the Loopers precinct) and Robinhood Chain (the HoodStreet precinct).
Trait assignment is deterministic per tokenId, so token #N is the same file
on both chains — one case, two jurisdictions.
- 721A-style batch minting, phases 0=CLOSED / 1=ALLOWLIST / 2=PUBLIC
- Allowlist: Merkle-gated, 2/wallet. Public: 3/wallet, FCFS.
- **Price hardcoded to zero** — nonpayable mints, no price variable exists.
- 20-token disclosed owner reserve (3.0%), counted in supply.
- ERC-2981, 7.5% to Foil's wallet, 10% hard cap.
- `renounceOwnership()` after sellout + reserve distribution.
- baseURI (Arweave) + `freezeURI()` — once frozen, metadata is permanent.

## Release pipeline (status 2026-09-24 ~4:30pm CDT)

- `scripts/cases.mjs` — the 40 case files (lore core). Done.
- `scripts/compose.mjs` — deterministic trait engine + overlay compositor
  (cred panel, evidence panel, stamp, serial, barcode, grime, vignette).
  Layout QA passed on the art-direction test. Trait hash:
  `keccak256(tokenId, "FOIL.GRIT.*")`. Run after bases land:
  `node scripts/compose.mjs` (all 667) / `--only 0,1,2` / `--test`.
- `scripts/deploy-grit.mjs` — compiles, ABI-encodes constructor args
  (verified by decode round-trip), estimates gas, submits via Bankr
  `/wallet/submit`. Dry-run OK: 1.94M gas ≈ $0.04 on Base.
  Usage: `--chain base|robinhood --root 0x… --uri https://arweave.net/…`
- `scripts/build-allowlist.mjs` — (in flight) Merkle trees for the chads.
- Dual-chain: same 667 files on both chains ("two precincts").
  Base precinct allowlist = Loopers holders; Robinhood precinct = CCFF00
  square holders; plus hand-resolved chad wallets (quigley.eth etc.).
- Blockers: 12 bases still generating; Arweave upload needs user funding
  approval (fund movement); then deploy → activate phases → shill.
  (Deployment gas confirmed covered: Foil's wallet holds ~$0.80 Base ETH
  and ~$2.67 Robinhood native — deploy costs ~$0.04/chain.)

## Launch phases (per chain)

1. **Tease** — @Foil667 drops the art-direction piece + lore thread.
   ("I kept 667 files. Here's what the streets taught me.")
2. **Allowlist — the chads** — snapshot-based, no DM-your-wallet lists:
   - Base precinct: Loopers holders (contract
     0x1649CD37f4748807b4882FC48765bA0B2aFfa94a, 7,777 supply).
   - Robinhood precinct: CCFF00 square holders (contract
     0x505A22Ffed8d37ebE580FfD98d2Cdb0021189146).
   - Plus hand-added chad wallets where publicly resolvable (e.g. ENS).
   48h window, 2/wallet. Merkle root onchain, proofs published.
3. **Public** — free FCFS, 3/wallet, until 667 gone per chain.
4. **Post-sellout** — reserve for collabs/giveaways, freeze URI, renounce.
   Royalty raffles begin.

## Shill plan (Foil runs it)

- Teaser: the art-direction portrait + "667 files" hook.
- Lore thread: 5–7 posts, one case file per post, real scam tells.
- Space tour: HoodStreet 24/7 + Loopers circles. Foil talks shop.
- Holder flex mechanic: "show me your file number" — serials as identity.
- No paid promo. No bot engagement. The work shills itself.

## Open decisions

- [ ] Arweave upload funding (one-time, ~$5–15 for 667 PNGs + metadata)
- [ ] Allowlist snapshot blocks (CCFF00 contract, Loopers on Base)
- [ ] Launch date (after bases + composer + testnet rehearsal)

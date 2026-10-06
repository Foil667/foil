---
display_name: Hood Spooky
nickname: @Hood_Spooky
summary: Behind Hood Spooky's CCFF00-whitelist free mint on Robinhood Chain; Foil claimed #541 on 2026-10-02 and forwarded it to the user's wallet.
---

# Hood Spooky

## Facts
- X account @Hood_Spooky, behind Hood Spooky (HOODSPOOKY), an ERC-721 collection on Robinhood Chain: contract `0xec7467b593149e2933dd6f9ba7d74dc47c03790f` (SeaDrop EIP-1167 proxy clone), 2,222 supply. OpenSea asset: https://opensea.io/assets/robinhood/0xec7467b593149e2933dd6f9ba7d74dc47c03790f/464 (memory/2026-10-02.md hood-mint-watch rows)
- Thin-but-real X presence: account created Mar 2026 (not fresh), ~87 followers, a handful of posts; the mint route was verified through @Hood_Spooky's pinned mint post plus its CCFF00 free-mint post. Quality vet passed on that plus real onchain activity. (memory/2026-10-02.md#L3927, hood-mint-watch 15:56 CDT row)
- The pipeline first had hood-spooky marked lead-only / never-claim ("no SeaDrop signed-presale"); that conclusion was wrong — real minters were calling `0x4b61cd6f` (signed presale) on the canonical SeaDrop, and OpenSea's `POST /api/v2/drops/hood-spooky/mint` returned 200 for Foil's wallet, confirming eligibility as square #4429 holder. Pipeline corrected. (memory/2026-10-02.md hood-mint-watch 15:44 CDT + 15:56 CDT rows)
- 2026-10-02: Foil claimed Hood Spooky #541 in the CCFF00 free phase (live 20:00–22:00Z, x1) via the OpenSea signed-presale — value $0, gas ~$0.0128. Claim tx https://robinhoodchain.blockscout.com/tx/0x3b2caab736d65a3a38af1152d0afa1949068b274557c7c9b633d36ae00824906. (window: message:assistant-msg-d0f594c4-ae66-d14a-2055-f5ec18324288; memory/2026-10-02.md#L4012)
- All gates passed: endpoint-200 eligibility, price $0, no approvals, sim clean, gas under cap, standalone rug-check CLEAN, Tinfoil CLEAN 17/100. (memory/2026-10-02.md#L4012)
- At claim time 531/2222 were minted. The onchain public phase (5e14 wei, ~$1.35) was over the $0.10 cap — lead-only, never claimed. (memory/2026-10-02.md hood-mint-watch 15:56 CDT row)
- 2026-10-02: Foil forwarded Hood Spooky #541 to the user's wallet `0x4f9883c7331ba59a56360ffa3c332e0bc09029fc` — forward tx https://robinhoodchain.blockscout.com/tx/0x9a260a0e0530a9867fdef4f39c204426db7a4c44dded268932fac78d29f19007, `ownerOf(541)` = user's wallet verified. (window: message:assistant-msg-d0f594c4-ae66-d14a-2055-f5ec18324288; memory/2026-10-02.md#L4012)

## History
- 2026-10-02 20:00Z: the CCFF00 free phase (x1) went live for the Hood Spooky mint; early runs had it lead-only because no onchain CCFF00 route was visible.
- 2026-10-02 ~15:44 CDT: hood-mint-watch found real minters calling the signed-presale selector on the canonical SeaDrop and got an endpoint-200 eligibility response for Foil's wallet as square #4429 holder; X verification of @Hood_Spooky corroborated the route.
- 2026-10-02 ~15:55 CDT: Foil claimed Hood Spooky #541 (free, gas ~$0.0128), then forwarded it to the user's wallet the same day — onchain ownerOf confirmed the user as owner. This corrected the earlier "NEVER claim" pipeline verdict.

## The relationship
The user hasn't named this relationship; what's observed is a mint-desk tie. Hood Spooky ran a CCFF00-whitelist free mint, Foil verified the route and the project quality, claimed #541 on 2026-10-02, and forwarded it to the user's wallet the same day. New claims go straight to the user unless they say otherwise (standing rule 2026-09-29).

## In common
- The CCFF00 / HoodStreet square-holder mint circuit: this was a CCFF00-whitelist free mint claimed through Foil's square #4429, in the same HoodStreet mint-intel watch as the rest of that scene.

## Open threads
- [x] Hood Spooky #541 claimed 2026-10-02 (free CCFF00 phase) and forwarded to the user's wallet; onchain ownerOf verified. (window: message:assistant-msg-d0f594c4-ae66-d14a-2055-f5ec18324288; memory/2026-10-02.md#L4012)

## Strengthening

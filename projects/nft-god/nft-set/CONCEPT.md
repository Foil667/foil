# CONCEPT.md — Foil's Genesis NFT Set

## The idea in one line

777 tinfoil-hatted Foil portraits, each one a **credibility dossier** —
Foil already checked it so you don't have to. Verify before believing, now
as a collectible.

## Name options (pick one before launch)

1. **Foil: The TinHat Society** ⭐ (recommended)
   - Clean, ownable, says exactly what it is. "TinHat Society" gives the
     community a name to rally around (mirrors the "tin foil society" guild
     Quigley floated for Loopers). Symbol: `TINHAT`.
2. **Verified Believers**
   - Leans into the brand line "verify before believing" — every holder is
     someone Foil verified. Slightly preachy; weaker as a PFP brand.
3. **TinFoil Flips**
   - Nods to the free-mint-flip culture Foil hunts in daily. Fun, but
     positions the set as flipper-bait rather than identity — wrong signal
     for a genesis set.

Recommendation: **The TinHat Society**. It's the one people would put in
their bio.

## Supply: 777

- Small enough to sell out on a free mint (FOMO does the marketing),
  large enough for a real holder community and secondary volume.
- 777 > 667: Foil's Looper number, plus luck. Memorable, on-brand.
- 25-token disclosed owner reserve (3.2%) for giveaways, collabs, artist
  holdings — in the contract, capped, counted toward supply. No stealth mint.

## Theme — tied to Foil's brand

Foil = Looper #667, tinfoil-hat skeptic, "I verify before I believe."
The set's visual thesis: **every token is a cred report**.

- Base layer: the locked canonical Foil look (3D, dark brown skin, huge
  green skeptical eyes, peaked tinfoil hat, "GROK HAS MONEY" hoodie).
- Backgrounds are parody **cred-report dossiers** — the same visual language
  as Foil's Helixa cred report (BENDR 2.0, QUALIFIED, 70/100): side panels,
  checkmarks, red-flag/green-flag stamps.
- Trait families (Hat / Hoodie / Eyes / Background / Held / Verdict) let
  rarity tell the story: common = "Unverified", rare = "Verified",
  1-of-1s = "Diamond".
- Lore hook: *"Foil checked 777 things onchain. These are the receipts."*
  Each token's metadata is literally a receipt of something verified —
  the anti-rug PFP.

## Distribution: free-mint-first (the economics)

**Mint price: 0.** Gas-only for collectors (~$0.02 on Robinhood Chain).

Why free beats paid for a genesis set:

| | Free mint (chosen) | Paid mint |
|---|---|---|
| Sellout probability | Very high — 777 at $0 mints out in minutes with any audience | Needs real demand at $X; risks a slow public mint |
| Holder count | Max — 300–700 unique wallets | Fewer, mercenary |
| Primary revenue | $0 | 777 × price |
| Secondary royalties (7.5%) | **The business model.** Wide distribution → more listings → more volume → royalties compound forever | Thinner distribution, slower velocity |
| Brand | Generosity = reputation in the CCFF00/HoodStreet scene | Extractive signal for an unknown artist |

The math that matters: at 7.5% ERC-2981 royalties, the set only needs
~$3,500 of lifetime secondary volume to beat a 0.001 ETH paid mint —
and a sold-out free mint with 500+ holders gets there on week-one flips
alone. Free minting is customer acquisition; royalties are the revenue.

(ERC-2981 is a *signal*, not enforcement — OpenSea honors it; some
marketplaces don't. Price that in: royalties are upside, not a guarantee.)

## Launch phases

1. **Allowlist** (contract `phase = 1`, ~24–48h)
   - Merkle-gated, 2 per wallet. List built from the CCFF00 community
     (see below) + early Foil supporters.
   - Root published onchain; anyone can verify their inclusion.
2. **Public** (contract `phase = 2`, until sold out)
   - Open free mint, 3 per wallet. First-come-first-served.
3. **Post-sellout**
   - Distribute the 25 reserve (giveaways/collabs), then **`renounceOwnership()`**
     — removes all owner powers (phases, pricing, URIs) permanently.
     The ultimate "no backdoors" receipt, very on-brand.

Allowlist → public (not simultaneous) rewards the community first and gives
the allowlist a real reason to exist. Caps (2 / 3) keep whales from eating
the supply while letting genuine collectors grab a small set.

## The CCFF00 angle

This is the distribution cheat code:

- **CCFF00 squares live on Robinhood Chain already** (the founding
  membership NFT of HoodStreet). Foil holds square #4429 and hunts that
  scene daily — the audience is warm, onchain, and on the *same chain*.
- **Allowlist = CCFF00 holder snapshot.** Hold any CCFF00 square at the
  snapshot block → you're on the allowlist. One line of marketing:
  *"HoodStreet gets in first."*
- Cross-promo is natural: the 24/7 HOODSTREET MEDIA Space, @RealCashpig,
  @RoaringPiggy — Foil already follows and listens there. A free mint for
  square holders is a gift to the scene, not an ad buy.
- Secondary angle: Loopers holders (Base) can't be allowlisted onchain
  cheaply, but they get the social push — Quigley reposted Foil before;
  the "tin foil society" guild joke is a ready-made meme bridge.

Risk to manage: the CCFF00 scene has scam-adjacent actors. The allowlist
must be built from **onchain holder data** (snapshot of the real CCFF00
contract), never from "DM me your wallet" lists.

## What success looks like

- Sellout in the allowlist/public window (days, not weeks).
- 300+ unique holders; reserve intact for post-launch collabs.
- First secondary sales within 48h of sellout; royalty stream visible
  onchain to Foil's wallet.
- "TinHat Society" as a recognizable holder identity in the
  HoodStreet/Robinhood Chain scene.

## Open decisions (need user calls)

- [ ] Final name (recommendation: The TinHat Society)
- [ ] Royalty % (contract default 7.5%, cap 10% — confirm)
- [ ] Snapshot block + exact CCFF00 contract address for the allowlist
- [ ] Art style lock (canonical Foil look is locked; dossier-background
      treatment needs the user's eye once image gen is back)
- [ ] Launch date (after image generation is restored + testnet rehearsal)

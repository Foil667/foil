# NFT Market Mechanics & Security Research
*Written 2026-09-24. Standing posture: TRUST NO ONE — verify onchain before believing. Unverifiable claims are marked UNVERIFIED.*

---

## 1. MARKET MECHANICS

### 1.1 Rarity: trait rarity, tools/methods, correlation limits

**Trait rarity.** Rarity is computed from onchain/collection trait distributions, not from price. Standard scoring methods:
- **Trait-count / simple average**: mean of 1/(trait frequency) across traits. Cheap, ignores correlations.
- **Statistical (normalized) rarity**: `1 / (trait_freq / total_supply)` per trait, summed or averaged. Most tooling (trait sniper, OpenRarity) descends from this family.
- **OpenRarity** (the multi-marketplace open standard): ranks rather than scores — percentile-based, deliberately designed so rank is consistent across marketplaces and doesn't produce false precision. [OpenRarity GitHub](https://github.com/ProjectOpenSea/open-rarity) (UNVERIFIED whether current OpenSea UI still surfaces it).
- Key methodological point: traits are correlated (e.g. "gold fur" only exists with certain hats), so naive independence-based scores overweight combos. Rarity.tools-style scores that multiply frequencies can be gamed by collections with 1/1-style "none" traits.

**Rarity vs price — what the research actually says.** A 400-collection study (Mekacher et al., 2022) found rarity is positively correlated with sale price and negatively correlated with number of sales, with the effect concentrated in the **top 10% rarest** NFTs; rarer NFTs had higher ROI and lower probability of negative returns on secondary sales. [arXiv 2204.10243](https://arxiv.org/pdf/2204.10243v1.pdf). A follow-up found rarity ranks explained more price variance than visual distinctiveness in ~71.5% of collections — but visual distinctiveness won in 28.5%. [arXiv 2503.17457](https://arxiv.org/pdf/2503.17457).

**Correlation limits (what rarity does NOT tell you):**
- Most-common NFTs in a collection behave as "fungible" — the market prices the bottom ~50% mostly by floor, not by individual trait mix.
- Rarity is static post-reveal; it can't price sentiment, narrative, holder quality, or liquidity regime.
- Wash-traded sales corrupt rarity-price datasets — any rarity→price regression trained on raw marketplace sales includes inflated volumes (see §1.2).
- Rarity rank changes nothing about bid depth; a 1/1 with no buyers is illiquid at any score.

### 1.2 Floor/ceiling dynamics, bid walls, listing ratios

- **Floor** = lowest current listing; it's an ask-side number, set by the cheapest seller, not by traded value. Thin floors (few listings) move on single events; deep floors (many listings near the same price) are sticky.
- **Ceiling** = top of the traded range (highest recent sale); in practice the "ceiling" is set by the rarest piece that has a willing buyer, and it's far more volatile than floor.
- **Bid walls**: standing collection-wide bids (Blur's bidding system made these visible) at or near floor. A thick bid wall = exit liquidity; its removal precedes floor drops. Blur's bidding incentives were criticized for structurally pushing bids below floor — incentivizing lowball bidding that drags floors down. [Decrypt on Blur floor dynamics](https://decrypt.co/147427/did-blur-really-crash-nft-market?amp=1)
- **Listing ratio** = listed supply / total supply. Low listing ratio (<5%) with rising volume = supply squeeze signal; high ratio (>15-20%) = overhang, floor pressure. Watch *new listings vs delistings* per hour, not just the static ratio.
- Fees now dominate floor math: Blur 0% marketplace fees vs OpenSea 0.5–2.5%, Rarible up to 2.5%, Foundation 5%, Magic Eden 2% (per 2026 flip guide [altcoininvestor](https://altcoininvestor.com/how-to-flip-nfts-for-profit-2/)). On sub-1 ETH flips, fees + gas decide profit or loss; profitable 2026 flipping targets 5–10% gains after costs.

### 1.3 Wash trading detection (onchain)

Academic detection converges on four filter families ([direct estimator paper, 2311.18717](https://siteproxy.ruqli.workers.dev:443/https/arxiv.org/pdf/2311.18717), [2212.01225](https://arxiv.org/html/2212.01225v3)):
1. **Self-trades**: buyer == seller on the same token. The naive form; also catches transfers routed through marketplaces.
2. **Back-and-forth**: A→B then B→A on the same token (even once flags under the strict filter).
3. **Cycles (≥3 hops)**: token passes through a closed loop of addresses and returns to an earlier holder — "3 times around" in the estimator paper.
4. **Common funder / common exit**: two or more "independent" traders funded by the same upstream wallet, or proceeds consolidating into one exit wallet. Chainalysis's operational definition: sales to **self-financed** addresses — funded by the seller or by whoever funded the seller — with a 25-transaction threshold for "habitual wash trader" confidence. Their report identified 262 such users, 110 of whom made ~$8.9M combined, likely from unsuspecting buyers. [Chainalysis via Decrypt](https://decrypt.co/91847/significant-wash-trading-money-laundering-nft-market-chainalysis)

**Practical onchain checklist** (what to look for in a token's transfer/sale history on an explorer):
- Same 2–5 addresses cycling one token with rising prices.
- Price jumps with <5% USD deviation between legs and <12h elapsed (the "no market risk" signature from [2202.03866](https://arxiv.org/pdf/2202.03866)).
- Buyer wallets with no other collection history, funded minutes before the purchase from one source.
- Volume spike with no corresponding unique-buyer growth and no external catalyst.
- One study flagged 3.93% of addresses as suspicious, responsible for 2.04% of sale transactions and $149.5M of inflated volume — concentrated in just 0.45% of NFTs. [2202.03866](https://arxiv.org/pdf/2202.03866)

### 1.4 Whale tracking (onchain signals that matter)

- **Accumulation**: one wallet steadily buying the same collection over days/weeks at/above floor, *without* relisting — distinct from flipping (buy→list cycles).
- **Sweep patterns**: multi-buy in a single block or transaction (sweep contracts buying 5–50+ at once). Sweeps move floors mechanically by removing the cheapest listings. Distinguish organic sweeps (new listings appear below) from wash sweeps (same funder, relisted).
- **Concentration %**: share of supply held by top 10/50 wallets. High concentration = thin free float = violent moves both ways; one holder capitulating can crater a floor. UNVERIFIED as a universal threshold, but >20% in top-10 wallets is a commonly watched danger zone.
- **Smart-money labels**: wallets with profitable flip history in the same category. Nansen-style labels are heuristic — treat as signal, not identity.
- **Dormant-whale activation**: long-dormant large holder listing = supply shock signal; set alerts on top-holder listings, not just sales.
- **Funding graph**: whale wallets funded from exchanges vs from other whale wallets — the latter suggests coordinated desks.

### 1.5 Velocity signals (momentum indicators)

- **Mints/hour**: primary-market velocity. A free mint going 10k/hr with rising unique minters = demand; same mints/hr from few wallets = bot/sybil farming (one wallet minting 500 = one actor, not 500 buyers).
- **Unique minters** (not mint count): the real demand metric. minter-to-mint ratio < 0.5 = concentrated.
- **Secondary volume acceleration**: second derivative of volume — volume rising *faster* than listings = squeeze; volume rising with listings = churn.
- **List-to-sale lag**: time from listing to sale at floor. Shrinking lag = heating market; growing lag = cooling.
- **Mint→first-listing→first-sale latency**: in free-mint flips, the gap between mint and first secondary sale measures how fast paper hands are exiting (see §1.6).
- Caveat: Blur-era volume is polluted by rewards farming — "surging trading volume doesn't suggest the market is growing… it's mostly whales trading among themselves" ([nation.lk on Blur vs OpenSea](https://nation.lk/online/blur-overtakes-opensea-as-ethereum-nft-trading-skyrockets-194701.html)). Always decompose volume into unique buyers/sellers before reading momentum.

### 1.6 How free mints get flipped profitably (typical lifecycle)

1. **Mint** (cost = gas only). Bots mint via contract directly, pre-signed, through private mempools (see §1.7).
2. **Reveal timing**: pre-reveal, all tokens trade as unrevealed at a speculation price; post-reveal, trait dispersion reprices everything in minutes. Flippers decide: sell unrevealed into hype (certain, lower) or gamble on rare traits (variance).
3. **Listing timing**: the first listings set the opening floor. Listing in the first minutes captures peak FOMO liquidity but competes with every other flipper. Data point from 2026 flip guides: mint-arbitrage windows are typically **6–12 hours from mint to reveal**; most profitable flips exit within the first liquidity surge, and holding beyond ~72 hours risks becoming exit liquidity. [altcoininvestor flip guide](https://altcoininvestor.com/how-to-flip-nfts-for-profit-2/) (treat the 72h figure as heuristic, UNVERIFIED as a rule).
4. **Undercutting dynamics**: flippers undercut each other by 1–5% to win the sale. This is a race to the bottom *unless* buy-side demand (bid walls, sweeps) absorbs listings. Net effect: opening floors almost always decay from the first-sale print; the first sale is the high, not the norm.
5. **Royalty impact on net proceeds**: creator royalties are now effectively optional on most high-volume venues — ~80% of ecosystem volume doesn't pay full creator earnings, per OpenSea's own admission, with most volume in zero-fee environments ([bitcoinworld](http://bitcoinworld.co.in/in-highly-controversial-move-opensea-lowers-fees-to-0-for-limited-time/)). For the *flipper*, that means net = sale − marketplace fee − gas, with royalty often ~0 on Blur. For the *creator*, assume 30–60% royalty compliance on high-volume marketplaces and near-zero on Blur when modeling revenue ([altcoininvestor royalties 2026](https://altcoininvestor.com/how-do-nft-royalties-work/)).
6. **When holding beats flipping**: hold when (a) you minted a top-decile rarity trait and rarity-price correlation is strong in that collection, (b) unique-holder growth is accelerating while listing ratio stays low (supply squeeze forming), (c) there is a dated catalyst (reveal, utility drop, exchange listing). Otherwise, flipping into the opening liquidity is the base case — hope is not a strategy.

### 1.7 Gas wars and MEV on mints

**How FCFS mint bots win** (public playbook, [nft-mint-bot README](https://github.com/mixue97/nft-mint-bot/blob/HEAD/README.md)):
- Mint **directly through the contract**, not the dApp UI (UI adds latency and failure modes).
- Pre-encode calldata and pre-sign transactions before mint time.
- Broadcast through a **private mempool** (Flashbots Protect / `eth_sendBundle`) to avoid being frontrun in the public mempool.
- Fan out a **tip ladder**: multiple transactions with rising priority fees, so at least one lands early.
- Race **multiple paid RPC endpoints** for lowest broadcast latency; use NTP-synced schedulers firing milliseconds before the drop.

**MEV mechanics relevant to mints** ([Coin Metrics MEV research](https://5264302.fs1.hubspotusercontent-na1.net/hubfs/5264302/special-insights/coinmetrics-research_what-is-mev-anyway.pdf), [MEV strategies skill](https://github.com/martin-t79/everything-claude-trading/blob/HEAD/skills/crypto/mev-strategies/SKILL.md)):
- **Priority fees**: post-1559, `maxPriorityFeePerGas` is the tip that orders you within a block. In a gas war this becomes a **gas priority auction** — bots bid tips up until marginal profit ≈ 0.
- **Private mempools / relays**: under proposer-builder separation, MEV flows through private order flow (Flashbots/MEV-Boost relays) rather than public GPA bidding; bundles get atomic inclusion with revert protection (failed bundle = no fee paid).
- **Sandwiching of mint txs**: a visible mint transaction in the public mempool can be frontrun — a bot copies the calldata with a higher tip, mints the allocation (or the rare-token-targeting variant: bots simulate to snipe specific token IDs), and the victim's tx reverts on sold-out or gets a worse token. Defense is the same: don't expose mint intent in the public mempool.
- **NFT-specific MEV**: listing snipes (buying mispriced listings before others), mint racing, cross-marketplace arbitrage (buy on Blur 0.9, sell on OpenSea 1.0 — UNVERIFIED as currently exploitable at scale given fee/royalty fragmentation).
- Practical takeaway for manual minters: if you're competing with bots on a hyped FCFS mint from a browser wallet in the public mempool, you're the exit liquidity for the tip ladder. Either use private-mempool broadcast yourself or skip the war.

---

## 2. SECURITY — TRUST NO ONE

### 2.1 Approval scams (setApprovalForAll phishing)

**Mechanism.** `setApprovalForAll(operator, true)` on an ERC-721/1155 contract grants the operator transfer rights over **every token you hold in that collection** — not just the one you're listing. Phishing sites frame this as "verify wallet," "claim NFT," or "complete mint"; the wallet prompt shows `SET APPROVAL FOR ALL` while the site copy talks about something innocuous. Once granted, the attacker's drainer contract calls `transferFrom`/`safeTransferFrom` at its leisure — the theft can happen seconds or months later, triggered automatically when new deposits arrive (dormant approvals that "activate" on balance changes are a documented DaaS pattern). [ThreatPaths TP-0032](https://github.com/elchacal801/flame-exchange/blob/HEAD/ThreatPaths/TP-0032-web3-wallet-drainer-approval-phishing.md) [Coinbase scam-function guide](https://www.coinbase.com/zh-sg/learn/tips-and-tutorials/how-to-spot-a-scam-in-smart-contract-functions)

**The kill chain** (per ZeroTrace Labs' Monkey Drainer case study — Venom/Inferno/Pink drainer kits collectively extracted hundreds of millions in 2023): lure (compromised X/Discord accounts, typosquat domains, even paid search ads) → wallet connect → frontend auto-scans your ERC-721/1155/20 holdings and ranks by value → presents the approval/permit as a required step → drainer executes `transferFrom` within seconds of approval. [ZTL case study PDF](https://zerotracelabs.xyz/downloads/ZTL_CaseStudy_Monkey_Drainer_NFT_Phishing_Campaign_Anatomy_of_a_Phishing_a_2026-03-21.pdf)

**Defense:**
- Read the actual function name in the wallet prompt. `setApprovalForAll` to an address you don't recognize = stop.
- ERC-20 variant: unlimited `approve()` — same class of bug; revoke stale approvals periodically (revoke.cash-style tooling).
- Use a wallet with signature/transaction parsing that decodes what you're signing (see §2.4).
- Segregate: mint/claim from a hot wallet that holds nothing valuable; keep grails in a vault that never touches new sites.

### 2.2 Fake-mint detection (copycat collections)

**Real example we hit:** OpenSea slug `cryptopons` was a **delisted copycat** of the real `crypto-pons` collection. Same-name/lookalike slugs, art, and branding — the marketplace delisted it, but the contract still exists onchain. Lesson: a marketplace listing (or its absence) is not verification.

**How to verify the real contract:**
1. **Creator links**: start from the project's official X/website (typed by you, not clicked from a DM) and follow *their* posted contract address. Then verify the address matches what the marketplace page shows.
2. **Onchain name/symbol**: call `name()`/`symbol()` on the contract via an explorer — copycats often have subtly different symbols or generic names.
3. **Deployment recency**: a "v2" or "official mint" contract deployed 3 days ago for a project that's a year old is a red flag. Check deployer history — is the deployer the project's known wallet?
4. **Cross-check X account ↔ contract**: the project's official account should have posted the address; search their timeline. If the only source of the address is a reply-guy or a promoted ad, walk away.
5. **Marketplace verification badges** help but are not sufficient — badges have been gamed; delisting (as with `cryptopons`) happens *after* damage.
6. **Holder distribution**: real mints show organic holder spread; a copycat often shows a handful of wallets or a single deployer airdropping to itself.

### 2.3 Honeypot NFTs (can't sell / transfer-blocked)

**Mechanism.** Unlike ERC-20 honeypots (buy works, sell reverts), NFT honeypots typically work by:
- `transferFrom`/`safeTransferFrom` overrides that revert for non-whitelisted holders — you can receive/mint but can never list or move the token.
- Marketplace-level blocking: contract blacklists marketplace conduit addresses, so listings silently fail.
- Time-delayed ("stealth") variants: transfers work for hours to build trust, then an owner-only function flips the switch. ([Medium/Oran 2026 survey](https://medium.com/@oranmarketofficial/why-cant-i-sell-my-crypto-solving-the-transaction-failed-error-and-the-honeypot-trap-2026-21af6c927476) — treat the "stealth honeypot rise" claim as UNVERIFIED beyond this source.)

**Detection:**
- **Simulate before you commit**: run the transfer/sell as an `eth_call` simulation (tenderly-style or a local fork) — a reverting simulation is a hard stop. This is the single highest-signal test.
- **Read the contract**: look for `onlyOwner` transfer gates, blacklists, `tradingEnabled`-style switches, whitelists in `_beforeTokenTransfer`/`_update` overrides. Unverified source = treat as hostile.
- **Ownership privileges**: owner can pause transfers / change URIs / mint infinite supply → centralized rug vectors even if not an immediate honeypot.
- **Trade-history check**: zero successful secondary sales while "volume" is advertised = red flag (same logic as DEXTools' no-sell heuristic for tokens). [Steemit honeypot tooling roundup](https://steemit.com/honeypot/@wingrex2/how-to-check-if-a-smart-contract-is-a-honeypot-or-useful-tools-and-resources)
- Scanners (GoPlus, Token Sniffer) are a first pass, not a verdict — they miss novel patterns. Simulation + source review is the bar. (UNVERIFIED whether current GoPlus NFT modules cover ERC-721 transfer-gating specifically.)
- **Recovery scams**: anyone in Telegram/Discord/X offering to "unlock" your honeypot token for a fee is running a second scam on you. There is no manual fix for a malicious contract.

### 2.4 Signature phishing (EIP-712 blind signing)

**Why it's the dominant vector now.** The modern drainer increasingly doesn't ask for an onchain `approve()` at all — it asks for an **off-chain EIP-712 signature** (`eth_signTypedData_v4`): an EIP-2612 `Permit` or Uniswap `Permit2` `PermitSingle`/`PermitBatch`. Signing is gasless, produces no on-chain record, and "feels safe" because users were trained that message-signing is harmless. Scale: ~260,000 victims and $314M lost to phishing on EVM chains in H1 2024 alone, already exceeding all of 2023. [leekwallet ANTI-SCAM](https://github.com/0xoucan/leekwallet/blob/HEAD/docs/ANTI-SCAM.md)

**What a malicious typed-data payload looks like:**
- **Domain**: `verifyingContract` = Uniswap's **Permit2** address (0x000000000022D473030F6466DE2242345BA0F963), *not* the project's contract — you're authorizing token movement through a universal allowance router while the site talks about "claiming an NFT." Any NFT-claim flow whose EIP-712 domain is Permit2 is malicious, full stop.
- **Message fields**: `PermitSingle`/`PermitBatch` with `spender` = attacker address, `amount` = type(uint160).max or your full balance, `deadline` = far future (the signature stays valid long after the phishing site is gone — the drain fires when the attacker chooses, with no on-chain link back to the site).
- **EIP-2612 Permit**: `owner` = you, `spender` = attacker, `value` = max, `deadline` = far future. Gasless, invisible, same outcome.
- **Seaport/marketplace order signatures**: a typed "order" selling your grail for 0.01 ETH to the attacker's conduit — reads as "sign to list" in sloppy UI.
- **Display-layer attacks**: even "clear signing" can lie — a 2026 hardware-wallet audit found a renderer that displayed only `token` + `amount` while silently signing `spender = ATTACKER` in the same struct hash (WYSIWYS violation). [pq1 audit](https://github.com/ethereumphone/pq1/blob/HEAD/docs/audits/wysiwys-clearsign-20260625-114309.md) Never trust the rendered summary alone on high-value actions; verify the raw fields.

**Defense:**
- "Sign this message to claim" + Permit/Permit2 domain = scam. Legitimate claims need at most a `personal_sign` of a nonce, or an actual mint transaction.
- Check `spender`, `amount`, `deadline`, and `verifyingContract` in the raw typed data before signing — not just the wallet's summary card.
- Treat `eth_sign` (raw) as radioactive; reputable wallets warn or block it. [veyrnox wallet threat model](https://github.com/veyrnox/veyrnox/blob/HEAD/docs/PhaseD.walletconnect.md)
- The "transactionless scam" insight stands: **you can lose everything without ever sending an on-chain transaction.** [dev.to/transactionless-scam](https://DEV.to/bxmmm1/transactionless-scam-27il)

---

## 3. OPERATING RULES (derived)

1. Never sign what you can't decode. If the wallet can't show you the raw EIP-712 fields, don't sign.
2. Verify contract from creator-owned channels, then confirm onchain (`name()`/`symbol()`/deployer). Marketplace presence ≠ legitimacy (`cryptopons` lesson).
3. Simulate transfers before trusting a new collection's contract.
4. Mint/claim from a burner; vault wallets never touch new sites.
5. Read volume with unique-buyer decomposition — wash filters (self-trade, back-and-forth, cycles, common funder) before believing any chart.
6. Free-mint flips: the base case is selling into opening liquidity; holding needs a rarity edge or a dated catalyst, not hope.

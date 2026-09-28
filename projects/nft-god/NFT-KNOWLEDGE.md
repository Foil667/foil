# NFT-KNOWLEDGE.md — Foil's distilled NFT reference

Synthesized 2026-09-24 from `research/01-standards-mint-mechanics.md`, `02-market-security.md`, `03-robinhood-data-sources.md` (all sourced, inline links in the originals). Standing posture: **TRUST NO ONE — verify onchain before believing.** Items not grounded are marked **UNVERIFIED**.

---

## 1. Token standards (cheat sheet)

| Standard | What it is | Key verified facts |
|---|---|---|
| ERC-721 | Base NFT | ifid `0x80ac58cd`; metadata ext `0x5b5e139f`; safe transfers call `onERC721Received` |
| ERC-1155 | Multi-token (fungible + non-fungible in one contract) | ifid `0xd9b67a26`; batch transfers; `{id}`-templated `uri()` |
| ERC-721A | Gas-optimized batch minting (Azuki) | Writes owner once per batch; 5-mint gas 616,914 → 85,206 (~7.2×). Uses ERC-2309 `ConsecutiveTransfer` |
| ERC-721C | Enforceable royalties (Limit Break) | Transfer hooks delegate to external validator registry; blocklists zero-royalty marketplaces. Superseded OpenSea's Operator Filter (dead 2024-02-29). OpenSea added support via Seaport v1.6 hooks |
| ERC-6551 | Token-bound accounts (NFT owns a wallet) | Registry `0x000000006551c19487814612e58FE06813775758` (same on all EVM chains); `createAccount` `0x8a54c52f`; account ifid `0x6faff5f1`; executable ifid `0x51945447`. Sale transfers the whole account + assets |
| ERC-4907 | Rentals | `user` role separate from `owner`, auto-expires; ifid `0xad092b5c`. User cannot transfer |
| ERC-5192 | Soulbound (minimal) | `locked(tokenId)` bool; ifid `0xb45a3c0e`. Caveat: sell-the-wallet defeats it — commitment device, not identity |
| DN404 | Divisible hybrid (experimental) | Two contracts: ERC-20 base + ERC-721 mirror; base mints/burns mirror NFTs at whole-unit thresholds. ~20% cheaper than ERC-404. Unaudited at launch — experimental |
| cNFTs | Compressed (Solana Bubblegum) | State in Merkle tree, only root on-chain; ~1M cNFTs ≈ 5 SOL vs ~12k SOL uncompressed. **No canonical EVM equivalent (UNVERIFIED)** |

ERC-2981 (royalties, ifid `0x2a55205a`) is info-only — marketplaces may ignore it. In 2026, ~80% of ecosystem volume doesn't pay full creator earnings; plan royalty compliance at 30–60% on major venues, ~0 on Blur.

---

## 2. SeaDrop — the drops contract (verified from ProjectOpenSea/seadrop source)

- **Singleton:** `0x00005EA00Ac477B1030CE78506496e8C2dE24bf5` — same address on every chain incl. Robinhood Chain (CREATE2 via Nick's factory). Verify via `eth_getCode` + code hash `0x53e4b9339cf624803c9a7d0195576cca5b917920813508d86b3eb93dcbabeb5c` on RH.
- **Architecture:** NFT contract grants SeaDrop mint rights; creators configure stages from the NFT contract; minters call SeaDrop directly; SeaDrop calls back `mintSeaDrop(minter, quantity)`.
- **PublicDrop** (one storage slot): `mintPrice` (uint80), `startTime`/`endTime` (uint48), `maxTotalMintableByWallet` (uint16), `feeBps` (uint16), `restrictFeeRecipients` (bool).
- **AllowListData:** `merkleRoot` (bytes32), `publicKeyURIs` (string[]), `allowListURI` (string). **No merkle root set = unsigned public stage.**
- **MintParams** (allowlist/signed, all uint256 + bool): mintPrice, maxTotalMintableByWallet, startTime, endTime, dropStageIndex (non-zero for non-public), maxTokenSupplyForStage, feeBps, restrictFeeRecipients.
- **Selectors (computed from canonical signatures):** `mintPublic(address,address,address,uint256)` = `0x161ac21f` · `mintAllowList` = `0x4300a4e6` · `mintSigned` = `0x4b61cd6f` · `mintAllowedTokenHolder` = `0x99eb900f`.
- **Payment:** `_checkCorrectPayment` reverts unless `msg.value == qty × mintPrice`. **Price 0 skips payment entirely.** Fee split: `feeAmount = msg.value × feeBps / 10_000` → feeRecipient, rest → creator.
- **Mint event:** `SeaDropMint(nftContract, minter, feeRecipient, payer, quantityMinted, unitMintPrice, feeBps, dropStageIndex)` — public mints use stage index 0. **Watchdog: scan this event, not just Transfers.**
- **Merkle leaf:** `keccak256(abi.encode(minter, mintParams))` — per-address price/caps/windows baked into the leaf.
- **Signed mints (EIP-712):** typehash `SignedMint(address nftContract,address minter,address feeRecipient,MintParams mintParams,uint256 salt)`, domain name `"SeaDrop"` v`"1.0"`. Each (signer, signature) single-use. `SignedMintValidationParams` caps what a signer key may authorize (damage containment).
- **SeaDrop 1.0 does NOT do Dutch auctions** (envisioned for later versions).

---

## 3. Mint mechanics

- **Allowlist/merkle:** O(log n) proofs vs O(n) on-chain mappings. SeaDrop leaf binds minter + full MintParams.
- **Signature-gated:** backend-issued ECDSA per-minter auth (we hit this live: CryptoPons GTD at 12:10 PM CDT 2026-09-24 was signature-gated; our wallet had no signature → all paths reverted).
- **Dutch auctions:** descending price, overpayment refunded; defuses gas wars only if the decay curve segments buyers; weak demand bleeds to reserve and reads as a failed mint.
- **Bonding curves / VRGDA:** price rises with supply minted; early (often insider) minters capture the spread; demand stalls → death spiral.
- **Free-mint economics:** distribution over revenue; minters pay gas only; everyone "in profit" post-mint; revenue shifts to secondary royalties (Loot 5%, Art Gobblers 6.9%, GoblinTown 7.5% — the canonical free-mint success). Needs HIGH secondary volume to monetize (10k supply at 5% needs 2,000 ETH lifetime volume to gross 100 ETH). Floors anchor near gas cost; flipper overhang suppresses price. **"Free mint" is the #1 NFT phishing lure.**

---

## 4. Robinhood Chain — operating facts

- **Chain ID 4663** (`0x1237`). Arbitrum Orbit/Nitro L2, settles to Ethereum. Mainnet 2026-07-01. Testnet 46630.
- **Gas token is ETH** (bridged). No chain token — any "$HOOD" is a memecoin. Base fee ~0.05–0.07 gwei. Block time ~100 ms.
- **CRITICAL — single-sequencer FCFS ordering: no gas/priority-fee auctions.** Mint races are won by **arrival time at the sequencer**, not by bidding. Optimize: lowest-latency submit path, pre-signed + pre-encoded tx, fire the instant the stage opens. Priority-fee ladders are theater on RH.
- **Thin public mempool** — pending-tx subscriptions show far less signal than L1; don't architect the race around mempool.
- **RPCs:** primary `https://rpc.mainnet.chain.robinhood.com` (rate-limited; keep a browser-like UA as precaution). WS feed `wss://feed.mainnet.chain.robinhood.com`. `robinhood-rpc.publicnode.com` (UNVERIFIED). Alchemy serves `robinhood-mainnet.g.alchemy.com` (signup). QuickNode `robinhood-mainnet.quiknode.pro` HTTPS+WSS (signup). viem ≥2.55 ships `robinhood` chain def.
- **Explorer:** Blockscout `robinhoodchain.blockscout.com`. REST API possibly Cloudflare-walled (UNVERIFIED) — prefer raw JSON-RPC. **Etherscan does not index 4663.**
- **Ground truth for any drop = onchain `getPublicDrop(nft)` on the SeaDrop singleton.** API/UI stage values lag.

## 5. Data sources (free vs paid)

- **OpenSea drops API — keyless does NOT work** (tested 2026-09-24: `?chain=robinhood` → 401). Free key via `POST /api/v2/auth/keys` (no signup, 30-day expiry, 60 reads/min, 3 keys/hour/IP) or permanent free key via developer.opensea.io signup. Endpoints: `GET /drops?type=upcoming|recently_minted|featured&chains=robinhood`, `GET /drops/{slug}` (stages), `POST /drops/{slug}/mint` (builds unsigned tx), `GET /drops/{slug}/eligibility` (wallet JWT).
- **Alchemy:** `alchemy_pendingTransactions` is ETH/Arbitrum/Polygon/Optimism **only — not RH**. Standard WS subs (`newHeads`, `newPendingTransactions`, `logs`) should work on their RH endpoint. Free 30M CU/mo (official FAQ).
- **QuickNode:** RH HTTPS+WSS yes. Streams = confirmed-block data only (not raw mempool). Free tier exists; Streams paid (~$20+/mo plans).
- **Blocknative: dead.** Mempool API discontinued; was Ethereum-only. Not viable.
- **Cheapest working stack:** public RPC + `wss://feed.mainnet.chain.robinhood.com` (`newHeads` @ ~100ms blocks + `getPublicDrop` polling) + OpenSea drops API free key for discovery. **Premint.xyz** pages are server-rendered HTML and parseable (no site-wide API — watchlist of slugs). **Superful** was down (Cloudflare 521) as of 2026-09-24. **Arctic Tools is a paid multi-account automation bot — excluded (ToS).** Alphabot has a site-wide raffles API supporting chainId 4663 but needs $8–12/mo signup (noted, not bought).

---

## 6. Market mechanics (for the screener + flip decisions)

- **Rarity:** trait-count / statistical / OpenRarity (rank-based). Mekacher et al. (400 collections): rarity→price correlation concentrated in **top 10% rarest**; rarer = higher ROI, lower negative-return probability. Limits: bottom ~50% of a collection prices as fungible floor; rarity is static post-reveal; can't price sentiment/liquidity; wash trades corrupt the datasets.
- **Floor** = cheapest ask (not traded value). Thin floors move on single events. **Bid walls** = exit liquidity (Blur incentives structurally pushed bids below floor). **Listing ratio** = listed/supply: <5% + rising volume = squeeze; >15–20% = overhang.
- **Wash-trade filters:** self-trades, back-and-forth A→B→A, ≥3-hop cycles, common funder/exit (Chainalysis: self-financed addresses; 262 users, $8.9M). Onchain tells: 2–5 addresses cycling one token at rising prices, <5% price deviation between legs, <12h elapsed, fresh buyer wallets funded minutes before purchase, volume spike with no unique-buyer growth.
- **Whale signals:** steady accumulation without relisting (vs buy→list flipping); single-block sweeps (mechanical floor moves); concentration % (top-10 >20% = danger zone, UNVERIFIED as universal); dormant-whale listings = supply shock; funding-graph analysis (exchange-funded vs whale-funded).
- **Velocity:** mints/hour + **unique minters** (minter:mint ratio <0.5 = concentrated/sybil); secondary volume acceleration (2nd derivative); list-to-sale lag; mint→first-sale latency. Blur-era volume is rewards-farmed — always decompose into unique buyers/sellers.
- **Free-mint flip lifecycle:** mint (gas only) → reveal (unrevealed speculation vs trait gamble) → list into opening FOMO → undercutting race (1–5%) → floor decay from first-sale print. Profitable windows typically 6–12h mint-to-reveal; base case = sell into opening liquidity; **holding needs a rarity edge or dated catalyst, not hope** (72h heuristic, UNVERIFIED as rule). Fees decide sub-1-ETH flips: Blur 0% vs OpenSea 0.5–2.5%.
- **Gas wars/MEV:** contract-direct minting, pre-encoded + pre-signed txs, private mempools (Flashbots), tip ladders, multi-RPC race, NTP-synced schedulers. Public-mempool mint intent gets frontrun/sandwiched. **On RH specifically: none of the gas-bidding applies — it's an arrival-time race at the sequencer.**

## 7. Security — operating rules

1. **Never sign what you can't decode.** Raw EIP-712 fields (`spender`, `amount`, `deadline`, `verifyingContract`) before the wallet summary. `eth_sign` = radioactive.
2. **"Sign to claim" + Permit/Permit2 domain = scam, full stop.** Legit claims need at most `personal_sign` of a nonce or a real mint tx. 260k victims / $314M H1-2024. Display-layer attacks exist (2026 WYSIWYS audit) — verify raw fields on high-value actions.
3. **`setApprovalForAll` to an unknown address = stop.** Grants transfer rights over EVERY token in the collection; drainers (Monkey Drainer case study) execute within seconds; dormant approvals activate later.
4. **Fake-mint detection (6 steps):** creator-owned channel → their posted address → match marketplace page → onchain `name()`/`symbol()` → deployment recency + deployer history → X account ↔ contract cross-check → holder distribution sanity. **We lived this:** `cryptopons` was a delisted copycat of `crypto-pons` — marketplace presence ≠ legitimacy.
5. **Honeypots:** simulate transfers via `eth_call` first (highest-signal test); read for `onlyOwner` transfer gates, blacklists, `tradingEnabled` switches; zero secondary sales + advertised "volume" = red flag; "recovery services" are a second scam.
6. **Segregate:** mint/claim from a hot wallet holding nothing valuable; vault never touches new sites.
7. **Read volume with unique-buyer decomposition** — run wash filters before believing any chart.

---

## 8. Screener scoring (NFT_WATCHDOG_CHAD_V2, authoritative)

- Formula: `uniqueMintersRatio×30 + velocity×20 + contractAge×15 + verifiedSocials×15 + priceSanity×10 + holderConcentration×10` (each component 0–100).
- Risk multipliers: single top holder ≥50% of supply → ×0.45 · bot farm (>30 mints/min from clustered wallets) → ×0.75 · unverified contract + price >0.5 ETH → ×0.7.
- Thresholds: score ≥75 = execute candidate (free mints only, all fire-time checks still apply); score ≥60 = run expensive verification (rug check, deep verify); <60 = watch.
- Mission loop: 5-minute cheap detect+score pass; expensive work (Slither, deep verification) only on candidates ≥60.
- Rug check (~/workspace/nft-god/rug-check/): Slither or bytecode fallback; flags selfdestruct, delegatecall, unrestricted mint(), owner-only withdraw. Fail → blacklist + logged reason, never execute.

## 9. Standing verification checklist (fire-time, every claim)

Price exactly 0 wei · drop active (start ≤ now ≤ end) · no allowlist merkle root · `eth_call` simulation clean · gas < $0.50 · calldata contains NO approval selectors · official credible route. Any failure = abort, report which check.

## 10. UNVERIFIED items (do not treat as fact)

DN404 default unit denominator · ERC-721C security-level enum values · canonical EVM compressed-NFT equivalent · OpenRarity current UI status · 72h hold heuristic as a rule · stealth-honeypot trend beyond one source · GoPlus NFT-module coverage of transfer-gating · cross-marketplace arb viability at scale · top-10 >20% concentration as universal threshold · `robinhood-rpc.publicnode.com` reliability · Blockscout REST Cloudflare wall · QuickNode RH mempool depth · Alchemy Notify webhooks for RH · RH membership in OpenSea drops API chain list.

# Robinhood Chain data sources — NFT God research note

Researched 2026-09-24. Read-only; no signups, no keys created, no onchain actions.

## 1. Robinhood Chain facts

| Property | Value |
|---|---|
| Chain ID | **4663** (`0x1237`) — confirmed live via `eth_chainId` against the public RPC 2026-09-24 |
| Stack | Arbitrum Orbit / Nitro L2, settles to Ethereum (blobs/EIP-4844) — [GetBlock RH page](http://getblock.io/nodes/robinhood/) |
| Mainnet launch | 2026-07-01 ([source](https://github.com/mikeypetrillo/agent402/blob/HEAD/wiki/Robinhood-Chain.md)) |
| Testnet | chain ID **46630**, RPC `https://rpc.testnet.chain.robinhood.com`, explorer `explorer.testnet.chain.robinhood.com`, faucet `faucet.testnet.chain.robinhood.com` ([source](https://github.com/nirholas/learn-robinhood-chain/blob/HEAD/content/01-what-is-robinhood-chain.md)) |
| Native gas token | **ETH** (bridged ETH, like Arbitrum One/Base). There is NO chain token — any "$HOOD chain token" is a memecoin, not a gas token ([source](https://github.com/nirholas/learn-robinhood-chain/blob/HEAD/content/01-what-is-robinhood-chain.md)). Canonical WETH: `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` ([source](https://github.com/payless2025/payless/blob/HEAD/docs/ROBINHOOD_CHAIN.md)) |
| Block time | ~100 ms soft confirmations (GetBlock measures ~10 blocks/sec; `Δ +0s` between blocks) ([source](https://github.com/getblock-io/guides/blob/HEAD/robinhood-ai-agent/README.md)) |
| Sequencing | **FCFS: first-come-first-served** by arrival time at the sequencer. Single sequencer operated by Robinhood. "No priority fee auctions" ([source](http://getblock.io/nodes/robinhood/)). ⚠️ **This is the single most important fact for a mint-racing watchdog: priority fees / gas bidding do NOT win ordering on RH — only arrival time at the sequencer does.** Base fee ~0.05–0.07 gwei (measured, e.g. [Edge integration notes](https://github.com/edgeapp/edge-currency-accountbased/blob/HEAD/src/docs/robinhood-chain.md)) |
| Mempool visibility caveat | Single-sequencer FCFS chains have a thin/nonexistent public mempool compared to Ethereum: the race is decided inside the sequencer. Pending-tx subscriptions will show far less signal than on L1. See §4 |

### RPC endpoints

- **Primary public RPC:** `https://rpc.mainnet.chain.robinhood.com` — rate-limited; fine for scripts, not production ([source](https://github.com/mashharuki/robinhood-chain-sample/blob/HEAD/rh-deploy/.agents/skills/robinhood-chain/SKILL.md))
- **User-Agent note (corrected):** an earlier community note said the public RPC needs a browser-like UA. Tested 2026-09-24: `eth_chainId` returned `0x1237` (HTTP 200) with **both** curl's default UA and a browser UA, so no UA block was active at test time. Keep a browser-like UA anyway as a precaution; UA-less HTTP clients may still be filtered.
- **Sequencer feed (WS):** `wss://feed.mainnet.chain.robinhood.com` ([source](https://github.com/nirholas/learn-robinhood-chain/blob/HEAD/content/01-what-is-robinhood-chain.md))
- **Additional public endpoint:** `robinhood-rpc.publicnode.com` (listed by chainid.network, cited in [Edge's RH integration](https://github.com/edgeapp/edge-currency-accountbased/blob/HEAD/src/docs/robinhood-chain.md)) — **UNVERIFIED** by me; test before relying.
- **Alchemy:** `https://robinhood-mainnet.g.alchemy.com/v2/<key>` ([source](https://github.com/mashharuki/robinhood-chain-sample/blob/HEAD/rh-deploy/.agents/skills/robinhood-chain/SKILL.md)) — signup required (not done).
- **QuickNode:** `robinhood-mainnet.quiknode.pro` HTTPS + WSS endpoints; QuickNode publishes an official [RH full-node guide](https://www.quicknode.com/guides/robinhood/how-to-run-a-robinhood-chain-full-node) — signup required (not done).
- **GetBlock:** RH mainnet + testnet (4663/46630) on Shared, Limitless, and Dedicated nodes; full + archive data; JSON-RPC + WebSocket; Frankfurt and New York regions ([source](https://getblock.io/index.md), [RH quickstart](https://github.com/getblock-io/getblock-docs/blob/HEAD/api-reference/robinhood/README.md)) — signup required (not done).
- dRPC / Blockdaemon / Validation Cloud also listed as working providers ([source](https://github.com/ismailmoazami/robinhood-chain-quickstart/blob/HEAD/AGENTS.md)) — **UNVERIFIED** by me.
- Etherscan does **not** index chain 4663 — no etherscan-style API. Contract verification/tx views happen only on Blockscout ([source](https://github.com/getblock-io/getblock-docs/blob/HEAD/api-reference/robinhood/README.md)).

### Explorer

- **Blockscout:** `https://robinhoodchain.blockscout.com` (mainnet). Testnet: `explorer.testnet.chain.robinhood.com`.
- ⚠️ One community report says the Blockscout REST v2 API is behind a Cloudflare bot-challenge — server-side discovery should prefer raw JSON-RPC over the Blockscout API ([source](https://github.com/nonfungibleh/vestream/blob/HEAD/docs/superpowers/specs/2026-08-29-hoodlock-robinhood-chain-design.md)). **UNVERIFIED** by me.
- Chain definitions ship in viem ≥2.55.0 as `robinhood` / `robinhoodTestnet` ([source](https://github.com/nirholas/learn-robinhood-chain/blob/HEAD/content/01-what-is-robinhood-chain.md)).

### SeaDrop on Robinhood Chain

- Canonical SeaDrop 1.0 singleton: **`0x00005EA00Ac477B1030CE78506496e8C2dE24bf5`** — CREATE2-deployed, same address on every SeaDrop chain incl. RH ([ProjectOpenSea/seadrop README](https://github.com/ProjectOpenSea/seadrop), [Loxleys RH deployment](https://github.com/dnebayis/loxleys), [PEPurge RH README](https://github.com/pepeisthedev/pepurge/blob/HEAD/hardhat/README.md))
- SeaDrop 1.0 runtime code hash on RH: `0x53e4b9339cf624803c9a7d0195576cca5b917920813508d86b3eb93dcbabeb5c` ([source](https://github.com/sinjoh-finance/sinjoh-contracts/blob/HEAD/sinjoh-contracts-v2/deployments/YIELD-BANKS-ACTIVATION.md)) — usable to verify a drop contract is really the singleton via `eth_getCode` + keccak.
- Known RH SeaDrop mint fn: `mintPublic(address nftContract, address feeRecipient, address minterIfNotPayer, uint256 quantity)` — selector `0x161ac21f`; working gas on RH: limit 180,000, maxFee ~0.5 gwei, base fee ~0.07 gwei (field notes from Dunlap/RH SeaDrop mints, [source](https://github.com/andyemad/nft-mint-rarity-toolkit/blob/HEAD/skills/web3/seadrop-rapid-mint/SKILL.md)).
- **Drop discovery flow for a watchdog:** for any suspected SeaDrop mint contract, call `getPublicDrop(<nftContract>)` on the singleton → returns stage timing, mintPrice, maxSupply, startTime/endTime. Public-stage truth should always come from this onchain read, not from UI/API caches (which lag). Note: testnet does NOT have the SeaDrop deployment — mainnet only ([source](https://github.com/pepeisthedev/pepurge/blob/HEAD/hardhat/README.md)).

## 2. OpenSea drops API

**Correction to the task premise:** `https://api.opensea.io/api/v2/drops?chain=robinhood` does **not** work keyless as of 2026-09-24. Verified live (three request variants: `?chain=robinhood`, `?type=upcoming&chains=robinhood`, `?chains=robinhood&limit=5`) — all returned **HTTP 401 `{"errors":["Missing an API Key, which is required for this request."]}`**. An `x-api-key` header is required for every v2 endpoint.

### Endpoints (all under `https://api.opensea.io/api/v2`)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/drops?type=<type>&chains=<chain>&limit=<n>&cursor=<cursor>` | List drops. `type`: `featured` \| `upcoming` \| `recently_minted` (from [opensea-js SDK source](https://github.com/ProjectOpenSea/opensea-js/blob/main/src/api/api.ts)) |
| `GET` | `/drops/{collection_slug}` | Drop details: stages, eligibility, supply |
| `POST` | `/drops/{collection_slug}/mint` | Build ready-to-sign mint tx (body: `{"minter": "0x…", "quantity": n}` — does NOT sign/submit) |
| `GET` | `/drops/{collection_slug}/eligibility` | Wallet-scoped eligibility (needs wallet JWT auth) |

(Source for endpoint table: [base/skills opensea plugin](https://github.com/base/skills/blob/HEAD/skills/base-mcp/plugins/opensea.md), [opensea-skill](https://github.com/projectopensea/opensea-skill/blob/HEAD/opensea-api/SKILL.md))

### Query params (`GET /drops`)

From the official SDK types ([`src/api/types.ts`](https://github.com/ProjectOpenSea/opensea-js/blob/main/src/api/api.ts) — `GetDropsArgs`):
- `type` — `featured` \| `upcoming` \| `recently_minted`
- `limit` — max results
- `chains` — comma-separated chain identifiers; RH chain identifier is `robinhood` (matches the `?chain=robinhood` convention). Supported chains on the API include `ethereum`, `base`, `matic`, `arbitrum`, `optimism`, `zora`, `blast` ([source](https://github.com/majiayu000/claude-skill-registry/blob/HEAD/skills/data/opensea-api/SKILL.md)) — RH membership on the API is presumed but **UNVERIFIED** (couldn't query without a key).
- `cursor` — pagination cursor.

### Response shape

`GetDropsResponse` = `{ drops: Drop[], next/previous cursors }` (`QueryCursorsV2`). Per the SDK, each `Drop` carries (camelized from the API's snake_case `DropResponse`):
- `collection` (collection summary incl. slug/name), `contract` (asset contract address), `name`/`description`/`banner_image`
- drop windows: `start_time`, `end_time`; `mint_price`; supply fields
- `/drops/{slug}` returns `DropDetailed` = drop + `stages` array (stage type, `startTime`/`endTime` per stage) + eligibility
- `POST /drops/{slug}/mint` returns `DropMintResponse` with the unsigned transaction (to/value/data)

⚠️ Watchdog note from field practice: API/SSR stage values can lag; for hot/FCFS mints use onchain `getPublicDrop()` as ground truth and treat the API as discovery/eligibility only ([source](https://github.com/dhasap/nft-mint-agent/blob/HEAD/references/opensea-official-skill-lessons.md)).

### Auth and rate limits (no key created; docs only)

- Free key: **no signup needed** — `POST https://api.opensea.io/api/v2/auth/keys` returns a key + `expires_at` (30 days), `rate_limits: { read: "60/m", write: "5/m", fulfillment: "5/m" }`; **3 key creations/hour/IP** ([source](https://github.com/base/skills/blob/HEAD/skills/base-mcp/plugins/opensea.md), [official api-keys docs](https://docs.opensea.io/reference/api-keys?ref=pinata.cloud))
- Classic published limits: **4 GET/sec, 2 POST/sec** per API key ([source](https://github.com/majiayu000/claude-skill-registry/blob/HEAD/skills/data/opensea-api/SKILL.md))
- A free permanent (non-expiring) key comes from a free signup at [developer.opensea.io](https://developer.opensea.io) — **documented only; signup NOT done per hard lines.**
- Higher limits via [opensea.io/settings/developer](https://opensea.io/settings/developer).

## 3. CCFF00 culture notes

(Caveat: CCFF00/HoodStreet is a community scene, not a documented protocol — most of this is community knowledge and the user's own field notes, not verifiable official docs. Marked where sourced.)

- **CCFF00 = "squares"** — the founding-membership NFT collection of the **HoodStreet** community, fully onchain on Robinhood Chain (4663). Holding a square is the credential that unlocks the scene's free-mint allowlists.
- **The scene's hub:** 24/7 X Spaces under **HOODSTREET MEDIA** (@HoodStreetMedia; hosts @RealCashpig, @RoaringPiggy — founder of @hoodstreetcap and @ccff00club — @STACCOverflow, @vibesforreal1, @40yrdegen). This is where mint intel breaks first; X posts by project accounts are the primary announcement surface. (User field notes, 2026-09-20..24.)
- **How free mints flow** (observed pattern):
  1. **Project X announcement** — project posts supply/price/window (typical: 3,333–5,555 supply, free + gas, per-wallet caps like 1/wallet). Examples: Identicon Punks GTD free mint for top-2,000 CCFF00 holders (went live 2026-09-21), Furnace GTD claim (1,000 spots, live 2026-09-22), Rounds free mint for square holders (sold out evening of 2026-09-20).
  2. **Allowlist/GTD stage** — square-holders (sometimes tiered by square count/rank) get guaranteed spots; often an allowlist checker site (e.g. thefurnacexyz for Identicon Punks).
  3. **FCFS overflow** — remaining supply goes first-come-first-served; this is where the mint-racing watchdog matters, and also where **scam risk is highest** (fake mint links were circulating for Identicon Punks; "CCFF00 PUNK" was a paid drop falsely marketed as a free mint — community-flagged scam, Sep 2026).
  4. **Public** — leftovers open to everyone.
- **Verification discipline is the local currency:** always verify the drop contract address against the project's own announcement before claiming (fake-mint warnings are routine); verify SeaDrop contracts against the singleton `0x00005EA00Ac477B1030CE78506496e8C2dE24bf5` (§1). The scene has active scam vectors (@CCFF00Diamonds skipped as a possible scam vector).
- **Why RH chain for this:** free mints + ~0.05–0.07 gwei base fees make claiming effectively gas-only; the friction cost of a claim is cents, so allowlist-gated drops are the whole game.

## 4. Mempool / pending-tx data providers for a mint-racing watchdog

### Alchemy
- **Offers:** enhanced WebSocket `alchemy_pendingTransactions` — subscribes to pending txs with filters on `fromAddress` / `toAddress` (up to 1,000 addresses), full tx objects or `hashesOnly: true` (prefer hashes — cheaper/lighter), optional re-orged/removed txs ([Alchmy docs](https://alchemy.com/docs/reference/alchemy-pendingtransactions)). Also `newPendingTransactions` (hashes only), `newHeads`, `logs` via standard `eth_subscribe`, plus Notify **webhooks** (`ADDRESS_ACTIVITY`, `MINED_TRANSACTION`, `DROPPED_TRANSACTION`, `NFT_ACTIVITY`) scoped per chain ([Hookdeck guide](http://hookdeck.com/webhooks/platforms/guide-to-alchemy-webhooks-features-and-best-practices)).
- **Tiers:** Free = 30M compute units/month per official pricing FAQ (note: an Alchemy marketing page claims 300M — **conflicting figures; use the official pricing page**). PAYG ≈ $0.45/M CU first 300M, then $0.40/M. WebSocket: 100 concurrent connections/app on Free, 2,000 on paid; 1,000 unique subs/connection ([Alchmy WS limits docs](https://github.com/alchemyplatform/docs/blob/HEAD/content/api-reference/bitcoincash/utxo-websockets.mdx)).
- **RH support: PARTIAL.** Alchemy serves RH RPC at `robinhood-mainnet.g.alchemy.com/v2/<key>` — so standard WS subs (`newHeads`, `newPendingTransactions`, `logs`) should work on 4663. **BUT** `alchemy_pendingTransactions` (the filtered enhanced sub) is documented as supported **only on Ethereum, Arbitrum, Polygon, Optimism** ([docs](https://www.alchemy.com/docs/reference/subscription-api)) — Robinhood Chain is **not** in the list, so plan on it being unavailable for 4663. Notify webhook availability for RH: **UNVERIFIED**.
- Signup required (not done).

### QuickNode
- **Offers:** `robinhood-mainnet.quiknode.pro` HTTPS + WSS endpoints ([source](https://github.com/wock9000/robinhoodpools/blob/HEAD/docs/RPC_OPERATIONS.md)). **Streams** — filtered real-time + historical blockchain data (receipts/logs) to S3/Postgres/Snowflake/webhooks; filters run server-side; billed on post-filter data received ([QuickNode blog](https://blog.quicknode.com/accelerate-your-blockchain-products-with-streaming-indexed-data/)). **QuickAlerts** — real-time webhook alerts on tx/activity patterns. Marketplace **add-ons** (e.g. Lil JIT bundle submission, `qn_estimatePriorityFees`, Metaplex DAS — chain-dependent).
- **Tiers:** free tier exists; paid plans from ~$20/mo ([theaisurf listing](https://theaisurf.com/listing/quicknode/)). Streams is a paid product — a filtered-streams example ran ~$480 for 194 GB vs ~$2,468 for unfiltered 987 GB (Build plan; much cheaper on Scale with compression: ~$14 / 103 GB filtered, [source](https://blog.quicknode.com/accelerate-your-blockchain-products-with-streaming-indexed-data/)).
- **RH support: YES for RPC/WSS.** Mempool specifics for RH: **UNVERIFIED** — Streams delivers *confirmed-block* data (receipts/logs), not raw mempool, so Streams is a post-confirmation feed, not a pre-confirmation race feed. Whether QuickNode's RH WSS exposes raw `newPendingTransactions` with useful depth is untested. Also: QuickNode's dedicated gRPC `MEMPOOL_TXS` stream seen in their Hyperliquid docs is **Hyperliquid-specific** ([source](https://www.quicknode.com/guides/hyperliquid/run-non-validating-node-with-quicknode-peering)) — not RH.
- Signup required (not done).

### Blocknative
- **Do not use.** Blocknative's mempool API was **discontinued** (CoW Swap removed its Blocknative mempool integration citing the discontinuation, [source](https://github.com/cowprotocol/cowswap/pull/4902)). Their public explorer `ethernow.xyz` was Ethereum-only and EF-grant-funded ([CoinDesk, 2023](https://www.coindesk.com/tech/2023/12/07/blocknative-releases-new-ethereum-mempool-explorer-to-help-with-mev-protection)). No RH (4663) support at any point.

### Watchdog design implications (synthesis, not provider claims)

1. **On RH there is no gas auction.** Arrival time at the single sequencer decides inclusion ([GetBlock](http://getblock.io/nodes/robinhood/)). A "mint racing" bot wins by *being first to the sequencer*, not by outbidding. Optimizing: lowest-latency RPC submit path (dedicated/geo-close endpoint, e.g. GetBlock NY/Frankfurt, Alchemy, QuickNode), pre-signed/pre-encoded tx, submit the instant the stage opens.
2. **The best pre-open signal is onchain, not mempool:** poll `getPublicDrop(contract)` on the SeaDrop singleton — returns exact `startTime`. Combine with `newHeads` over WSS (~100 ms blocks) to fire within a block of stage open.
3. **`newPendingTransactions` on RH is a weak signal** (single sequencer, thin public mempool) — still worth wiring via WSS, but don't architect the race around it.
4. **Cheapest free stack:** public RPC `https://rpc.mainnet.chain.robinhood.com` (rate-limited) + `wss://feed.mainnet.chain.robinhood.com` for `newHeads`/`newPendingTransactions` + `getPublicDrop` reads + OpenSea drops API (free key via `POST /api/v2/auth/keys`, 30-day expiry) for discovery. Mark Blockscout REST API as possibly Cloudflare-walled (**UNVERIFIED**); prefer raw JSON-RPC.

## Sources index

- Chain params: [Agent402 RH wiki](https://github.com/mikeypetrillo/agent402/blob/HEAD/wiki/Robinhood-Chain.md) · [robins.tools](https://github.com/melahat34/robins.tools) · [learn-robinhood-chain](https://github.com/nirholas/learn-robinhood-chain/blob/HEAD/content/01-what-is-robinhood-chain.md) · [PayLess RH doc](https://github.com/payless2025/payless/blob/HEAD/docs/ROBINHOOD_CHAIN.md) · [robinhood-chain-quickstart AGENTS.md](https://github.com/ismailmoazami/robinhood-chain-quickstart/blob/HEAD/AGENTS.md) · [robinhood-chain MCP](https://github.com/ExpertVagabond/robinhood-chain-mcp)
- GetBlock RH: [getblock.io/index.md](https://getblock.io/index.md) · [getblock RH node page](http://getblock.io/nodes/robinhood/) · [getblock RH quickstart](https://github.com/getblock-io/getblock-docs/blob/HEAD/api-reference/robinhood/README.md) · [getblock RH AI-agent guide](https://github.com/getblock-io/guides/blob/HEAD/robinhood-ai-agent/README.md)
- QuickNode RH: [wock9000/robinhoodpools RPC ops](https://github.com/wock9000/robinhoodpools/blob/HEAD/docs/RPC_OPERATIONS.md) · [QuickNode RH full-node guide](https://www.quicknode.com/guides/robinhood/how-to-run-a-robinhood-chain-full-node) · [QuickNode Streams blog](https://blog.quicknode.com/accelerate-your-blockchain-products-with-streaming-indexed-data/)
- SeaDrop: [ProjectOpenSea/seadrop](https://github.com/ProjectOpenSea/seadrop) · [Loxleys (RH deployment)](https://github.com/dnebayis/loxleys) · [PEPurge RH](https://github.com/pepeisthedev/pepurge/blob/HEAD/hardhat/README.md) · [SeaDrop rapid-mint skill](https://github.com/andyemad/nft-mint-rarity-toolkit/blob/HEAD/skills/web3/seadrop-rapid-mint/SKILL.md) · [Yield Banks activation constants](https://github.com/sinjoh-finance/sinjoh-contracts/blob/HEAD/sinjoh-contracts-v2/deployments/YIELD-BANKS-ACTIVATION.md)
- OpenSea API: [base/skills opensea plugin](https://github.com/base/skills/blob/HEAD/skills/base-mcp/plugins/opensea.md) · [opensea-skill](https://github.com/projectopensea/opensea-skill/blob/HEAD/opensea-api/SKILL.md) · [opensea-js](https://github.com/ProjectOpenSea/opensea-js/blob/main/src/api/api.ts) · [opensea mint-agent lessons](https://github.com/dhasap/nft-mint-agent/blob/HEAD/references/opensea-official-skill-lessons.md) · [opensea api-keys docs](https://docs.opensea.io/reference/api-keys?ref=pinata.cloud)
- Alchemy: [pendingTransactions docs](https://alchemy.com/docs/reference/alchemy-pendingtransactions) · [Subscription API overview](https://www.alchemy.com/docs/reference/subscription-api) · [WS limits](https://github.com/alchemyplatform/docs/blob/HEAD/content/api-reference/bitcoincash/utxo-websockets.mdx) · [pricing](https://www.alchemy.com/pricing?r=f5ecd4315e80b9d9) · [webhooks guide](http://hookdeck.com/webhooks/platforms/guide-to-alchemy-webhooks-features-and-best-practices)
- Blocknative: [CoW Swap removal PR](https://github.com/cowprotocol/cowswap/pull/4902) · [CoinDesk ethernow](https://www.coindesk.com/tech/2023/12/07/blocknative-releases-new-ethereum-mempool-explorer-to-help-with-mev-protection)

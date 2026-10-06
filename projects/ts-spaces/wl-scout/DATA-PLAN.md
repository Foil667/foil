# Data Plan

## Context provenance
- `If there's anything free on there. Mint it` (current user request; discovery context only—the artifact remains read-only and never signs or mints).
- `Anyway to develop a program that will search open sea for your address and chain and any project there's a white list for the wallet` (current user request; defines the wallet + chain scan and requires honest OpenSea limits).
- `No vanilla build. Want deep research into a way of getting it done` (current user request; drives the evidence-first neon arcade design).
- User scope expansions: live mint and raffle feeds, per-project entry checklists, subscriptions, in-app alerts, agent-readable actions, ranked INTEL enrichment, and visible source-health/failover behavior.
- `OpenSea /api/v2/drops ... has no per-wallet eligibility endpoint` (finished research; OpenSea can indicate a phase, never membership).
- `A non-zero SeaDrop allowListMerkleRoot proves a gated phase exists, but the proof cannot be derived locally` (finished research; becomes CHECKER or UNKNOWN, never ELIGIBLE).
- `Holder-gated phases are fully verifiable with ERC-721 balanceOf/ownerOf` (finished research; the only green ELIGIBLE lane).
- Existing corpus: `/home/hatch/workspace/goals/robinhood-chain-free-mint-watch/hidden_files/ccff00-wl-pipeline.json` (source-backed project index named by the report; exact project names/contracts/reasons only).
- `got lawb` was resolved as GitLab in the user clarification; the app surfaces this once in Help and includes a graceful GitLab enrichment leg.

## Tested sources
### NeverFuckingTrade radar CDN
**Used by**: `getFeeds`, `scanWallet`, `refreshAlerts`, and `getUpcoming`.
**Test command**: `bun /opt/hatch/skills/spaces/ts-runtime/dist/probe-ctx.js < /tmp/wl-scout-feed-probe.ts`
**Sample output**: HTTP 200; version `1791080224848`; feed bytes `973196`; title examples included `WHITELIST · 03.10 22:01 UTC → 04.10 03:01 UTC · FREE · limit 2222` and `GTD/FCFS · 02.10 20:08 UTC → 04.10 06:08 UTC · FREE · limit 3`.
**Processing**: fetch version then versioned HTML; parse article and gate attributes; filter Free, WL-gated, CCFF00, or ending soon. Aggregator prices stay labeled `per aggregator (unverified)` unless RPC corroborates them.

### NeverFuckingTrade raffles JSON
**Used by**: `getFeeds`, `refreshAlerts`, and `getUpcoming`.
**Test command**: `bun /opt/hatch/skills/spaces/ts-runtime/dist/probe-ctx.js < /tmp/wl-scout-raffle-probe3.ts`
**Sample output**: HTTP 200; 151 rows at the live payload's `base.raffles`, including two live Robinhood free raffles (`Monke Lore`: 10 winners / 96 entrants; `Computers Rh`: 7 / 97); base source links were returned verbatim.
**Processing**: use the observed `base.raffles` path, include live/waiting free-entry rows only, preserve nulls, and pass through only source-returned URLs.

### Robinhood Chain JSON-RPC
**Used by**: `scanWallet` for chain identity, balance, CCFF00 holder proof, SeaDrop public phase, and merkle-root reads.
**Test command**: `bun /opt/hatch/skills/spaces/ts-runtime/dist/probe-ctx.js < /tmp/wl-scout-probe.ts`
**Sample output**: primary HTTP 200; `eth_chainId` returned `0x1237` (4663).
**Processing**: read-only JSON-RPC with browser User-Agent; failover primary → official → Nodeflare; three bounded attempts per endpoint with 0.5s/2s/8s backoff; eight concurrent calls maximum and 20s per-contract timeout. A failed row becomes stale UNKNOWN, never an empty success.

### Robinhood Chain holder proof
**Used by**: `scanWallet` wallet profile and verified verdict lane.
**Test command**: `bun /opt/hatch/skills/spaces/ts-runtime/dist/probe-ctx.js < /tmp/wl-scout-holder-probe.ts`
**Sample output**: `balanceOf(0x6573…68d)` on CCFF00 returned `0x1`; `ownerOf(4429)` returned `0x6573682faee72a4a96e791ba262439f1df3a268d`.
**Processing**: decode exact uint/address results; green ELIGIBLE is emitted only for an exact holder gate plus successful live RPC proof.

### Base JSON-RPC failover
**Used by**: `scanWallet` chain identity and wallet context.
**Test command**: `bun /opt/hatch/skills/spaces/ts-runtime/dist/probe-ctx.js < /tmp/wl-scout-enrichment-probe.ts`
**Sample output**: `mainnet.base.org`, `base-rpc.publicnode.com`, and `base.meowrpc.com` each returned HTTP 200 and chain id `0x2105`.
**Processing**: same retry/failover policy as Robinhood; Base rows without a verifiable holder rule remain CHECKER or UNKNOWN.

### GitHub and GitLab public APIs
**Used by**: per-project `INTEL` enrichment.
**Test command**: `bun /opt/hatch/skills/spaces/ts-runtime/dist/probe-ctx.js < /tmp/wl-scout-enrichment-probe.ts`
**Sample output**: GitHub repository search for `ccff00 NFT` returned HTTP 200 with 0 results; GitLab project search for `robinhood chain nft` returned HTTP 200 with 0 results.
**Processing**: run sparse, low-priority exact-name searches; pass through only API-returned project/repository URLs; empty results are labeled thin coverage, not errors. GitLab 5xx and rate limits degrade only the enrichment leg.

### Existing CCFF00 pipeline
**Used by**: bundled project corpus for `scanWallet` and alert diffing.
**Test command**: Python read of `/home/hatch/workspace/goals/robinhood-chain-free-mint-watch/hidden_files/ccff00-wl-pipeline.json` filtering Robinhood entries with a valid contract and CCFF00/CCFFOO evidence.
**Sample output**: 329 matching entries; exact rows include BroostersNFT `0xad56e25c6267e48bc5da326c1b2b7133107b6e4b` and MeowzNFTs `0xa0412bbfbdcc79ca9e824ac7ddd216ab7736df7a` with recorded gate, phase, and risk notes.
**Processing**: ship a bounded high-signal subset; preserve exact contract, phase note, status, and reason. Blocked/lead-only rows stay visibly restricted and are never upgraded from corpus text alone.

## Long-term data behavior
- **Refresh policy**: wallet scans on demand with a 60-second cache; an artifact-owned action refreshes feed-derived upcoming items and diffs alerts about every 15 minutes; no Telegram credential enters the artifact.
- **Growth**: subscriptions, alerts, source-health, and one compact feed snapshot persist in app storage; alerts are bounded and deduplicated by stable event key.
- **Ordering**: verified eligible first, then checker/unknown; active and ending-soon windows outrank later/ended. INTEL facts display in source reliability order.
- **Time semantics**: source times remain UTC instants and render viewer-local; every scan, feed, and intel fact shows its `as_of`.
- **Delivery**: `get-alerts` is the pull API for Foil's agent-side cron to forward to Telegram opt-ins; NetProtocol mirroring is documented but not executed. Onchain messages do not reach wallets that do not read NetProtocol.
- **Health**: each leg reports ok/degraded/down, endpoint, last success, consecutive failures, and error. Any degraded leg raises a banner and stale badges; if the selected chain's RPC leg is down, results are withheld behind a retry state.

## Rejected approaches
- **Tried**: using OpenSea as a wallet-eligibility oracle.
  **Why rejected**: `/api/v2/drops` exposes phases, not per-wallet membership; without a runtime-safe API key its health leg is transparently degraded.
- **Tried**: deriving a Merkle proof from the onchain root.
  **Why rejected**: the project keeps the leaf list and proof service.
- **Tried**: trusting aggregator `FREE` labels.
  **Why rejected**: research found stale/incorrect prices; RPC evidence wins.
- **Tried**: pushing Telegram or onchain DMs inside the artifact.
  **Why rejected**: Telegram credentials belong in the agent connector; arbitrary EOAs cannot receive NetProtocol messages without opting in and reading the protocol.
- **Tried**: Reddit headless automation.
  **Why rejected**: public JSON endpoints returned a bot wall; Reddit remains browser-assisted lead links only.
- **Tried**: automatic minting.
  **Why rejected**: the artifact is an evidence and alert surface only; it never connects wallets, signs, or moves funds.

## Imagery
Imagery not needed: this is a live evidence instrument with no visual object to depict; the visual identity comes from typography, status lamps, scanlines, and verdict geometry.

# Data Plan

## Context provenance
- `Build a web artifact called "Wallet Report Card" — an NFT wallet-rating dashboard.` (verbatim request; defines the sole workflow)
- `Someone should build a website that rates an NFT wallet and shows how long they actually hold, how often they flip, and how quickly they sell.` (quoted public request in the handoff; drives the behavioral metrics and compact X-ready receipt)
- `Fail-closed: never invent data; if the wallet has no NFT history, say so.` (verbatim request; every source and pagination path must either complete or return a clear unavailable/no-history result)
- Public source discovery: Robinhood Chain public RPC endpoint and chain id 4663 were corroborated in https://github.com/runtimeadmin/countersig-network/blob/HEAD/docs/robinhood-chain.md and are used only as a fail-closed fallback when the requested Blockscout host is blocked.

## Tested sources
### Base Blockscout REST API
**Used by**: `analyzeWallet` for Base ERC-721 transfer history.
**Test command**: `bun /opt/hatch/skills/spaces/ts-runtime/dist/probe-ctx.js < /tmp/wallet-report-probe-shape2.ts`
**Sample output**: HTTP 200; address history returned 50 ERC-721 items, `next_page_params` with `index` and `block_number`, plus timestamp, from/to hashes, contract address, and token id.
**Processing**: Request `/api/v2/addresses/{address}/token-transfers?type=ERC-721`; follow returned `next_page_params`; keep only valid ERC-721 rows; cap pages and fail closed if the cap is reached before history completion.

### Ethereum Blockscout REST API
**Used by**: `analyzeWallet` for Ethereum ERC-721 transfer history without an API key.
**Test command**: `bun /opt/hatch/skills/spaces/ts-runtime/dist/probe-ctx.js < /tmp/wallet-report-probe-shape2.ts`
**Sample output**: HTTP 200; address history returned 50 ERC-721 items, `next_page_params` with `index` and `block_number`, plus timestamp, from/to hashes, contract address, and token id.
**Processing**: Same normalized pagination contract as Base, against `eth.blockscout.com`; reject malformed dates or incomplete pages rather than estimating.

### Robinhood Chain Blockscout REST API
**Used by**: first attempt in `analyzeWallet` for Robinhood Chain.
**Test command**: `bun /opt/hatch/skills/spaces/ts-runtime/dist/probe-ctx.js < /tmp/wallet-report-probe.ts`
**Sample output**: HTTP 403 with Cloudflare challenge HTML from `robinhoodchain.blockscout.com`; a second legacy-API probe closed the socket. The multichain Blockscout API returned HTTP 402: `Proceed with API key or make a X402 payment to continue`.
**Processing**: Treat non-JSON, challenge pages, 402, 403, and timeouts as source failures; do not parse or invent metrics. Fall back to the public Robinhood RPC only when the explorer request fails.

### Robinhood Chain public JSON-RPC
**Used by**: `analyzeWallet` fallback for Robinhood Chain transfer logs.
**Test command**: `bun /opt/hatch/skills/spaces/ts-runtime/dist/probe-ctx.js < /tmp/robinhood-rpc-probe2.ts`
**Sample output**: `eth_chainId` returned `0x1237`; `eth_blockNumber` returned a live block; a 20,000-block Transfer scan returned 3,798 logs, and a wallet-topic-filtered 100,000-block scan returned 106 logs. Larger windows can return `logs matched by query exceeds limit of 10000`.
**Processing**: Query incoming and outgoing Transfer topics, recursively split block ranges when the provider reports a result-limit error, retain only four-topic ERC-721 Transfer events, hydrate unique block timestamps, and enforce strict request/event/time budgets. If a complete scan cannot finish within those budgets, return an unavailable/incomplete error and compute no score.

## Long-term data behavior
- **Refresh policy**: No scheduled refresh. Each explicit Scan action performs a new server-side live fetch; the UI displays the action completion time.
- **Growth**: No user history is persisted. Transfer pages are bounded to 1,000 normalized events and RPC work is bounded; a wallet beyond the cap receives an honest `history too large to score safely` result.
- **Ordering**: Normalize events oldest-first by block number/log index before pairing acquisitions and disposals.
- **Time semantics**: Source timestamps remain UTC instants; durations use elapsed milliseconds and are rendered in human-readable days/months/years. Ongoing holds close at the server analysis instant.
- **Metric semantics**: An NFT is `contract + token id`; each inbound transfer starts a holding cycle, each later outbound transfer closes it, self-transfers are ignored, current cycles remain open. Average hold includes completed and ongoing cycles; average time-to-sell includes completed cycles only. Each flip-rate denominator includes only acquisitions whose threshold outcome is known: already exited, or observed for at least 7/30 days. If no acquisition has a known 30-day outcome, the app returns an honest insufficient-history state instead of a score.
- **Rating formula**: `round(50 × min(avgHoldDays / 365, 1) + 30 × (1 − flip7Rate) + 20 × (1 − flip30Rate))`, clamped 0–100, only after at least one known 30-day outcome. Labels: 80–100 Diamond Hands, 60–79 Steady Holder, 35–59 Active Flipper, 0–34 Paper Hands. The formula and eligible denominators are shown in the UI.

## Imagery
Imagery not needed: the requested subject is abstract wallet behavior, and the design’s primary visual is a deterministic typographic score stamp rather than a decorative or potentially misleading NFT image.

## Rejected approaches
- **Tried**: Robinhood Chain’s instance Blockscout REST and legacy API without credentials.
  **Why rejected**: Live probes returned Cloudflare challenge HTML / connection closure; the multichain endpoint requires an API key or payment, conflicting with the no-key requirement.
- **Tried**: Unfiltered large-range Robinhood RPC log scans.
  **Why rejected**: The provider returns an explicit 10,000-log limit. The implementation will topic-filter and recursively split; if full completion still exceeds strict budgets, it fails closed.
- **Tried**: Persisted examples or sample wallet metrics.
  **Why rejected**: The request explicitly forbids simulated or frozen sample data.

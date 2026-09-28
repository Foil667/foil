# NFT Watchdog Screener

Free-mint hunter for **Robinhood Chain** (chain ID 4663, EVM). Built for Foil's
standing hunt → verify → claim → flip loop.

**`screener.mjs`** — Node 18+, zero dependencies (global `fetch` only). Strictly
read-only: no signing, no transactions, no spend, no private keys, no API
signups, no writes of any kind to the chain. It cannot touch the CCFF00 square
contract — there is no interaction code path at all, and a `PROTECTED_CONTRACTS`
set excludes known addresses from candidacy (the square's contract address is
not recorded in the workspace; add it there if it becomes known).

## Signals

| # | Signal | Source | Status |
|---|--------|--------|--------|
| 1 | Upcoming drops, hours early (`start_time` in future) | OpenSea drops API | **DEGRADED** — now returns HTTP 401 "Missing an API Key". Offline until a key exists. |
| 2 | Live mints, ~5 min window | `eth_getLogs` for `Transfer` events with `topics[1] == 0x0` (mints) over the last N blocks, chunked in 500-block pages | **LIVE** |
| 3 | New collections | `seen.json` first-seen tracking (< 24h = new); improves with every run | **LIVE** (drops-API leg offline, same as #1) |

Coverage is printed on every run. When a source is unavailable the screener
says so and scores only what it can verify — it never fabricates data.

## Scoring (0–100, like a trading screener)

| Component | Weight | Formula |
|-----------|--------|---------|
| Unique minters | 30% | `min(unique, 200)/200 × 30` — real demand, hard to fake cheaply |
| Mint velocity | 20% | `min(mints/hour, 600)/600 × 20` — heat of the mint |
| Collection age | 15% | `(1 − min(ageHours, 72)/72) × 15` — fresher is hotter. First-ever-seen → neutral 7.5 (age genuinely unknown, documented) |
| Verified / socials | 15% | `name()` readable 7.5 + `symbol()` readable 7.5. Contract source-verification is **unavailable** on this chain's public infra (Sourcify 404s for chain 4663; Blockscout API is Cloudflare-gated), so this is onchain-only. Documented, not faked. |
| **Free-mint confidence** | 20% | **My choice** (see below) |

### The 20% I chose: free-mint confidence

Foil hunts **free** mints. Velocity and minter counts are worthless if the mint
costs money or its price can't be verified — so the single most
decision-relevant fact gets the remaining weight, read from SeaDrop's
`getPublicDrop(address)` onchain:

- price == 0 and phase **live** → 1.0 (×20)
- price == 0 but not live (upcoming/ended) → 0.6
- not on SeaDrop / direct mint (price unverifiable) → 0.3
- price > 0 → 0.0 (correctly tanks paid mints like JeanPhil Punks to the bottom)

## Risk veto

If a single whale's **net** balance (mints + receives − sends within the window)
is **≥ 50% of the window's minted supply**, the final score is **multiplied by
0.45**. Whale share is capped at 1.0 (transfers of pre-existing supply can push
net holdings above the window's mint count). Rationale: a mint that one wallet
dominates is an insider farm or a wash — not a flip opportunity.

## Flags

```
node screener.mjs [--dry] [--json] [--min-score N] [--blocks N] [--min-mints N]

--dry         default safe mode banner (no-op: the script has no write paths)
--json        print the alert payload as JSON to stdout
--min-score   alert cutoff, default 30
--blocks      scan window in blocks, default 3000 (~5 min @ ~100ms/block)
--min-mints   minimum mints in window to become a candidate, default 3
```

Output: ranked alerts to stdout + `alerts.json` (same directory). Each alert
carries collection name, contract, score breakdown, phase/price, start time,
and links (OpenSea asset page + Blockscout address page). `seen.json` is a
local first-seen cache (improves signal 3 over runs) — never chain state.

## Sample run

`node screener.mjs --dry --min-score 30` — 2026-09-24 12:42 CDT:

```
== DRY MODE: read-only. No signing, no transactions, no spend, no private keys used. ==

NFT WATCHDOG — Robinhood Chain (4663) — 2026-09-24T17:42:54.536Z
mode: READ-ONLY (dry) | window: 3000 blocks | candidates: 18 | alerts (score>=30): 8
  * DEGRADED: OpenSea drops API unavailable (HTTP 401: {"errors":["Missing an API Key, which is required for this request."]}). Signal 1 (upcoming drops, hours early) and the drops-API legs of signals 2/3 are offline. Onchain legs below still work; no scores are fabricated for missing data.
  * DEGRADED: contract source-verification unavailable (Sourcify 404s for chain 4663; Blockscout API is Cloudflare-gated). Legitimacy is scored on onchain name()/symbol() only.
  * OK: eth_getLogs scanned blocks 71553564..71556564 (3000 blocks, ~5 min window), 4708 mint Transfer events from 0x0.

#1  JeanPhil Punks (JEANPUNKS)  [ERC721]  score 80
    contract : 0x49be85cac42de65455448f705baec9f64aa55f71
    phase    : upcoming | free: no | price: 0.0004 ETH
    window   : 2026-09-24T17:45:09.000Z -> 2026-09-28T17:45:09.000Z
    observed : 409 mints / 4875.5/h from 409 minters in ~5 min
    breakdown: unique=30 velocity=20 age=15 legit=15 freeConf=0
    risk     : whaleShare=0.046
    signals  : live-mint, new-collection
    links    : https://opensea.io/assets/robinhood/0x49be85cac42de65455448f705baec9f64aa55f71/1564
               https://robinhoodchain.blockscout.com/address/0x49be85cac42de65455448f705baec9f64aa55f71

#2  Tessa (Tessa)  [ERC721]  score 74.3
    contract : 0xbca2555613b7627b6c6f4fdae5a7ef9eab1a5c35
    phase    : live | free: yes | price: 0 ETH
    window   : 2026-09-24T17:38:48.000Z -> 2026-09-24T17:43:48.000Z
    observed : 142 mints / 1692.7/h from 29 minters in ~5 min
    breakdown: unique=4.4 velocity=20 age=15 legit=15 freeConf=20
    risk     : whaleShare=0.141
    signals  : live-mint, new-collection
    links    : https://opensea.io/assets/robinhood/0xbca2555613b7627b6c6f4fdae5a7ef9eab1a5c35/1
               https://robinhoodchain.blockscout.com/address/0xbca2555613b7627b6c6f4fdae5a7ef9eab1a5c35

#4  BAKKA BOT (ba)  [ERC721]  score 63.5
    contract : 0xee9a62feae9940a3c2316ff192da2589d905040f
    phase    : live | free: yes | price: 0 ETH
    window   : 2026-09-24T17:37:19.000Z -> 2026-09-25T17:38:19.000Z
    observed : 29 mints / 345.7/h from 13 minters in ~5 min
    breakdown: unique=2 velocity=11.5 age=15 legit=15 freeConf=20
    risk     : whaleShare=0.345
    signals  : live-mint, new-collection
    links    : https://opensea.io/assets/robinhood/0xee9a62feae9940a3c2316ff192da2589d905040f/1
               https://robinhoodchain.blockscout.com/address/0xee9a62feae9940a3c2316ff192da2589d905040f

alerts.json written: /home/hatch/workspace/nft-god/screener/alerts.json
```

Notes on the sample: Tessa and BAKKA BOT verified **live and free (0 ETH)**
via SeaDrop — exactly what the hunter wants. JeanPhil Punks scored highest on
raw activity but `freeConf=0` (0.0004 ETH) keeps it out of the free-mint
shortlist by design. The whale veto fired on several low-activity candidates
(e.g. whaleShare 0.667 → score ×0.45), pushing obvious insider farms down the list.

## Hard lines (non-negotiable)

- Never writes private keys anywhere (it reads none; there is no key handling code).
- Never touches the CCFF00 square contract (no interaction code paths exist).
- Read-only: `eth_getLogs`, `eth_call`, `eth_blockNumber`, `eth_getBlockByNumber` only.
- Honest degradation: unavailable sources are reported in `coverage`, never papered over.

## v2 — multi-chain spec update (`screener-v2.mjs`)

Implements the NFT_WATCHDOG_CHAD_V2 spec alongside v1, with **separate state
files** (`seen-v2.json`, `alerts-v2.json`, `blacklist-v2.json`) so the two can
run without clobbering each other.

- **Scope:** Ethereum, Base, Zora, Polygon, Arbitrum, Optimism, Blast,
  Robinhood Chain (+ Solana candy-machine and mempool-WS as documented stubs —
  no Helius/Alchemy/QuickNode keys, no signups, per hard lines).
- **Detection:** per-chain mint-`Transfer` scans (parallel, ~5-min windows) +
  OpenSea `/api/v2/drops?chains=ethereum,base,zora,matic,arbitrum,optimism,blast`
  (needs `OPENSEA_API_KEY`; degrades gracefully without it — keys are never
  created here) + Zora timed-sale strategy
  `0x777777722D078c97c6ad07d9f36801e653E356Ae` activity monitor (ABI unpinned →
  reported as undecoded activity).
- **Scoring (exact):** `(uniqueMintersRatio×30 + velocity×20 + contractAge×15 +
  verifiedSocials×15 + priceSanity×10 + holderConcentration×10)/100`, each
  0–100. Multipliers after: topHolder≥50% → ×0.45; botFarm (>30 mints/min AND
  uniqueMintersRatio<25) → ×0.75; unverified contract + price>0.5 ETH → ×0.7.
- **Thresholds:** ≥75 execute-candidate (flagged for downstream executor; the
  screener never executes) · ≥60 verify (rug-check hook) · <60 watch.
- **Rug-check hook:** `node ~/workspace/nft-god/rug-check/rug-check.mjs
  <chainId> <contract>` for every candidate ≥60 (exit 0 clean / 2 flagged);
  flagged → blacklisted + logged, never execute. Absent → stub, candidate
  stays at verify tier.
- **Contract detection:** ERC-165 with properly padded calldata (see lesson
  above), plus `ownerOf(sampleTokenId)` fallback for non-ERC165 contracts;
  method recorded per candidate as `ifaceVia`.

```bash
node screener-v2.mjs --dry --chains robinhood,base,ethereum
node screener-v2.mjs --dry --loop   # 5-min cheap passes
```

## Files

- `screener.mjs` — the screener (v1, Robinhood-only)
- `screener-v2.mjs` — v2 multi-chain implementation (see section above)
- `seen-v2.json`, `alerts-v2.json`, `blacklist-v2.json` — v2 state files
- `alerts.json` — latest run's ranked alerts (machine-readable)
- `seen.json` — local first-seen cache for signal 3

## Lesson learned (2026-09-24)

`supportsInterface(bytes4)` calldata must zero-pad the argument to 32 bytes
(`0x01ffc9a7` + 8 hex chars + 56 zeros). The first version omitted the padding,
most contracts answered false, and real NFTs (e.g. XLords Heroes: Genesis)
were silently filtered out as "nonstandard". Verified against the contract
directly before trusting the filter.

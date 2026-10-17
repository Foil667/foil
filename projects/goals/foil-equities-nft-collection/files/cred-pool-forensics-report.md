# CRED/WETH Pool Liquidity Pull — Forensic Report

**Date of report:** 2026-10-14
**Incident:** Reported ~43% liquidity drop in the CRED/WETH Uniswap V4 pool on Base
**Pool (V4 PoolId):** `0x55a4f7a23c4c2616cf848e639a08bd4283d13e66f5fcf34f828b5ca7e4e96324`
**CRED token:** `0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3` (18 decimals, `owner()` = `0x660eaaedebc968f8f3694354fa8ec0b4c5ba8d12`)
**WETH (Base):** `0x4200000000000000000000000000000000000006`
**V4 PoolManager (Base):** `0x498581ff718922c3f8e6a244956af099b2652b2b`
**Detection:** standing `cred-lp-watch` — ALERT 2026-09-30 ~11:44 CDT: `LIQUIDITY DROP: $142,316 → $81,208` (T7)

## Watch timeline (CDT, 2026-09-30; GeckoTerminal `reserve_in_usd`)

| Time | Reserve (USD) | CRED price | Note |
|---|---|---|---|
| 00:59 | $141,715 | $1.080e-6 | CLEAN |
| 10:44 | $141,795 | $1.080e-6 | CLEAN |
| 11:14 | $142,316 | $1.0807e-6 | CLEAN — last pre-drop reading |
| 11:44 | $81,208 | — | **ALERT** — first post-drop reading |
| 12:14 | $81,446 | $1.09e-6 | CLEAN — new baseline |

CRED price moved only ~+0.8%; no dump. GeckoTerminal's figure implies ~$61K (42.9%) of token value left the pool between the 11:14 and 11:44 CDT checks (16:14–16:44 UTC).

## Onchain investigation

**Method.** In Uniswap V4, every liquidity add/remove goes through `PoolManager.modifyLiquidity`, which emits `ModifyLiquidity(bytes32,address,int24,int24,int256,bytes32)` (topic `0xf208f4912782fd25c7f114ca3723a2d5dd6f3bcc3ac8db5af63baa85f711d5ec`) with the poolId as topic1 and a signed `liquidityDelta` (negative = removal). A 43% TVL removal at flat price *must* produce such events — there is no other path for tokens to leave a V4 pool. I scanned Base `eth_getLogs` filtered by this topic + poolId across 2026-09-30, decoding each event (a decoder validated against live events) and prepared to recover token amounts from each removal tx's receipt (ERC-20 `Transfer`s out of the PoolManager).

Every component was verified independently:
- Event topic: confirmed against live V4 `ModifyLiquidity` emissions (11 events in a 10-block sample).
- PoolId: confirmed via GeckoTerminal (`base_0x55a4…` = "CRED / WETH", the pool the watch tracks).
- PoolManager address: confirmed as the actual emitter (has contract code; the commonly recalled address has none).
- Block↔time mapping: confirmed via direct `eth_getBlockByNumber` timestamp reads.
- Topic filter mechanics: confirmed by filtering for a known-active poolId and recovering its events.

**Scanned windows (2026-09-30, UTC) and results:**

| Window (UTC) | Blocks | ModifyLiquidity events for this pool |
|---|---|---|
| 14:00–15:00 | 51,991,900–51,995,526 | **0** |
| 15:00–16:16 | 51,995,526–51,997,825 | **0** |
| 16:16–16:53 | 51,997,826–51,998,926 | **0** |

The 14:00–16:53 UTC span fully covers the alert window (16:14–16:44 UTC) plus margin on both sides for indexer lag. **Zero liquidity-add or -remove events exist for this pool in that span.**

### The removal transactions

**None identified.** No onchain liquidity-removal transactions were found in the searched windows, so no wallets, amounts, or block timestamps can be named. The planned per-tx receipt analysis (CRED/WETH `Transfer`s out of the PoolManager) had no removal txs to analyze.

### Wallet attribution

**Not established.** CRED's `owner()` returns `0x660eaaedebc968f8f3694354fa8ec0b4c5ba8d12`, but no onchain link between that wallet (or any wallet) and a September 30 liquidity removal was found.

### Character of the pull

**Unresolved — ambiguous.** The GeckoTerminal-reported 43% drop does not correspond to any `ModifyLiquidity` event in the searched windows. Two explanations remain open: (a) the removal occurred outside the searched windows (indexer/data lag larger than the margin scanned); (b) the `reserve_in_usd` figure was revised without a corresponding onchain removal. The onchain data in hand cannot distinguish these, and no wallet can be named.

## Verdict (2026-10-14)

**NO-GO — do not reopen the $CRED activation rail.**

The reported pull cannot be attributed to a known benign cause. No remover wallet was identified, so a whale exit or coordinated LP drain cannot be ruled out. Per the standing rule — an ambiguous cause means no-go — the $CRED activation rail stays paused.

## Re-pause trigger (for the standing LP watch)

If the rail is ever reopened, re-pause it immediately if **any** of the following is observed:

1. **Liquidity drop (already watched):** GeckoTerminal `reserve_in_usd` for pool `0x55a4…96324` falls more than 20% between consecutive 15-minute checks. Keep the existing T7 alert.
2. **Large single removal (onchain):** any `ModifyLiquidity` event on the pool with negative `liquidityDelta` whose implied withdrawal exceeds $10,000 — compute from the tx receipt's CRED/WETH `Transfer`s out of the PoolManager (`0x498581ff718922c3f8e6a244956af099b2652b2b`), priced at current USD.
3. **Team-wallet movement (onchain):** any `ModifyLiquidity` removal where the event `sender` (or tx origin) is the CRED `owner()` wallet `0x660eaaedebc968f8f3694354fa8ec0b4c5ba8d12` or a wallet funded directly by it — flag for manual review before any rail action; do not auto-resume.

## Method notes & limitations

- Free Base RPC endpoints are not archive nodes: historical `eth_call`/`eth_getStorageAt`/`eth_getCode` are unavailable, so this analysis rests on event logs, which full nodes retain. (Current pool storage was readable: total liquidity `5620395354970486964442662724250457`.)
- `eth_getLogs` on usable free endpoints is range-limited (10 blocks), which constrained scan speed; the 00:00–14:00 UTC portion of Sept 30 was not fully covered. The 14:00–16:53 UTC span — the window that must contain the removal if GeckoTerminal's timing is right — was fully covered with zero events.
- If a removal is later identified outside the searched windows (or via a full-archive source), this verdict should be revisited with the wallet attribution in hand. Until then, the safe posture is NO-GO.

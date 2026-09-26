# fast-mint — race a verified FREE SeaDrop public mint on Robinhood Chain

`fast-mint.mjs` claims a verified price-0 SeaDrop public mint as fast as possible:
run it ~10 min before the drop opens and it pre-encodes calldata, early-verifies,
and **pre-signs via Bankr** in the pre-encode window; sleeps until T-`early-ms`;
**re-verifies everything at fire time** (per wallet); then broadcasts each wallet's
signed tx racing across multiple RPCs, with RBF fee bumps if it stays unconfirmed.
`--wallets` fans the same verified claim across multiple wallets in parallel
(default: single wallet).

## Usage

```
node fast-mint.mjs <nftContract> <qty> [flags]

--priority-gwei <n>      initial maxPriorityFeePerGas in gwei (default 2)
--broadcast-rpcs <u1,u2> comma-separated RPC URLs to race (default: primary RH RPC
                         + 2 UNVERIFIED public alternates, see below)
--rbf-after-ms <ms>      receipt-wait before an RBF bump (default 13000)
--early-ms <ms>          broadcast this far before drop start (default 750)
--pre-encode-mins <n>    pre-encode window in minutes before drop open (default 10);
                         if invoked earlier, the tool idles until the window, then
                         encodes + verifies + pre-signs immediately
--wallets <path>         JSON array of {label, apiKeyEnvVar, address} to fan the SAME
                         verified claim across wallets in parallel (default: single wallet)
--dry                    verify + encode + gas-estimate ONLY.
                         NEVER signs, NEVER submits, NEVER spends.
```

Chain: Robinhood Chain (chainId 4663), primary RPC `https://rpc.mainnet.chain.robinhood.com`
with a browser-like User-Agent. SeaDrop: `0x00005EA00Ac477B1030CE78506496e8C2dE24bf5`.
Foil's funded wallet `0x6573682faee72a4a96e791ba262439f1df3a268d` signs **only** via
Bankr `POST https://api.bankr.bot/wallet/sign` (`eth_signTransaction`); the API key
is read from `~/.bankr/config.json` only on live (non-`--dry`) runs and is never logged.
The pre-signed tx always carries EIP-1559 fields (`maxFeePerGas`/`maxPriorityFeePerGas`)
per the Bankr sign-submit API reference — no legacy `gasPrice`, no `value`, no approvals.

## The 10-minute pre-encode pattern (recommended)

```
# ~10 minutes before the drop opens:
node fast-mint.mjs <nftContract> <qty>
```

1. The tool reads the drop's `startTime`. If invoked earlier than T-`--pre-encode-mins`
   (default 10), it idles until the window opens — so you can safely launch it early.
2. **Pre-encode (immediate):** calldata encoded (no-approval asserted), early verification
   (price == 0, qty ≤ maxSupply, no allowlist root — the drop-active/sim/gas checks can't
   run pre-open and are deferred), then **each wallet pre-signs its tx via Bankr**.
   Nothing is broadcast.
3. The tool sleeps until T-`--early-ms` (default 750 ms).
4. **Fire-time re-verification** (all five checks, fresh reads, per wallet) — every wallet
   must pass before any wallet broadcasts; any failure aborts everything.
5. Per wallet: if the nonce moved, fees moved, or the pre-open gas estimate was unverified,
   it re-signs with fresh values; otherwise the pre-signed tx broadcasts immediately
   (zero signing latency at fire time).
6. Broadcast race + RBF as below.

Pre-signing is what the `--pre-encode-mins` window buys: the Bankr round-trip happens
minutes before the drop, so at T-750ms the only work left is verify → broadcast.

## Fire-time verification checklist (all five must pass, fresh reads, or abort)

| # | Check | How | On failure |
|---|-------|-----|------------|
| 1 | Price exactly 0 wei | `getPublicDrop(nft).mintPrice == 0` (`0xbc6a629c`) | `BLOCKED: mint price is not zero` |
| 2 | Drop active | `startTime <= now <= endTime` | `BLOCKED: public drop not active` |
| 3 | Unsigned public stage | `allowListMerkleRoot(nft)` unset (`0x32bf11f5`) | `BLOCKED: allowlist merkle root is SET` |
| 4 | Simulation clean | `eth_call` of the exact `mintPublic` payload, from each wallet's own address (per-wallet caps differ) | `BLOCKED: eth_call simulation reverted` |
| 5 | Gas under cap | `eth_estimateGas` × `eth_gasPrice` < $0.50 (ETH≈$2686 static) | `BLOCKED: estimated gas ... exceeds $0.50` |

Also enforced before anything signs: `qty <= maxSupply`; the calldata is exactly
132 bytes, selector `0x161ac21f` (`mintPublic(address,address,address,uint256)`)
with `feeRecipient = 0`, `minterIfNotPayer = 0`, `value = 0`; and a hard
**no-approval assertion** — the built calldata is scanned for the
`approve` (`095ea7b3`) and `setApprovalForAll` (`a22cb465`) selectors and the tool
aborts if either appears. No `approve`/`setApprovalForAll` is ever encoded, ever.

Verification logic mirrors the proven production script
`~/workspace/goals/robinhood-chain-free-mint-watch/hidden_files/claim-seadrop-free.js`.

## RPC race design

- Default `--broadcast-rpcs` is now **three** endpoints: the primary RH RPC plus two
  documented public alternates —
  `https://robinhood-rpc.publicnode.com` and `https://rpc.nodeflare.app/robinhood/public`
  (both listed in chainlist extraRpcs PRs #2960 / #2923; both answered `eth_chainId`
  with `0x1237` on a 2026-09-24 probe). **Both alternates are UNVERIFIED** — never used
  for a real `eth_sendRawTransaction` by us. The race logic (`Promise.allSettled`,
  first success wins) tolerates dead or slow endpoints, so an unverified alternate can
  only help, never hurt.
- Nonce comes from `eth_getTransactionCount(address, 'pending')` on the primary RPC,
  per wallet.
- Fees: `eth_feeHistory(1, latest, [50])` for base fee + network priority reward;
  legacy `eth_gasPrice` fallback if fee history is unavailable. Initial
  `maxPriorityFeePerGas = max(--priority-gwei, network reward)`,
  `maxFeePerGas = 2×baseFee + priority`, gas limit = estimate × 1.3.
- Each wallet's signed raw tx is `eth_sendRawTransaction`'d to **every**
  `--broadcast-rpcs` URL concurrently; the first accepted response wins.
  An "already known" rejection from a slower RPC is harmless once one RPC accepted.
  Wallets fan out in parallel (`Promise.allSettled`); one wallet's failure doesn't
  stop the others, and the run exits non-zero if any wallet failed.
- Receipt polling hits each race RPC in turn every 2 s until `--rbf-after-ms`.
- The tx hash is derived locally as `keccak256(signedRawTx)` using a minimal
  in-file keccak-256 (validated against the official empty-string and `"abc"`
  test vectors), so no external crypto dependency is needed.

## Multi-wallet fan-out (`--wallets`)

`--wallets wallets.json` fans the **same verified claim** across N wallets in parallel:

```json
[
  {"label": "foil",   "apiKeyEnvVar": "BANKR_API_KEY_FOIL",   "address": "0x6573...68d"},
  {"label": "foil-2", "apiKeyEnvVar": "BANKR_API_KEY_FOIL_2", "address": "0x..."}
]
```

`wallets.json.example` ships with the tool — copy it, never commit real keys.
Each entry needs `label`, `apiKeyEnvVar` (name of the env var holding **that wallet's
own Bankr API key**), and `address`. Default (no `--wallets`): single wallet, the
existing behavior. `qty` applies **per wallet** (2 wallets × qty 3 = 6 mints).

**Approval requirements — read before adding a wallet:**
- Each extra wallet needs its **own Bankr API key** (separate env var; key values are
  never logged, only the var name) **and its own gas funding** on Robinhood Chain.
- Both the key provisioning and the funding need the **user's explicit per-action
  approval with exact amounts** — this tool is scaffolding only; it never funds
  wallets, never generates keys, and never moves funds between wallets.
- **Never add the wallet holding CCFF00 square #4429** to a fan-out config. This tool
  never touches square #4429.
- In `--dry` mode the config is validated (labels, addresses, env-var presence) but no
  key is ever read and nothing signs.

## RBF logic

If no receipt appears after `--rbf-after-ms`: same nonce, priority fee bumped
×1.18 (minimum +1 gwei over the original), `maxFeePerGas` recomputed from the
base fee, **re-signed via Bankr** (a new signature is required for new fees),
rebroadcast across all race RPCs. Up to 4 bumps (5 attempts total). If still
unconfirmed, the tool exits non-zero and prints the tx hash + nonce so the
operator can inspect the explorer — it never blindly retries, because the nonce
may be sitting pending in a mempool.

`/wallet/sign` response shape: the tool expects the fully-signed raw transaction
in `signature` (or `rawTransaction`), asserts the returned `signer` matches
Foil's wallet, and aborts with a clear error on any other shape instead of guessing.

## Test output (2026-09-24, all real runs)

**1. Mandated negative test — paid drop must be refused** (re-run after the
NFT_WATCHDOG_CHAD_V2 delta; still blocks):

```
$ node fast-mint.mjs 0xce03cdbb84b1105b631ec067313ede5a010f1b4e 6 --dry
fast-mint: 0xce03cdbb84b1105b631ec067313ede5a010f1b4e x6 (DRY RUN) chainId=4663 wallets=[foil:0x6573682faee72a4a96e791ba262439f1df3a268d]
calldata pre-encoded (132 bytes), selector 0x161ac21f = mintPublic, no approval calldata present
  wallet "foil" 0x6573682faee72a4a96e791ba262439f1df3a268d: Bankr key from ~/.bankr/config.json (not read in dry mode)
[DRY [foil]] verifying 0xce03cdbb84b1105b631ec067313ede5a010f1b4e x6 from 0x6573682faee72a4a96e791ba262439f1df3a268d via https://rpc.mainnet.chain.robinhood.com
  drop: price=23000000000000 wei start=2026-09-24T17:30:44.000Z end=2026-09-26T19:30:44.000Z maxSupply=10 now=2026-09-24T17:41:49.000Z
BLOCKED: [DRY [foil]] mint price is not zero (price=23000000000000 wei — paid drop, refusing)
(exit code 1)
```

**2. New-flag validation tests** (all `--dry`, nothing signed or spent):

- `--wallets` with a 2-wallet config: both wallets validated (env-var names only,
  values never logged), per-wallet verification fanned out in parallel, paid drop
  still blocked for every wallet. Exit 1.
- `--wallets` with a missing env var: `FAILED: --dry: wallet "foil-2" needs env var
  BANKR_API_KEY_FOIL_2 set (value never logged)`. Exit 1. (Names the var, never the value.)
- `--wallets /tmp/nope.json`: `FAILED: --wallets: cannot read/parse ... ENOENT`. Exit 1.
- `--pre-encode-mins -1`: `FAILED: --pre-encode-mins must be >= 0`. Exit 1.
- `node --check fast-mint.mjs`: syntax OK.

**3. Positive-path probes — five currently-active price-0 drops** (found by scanning
SeaDrop events for `price == 0 && active`; `--dry` only, nothing signed or spent).
All five correctly refused at the simulation gate (revert data `0x5136e8d5` and
`0xe12d2314…` — doomed mints, e.g. signed phases / exhausted), e.g.:

```
$ node fast-mint.mjs 0xea651c2868ad0f5dfefcaf5f9c9153488ddde765 1 --dry
  CHECK pass: price 0 wei, drop active, no allowlist root (unsigned public stage)
BLOCKED: eth_call simulation reverted: eth_call: {"code":3,"message":"execution reverted","data":"0x5136e8d5"}
(exit code 1)
```

No fully-claimable free drop exists on Robinhood Chain right now, so a complete
`DRY RUN OK` on a live contract has not yet been observed. The verification sequence
is byte-identical in shape to the proven `claim-seadrop-free.js` used for real claims.

**4. Crypto sanity:** the in-file keccak-256 reproduces the official vectors
`keccak256("") = c5d24601…5a470` and `keccak256("abc") = 4e03657a…d6c45`.

**5. Bug caught in testing:** an early version double-prefixed the calldata
(`0x0x161ac21f…`); caught by the selector/length assertions and fixed —
calldata is now asserted to be exactly 132 bytes before use.

## What remains manual / approval-gated

- **Live runs spend gas** (only the mint tx itself; value is always 0). Any live
  execution needs the user's explicit go-ahead — `--dry` is the default way to probe.
- **Bankr signing** goes through the funded wallet's restricted API key; the tool
  never touches raw private keys. No local burner keypair was generated — nothing in
  this tool signs locally, so none is needed. (If one is ever wanted for offline
  calldata tests, generating it would need explicit user approval with exact funding amounts.)
- **`--broadcast-rpcs`**: the default is now the primary RH RPC plus two UNVERIFIED
  public alternates (publicnode, nodeflare — both answered `eth_chainId` = 4663 on a
  2026-09-24 probe, but neither has carried a real broadcast yet). Override with your
  own keyed provider (Alchemy/QuickNode/etc. — needs user approval, no paid services
  wired in) for a harder race; the more uncorrelated mempools, the better.
- **No claimable free drop exists right now** — the tool is ready, but the first
  live fire will be its first live test of the sign → race → RBF path.
- The `$0.50` gas cap uses a static ETH≈$2686 estimate; re-check in a volatile market.
- The `/wallet/sign` raw-tx response-shape assumption is documented in the file
  header; if Bankr changes it, the tool aborts loudly rather than misfiring.

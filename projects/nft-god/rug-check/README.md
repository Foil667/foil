# rug-check — static rug-scan for NFT mint targets

Part of **NFT_WATCHDOG_CHAD_V2**. Scans a target contract *before* any claim.
Standing posture: **TRUST NO ONE**.

**STRICTLY READ-ONLY.** No signing, no transactions, no spend, no keys, no
deployments. Only public read APIs (Sourcify, Blockscout, public RPCs).
Never touches private keys or the CCFF00 square contract.

## Usage

```bash
node rug-check.mjs <chainId|solana> <contractAddress> [--json]
```

| Exit | Meaning |
|------|---------|
| `0`  | clean — no HIGH/MEDIUM findings |
| `2`  | flagged — ≥1 HIGH or MEDIUM finding (also appended to `blacklist.json`) |
| `3`  | unknown/error — scan couldn't run (bad input, no code, no RPC, fetch failures) |

`--json` prints the machine-readable report:

```json
{
  "verdict": "clean|flagged|unknown",
  "findings": [{ "severity": "HIGH|MEDIUM|LOW|INFO", "title": "...", "detail": "..." }],
  "sourceAvailable": true,
  "chainId": 8453,
  "contract": "0x1649...",
  "scannedTarget": "0x68F2...",
  "scannedAt": "2026-09-24T...",
  "proxy": { "implementation": "0x68F2...", "method": "blockscout-implementations" }
}
```

Chains: `1` ethereum, `8453` base, `7777777` zora, `137` polygon,
`42161` arbitrum, `10` optimism, `81457` blast, `4663` robinhood,
`solana` (program upgrade-authority / SPL mint+freeze-authority checks).

## Pipeline

1. **Proxy resolution** — reads the EIP-1967 implementation slot via
   `eth_getStorageAt`, falls back to Blockscout's `implementations` list.
   The *implementation* is scanned, not the proxy shell. (This is how the
   Loopers test below resolved `0x1649…94a` → `LoopersUpgradeable` at
   `0x68F2…e908`.)
2. **Source fetch** (keyless, in order): Sourcify v2 → Blockscout v2 →
   Etherscan V2 (only if `ETHERSCAN_API_KEY` is set).
3. **Slither** (when source is available) with the rug-focused detector set,
   auto-selecting the solc version from Sourcify metadata / pragma
   (installed on demand via `solc-select`; Sourcify remappings are forwarded).
4. **Custom source heuristics** for patterns Slither's detector set misses:
   owner-controlled `mint`, public free `mint` (no access control, no
   payment), owner `withdraw`/`sweep`, `selfdestruct`, `tx.origin` auth.
5. **Bytecode second opinion** — disassembles runtime code from `eth_getCode`
   and checks for `SELFDESTRUCT` (`0xff`) / `DELEGATECALL` (`0xf4`) with
   proper `PUSHn` immediate-skipping. EIP-1967 proxy markers downgrade
   `DELEGATECALL` from HIGH to MEDIUM.
6. **No source?** → bytecode-only heuristic scan, flagged as reduced
   confidence. No code at all (EOA) → `unknown`, exit 3.
7. **Verdict** — `flagged` on any HIGH or MEDIUM finding; flagged targets are
   appended to `blacklist.json` as `{chainId, contract, reason, ts}`
   (deduped on `chainId:contract`).
8. **Lord-of-War fingerprints** (chains 4663/8453, ERC-20 targets only) —
   six additive INFO-only signals adapted from
   [staccDOTsol/the-book](https://github.com/staccDOTsol/the-book); they add
   `lowPoints` to a `low-risk score` but never flip the verdict alone.
   See "Lord-of-War fingerprints" below.

## Detector rationale

| Detector | Why it matters for a mint hunter |
|---|---|
| `suicidal` | Contract can be destroyed → funds/tokens locked, classic kill-switch rug |
| `controlled-delegatecall` | Executed code comes from an attacker-chosen address → full hijack |
| `tx-origin` | Phishable auth; breaks the moment a contract (or agent wallet) calls in |
| `arbitrary-send-eth` / `arbitrary-send-erc20` | Funds/tokens can be pushed anywhere — sweep risk |
| `unprotected-upgrade` | Proxy whose upgrade function has no access control |
| heuristic: owner-controlled mint | Owner can inflate supply at will (dilutes your mint) |
| heuristic: public free mint | No access control + no payment — dilution/bot-drain risk (also matches the free-mint-hunter target profile, surfaced as INFO/MEDIUM context) |
| heuristic: owner withdraw/sweep | Owner can drain contract balance |
| bytecode: SELFDESTRUCT / DELEGATECALL | Last-resort signals when no source exists |

**`flagged` ≠ "this is a rug."** It means risk vectors exist that you must
price in before claiming. A UUPS-upgradeable collection with an owner
`withdraw()` is *normal* for legit projects — and still means the team can
change the code and drain funds. The tool surfaces the vectors; you decide.

## Lord-of-War fingerprints (EVM adaptation)

Six on-chain fingerprints of the "Lord of War" rigged-launch shape,
documented in [staccDOTsol/the-book](https://github.com/staccDOTsol/the-book)
(Solana/pump.fun original, XGAS.DEV forensics on Robinhood Chain), adapted
here for ERC-20 launches on Robinhood Chain (4663) and Base (8453).

| # | Original fingerprint | EVM signal (`low:*`) | Max pts |
|---|---|---|---|
| 1 | AMM-count anomaly — 9 pools on one mint at t≈0 | Distinct DEX pools receiving the token in its first 50 blocks (V2/V3 pool-interface probing on early transfer recipients) | 40 |
| 2 | Honeypot fee tiers — fee 0 / 70–98% | V3 `fee()` anomalous (0, non-standard, or ≥50% honeypot tier) + transfer-tax keywords in verified source | 40 |
| 3 | Init-without-tokens ladder — zero-liq pools quoting 5x→5000x | Zero-liquidity pools at t≈0, sqrtPriceX96 spread across V3 pools, zero-trade check | 50 |
| 4 | JIT +dL/−dL pairing — atomic swap+pull in one tx | Same-tx Mint+Swap / Mint+Burn bundles on t≈0 pools (first 100 blocks, via logs) | 40 |
| 5 | Fixed side-payment per fill — 19.92 USDG/fill toll | Most-repeated fixed `(to, value)` transfer in first 200 blocks; bonus when those txs overlap pool swaps | 45 |
| 6 | Same operator — one hand, deterministic helper on 8 chains | Early wallets clustered by earliest funder (Blockscout); identical runtime code at the same address on the other in-scope chain | 40 |

Rules: **additive INFO-only** — every finding is severity INFO with a
`lowPoints` value, summed into `lowRisk: { score, maxScore: 255, signals }`.
They never flip the verdict on their own. Anything uncheckable with public
RPC / keyless Blockscout data (e.g. Uniswap V4 pools, which have no per-pool
contract — needs a known PoolManager address) returns `unknown` rather than
guessing. NFT/ERC-721 targets skip the module (`low:not-applicable`) after a
two-call ERC-20 probe.

## Installation

```bash
python3 -m venv .venv
.venv/bin/pip install slither-analyzer
.venv/bin/solc-select install 0.8.28 && .venv/bin/solc-select use 0.8.28
```

`rug-check.mjs` auto-prepends `./.venv/bin` to `PATH`, so `node rug-check.mjs`
just works. Additional solc versions are installed on demand by `solc-select`
(the first run against a new compiler version needs network access to
`binaries.soliditylang.org`). `solc` itself is the hard dependency: without a
matching compiler version, Slither is skipped and the report says so.

## Tests (run 2026-09-24, all read-only)

Unit: `node test/selftest.mjs` — **13/13 pass** (heuristics on a synthetic
malicious fixture, bytecode disassembler edge cases incl. `PUSH1 0xff`
immediate-skipping, proxy downgrade, empty-code path).

### Test 1 — known-legit: Loopers ERC-721 on Base (exit 2, flagged)

```
$ node rug-check.mjs 8453 0x1649CD37f4748807b4882FC48765bA0B2aFfa94a
target scanned : 0x68F22e3563891167D37C86391c4a83449c83e908 (verified source)
verdict        : FLAGGED

[MEDIUM] proxy:implementation-resolved
[INFO]   slither:no-findings          (6 detectors, 0 hits — source via Sourcify)
[INFO]   heuristic:public-paid-mint  (publicMint() is priced — ordinary)
[HIGH]   heuristic:owner-controlled-mint   (reserveMint() — team reserve)
[HIGH]   heuristic:owner-withdraw-sweep    (withdraw() — owner can drain)
[MEDIUM] bytecode:DELEGATECALL-upgradeable-impl
```

Read it correctly: Loopers is a legitimate project. The flags are
**centralization vectors**, not a rug verdict — UUPS-upgradeable (proxy admin
can swap code), team `reserveMint()`, owner `withdraw()`. Exactly what a
watchdog should surface before you ape a mint. Entry appended to
`blacklist.json` (dedupe verified: 3 flagged runs → 1 entry).

### Test 2 — synthetic malicious contract (Slither detectors)

`test/RugFixture.sol` (never deployed) exercises the detector set:

```
[Medium] tx-origin                 — adminSweep() uses tx.origin auth
[High]   controlled-delegatecall   — upgrade() delegatecalls user input
[High]   arbitrary-send-eth        — adminSweep() sends ETH to arbitrary user
```

plus heuristics: `owner-controlled-mint`, `public-free-mint`,
`owner-withdraw-sweep`, `selfdestruct-in-source` (all covered in selftest).

### Test 3 — unknown path: EOA on Ethereum (exit 3)

```
$ node rug-check.mjs 1 0x0000000000000000000000000000000000000001 --json
{ "verdict": "unknown", ... "bytecode:no-code" ... }   # exit 3
```

### Test 4 — Solana: SPL Token program (exit 0, clean)

Upgrade-authority parse verified against raw `getAccountInfo` data
(authority option byte = 0 → genuinely immutable):

```
[INFO] solana:immutable-program — Program has no upgrade authority
```

## Honest limits

- **Slither needs source.** Unverified contracts get only the bytecode
  heuristic scan (SELFDESTRUCT/DELEGATECALL/CREATE2) — logic rugs, hidden
  mint functions, and fee-on-transfer traps are invisible at that level.
  Confidence is marked reduced in the report.
- **No reachable public RPC** from this environment for **Zora (7777777)**
  and **Blast (81457)** (tested 2026-09-24: `rpc.zora.energy`,
  `zora.publicnode.com`, `rpc.blast.io`, `blastl2-mainnet.publicnode.com`,
  ankr endpoints all fail). Those chains still work via the Sourcify /
  Blockscout source path; the bytecode fallback is unavailable there.
- **Etherscan V2 is key-gated** — used only if `ETHERSCAN_API_KEY` is set;
  Sourcify + Blockscout cover the test chains keyless.
- **Heuristics are regex-based**, not semantic: exotic proxy patterns,
  inline assembly, and obfuscated control flow can evade them; unusual but
  benign code can trip them. Slither findings carry confidence levels —
  read them.
- **Bytecode scan is opcode-level**: it cannot tell a *legit* `DELEGATECALL`
  (diamond proxy, UUPS `upgradeToAndCall`) from a malicious one beyond the
  EIP-1967 marker check. The implementation-behind-proxy case is downgraded
  to MEDIUM with an explanation, not dismissed.
- **Solana coverage is narrow**: upgrade authority for programs, mint/freeze
  authority for SPL mints. No Anchor IDL / instruction-level analysis.
- **Proxy admin ownership is not resolved** (who holds the keys) — flagged as
  a vector, not attributed.
- **Lord-of-War fingerprints are launch-shape heuristics, not proof of a
  rig**: a legit multi-DEX launch can trip the AMM-count signal; the V4
  pool shape (no per-pool contract) is not covered without a known
  PoolManager address; funder clustering degrades when Blockscout is
  unreachable; all six signals are INFO-only and additive by design.
- Findings are point-in-time: upgradeable contracts can change after the
  scan. Re-run before claiming.

## Files

- `rug-check.mjs` — the scanner (CLI + importable pure functions for tests)
- `blacklist.json` — persistent flagged-contract list (append-only, deduped)
- `test/RugFixture.sol` — synthetic malicious contract (never deploy)
- `test/selftest.mjs` — offline unit tests
- `.venv/` — Slither + solc-select install (not for checkin)

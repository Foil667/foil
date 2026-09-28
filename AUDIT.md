# Looper Rescue — Security Audit

**Audited:** 2026-09-28 ~11:20 CDT
**Reviewer:** Foil (independent review — code written by a separate builder agent, audited fresh here)
**Scope:** `~/workspace/rescue-protocol/app/` — `index.html` (126 lines), `app.js` (930 lines), `style.css` (224 lines), `logo.webp`
**Method:** static grep review + full end-to-end manual read of every file + independent re-verification of all cryptographic constants (local keccak256 recomputation + live Base `eth_getLogs` empirical tests) + DOM wiring check.

## Verdict: PASS

No blockers. All non-negotiable safety requirements hold. Four non-blocking observations are noted at the bottom.

---

## Static checks

| Check | Result |
|---|---|
| `privateKey` / `mnemonic` / `requestAccounts` / `personal_sign` / `sendTransaction` / `signTypedData` / `walletconnect` / `window.ethereum` / `eth_requestAccounts` / `eth_sendTransaction` | **PASS** — zero hits in code. The single grep hit is a header *comment* documenting their absence. |
| `localStorage` / `sessionStorage` / `document.cookie` | **PASS** — zero hits. All state is in-memory. |
| `eval(` / `Function(` / string `setTimeout`/`setInterval` / `\x` escapes / `atob(` / `fromCharCode` (obfuscation signals) | **PASS** — zero hits. |
| `innerHTML` / `outerHTML` / `insertAdjacentHTML` / `document.write` (XSS surface) | **PASS** — zero hits. All DOM is built via `document.createElement` + `textContent`. |
| Outbound URLs vs allowlist | **PASS** — every fetched or linked URL is within the allowlist: `mainnet.base.org`, `ethereum.publicnode.com` (defined, intentionally unused), `api.merkl.xyz`, `api.dexscreener.com`, `api.coinbase.com`, `bridge.base.org`, `merkl.xyz`, `basescan.org`, `docs.base.org`, `x.com/Foil667`. No CDNs, no fonts, no analytics, no other hosts. |
| RPC methods called | **PASS** — only `eth_chainId`, `eth_blockNumber`, `eth_getBalance`, `eth_call`, `eth_getLogs`, `eth_getBlockByNumber`. All read-only. |
| `node --check app.js` | **PASS** |
| DOM wiring (`getElementById` targets vs HTML ids) | **PASS** — all 9 referenced IDs exist. |

## Cryptographic constant verification (independent)

Recomputed every selector/event hash locally with keccak256 (js-sha3) and tested against live Base chain data via `eth_getLogs`:

| Constant | In code | Independent check |
|---|---|---|
| `balanceOf(address)` `0x70a08231` | ✓ | keccak match |
| `decimals()` `0x313ce567` | ✓ | keccak match |
| `symbol()` `0x95d89b41` | ✓ | keccak match |
| `ownerOf(uint256)` `0x6352211e` | ✓ | keccak match |
| `supportsInterface(bytes4)` `0x01ffc9a7` | ✓ | keccak match (spec draft had a typo `…d7`; builder corrected) |
| `balanceOf(address,uint256)` `0x00fdd58e` | ✓ | keccak match |
| `Transfer` `0xddf252ad…` | ✓ | keccak match |
| `TransferSingle` `0xc3d58168…` | ✓ | keccak match **+ 2,418 live hits** in last 2,000 Base blocks |
| `TransferBatch` `0x4a39dc06…` | ✓ | keccak match **+ 562 live hits** in last 2,000 Base blocks |
| `MessagePassed` `0x02a52367…` on L2ToL1MessagePasser | ✓ | keccak match **+ 6 live hits** on the passer contract |
| `WithdrawalInitiated` assumption | correctly **rejected** | 0 hits on the passer — builder's switch to `MessagePassed` was the right call |

## Manual review — honesty & safety

| Check | Result |
|---|---|
| Roadmap vs live labeling | **PASS** — dedicated "Roadmap / NOT LIVE" section; each of one-click execution, fee discounts, staking, Proof-of-Rescue individually labeled "not live"; copy states "They are not available in this app today. Nothing below is promised on any timeline." |
| $RESCUE price panel | **PASS** — unindexed token shows "Not indexed by DEXScreener yet" + "a missing price is not a $0 price." Never renders fake data. |
| Recovery links genuinely official | **PASS** — `bridge.base.org` (official Base bridge), `merkl.xyz` (official Merkl app), `basescan.org`, `docs.base.org`. All `target="_blank" rel="noopener"`. |
| "Likely stuck" flag honesty | **PASS** — UI and code comments state plainly that L1 finalization is NOT checked and the flag is purely a >30-day age heuristic. |
| Scan-depth limitation | **PASS** — "~last 46 days… Older history is not covered — full-history deep scan is roadmap" shown before and after scan. |
| Failure handling | **PASS** — every section failure renders an explicit "section unavailable — RPC error" card; a failed chunk batch throws rather than producing a silent partial scan. |
| Address input validation | **PASS** — `/^0x[0-9a-fA-F]{40}$/` enforced before any network call; invalid input shows an error and scans nothing. |
| Safety notice / anti-phishing | **PASS** — "If any site claiming to be Looper Rescue asks you to connect a wallet or sign anything, it is a scam — close it." |
| ERC-721 verification | **PASS** — `ownerOf(tokenId)` checked per token ID; only currently-held IDs listed. |
| ERC-1155 verification | **PASS** — `balanceOf(address,id)` confirmed per (contract,id); only nonzero balances listed. |
| Logo | **PASS** — valid WebP, copied into `app/`, referenced relatively. |

## Non-blocking observations

1. `L1_RPC` (`ethereum.publicnode.com`) is defined but intentionally unused — no L1 state is queried by design. Documented in code. Harmless; keep if L1 finalization checks land later.
2. Withdrawal "Value" is formatted as ETH (18 decimals). ERC-20 bridge withdrawals will display ~0 ETH — the Basescan tx link next to each withdrawal is the verification path. Minor display limitation, not a safety issue.
3. `Number(wei)/1e18` for the USD dust-context loses precision on extremely large balances — display-only, acceptable.
4. Scan covers ~46 days of history; anything older is out of scope and labeled as such. Full-history deep scan remains roadmap.

---

**Auditor's note:** the builder's header comment in `app.js` documents three spec corrections (supportsInterface selector typo, TransferSingle/Batch recomputation, MessagePassed vs WithdrawalInitiated) with their verification method. All three were independently re-verified above and check out. The honesty labeling throughout the UI matches the committed safety architecture: read-only scanning, official external links only, no live functionality implied where none exists.

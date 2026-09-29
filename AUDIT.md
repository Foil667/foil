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
| RPC methods called | **PASS** — only `eth_chainId`, `eth_blockNumber`, `eth_getBalance`, `eth_call`, `eth_getLogs`. All read-only. (`eth_getBlockByNumber` was dropped in v2 — withdrawal age is estimated from block numbers.) |
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

---

## Addendum — v2 scan-architecture fix (2026-09-28 ~13:00 CDT)

**Trigger:** live smoke tests of the deployed v1 (https://foil667.github.io/foil/) showed the tab dying near completion of a full scan — renderer retired at 853/1,001 and 910/1,001 chunks on two attempts.

**Root cause:** v1 ran four separate `eth_getLogs` passes over ~2,000,000 Base blocks in 2,000-block chunks (Transfer + TransferSingle + TransferBatch + MessagePassed ≈ 4,000 chunk requests, ~20+ minutes of sustained network, all results accumulated in memory, sections rendered only at the end, no timeouts or cancel).

**Fix (scope widened, not narrowed):**
- Token/NFT discovery moved to Blockscout's indexed `GET /api/v2/addresses/{addr}/token-transfers` (full history, paginated, ~1s for a normal wallet). The classification pipeline is unchanged: the same onchain `balanceOf` / `decimals` / `supportsInterface(ERC-721)` / `ownerOf` / `balanceOf(address,id)` checks run against the same discovered contracts — only the discovery source changed, from slow to indexed. ERC-721 token IDs come from `total.token_id`, the token contract from `token.address_hash` (both verified against live API responses).
- Bridge withdrawals keep the verified raw-RPC `MessagePassed` path (address-filtered 2,000-block chunks), now with progress, cancel, and timeouts.
- Every request: 30s timeout + 3 attempts with backoff. Whole scan: 8-minute ceiling + a Cancel button. Sections render progressively as they complete. Hard caps (20 Blockscout pages, 300 contracts, 500 token IDs/contract) degrade to honest "too much history to scan safely in-browser" notes instead of hanging.

**Re-verification of the v2 code (static grep + syntax + DOM wiring, 2026-09-28):**

| Check | Result |
|---|---|
| `privateKey` / `mnemonic` / `requestAccounts` / `personal_sign` / `sendTransaction` / `signTypedData` / `walletconnect` / `window.ethereum` / `eth_requestAccounts` / `eth_sendTransaction` | **PASS** — zero hits. |
| `localStorage` / `sessionStorage` / `document.cookie` | **PASS** — zero hits in code (one header comment documenting their absence). |
| `eval(` / `Function(` / `atob(` / `fromCharCode` | **PASS** — zero hits. |
| `innerHTML` / `outerHTML` / `insertAdjacentHTML` / `document.write` | **PASS** — zero hits. |
| Outbound URLs vs allowlist | **PASS** — adds `base.blockscout.com` (read-only REST) to the existing allowlist; all other hosts unchanged. No CDNs, fonts, analytics. |
| RPC methods called | **PASS** — only `eth_chainId`, `eth_blockNumber`, `eth_getBalance`, `eth_call`, `eth_getLogs`. All read-only. |
| `node --check app.js` | **PASS** |
| DOM wiring | **PASS** — all `getElementById` targets exist in `index.html`. |

**Copy honesty:** the pre-scan scope note and the post-scan scope line now state token discovery covers full transfer history while bridge-withdrawal detection covers the last ~2,000,000 blocks (~46 days). The "full-history deep scan is on the roadmap" claim was removed because it is no longer true for token discovery.

**Verdict: PASS** — no new blockers introduced; the v1 hang is architecturally fixed.

---

## Addendum — $RESCUE flywheel retrofit (2026-09-28 ~16:45 CDT)

**Scope:** `index.html`, `style.css`, new `flywheel.js`, vendored `rescue-burn.js` + `rescue-burn.css`
(copied from `~/workspace/shared/`), `AUDIT.md`.

**What changed (flywheel mechanics, all DEMO unless stated LIVE):**
- **Priority scan (demo):** new checkbox in the scan form. On submit, a fixed 10 $RESCUE demo fee is
  charged from the browser-local demo wallet (starts at 1,000, refillable), split **9 → bounty pool,
  1 → furnace (burned, demo ledger)**. The fee hook runs on the *capture* phase of the form's submit
  event, before app.js's own bubble-phase scan handler, so a failed fee (insufficient demo funds)
  blocks the scan via `preventDefault` + `stopImmediatePropagation` with an honest receipt. A success
  receipt shows the exact split. The scan code itself is identical — the copy says so.
- **Proof-of-Rescue bounty board (demo):** post a bounty (locks demo funds in escrow; min 10 / max
  1,000,000 $RESCUE; validated client-side), claim with a plain-text handle, complete via an armed
  double-click confirm that previews the split **90% → rescuer · 10% → furnace (burned, demo ledger)**.
  Open bounties can be cancelled with escrow refunded. All state in `localStorage` (`foil-rescue-flywheel-v1`);
  corrupt storage falls back to a blank state without crashing.
- **Rescuer tiers (demo):** Scout ≥1, Hunter ≥3, Legend ≥10 completed rescues per handle; rendered in a
  tier board. Handles are labels, not identities — the copy says so.
- **The Furnace (LIVE onchain + demo ledger):** renders the shared `RescueBurn.renderWidget` (real
  $RESCUE `Transfer`→`0x0000…dEaD` events on Base via chunked `eth_getLogs`, localStorage-cached,
  honestly stale-labeled on RPC failure) plus a separate clearly-labeled **demo burn ledger** for
  priority-fee and bounty-cut demo burns from this browser. The demo ledger never touches the live total.
- **Roadmap copy:** updated — the app now does three things (read-only scan, official-links, demo
  bounty/furnace simulation); the Proof-of-Rescue bullet now notes the board is a local demo and no
  onchain reward distribution exists.

**Re-verification (static grep + syntax + DOM wiring, 2026-09-28):**

| Check | Result |
|---|---|
| `privateKey` / `mnemonic` / `requestAccounts` / `personal_sign` / `sendTransaction` / `signTypedData` / `walletconnect` / `window.ethereum` / `eth_requestAccounts` / `eth_sendTransaction` | **PASS** — zero hits in all JS (one header comment each documenting absence). |
| `localStorage` | **CHANGED, PASS** — now used for two things only: the demo flywheel ledger (`foil-rescue-flywheel-v1`) and the RescueBurn snapshot cache (`foil-rescue-burn-v1`). No keys, no wallet data, no user PII. |
| `sessionStorage` / `document.cookie` | **PASS** — zero hits. |
| `eval(` / `Function(` / `atob(` / `fromCharCode` | **PASS** — zero hits. |
| `innerHTML` / `outerHTML` / `insertAdjacentHTML` / `document.write` | **CHANGED, PASS** — appears only in the shared `rescue-burn.js` widget; every interpolated value passes through its `esc()` HTML-escaper (verified by test: no `<script>` in widget output). `flywheel.js` builds all DOM via `createElement` + `textContent` (verified by test: XSS payloads in bounty title/handle render escaped). |
| Outbound URLs vs allowlist | **PASS** — no new hosts. `rescue-burn.js` fetches only `https://mainnet.base.org` (already allowlisted). Demo surfaces make zero network calls. |
| `node --check` on all JS | **PASS** — `app.js`, `flywheel.js`, `rescue-burn.js` |
| DOM wiring | **PASS** — all 24 `getElementById` targets across `app.js` + `flywheel.js` exist in `index.html`; all three scripts + both stylesheets wired. |
| Demo labeling | **PASS** — every demo surface carries a "DEMO" pill or "demo only" copy (priority row, wallet bar, bounty form/list, tier board, demo ledger); the roadmap no longer claims "exactly two things"; no demo surface implies real token movement. |

**Test evidence (all in-sandbox, 2026-09-28):**
- `/tmp/fw-logic-test.js` — 44/44 PASS: bounty post/validation (empty title, empty asset, below-min, above-max,
  unaffordable), escrow deduction, claim (empty-handle reject, double-claim reject), split math incl. floor
  on odd amounts (105 → 95/10), completion (90/10 split, escrow release, ledger entry, rescuer credit),
  tiers (0→none, 1/2→Scout, 3/9→Hunter, 10→Legend), cancel + refund, priority fee 9/1 split, insufficient-funds
  fee failure, refill, persistence round-trip, corrupt-storage recovery, input trim/length caps.
- `/tmp/burn-degradation-test.js` — 16/16 PASS: bogus RPC + no cache → `ok:false` with no invented totals;
  bogus RPC + seeded stale cache → `ok:true, stale:true` with the cached total (2,500.00) and named error;
  fake happy-path RPC → total 1,500.00 computed from a fabricated Transfer log, top-burner aggregation,
  recent-burn decoding; `renderWidget` success renders title/total/recent/top; error path renders an honest
  "Burn data unavailable" message; no `<script>` in widget output.
- `/tmp/fw-dom-test.js` — 31/31 PASS (minimal DOM shim driving the real `flywheel.js` UI code): form post →
  card render with XSS payloads escaped (`<script>`, `<img onerror>`, `<b>` in title/poster/handle);
  wallet bar updates (1,000 → 900); claim flow → CLAIMED card; complete double-click arm → confirm →
  split preview 90/10 → tier board Scout + 90 earned + demo ledger bounty-cut entry; priority fee →
  receipt with 9/1 split + ledger priority-fee entry; insufficient-funds priority blocks the scan
  (preventDefault + stopImmediatePropagation), unchecks the box, shows an honest receipt; invalid post →
  inline error, funds untouched.
- Local serve (`python3 -m http.server`) — `index.html`, `app.js`, `flywheel.js`, `rescue-burn.js`,
  `rescue-burn.css`, `style.css`, `logo.webp` all return HTTP 200.
- Mobile layout — reviewed in CSS (no Chromium screenshots in this sandbox): new grids collapse at
  `max-width: 760px` (`.form-grid` → 1fr, `.claim-row` → column), `.rbw-cols` collapses at 520px
  (shared CSS), `.burn-when` un-floats, bounty/wallet bars wrap. **Not visually verified** — recommend a
  real-device check after deploy.

**Non-blocking observations:**
1. The priority-scan "queue jump" is honest copy only — in a single-user in-browser app there is no queue;
   the UI states the scan code is identical and the fee feeds the demo flywheel.
2. Demo state is per-browser (localStorage); two browsers see different boards. Labeled as local demo.
3. `rescue-burn.js` does a full `eth_getLogs` sweep from block 51,910,000 on first load (~a day of blocks,
   20k-block chunks); subsequent loads are incremental. Acceptable on public RPC.
4. The mobile layout has not been visually verified (no screenshots in this sandbox) — check on a real
   device post-deploy.

**Verdict: PASS** — no blockers. The demo flywheel is fully labeled, the live burn widget reads real
onchain state with honest degradation, and no fund-movement / wallet / signature surface was added.

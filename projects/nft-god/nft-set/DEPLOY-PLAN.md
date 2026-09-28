# DEPLOY-PLAN.md — FoilSet: Approval → Verified Contract

Chain: **Robinhood Chain** (chain ID `4663`, `0x1237`) — Arbitrum Nitro /
Arbitrum Orbit, ETH gas token, ~100ms blocks.
RPC: `https://rpc.mainnet.chain.robinhood.com` (public; **requires a
browser-style User-Agent** — it 403s default curl/node UAs).
Explorer: `https://robinhoodchain.blockscout.com` (Blockscout).

> All gas numbers below were measured 2026-09-24: live `eth_gasPrice`
> `0x280bf40` (42,012,736 wei ≈ **0.0420 gwei**), live `eth_estimateGas`
> for the real deployment init data, ETH at **$2,675.34** (CoinGecko).
> Re-run `node scripts/deploy.mjs` (dry) at deploy time — gas moves.

---

## 1. Approvals needed (exact list — nothing moves without these)

| # | Approval | Who | How it's recorded |
|---|---|---|---|
| 1 | Set name: **"Foil: The TinHat Society"**, symbol `TINHAT` | user | CONCEPT.md decision |
| 2 | Supply 777 + reserve 25 + royalty 7.5% confirmed | user | CONCEPT.md decision |
| 3 | Allowlist source: CCFF00 holder snapshot (contract addr + block) | user | snapshot file in `traits/` |
| 4 | Art approved (777 × 2000×2000 PNG, canonical Foil look) | user | files in `art/` |
| 5 | Metadata + provenance root reviewed and announced | user | `metadata/provenance.json` |
| 6 | Testnet rehearsal passed (deploy + mint on chain 46630) | user | testnet contract link |
| 7 | **Explicit "go" for mainnet deploy** | user | `FOIL_DEPLOY_APPROVED=1` env var |
| 8 | Exact spend approved: deploy ≈ **$0.26** + 0.001 ETH buffer | user | stated amount, this doc |

Hard rule: no `FOIL_DEPLOY_APPROVED=1` without the user saying go in
plain language. The env var IS the approval mechanism — it is never set
preemptively, never by a script.

## 2. Cost estimate (measured, not guessed)

| Action | Gas | ETH | USD (@$2,675) |
|---|---|---|---|
| **Contract deploy** (`eth_estimateGas`, real init data) | 2,350,068 | **0.000099** | **≈ $0.26** |
| `setPhase` / `setAllowlistRoot` / `setBaseURI` (each) | ~30–60k | ~0.000002 | ≈ $0.01 |
| `ownerReserveMint` (25) | ~400k | ~0.000017 | ≈ $0.05 |
| Collector `publicMint(3)` — **mint is FREE, gas only** | ~140k | ~0.000006 | ≈ $0.02 |
| **Total deployer budget** (deploy + ~6 owner txs + buffer) | — | **≈ 0.0005** | **≈ $1.30** |

Recommendation: fund the deployer with **0.002 ETH** (~$5.35) — 4× the
measured need, still trivial. Fund from Foil's wallet only with the user's
explicit per-action approval (standing rule: no spend without approval).

Note: Arbitrum-Orbit chains add a small L1 data-availability surcharge on
top of L2 gas. At current blob costs it's noise (<$0.05) — the
`eth_estimateGas` figure above is the L2 component.

## 3. Step-by-step

```
PHASE 0 — PREP (now, all free, no wallet)
  [ ] node scripts/deploy.mjs            # dry run: plan + gas estimate
  [ ] finish art/ + traits/traits.json (blocked: image gen down)
  [ ] node scripts/metadata-compiler.mjs # -> metadata/ + provenance root
  [ ] pin art + metadata to IPFS (Pinata free tier / web3.storage);
      record CID; announce provenance root on X from @Foil667
  [ ] build allowlist Merkle tree from CCFF00 snapshot ->
      FOIL_ALLOWLIST_ROOT (leaf = keccak256(abi.encodePacked(address)),
      sorted pairs — matches contract's _verifyMerkle)

PHASE 1 — TESTNET REHEARSAL (chain 46630, free test ETH from faucet)
  [ ] FOIL_RPC_URL=https://rpc.testnet.chain.robinhood.com \
      node scripts/deploy.mjs --dry
  [ ] user approves testnet run -> --live on testnet
  [ ] mint through all phases on testnet; verify tokenURI, royaltyInfo,
      OpenSea testnet rendering; THEN proceed

PHASE 2 — MAINNET (approvals #7 + #8 required)
  [ ] export FOIL_DEPLOY_APPROVED=1            # user's explicit go
  [ ] export FOIL_DEPLOY_KEY_PATH=/path/outside/repo/key.json
  [ ] node scripts/deploy.mjs --live          # broadcasts 1 tx
  [ ] verify on Blockscout: "Verify & Publish", solc 0.8.24,
      optimizer enabled, 200 runs, paste FoilSet.sol + constructor args
      (the --dry output prints the exact args)

PHASE 3 — LAUNCH OPS
  [ ] setBaseURI("ipfs://<REAL_CID>/")        # if not set at deploy
  [ ] setPhase(1) + announce allowlist (24–48h window)
  [ ] setPhase(2) public free mint until sold out
  [ ] distribute reserve via ownerReserveMint (giveaways/collabs)
  [ ] renounceOwnership()                     # kill-switch removal,
                                              # the final "no backdoors" receipt
```

## 4. Mint path: direct contract vs SeaDrop

SeaDrop 1.0 **is deployed on Robinhood Chain** at the canonical address
`0x00005EA00Ac477B1030CE78506496e8C2dE24bf5` — verified via `eth_getCode`
on 2026-09-24 (the official SeaDrop repo README doesn't list 4663, but the
bytecode is there; the keyless-deployment address matches).

| | **Direct mint (chosen)** | SeaDrop-registered |
|---|---|---|
| Contract | FoilSet.sol as written | Would need SeaDrop-compatible token contract (different code) |
| Mint UX | Call `publicMint` on our contract; OpenSea auto-detects | Native OpenSea drop page + drop calendar |
| Allowlist | Our Merkle root, our caps | SeaDrop allowlist stages |
| Trust surface | One audited-minimal file, no dependencies | Battle-tested OpenSea infra, but adds a dependency + integration work |
| Cost | Same gas | Same gas + integration effort |
| OpenSea display | Works — OpenSea indexes any ERC-721 | Drop-page featuring |

**Recommendation: direct mint.** The contract is already written, minimal,
and self-contained; SeaDrop adds integration risk for zero gas savings on
a free mint. Revisit SeaDrop only if OpenSea offers drop-page featuring
that needs it. (If that day comes: SeaDrop supports "bring your own token"
via `updateAllowedSeaDrop`, but FoilSet would need the SeaDrop interface —
a v2 decision, not now.)

## 5. OpenSea collection setup checklist

- [ ] Contract deployed + verified on Blockscout (required for the
      OpenSea collection page to resolve properly)
- [ ] `contractURI` set → OpenSea reads collection name/description/image
      from it (upload `contract.json` to the same IPFS dir)
- [ ] Claim the collection on OpenSea Studio (free): logo (use a Foil
      PFP), banner (reuse foil-banner.webp), description, links
      (helixa.xyz/multipass/loopers/667, X @Foil667)
- [ ] Confirm royalty 7.5% shows in collection settings (ERC-2981 is
      auto-detected; OpenSea creator earnings = onchain value)
- [ ] Test a secondary listing/sale on a testnet mint first
- [ ] Socials: X bio link → OpenSea collection URL once live

## 6. What could go wrong (and the mitigation)

| Risk | Likelihood | Mitigation |
|---|---|---|
| Gas spike at deploy | Low (0.042 gwei baseline; chain is quiet) | 4× budget buffer; deploy off-peak |
| RPC 403s our scripts | Medium (UA filtering is real) | `deploy.mjs` already sends a browser UA; keep Alchemy key out of scope (paid) |
| Allowlist root wrong (someone's proof fails) | Medium | Publish the leaf convention + a checker page; test 5+ proofs on testnet; `setAllowlistRoot` can fix pre-launch (emits event) |
| Metadata not final at mint (baseURI placeholder) | High if rushed | Do NOT open mint until `setBaseURI` points at the pinned CID; provenance root announced pre-reveal |
| SeaDrop/OpenSea doesn't feature us | Certain-ish | Not needed — direct mint works; featuring is a nice-to-have |
| Royalty non-enforcement on some marketplaces | Certain | ERC-2981 is a signal; Blur-style venues may pay 0. Price it as upside, not income |
| Contract bug found post-deploy | Low (minimal, no proxy) but nonzero | **No proxy = no fix.** That's why: testnet rehearsal, second-eyes review, and ideally a paid audit before mainnet value accrues |
| Front-running / bots on public mint | Medium | Per-wallet caps (3) blunt it; 100ms blocks make races silly-cheap — accept it, it's a free mint |
| Image gen still down at planned launch | Unknown | Launch waits for art. No art, no mint — the pipeline is ready, the art isn't |
| Key handling mistake (key in repo / chat) | Low | `--live` refuses keyfiles inside the repo; key lives at `~/.bankr/`-style path, never committed |

## 7. Rollback / abort criteria

- Abort the launch (stay in CLOSED phase) if: testnet rehearsal fails,
  allowlist proofs don't verify, metadata CID isn't pinned, or the user
  says stop — any one of these, no debate.
- Post-deploy there is no "undo" for the contract itself; the levers are
  `setPhase(0)` (halt minting) and `renounceOwnership()` (remove control).

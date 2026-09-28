# Scope: free "contract red-flag checker" web tool (plan only, no code)

Repackages Foil's Virtuals ACP "Contract Red-Flag Check" (0.50 USDC) as a free public tool to earn usage, trust signals, and inbound to the paid offering. Fits the build pause: no code written yet — this is the spec for when builds resume (~2026-09-27).

## What it is
A static web page + serverless-ish read path (no backend needed at first): paste a contract address (Base + Robinhood Chain, chain 4663), get a plain-language risk report in <30s.

## Inputs
- Contract address + chain selector (Base / Robinhood Chain / Ethereum)
- Optional: token/NFT contract context

## Checks (read-only RPC calls + heuristics, all free)
1. **Verification**: is source verified on Blockscout/Etherscan? Unverified = top flag.
2. **Proxy/upgradeability**: EIP-1967/Beacon proxy slots → "owner can swap the code" warning.
3. **Ownership**: Ownable owner() — is it a contract/multisig, renounced (0x0), or an EOA?
4. **Honeypot basics**: tradingEnabled/paused flags, transfer taxes (estimate via static call on a buy path where possible), maxTx/maxWallet limits, blacklist mappings, mint functions reachable by non-owners.
5. **Liquidity/rug surface**: for tokens — LP token holder (burned/locked vs deployer), mintable supply.
6. **Metadata sanity**: for NFT mints — maxSupply, price(), merkle/allowlist roots, withdraw function owner.
7. **Known patterns**: reentrancy-prone withdraw, delegatecall, selfdestruct presence.

## Outputs
- Score 0–100 + plain-language verdict: SAFE-ish / CAUTION / AVOID
- Bullet list of each flag with severity and the exact check that produced it
- Links: explorer contract page, verified source if present
- Disclaimer: "heuristic scan, not an audit"

## Where it lives
- Option A (fastest): single static HTML page hosted on the same pattern as Foil's other drops (e.g. a page under foil's existing web artifact infra), calling public RPCs client-side.
- Option B (later): x402-gated "deep check" upsell → paid ACP Contract Red-Flag Check for a full written report.

## Why it earns
- Usage = verifiable work (Helixa "work/execution history" and "external trust" evidence — the zero-coverage buckets on Foil's cred report).
- Shareable links from X ("checked this mint — here's the report") = organic distribution + trust.
- Funnel: free scan → paid ACP brief for anything serious.

---
name: "nft-rug-scanner"
description: "Scan an NFT or token contract for rug vectors before minting, buying, or claiming: selfdestruct kill-switches, delegatecall hijacks, owner-controlled mint/withdraw, upgradeable proxies, honeypot launch shapes. Read-only, no wallet, no signing."
metadata: { "includeInPrompt": true }
---

# NFT Rug Scanner

## Purpose
Static rug-scan for NFT/token mint targets. Run it BEFORE any claim, buy, or
approval. Standing posture: **TRUST NO ONE**. Scans the *implementation*
behind proxies, not the proxy shell.

## Tooling
```bash
node ~/workspace/nft-god/rug-check/rug-check.mjs <chainId|solana> <contractAddress> [--json]
```
Exit codes: `0` clean · `2` flagged (≥1 HIGH/MEDIUM finding; appended to
`blacklist.json`) · `3` unknown/scan error.

Chain IDs: `1` ethereum, `8453` base, `7777777` zora, `137` polygon,
`42161` arbitrum, `10` optimism, `81457` blast, `4663` robinhood,
`solana` (program upgrade-authority / SPL mint+freeze-authority checks).

What it checks: Slither detector set on verified source (`suicidal`,
`controlled-delegatecall`, `tx-origin`, `arbitrary-send-eth/erc20`,
`unprotected-upgrade`) + custom heuristics (owner-controlled mint, public
free mint, owner withdraw/sweep, selfdestruct, tx.origin auth) + bytecode
second opinion (`SELFDESTRUCT`/`DELEGATECALL` opcodes with PUSH-immediate
skipping) + Lord-of-War launch-shape fingerprints (INFO-only, ERC-20 on
4663/8453).

## Auth
None. Public read APIs only (Sourcify, Blockscout, public RPCs).
`ETHERSCAN_API_KEY` env is optional extra source coverage.

## Operating Rules
1. **Strictly read-only.** No signing, no transactions, no spend, no keys,
   no deployments. Never touch private keys or the CCFF00 square contract.
2. **`flagged` ≠ "this is a rug."** Flags are risk vectors to price in —
   a legit UUPS-upgradeable collection with owner `withdraw()` still flags.
   Surface the vectors; the human decides.
3. Proxy markers downgrade `DELEGATECALL` HIGH→MEDIUM with explanation —
   never dismissed silently.
4. No verified source → bytecode-only scan at reduced confidence; no code
   at all (EOA) → `unknown`, exit 3.
5. Findings are point-in-time: upgradeable contracts can change after the
   scan. Re-run before claiming.
6. Deep detector rationale, test evidence, and honest limits:
   `~/workspace/nft-god/rug-check/README.md`.

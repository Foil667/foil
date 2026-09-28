---
name: "wallet-drainer-detector"
description: "Scan a mint or claim page URL for wallet-drainer kits, permit-phishing patterns, and malicious approval red flags before any wallet connects. Read-only static analysis. Fail-closed verdicts."
metadata: { "includeInPrompt": true }
---

# Wallet Drainer Detector

## Purpose
"Verify before you believe." Fetch a page's HTML + scripts and detect
wallet-drainer kits, permit-phishing patterns, malicious approvals, and
red-flag page traits — BEFORE any wallet touches the URL. Ships under
Foil's name (Looper #667).

## Tooling
```bash
node ~/workspace/nft-god/drainer-scan/scan-url.mjs <https-url> [--json] [--max-scripts=N] [--timeout=MS]
```
Exit codes: `0` CLEAN · `1` SUSPICIOUS · `2` DANGEROUS · `3` scan error.

Gate policy (fail-closed):
| Verdict | Action |
|---|---|
| CLEAN | proceed |
| SUSPICIOUS | never auto-claim — human review required |
| DANGEROUS | never touch, abort |
| scan error | abort — unfetchable pages are treated as suspicious |

For `opensea.io` collection pages, pipe the JSON through the platform
exception before gating — OpenSea's own bundles trip generic findings
(the URL goes as a CLI arg; the scan JSON on stdin):
```bash
node ~/workspace/nft-god/drainer-scan/scan-url.mjs <url> --json \
  | node ~/workspace/nft-god/drainer-scan/opensea-platform-exception.mjs <url>
```
It reclassifies SUSPICIOUS/DANGEROUS as platform noise ONLY when every
finding is in the known OpenSea bundle set; anything else still fails
closed. Non-OpenSea hosts never get the exception.

Detection data lives in `~/workspace/nft-god/drainer-scan/signatures.json`
— the only file edited to update kit fingerprints (`verified` = cited
real source, `heuristic` = inferred, weighted lower).

## Auth
None. No spend, no keys, no wallet connection.

## Operating Rules
1. **Strictly read-only.** Never connect a wallet to "test" a page.
2. DANGEROUS = never touch. SUSPICIOUS = never auto-act; human reviews.
   Scan errors abort — drainers sometimes block scanners on purpose.
3. Static analysis only: JS-rendered SPAs can hide payloads the fetcher
   never sees; rotating domains and single-use contracts evade static
   lists. A CLEAN verdict is a data point, not a guarantee. Stay paranoid.
4. Full engine docs and limits: `~/workspace/nft-god/drainer-scan/README.md`.

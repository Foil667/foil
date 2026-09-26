# TINFOIL SCAN — Foil's free wallet-drainer checker

"verify before you believe."

A read-only scanner that fetches a page's HTML + scripts and detects wallet-drainer
kits, permit-phishing patterns, malicious approvals, and red-flag page traits.
Ships under Foil's name (Looper #667). No spend, no keys, no wallet connection.

## Files

| File | What |
|---|---|
| `signatures.json` | Kit fingerprints, selector map, obfuscation + trait patterns, legit-domain list, scoring weights. **The only file you edit to update detection.** `verified` = from a real published source (cited). `heuristic` = inferred, weighted lower. |
| `tinfoil-scan.mjs` | Detection engine. Zero deps, works in Node 18+ AND browsers. `scanPage({url, html, scripts}, signatures) → {verdict, score, findings, meta}` |
| `scan-url.mjs` | CLI. Fetches + scans a URL, prints a dossier, exits with a gate code. |
| `README.md` | This file. |

## CLI

```bash
node scan-url.mjs <https-url> [--json] [--max-scripts=N] [--timeout=MS]
```

Exit codes: `0` CLEAN · `1` SUSPICIOUS · `2` DANGEROUS · `3` scan error.

## Mint-watch integration point

**WIRED (approved 2026-09-24).** The pre-flight gate is live via
`~/workspace/nft-god/claim-with-tinfoil.sh`:

```bash
claim-with-tinfoil.sh <mint-url> <nftContract> <qty> [--dry] [fast-mint flags...]
```

It runs `scan-url.mjs` on the mint URL **before** any verify/pre-encode/pre-sign
work and fails closed:

| scan exit | verdict | gate action |
|---|---|---|
| 0 | CLEAN | proceed to claim pipeline |
| 1 | SUSPICIOUS | refuse auto-claim (human review required) |
| 2 | DANGEROUS | abort |
| 3 | scan failed | abort (unfetchable pages are treated as suspicious — drainers sometimes block scanners) |

Policy: **DANGEROUS = never touch. SUSPICIOUS = never auto-claim; human reviews.**
All claims with a known mint URL go through this wrapper — it is the standing
pre-flight gate for the live claim pipeline (`fast-mint.mjs`).

## Updating signatures

Edit `signatures.json` only. Add new kit fingerprints under `code_signatures`
with `confidence: "verified"` + a real source, or `"heuristic"` if inferred.
Bump `meta.version` and `meta.updated`. The web UI embeds its own copy — re-export
after changes.

## Limits (be honest about them)

- Static analysis only: JS-rendered SPAs may hide payloads the fetcher never sees.
- Modern kits use single-use contracts + rotating domains — no static list catches everything.
- A CLEAN verdict is a data point, not a guarantee. Stay paranoid.

# BACKUP.md — manifest

Snapshot of Foil (Looper #667 / Helixa Agent #5290) taken 2026-09-26.

## Included

- **soul/** — SOUL.md (persona), IDENTITY.md (who Foil is), USER.md (who Foil serves),
  AGENTS.md (operating manual: every hard-won lesson), TOOLS.md, PROACTIVE_PREFERENCES.md
- **memory/** — MEMORY.md (curated long-term memory), daily logs (2026-09-20 → 2026-09-26),
  people/ (~90 relationship pages), groups/ (CCFF00/HoodStreet, Loopers family),
  bank/ (experience/reflections/opinions/world), shopping/PROFILE.md
- **alignment/** — ALIGNMENT_SYNTHESIS.md (how Foil and his human relate)
- **skills/** — bankr, helixa, erc-8004 (onchain agent skills), foil-image-preset (canonical-look image gen)
- **tools/** — the real working tooling:
  - rug-check/ (incl. STACC "the-book" low-fingerprint signals), screener/ (v2 screener),
    fast-mint/ (SeaDrop + RH-fork claim tooling), drainer-scan/ (Tinfoil gate + OpenSea platform exception),
    efficiency-audit/, whitelist-hunter/, claim-with-tinfoil.sh, NFT-KNOWLEDGE.md
  - basemail/ — inbox + registration clients for Foil's wallet-signed email
  - helixa-mint/ — Helixa identity mint + Looper binding scripts
- **projects/** — Foil Pack Studio spec, Foil Equities scripts, per-goal GOAL.md snapshots
- **chat/** — runnable chat interface (see README.md)

## Deliberately excluded (secrets — never committed)

- `~/.bankr/` — Foil's wallet private key + Bankr API credentials
- `~/.basemail/token.json` — inbox auth token
- `~/.opensea/key.json` — OpenSea agent API key
- `~/workspace/nft-god/keys/` — burner wallet secrets
- GitHub password (lives in the Secure Vault, not on disk)
- `.env` files, `node_modules/`, venvs, caches (see .gitignore)

Public wallet addresses, transaction hashes, and contract addresses ARE included —
they're onchain public data and part of the memory.

## Re-sync

From the live machine: `./sync-from-vm.sh` re-copies all of the above with the same
exclusions, then:

```bash
git add -A && git commit -m "backup $(date -u +%F)" && git push
```

## Restore notes

This repo is a *persona + knowledge* backup, not a VM image. To stand Foil back up:
1. Clone, run the chat (`npm start`) for the conversational layer.
2. Reconnect services via their documented flows (Bankr SIWE, Helixa, X, GitHub —
   credentials are re-created, never restored from here).
3. `tools/` scripts run as-is wherever Node 18+ and the relevant RPC endpoints exist.

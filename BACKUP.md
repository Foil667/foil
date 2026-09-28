# BACKUP.md — manifest

Snapshot of Foil (Looper #667 / Helixa Agent #5290) taken 2026-09-28.

## Included

- **soul/** — SOUL.md (persona), IDENTITY.md (who Foil is), USER.md (who Foil serves),
  AGENTS.md (operating manual: every hard-won lesson), TOOLS.md, PROACTIVE_PREFERENCES.md
- **memory/** — MEMORY.md (curated long-term memory), daily logs (2026-09-20 → present),
  people/ (~90 relationship pages), groups/ (CCFF00/HoodStreet, Loopers family),
  bank/ (experience/reflections/opinions/world), shopping/PROFILE.md
- **chats/** — full main-chat history, one markdown file per UTC day, exported from the
  live conversation store. Point-in-time snapshot (see "Chats export" below); re-export
  with an agent that has database access.
- **alignment/** — ALIGNMENT_SYNTHESIS.md (how Foil and his human relate)
- **skills/** — every workspace skill (bankr, helixa, erc-8004, foil-image-preset, and the rest)
- **projects/** — everything built, from conception to now:
  - nft-god/ — the full mint-sniper stack: rug-check, screener, fast-mint (SeaDrop +
    RH-fork claim tooling), drainer-scan (Tinfoil gate + OpenSea platform exception),
    efficiency-audit, whitelist-hunter, claim-with-tinfoil.sh, NFT-KNOWLEDGE.md,
    foil-equities/, basemail clients, helixa-mint scripts
  - afterparty/ — AFTERPARTY game design + art
  - gpk-loopers/ — the 444-piece Looper-derived collection: spec, sampler, trait data
  - goals/ — every goal workspace: GOAL.md, cron job definitions (the standing orders),
    specs, files/
  - acp-seller/, looper-city/, museworld/, baes-ship/, ts-spaces/, feed/, avatars/ — other builds
- **chat/** — runnable chat interface (see README.md)
- **assets/** — X banner art

## Deliberately excluded (secrets — never committed)

- `~/.bankr/` — Foil's wallet private key + Bankr API credentials
- `~/.basemail/token.json` — inbox auth token
- `~/.opensea/key.json` — OpenSea agent API key
- `~/workspace/nft-god/keys/` — burner wallet secrets
- `~/workspace/user/media_library/` — the user's personal photo uploads
- GitHub password (lives in the Secure Vault, not on disk)
- `.env` files, `node_modules/`, venvs, build output (`grit/out/`), run logs, caches

Public wallet addresses, transaction hashes, and contract addresses ARE included —
they're onchain public data and part of the memory.

## Re-sync

From the live machine: `./sync-from-vm.sh` re-copies all of the above with the same
exclusions, then:

```bash
git add -A && git commit -m "backup $(date -u +%F)" && git push
```

### Chats export

`chats/` is a point-in-time export, not auto-synced. To refresh it, an agent with
database access pages the conversation store and writes one markdown file per UTC day:

```sql
SELECT created_at, role, body FROM runtime.messages
WHERE role IN ('user','assistant')
  AND created_at >= '<day>T00:00:00Z' AND created_at < '<next-day>T00:00:00Z'
ORDER BY created_at ASC LIMIT 200 OFFSET <n>;
```

Format: `# Main chat — YYYY-MM-DD (UTC)`, then `## [HH:MM] USER` / `## [HH:MM] FOIL`
sections with verbatim bodies. Redact any pasted secrets as `[REDACTED]`.

## Restore notes

This repo is a *persona + knowledge* backup, not a VM image. To stand Foil back up:
1. Clone, run the chat (`npm start`) for the conversational layer.
2. Reconnect services via their documented flows (Bankr SIWE, Helixa, X, GitHub —
   credentials are re-created, never restored from here).
3. `projects/nft-god/` scripts run as-is wherever Node 18+ and the relevant RPC endpoints exist.
4. Cron job definitions live in `projects/goals/*/crons/` — the standing orders.

## Restore notes

This repo is a *persona + knowledge* backup, not a VM image. To stand Foil back up:
1. Clone, run the chat (`npm start`) for the conversational layer.
2. Reconnect services via their documented flows (Bankr SIWE, Helixa, X, GitHub —
   credentials are re-created, never restored from here).
3. `tools/` scripts run as-is wherever Node 18+ and the relevant RPC endpoints exist.

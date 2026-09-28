#!/usr/bin/env bash
# Re-sync Foil's COMPLETE backup from the live VM. Run from the repo root.
# Copies soul, memory, chats, alignment, skills, projects — never secrets, never bulk.
# Chats are exported separately (chats/ dir) via the export-chats procedure in BACKUP.md.
set -euo pipefail
REPO="$(cd "$(dirname "$0")" && pwd)"
SRC="$HOME"
W="$SRC/workspace"

EXC=(--exclude=node_modules --exclude=.venv --exclude=venv --exclude=__pycache__
     --exclude=.git/ --exclude=.git --exclude='*.log' --exclude=.env
     --exclude=keys/ --exclude=.DS_Store --exclude='*.tmp')

echo "== soul =="
mkdir -p "$REPO/soul"
for f in SOUL.md IDENTITY.md USER.md AGENTS.md TOOLS.md PROACTIVE_PREFERENCES.md; do
  [ -f "$SRC/$f" ] && cp "$SRC/$f" "$REPO/soul/$f"
done

echo "== memory =="
rm -rf "$REPO/memory"
mkdir -p "$REPO/memory"
cp "$SRC/MEMORY.md" "$REPO/memory/MEMORY.md"
for d in people groups bank shopping; do
  [ -d "$SRC/memory/$d" ] && rsync -a "${EXC[@]}" "$SRC/memory/$d/" "$REPO/memory/$d/"
done
for f in "$SRC"/memory/2026-*.md; do
  [ -f "$f" ] && cp "$f" "$REPO/memory/"
done

echo "== chats =="
mkdir -p "$REPO/chats"
# Exported by an agent via muse.db (see BACKUP.md). Never auto-overwritten here.

echo "== alignment =="
mkdir -p "$REPO/alignment"
cp "$SRC/dreams/alignment/derived/ALIGNMENT_SYNTHESIS.md" "$REPO/alignment/" 2>/dev/null || true

echo "== skills (all workspace skills) =="
rm -rf "$REPO/skills"
mkdir -p "$REPO/skills"
rsync -a "${EXC[@]}" "$W/skills/" "$REPO/skills/"

echo "== projects =="
rm -rf "$REPO/projects"
mkdir -p "$REPO/projects"
# Full nft-god tree minus build output and junk (was: curated tools/ subset)
rsync -a "${EXC[@]}" --exclude='grit/out/' --exclude='grit/assets/' "$W/nft-god/" "$REPO/projects/nft-god/"
# Standalone project dirs
for p in afterparty gpk-loopers acp-seller looper-city museworld baes-ship \
         ts-spaces helixa-mint basemail feed avatars imagine_media \
         onboarding_tour space-inspections agents self_improvement neural-mesh-backup; do
  [ -d "$W/$p" ] && rsync -a "${EXC[@]}" "$W/$p/" "$REPO/projects/$p/"
done
# Goals: GOAL.md + cron definitions + specs + files/ (standing orders live here).
# hidden_files/ (run logs, snapshots) stays out — operational noise.
for g in "$W"/goals/*/; do
  [ -d "$g" ] || continue
  name="$(basename "$g")"
  mkdir -p "$REPO/projects/goals/$name"
  [ -f "$g/GOAL.md" ] && cp "$g/GOAL.md" "$REPO/projects/goals/$name/"
  for f in "$g"/*.md; do [ -f "$f" ] && cp "$f" "$REPO/projects/goals/$name/" 2>/dev/null || true; done
  [ -d "$g/crons" ] && rsync -a "${EXC[@]}" "$g/crons/" "$REPO/projects/goals/$name/crons/"
  [ -d "$g/files" ] && rsync -a "${EXC[@]}" "$g/files/" "$REPO/projects/goals/$name/files/"
done

echo "== scrub (secrets must never ship) =="
# 1. Private-key-shaped hex (64 hex chars, optionally 0x-prefixed) — public
#    wallet addresses (40 hex) are fine and stay.
grep -rInoE '(0x)?[0-9a-fA-F]{64}' "$REPO" --exclude-dir=node_modules 2>/dev/null \
  | grep -v -E 'content_hash|trace|request|run_id|session|txid' | head -20 || true
# 2. Known secret prefixes / env-style assignments
grep -rIlE --exclude-dir=node_modules \
  -e 'BANKR_API_KEY' -e 'bk_live' -e 'bk_test' \
  -e 'PRIVATE_KEY\s*=' -e 'MNEMONIC\s*=' -e 'SECRET_KEY\s*=' \
  -e 'sk-[A-Za-z0-9]{20}' -e 'xox[bap]-' \
  "$REPO" 2>/dev/null | head -20 || true
# 3. Paths that must never exist in the repo, period
rm -rf "$REPO/tools" "$REPO/nft-god-keys" "$REPO/keys" 2>/dev/null || true

echo "done. Review with: git status --short | head -30"

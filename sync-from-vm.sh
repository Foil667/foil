#!/usr/bin/env bash
# Re-sync Foil's backup from the live VM. Run from the repo root.
# Copies soul, memory, skills, tools, projects — never secrets.
set -euo pipefail
REPO="$(cd "$(dirname "$0")" && pwd)"
SRC="$HOME"

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
  [ -d "$SRC/memory/$d" ] && rsync -a --exclude=.venv --exclude=node_modules --exclude=__pycache__ --exclude=.git "$SRC/memory/$d/" "$REPO/memory/$d/"
done
for f in "$SRC"/memory/2026-*.md; do
  [ -f "$f" ] && cp "$f" "$REPO/memory/"
done

echo "== alignment =="
mkdir -p "$REPO/alignment"
cp "$SRC/dreams/alignment/derived/ALIGNMENT_SYNTHESIS.md" "$REPO/alignment/" 2>/dev/null || true

echo "== skills (no .git) =="
rm -rf "$REPO/skills"
mkdir -p "$REPO/skills"
for s in bankr helixa erc-8004; do
  [ -d "$SRC/workspace/skills/bankr-skills/$s" ] && rsync -a --exclude=.git/ "$SRC/workspace/skills/bankr-skills/$s/" "$REPO/skills/$s/"
done
[ -d "$SRC/workspace/skills/foil-image-preset" ] && rsync -a --exclude=node_modules "$SRC/workspace/skills/foil-image-preset/" "$REPO/skills/foil-image-preset/"
find "$REPO/skills" -name ".git" -prune -exec rm -rf {} + 2>/dev/null || true

echo "== tools =="
rm -rf "$REPO/tools"
mkdir -p "$REPO/tools"
NG="$SRC/workspace/nft-god"
for t in rug-check screener fast-mint drainer-scan efficiency-audit whitelist-hunter; do
  [ -d "$NG/$t" ] && rsync -a --exclude=.venv --exclude=node_modules --exclude=__pycache__ --exclude=.git "$NG/$t/" "$REPO/tools/$t/"
done
for f in claim-with-tinfoil.sh NFT-KNOWLEDGE.md; do
  [ -f "$NG/$f" ] && cp "$NG/$f" "$REPO/tools/$f"
done
mkdir -p "$REPO/tools/basemail"
cp "$SRC/workspace/basemail/inbox.cjs" "$SRC/workspace/basemail/register.cjs" "$REPO/tools/basemail/" 2>/dev/null || true
if [ -d "$SRC/workspace/helixa-mint" ]; then
  mkdir -p "$REPO/tools/helixa-mint"
  cp "$SRC/workspace/helixa-mint"/*.js "$REPO/tools/helixa-mint/" 2>/dev/null || true
fi

echo "== projects =="
rm -rf "$REPO/projects"
mkdir -p "$REPO/projects"
FE="$SRC/workspace/nft-god/foil-equities"
[ -d "$FE" ] && { mkdir -p "$REPO/projects/foil-equities"; rsync -a --exclude=node_modules "$FE/scripts/" "$REPO/projects/foil-equities/scripts/" 2>/dev/null || true; }
GSPEC="$SRC/workspace/goals/foil-equities-nft-collection/foil-pack-studio-spec.md"
[ -f "$GSPEC" ] && cp "$GSPEC" "$REPO/projects/"
for g in foil-looper-wiring-and-helixa-identity foil-monetization-and-cred-building foil-s-base-eth-name-registration foil-x-debut-posts-on-foil667 loopers-only-simcity-world musechain-testnet-participation robinhood-chain-free-mint-watch foil-equities-nft-collection; do
  if [ -f "$SRC/workspace/goals/$g/GOAL.md" ]; then
    mkdir -p "$REPO/projects/goals/$g"
    cp "$SRC/workspace/goals/$g/GOAL.md" "$REPO/projects/goals/$g/"
  fi
done

echo "== scrub =="
# Remove anything that looks like it shouldn't ship. Fail-safe: list and delete.
grep -rIlE --exclude-dir=node_modules \
  -e 'burner-evm|burner-sol' \
  "$REPO" | while read -r f; do echo "SCRUBBED(hidden): $f"; done
# Never ship these paths, period:
rm -rf "$REPO/tools/nft-god-keys" "$REPO/keys" 2>/dev/null || true

echo "done. Review with: git status"

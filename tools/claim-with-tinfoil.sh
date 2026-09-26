#!/usr/bin/env bash
# claim-with-tinfoil.sh — TINFOIL-GATED claim wrapper.
#
# Every claim with a known mint URL goes through this gate. The tinfoil
# pre-flight scan runs BEFORE any verify/pre-encode/pre-sign work. It is
# fail-closed: DANGEROUS, SUSPICIOUS, or an unreadable page all abort the
# claim. This is the standing integration of Tinfoil Scan into the live
# claim pipeline (approved 2026-09-24).
#
# Usage: claim-with-tinfoil.sh <mint-url> <nftContract> <qty> [--dry] [fast-mint flags...]
#
# Examples:
#   claim-with-tinfoil.sh https://quadgrifters.com 0x7b3A...FE 1 --dry
#   claim-with-tinfoil.sh https://mint.example.xyz 0xabcd... 1
#
set -u

if [ $# -lt 3 ]; then
  echo "usage: claim-with-tinfoil.sh <mint-url> <nftContract> <qty> [--dry] [fast-mint flags...]" >&2
  exit 2
fi

MINT_URL="$1"; NFT="$2"; QTY="$3"; shift 3
SCAN="$HOME/workspace/nft-god/drainer-scan/scan-url.mjs"
PLATFORM_X="$HOME/workspace/nft-god/drainer-scan/opensea-platform-exception.mjs"
FAST_MINT="$HOME/workspace/nft-god/fast-mint/fast-mint-fork.mjs"

echo "[TINFOIL] pre-flight scan of $MINT_URL (nft=$NFT qty=$QTY)"
SCAN_JSON="$(node "$SCAN" "$MINT_URL" --json 2>/dev/null)"
# print the human-readable scan too (to stderr so it doesn't pollute SCAN_JSON)
node "$SCAN" "$MINT_URL" >&2
VERDICT="$(echo "$SCAN_JSON" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{process.stdout.write(JSON.parse(d).verdict||'ERROR')}catch{process.stdout.write('ERROR')}})")"
case "$VERDICT" in
  CLEAN) echo "[TINFOIL] verdict CLEAN — proceeding to claim pipeline" ;;
  SUSPICIOUS)
    if echo "$SCAN_JSON" | node "$PLATFORM_X" "$MINT_URL"; then
      echo "[TINFOIL] verdict SUSPICIOUS reclassified: OpenSea platform noise (explicit exception, 2026-09-25 policy) — proceeding to onchain gates" >&2
    else
      echo "[TINFOIL] verdict SUSPICIOUS — refusing auto-claim (human review required)" >&2; exit 1
    fi ;;
  DANGEROUS)
    if echo "$SCAN_JSON" | node "$PLATFORM_X" "$MINT_URL"; then
      echo "[TINFOIL] verdict DANGEROUS reclassified: OpenSea platform noise (explicit exception, 2026-09-25 policy) — proceeding to onchain gates" >&2
    else
      echo "[TINFOIL] verdict DANGEROUS — aborting claim" >&2; exit 1
    fi ;;
  *) echo "[TINFOIL] scan failed (verdict $VERDICT) — failing closed, aborting claim" >&2; exit 1 ;;
esac

exec node "$FAST_MINT" "$NFT" "$QTY" "$@"

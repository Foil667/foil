#!/usr/bin/env bash
# claim-with-tinfoil.sh — TINFOIL-GATED claim wrapper.
#
# Every claim with a known mint URL goes through this gate. The tinfoil
# pre-flight scan runs BEFORE any verify/pre-encode/pre-sign work. It is
# fail-closed: DANGEROUS, SUSPICIOUS, or an unreadable page all abort the
# claim. This is the standing integration of Tinfoil Scan into the live
# claim pipeline (approved 2026-09-24).
#
# Usage: claim-with-tinfoil.sh <mint-url> <nftContract> <qty> [--route-x @handle] [--route-site https://...] [--dry] [fast-mint flags...]
#
# Route gate (fail-closed, 2026-10-01): --route-x/--route-site, or route_x/
# route_site + route_verified:true recorded on the project's pipeline entry,
# is REQUIRED before the Tinfoil scan runs. The mint URL itself is not route
# evidence; opensea.io/aggregator metadata alone never passes.
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

# ---- gate R: OFFICIAL-ROUTE (fail-closed, 2026-10-01).
# Consumes --route-x @handle / --route-site https://... from the arg list
# (they gate BEFORE the Tinfoil scan AND are re-attached for fast-mint's
# own startup gate) and enforces the shared route gate BEFORE the Tinfoil
# scan. The mint URL itself is NOT route evidence:
# an opensea.io collection URL does not prove a project-owned route.
ROUTE_X=""; ROUTE_SITE=""; FWD_ARGS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --route-x) ROUTE_X="$2"; shift 2 ;;
    --route-site) ROUTE_SITE="$2"; shift 2 ;;
    *) FWD_ARGS+=("$1"); shift ;;
  esac
done
echo "[ROUTE] verifying official project route for $NFT (fail-closed)"
if ! node "$HOME/workspace/nft-god/fast-mint/route-gate.mjs" --contract "$NFT" \
    ${ROUTE_X:+--x "$ROUTE_X"} ${ROUTE_SITE:+--site "$ROUTE_SITE"}; then
  echo "[ROUTE] official route NOT verified — refusing claim. Aggregator metadata alone is never sufficient." >&2
  exit 4
fi

SCAN="$HOME/workspace/nft-god/drainer-scan/scan-url.mjs"
PLATFORM_X="$HOME/workspace/nft-god/drainer-scan/opensea-platform-exception.mjs"
FAST_MINT="$HOME/workspace/nft-god/fast-mint/fast-mint-fork.mjs"

# CLOSED-EXCLUSION REGISTRY (durable kill list, 2026-09-27).
# Fail-closed: a blacklisted contract aborts BEFORE any scan/verify/sign.
EXCL_JSON="$HOME/workspace/nft-god/closed-exclusions.json"
EXCL_REASON="$(node -e '
const fs=require("fs"),addr=process.argv[1].toLowerCase();
try{const d=JSON.parse(fs.readFileSync("'$EXCL_JSON'","utf8"));
const e=d.exclusions[addr];
if(e){process.stdout.write(e.project+": "+e.reason)}}catch{}' "$NFT")"
if [ -n "$EXCL_REASON" ]; then
  echo "[EXCLUSION] $NFT is permanently blacklisted — refusing claim." >&2
  echo "[EXCLUSION] $EXCL_REASON" >&2
  exit 3
fi

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

# Re-attach route evidence for fast-mint's own startup gate (fail-closed):
# the wrapper consumes --route-x/--route-site for its pre-scan gate but
# fast-mint ALSO enforces the route gate at startup, so the flags must be
# forwarded, not dropped. (2026-10-05: main-agent Golden Arrows fire was
# blocked because the flags were eaten here.)
[ -n "$ROUTE_X" ] && FWD_ARGS+=(--route-x "$ROUTE_X")
[ -n "$ROUTE_SITE" ] && FWD_ARGS+=(--route-site "$ROUTE_SITE")

exec node "$FAST_MINT" "$NFT" "$QTY" "${FWD_ARGS[@]}"

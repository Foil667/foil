#!/bin/bash
# fire-sherwood.sh — at 17:45:08 UTC claim the sherwood-hood-animated FREE public
# stage (SeaDrop, price 0, max/wallet 1) via the tinfoil-gated wrapper.
set -u
OPEN_UTC=$(date -u -d "2026-09-30 17:45:08 UTC" +%s)
NOW_UTC=$(date -u +%s)
WAIT=$((OPEN_UTC - NOW_UTC))
if [ "$WAIT" -gt 0 ]; then echo "[sherwood] waiting ${WAIT}s for 17:45:08 UTC"; sleep "$WAIT"; fi
exec ~/workspace/nft-god/claim-with-tinfoil.sh \
  https://opensea.io/collection/sherwood-hood-animated \
  0x910fa9f4bed170cc0dd8ff5fd16119c143a2d053 1 --max-price-usd 0.10 2>&1

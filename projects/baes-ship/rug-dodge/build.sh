#!/bin/bash
# Assemble ~/workspace/baes-ship/rug-dodge/index.html from parts:
#   src/head.html + shared rescue-burn.js + src/game.js
set -e
D="$(cd "$(dirname "$0")" && pwd)"
OUT="$D/index.html"
{
  cat "$D/src/head.html"
  printf '<script>\n'
  cat /home/hatch/workspace/shared/rescue-burn.js
  printf '\n</script>\n<script>\n'
  cat "$D/src/game.js"
  printf '\n</script></body></html>\n'
} > "$OUT"
echo "built $OUT ($(wc -c < "$OUT") bytes)"

#!/usr/bin/env bash
#
# sample-run.sh — demonstrates the audit's two hard rules on seeded SAMPLE data,
# then deletes the seed. Nothing here touches real state or the real mint log.
#
#   1. RPC-replacement rule: "public-base-rpc" wins 20/60 (33%) -> REPLACE;
#      "new-rpc" wins 3/9 (33.3%) but only 9 mints -> WATCH (insufficient volume),
#      proving <50 mints never triggers REPLACE. "backup-rpc" at 40/60 (67%) -> OK.
#      Win patterns cap consecutive losses at 2 on "base" so only the intended
#      robinhood streak triggers an auto-bump.
#   2. Auto-bump rule: 3 consecutive negative-ROI mints on "robinhood" bump its
#      minScore 30 -> 35 in state.json (live mode only). Dry run must NOT mutate.
#
# The seed is generated fresh into /tmp on every run and deleted at the end.
# To keep this sample data instead, re-run with KEEP_SAMPLE=1.

set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUDIT="$DIR/../audit.mjs"
SAMPLE_DIR="${SAMPLE_DIR:-/tmp/efficiency-audit-sample}"
MINT_LOG="$SAMPLE_DIR/mint-log.jsonl"
STATE="$SAMPLE_DIR/state.json"
OUT="$SAMPLE_DIR/out"

pass=0; fail=0
check() { # check <description> <command...>
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then echo "  PASS: $desc"; pass=$((pass+1));
  else echo "  FAIL: $desc"; fail=$((fail+1)); fi
}

echo "== seeding sample mint log =="
rm -rf "$SAMPLE_DIR"; mkdir -p "$OUT"
MINT_LOG="$MINT_LOG" node -e '
const fs = require("fs");
const out = process.env.MINT_LOG;
const rows = [];
let t = Date.parse("2026-09-20T00:00:00Z");
// loss patterns are designed so base-chain consecutive losses NEVER reach 3:
// wins pay +0.35 net (0.40 proceeds - 0.05 gas), losses pay -0.05 net
const mint = (chain, rpc, win, i, lat) => {
  t += 60000;
  return { ts: new Date(t).toISOString(), chain, contract: "0x" + rpc.replace(/-/g,"").slice(0,4) + i,
    latencyMs: lat, gasCostUsd: 0.05, rpcUsed: rpc,
    rpcWon: win, score: 70, proceedsUsd: win ? 0.40 : 0 };
};
// 1) base chain, backup-rpc: 60 mints, 40 wins (66.7%) -> OK (losses come in pairs)
for (let i = 0; i < 60; i++) rows.push(mint("base", "backup-rpc", i % 3 !== 2, i, 900 + (i % 200)));
// 2) base chain, public-base-rpc: 60 mints, 20 wins (33.3%) -> REPLACE (losses in pairs)
for (let i = 0; i < 60; i++) rows.push(mint("base", "public-base-rpc", i % 3 === 0, i, 2400 + (i % 300)));
// 3) base chain, new-rpc: 9 mints, 3 wins (33.3%) -> WATCH only (too few mints)
//    starts with a win so no loss streak crosses the RPC boundary; losses in pairs
for (let i = 0; i < 9; i++) rows.push(mint("base", "new-rpc", i % 3 === 0, i, 1500));
// 4) robinhood chain: 3 CONSECUTIVE negative-ROI mints -> auto-bump 30 -> 35
for (let i = 0; i < 3; i++) rows.push(mint("robinhood", "backup-rpc", false, i, 1100));
fs.writeFileSync(out, rows.map(r => JSON.stringify(r)).join("\n") + "\n");
console.log("  seeded", rows.length, "sample mint lines");
'

echo "== dry run (must not mutate state.json) =="
env AUDIT_MINT_LOG="$MINT_LOG" AUDIT_STATE="$STATE" AUDIT_OUT_DIR="$OUT" AUDIT_SKIP_GITHUB=1 \
  node "$AUDIT" --dry | tail -8
check "dry run wrote AUDIT-REPORT.md" test -f "$OUT/AUDIT-REPORT.md"
check "dry run did NOT create state.json" test '!' -f "$STATE"
check "dry report flags public-base-rpc as REPLACE" grep -q 'public-base-rpc.*REPLACE' "$OUT/AUDIT-REPORT.md"
check "dry report does NOT replace new-rpc (WATCH instead)" grep -q 'new-rpc.*WATCH (low volume)' "$OUT/AUDIT-REPORT.md"
check "dry report notes the auto-bump as NOT persisted" grep -q 'NOT persisted' "$OUT/AUDIT-REPORT.md"

echo "== live run (applies the bump) =="
env AUDIT_MINT_LOG="$MINT_LOG" AUDIT_STATE="$STATE" AUDIT_OUT_DIR="$OUT" AUDIT_SKIP_GITHUB=1 \
  node "$AUDIT" --live | tail -8
check "live run created state.json" test -f "$STATE"
check "robinhood minScore bumped 30 -> 35" node -e "const s=require('$STATE');process.exit(s.chainMinScore.robinhood===35?0:1)"
check "base was NOT bumped (streak never hit 3)" node -e "const s=require('$STATE');process.exit(('base' in s.chainMinScore)?1:0)"
check "robinhood consecutive-loss streak reset to 0" node -e "const s=require('$STATE');process.exit(s.consecutiveLosses.robinhood===0?0:1)"

echo "== second live run (idempotency: cursor advanced, no duplicate bump) =="
env AUDIT_MINT_LOG="$MINT_LOG" AUDIT_STATE="$STATE" AUDIT_OUT_DIR="$OUT" AUDIT_SKIP_GITHUB=1 \
  node "$AUDIT" --live | tail -5
check "second run processed 0 new lines" grep -q '0 new since cursor' "$OUT/AUDIT-REPORT.md"
check "minScore still 35 (no double bump)" node -e "const s=require('$STATE');process.exit(s.chainMinScore.robinhood===35?0:1)"

echo "== cleanup =="
if [ "${KEEP_SAMPLE:-0}" = "1" ]; then
  echo "  KEEP_SAMPLE=1: sample kept at $SAMPLE_DIR (SAMPLE DATA — do not mix with real logs)"
else
  rm -rf "$SAMPLE_DIR"
  echo "  sample seed deleted"
fi

echo ""
echo "result: $pass passed, $fail failed"
exit $((fail > 0 ? 1 : 0))

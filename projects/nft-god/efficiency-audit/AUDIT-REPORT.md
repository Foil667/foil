# Efficiency Audit Report

Run: 2026-10-10T10:36:09.534Z
Mode: --live (state mutations applied)

## 1. Tool candidates (GitHub discovery)

Status: OK — 15 candidate repos (pushed since 2026-07-12). Full list in CANDIDATE_TOOLS.md.

## 2. RPC performance (mint-log.jsonl)

Log: /home/hatch/workspace/nft-god/fast-mint/mint-log.jsonl — 42 total lines, 3 new since cursor, 0 malformed skipped.

| RPC | Mints | Wins | Win rate | Median latency (ms) | Verdict |
| --- | --- | --- | --- | --- | --- |
| unknown | 3 | 0 | 0.0% | n/a | **WATCH (low volume)** |

Rule: win rate <40% over >=50 mints => REPLACE. Low-volume underperformers (<50 mints) are WATCH, not REPLACE.

## 3. Chain ROI

| Chain | Mints | Proceeds | Gas | Net ROI | Consecutive losses (persisted) |
| --- | --- | --- | --- | --- | --- |
| unknown | 3 | $0.0000 | $0.0000 | $0.0000 | 0 |

Rule: 3 consecutive negative-ROI mints => chain minScore +5 (never lowered).

## 4. Actions taken

none.

State: state.json updated (0 bump action(s), cursor advanced).

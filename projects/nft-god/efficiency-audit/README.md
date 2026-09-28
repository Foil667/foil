# efficiency-audit

24-hour efficiency audit for **NFT_WATCHDOG_CHAD_V2**. Fully non-interactive —
safe to run from the scheduler. Node 24+, global `fetch` only, no dependencies.

## What it does

| Job | Reads | Writes |
|-----|-------|--------|
| 1. GitHub tool discovery | public GitHub search API (keyless) | `CANDIDATE_TOOLS.md` |
| 2. Mint-log RPC analysis | `mint-log.jsonl` (written by the fast-mint tool) | `AUDIT-REPORT.md` |
| 3. Per-chain ROI + minScore bumps | `mint-log.jsonl`, `state.json` | `AUDIT-REPORT.md`, `state.json` (`--live` only) |

**HARD LINES:** no spend, no signups, no keys, no deployments. Read-only except
its own report files and — only under `--live` — `state.json`.

## Flags

```
node audit.mjs [--dry] [--live] [--skip-github] [--help]
```

- **`--dry` (DEFAULT).** Read-only analysis. Writes `AUDIT-REPORT.md` and
  `CANDIDATE_TOOLS.md` only. **Never creates or mutates `state.json`.**
- **`--live`.** Additionally applies chain-minScore bumps and persists the log
  cursor to `state.json`. Only run when the scheduler owner has approved state
  mutation (this is what the 24h cron uses).
- `--skip-github`. Skip the GitHub discovery job (offline / test runs).

## Job details

### 1. GitHub tool discovery → CANDIDATE_TOOLS.md

Three keyless queries against `api.github.com/search/repositories`, all filtered
to repos pushed in the last 90 days, sorted by stars:

- `topic:nft-mint-bot`, `topic:nft-bot`
- `nft mint bot in:name,description` (broad fallback)

Dedupes by repo, keeps the top 15, and writes one honest relevance line per repo
derived only from its name/description/topics — no invented claims. Requests are
spaced 2s apart (well under the 10 req/min unauthenticated search limit). On a
403/429 or network failure the file is written with `STATUS: DEGRADED` and the
rate-limit reset time — **degraded is reported, never faked.**

### 2. RPC performance → AUDIT-REPORT.md

Reads `mint-log.jsonl` (JSON lines, see schema below). Per `rpcUsed` it computes
uses, wins (`rpcWon` truthy = win), win rate, and median `latencyMs`.

**REPLACE rule:** win rate **<40%** over **≥50 mints** → verdict `REPLACE`.
Underperformers under 50 mints get `WATCH (low volume)` — never `REPLACE`.

### 3. Chain ROI + auto-bump → state.json (`--live` only)

Sums `proceedsUsd − gasCostUsd` per chain. **Bump rule:** 3 consecutive
negative-ROI mints on a chain → that chain's `minScore` goes **+5**.
minScore is **never lowered automatically**. A streak breaks on the first
profitable (or breakeven) mint; after a bump the streak resets so the *next*
3 consecutive losses trigger another +5.

`state.json` shape (created on first `--live` run):

```json
{
  "chainMinScore": { "robinhood": 35 },
  "consecutiveLosses": { "robinhood": 0, "base": 1 },
  "cursorTs": "2026-09-20T03:32:00.000Z",
  "lastRun": "2026-09-24T12:00:00.000Z"
}
```

- `chainMinScore` — per-chain overrides; chains not listed use the screener's
  default `30` as the bump baseline.
- `cursorTs` — last processed mint timestamp, so each run only processes **new**
  log lines (prevents double-counting across the 24h runs).
- If `mint-log.jsonl` is missing or has zero parseable lines, the report says
  `no data yet` and nothing is persisted.

### 4. AUDIT-REPORT.md

Overwritten every run with timestamped sections: tool candidates, RPC
performance, chain ROI, actions taken (each marked `[dry run — NOT persisted]`
or `[persisted to state.json]`).

## mint-log.jsonl schema

Written by the fast-mint tool (one JSON object per line):

```json
{"ts":"2026-09-24T01:02:03.000Z","chain":"base","contract":"0x…",
 "latencyMs":812,"gasCostUsd":0.041,"rpcUsed":"backup-rpc","rpcWon":true,
 "score":72,"proceedsUsd":0.40}
```

Default path: `../fast-mint/mint-log.jsonl` (next to this module).
Overrides: `AUDIT_MINT_LOG`, `AUDIT_STATE`, `AUDIT_OUT_DIR`, `AUDIT_SKIP_GITHUB=1`.

## Sample run

`test/sample-run.sh` seeds 132 **sample** mint lines into `/tmp` (never touching
real state), then:

1. **Dry run** — proves `state.json` is *not* created, `public-base-rpc`
   (20/60 wins = 33.3%) is flagged **REPLACE**, `new-rpc` (3/9 wins = 33.3%)
   gets **WATCH** (insufficient volume), and the robinhood auto-bump is reported
   as *not persisted*.
2. **Live run** — proves `state.json` *is* created with `robinhood` minScore
   bumped 30 → 35, the loss streak reset to 0, and `base` untouched.
3. **Second live run** — proves idempotency: the cursor advances, 0 new lines
   are processed, and the bump is not applied twice.
4. Deletes the seed (set `KEEP_SAMPLE=1` to keep it at
   `/tmp/efficiency-audit-sample` — it is clearly labeled SAMPLE DATA).

```bash
bash test/sample-run.sh   # 11 checks, all must PASS
```

## Scheduling

Run every 24h non-interactively:

```bash
node ~/workspace/nft-god/efficiency-audit/audit.mjs --live
```

Omit `--live` (or pass `--dry`) for a read-only trial that still produces both
reports. Stdout prints a one-paragraph summary for scheduler logs.

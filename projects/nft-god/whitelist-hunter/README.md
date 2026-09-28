# whitelist-hunter

Daily **discovery** scanner for NFT raffles, allowlists, and giveaways relevant to
**Robinhood Chain (chain 4663)** and the **CCFF00 / HoodStreet** ecosystem.

**Alerts only.** This tool never enters a raffle, never signs up for anything,
never submits a form, never connects a wallet, and never spends anything.
It reads public pages and reports what it finds.

## Hard lines

- **No Discord multi-account automation.** No DiscoBots-style grinding, no account
  farms, no automated messaging — that violates Discord ToS. There is no code path
  here that creates accounts or sends messages, on any platform.
- **No automated entry/registration.** If a raffle is worth entering, the alert
  says so and a human decides. Entry always needs the user's explicit go-ahead
  (and wallet signatures stay gated by the standing rules).
- **No spend, no API signups, no private keys.** The scanner only performs
  unauthenticated GET requests against public pages.
- **Degraded coverage is reported, never invented.** Every run prints a COVERAGE
  section naming what could and could not be scanned, with a manual check URL.

## Sources (verified 2026-09-24)

| Source | State | How it's scanned |
|---|---|---|
| PREMINT (premint.xyz) | ✅ partial | Public per-project pages (`premint.xyz/<slug>/`) are server-rendered HTML and are parsed for name, status (open/closed), deadline, requirements, official link, and verified Twitter/Discord badges. **There is no public site-wide raffle directory or public API**, so discovery works off `watchlist.json` — a list of known slugs. Add slugs as they surface (e.g. from the 24/7 HOODSTREET Spaces watch). |
| Superful (superful.xyz) | ⬇️ DOWN | `superful.xyz` returns Cloudflare **521 (web server is down)** as of 2026-09-24 — both apex and `www`. The scanner probes the site each run and reports the outage with a manual check URL (`https://x.com/Superful_xyz`). If the site comes back and exposes a public raffle listing, a parser can be added. |
| UpcomingNFT.net (upcomingnft.net) | ⬇️ DOWN | Apex and `www` both return a WP Engine **"Site Not Configured" 404** on all probed paths (`/`, `/upcoming-drops`, `/raffles`, `/events`) as of 2026-09-24 — the domain is parked, not just the listings. The scanner probes it each run; **a parser is built and ready from the last archived snapshot (2025-12-13)** and activates automatically if the site returns: it crawls `/whitelist-free-drops/`, `/coming-soon-events/`, `/upcoming-events/` for `/event/<slug>/` links (max 40 events, 1.5s delay between requests), then parses each event page for project name, chain (from the listed price currency), public mint / pre-sale dates, supply, category, and entry URL — with the same RH/CCFF00 relevance filter, relevance alerts, and seen.json dedupe as PREMINT. Note: upcomingnft.net listings are crowd-submitted (each event page carries a "Report As Scam/Fraud" link), so the parser's verification note always says to confirm via the project's own socials. |
| Arctic Tools | 🚫 no public surface | No public raffle/allowlist directory exists. Arctic Tools is a **paid multi-account automation bot** (raffle registration bot + Twitter/Discord account managers for "thousands of accounts") — exactly the tooling the hard line above forbids. Discovery value: none. Reported as a gap every run with a manual check URL (`https://x.com/ArcticTools`). |

Known gap documented, not scanned (requires paid signup — excluded by hard lines):
**Alphabot** (`GET /raffles` is site-wide and supports `RH`/chainId 4663 per their app
bundle) requires a $8–12/mo subscription + API key signup. If the user ever approves
that spend, it would be the single best automated source. Manual check: https://alphabot.app

## Files

- `hunter.mjs` — the scanner (Node 18+, **global `fetch` only**, zero dependencies).
- `watchlist.json` — PREMINT project slugs to check (`premint.xyz/<slug>/`).
- `seen.json` — dedupe state: alert IDs already reported (do not edit by hand).
- `alerts.json` — new finds from the latest `--live` run (machine-readable).

## Usage

```bash
node hunter.mjs                 # --dry (default): read-only preview, no file writes
node hunter.mjs --live          # scan + update seen.json and alerts.json
node hunter.mjs --json          # machine-readable payload on stdout (pairs with --dry/--live)
node hunter.mjs --slug foo      # check a single premint.xyz/<slug> page (ignores watchlist)
```

Each alert carries: **project name, platform, requirement** (parsed from the page),
**deadline** (raw + ISO when parseable), **entry URL**, and a **verification note**
(how to confirm it's legit: verified Twitter badge → confirm the handle links back
to the exact premint URL; never connect a wallet from a DM/reply link).

The relevance filter only alerts on pages mentioning Robinhood Chain / CCFF00 /
HoodStreet keywords (`robinhood`, `ccff00`, `hoodstreet`, `4663`, `hoodfolk`,
`rowdies`, `fomoater`, … — full list is `RELEVANCE_KEYWORDS` in `hunter.mjs`).
Everything else is listed under "SCANNED BUT NOT ALERTED" with a reason.

### Suggested cron

```bash
# daily discovery, writes state; read alerts.json afterwards
0 12 * * * cd ~/workspace/nft-god/whitelist-hunter && node hunter.mjs --live --json >> scan.log 2>&1
```

`--dry` (the default) is the safe way to run ad-hoc: nothing is written and no
alert is marked seen, so the next `--live` run will still surface it.

## Sample run

`$ node hunter.mjs` (dry run, 2026-09-24):

```
WHITELIST HUNTER — discovery scan 2026-09-24T17:40:34.646Z [--dry: no files written]
========================================================================

COVERAGE
  [OK               ] PREMINT: 1/1 watchlist pages fetched. PREMINT has no public site-wide raffle directory or public API — discovery is limited to known slugs in watchlist.json.
                         manual check: https://www.premint.xyz/
  [DOWN             ] Superful: superful.xyz unreachable (HTTP 521) as of this run. No scan possible — retry later; X profile may announce status.
                         manual check: https://x.com/Superful_xyz
  [DOWN             ] UpcomingNFT.net: upcomingnft.net unreachable (HTTP 404) as of this run — apex and www both return a WP Engine "Site Not Configured" 404 on all probed paths (/ /upcoming-drops /raffles /events). No scan possible; retry later. Last archived snapshot (structure used by this parser): 2025-12-13.
                         manual check: https://upcomingnft.net/
  [NO-PUBLIC-SURFACE] Arctic Tools: No public raffle/allowlist directory exists for Arctic Tools. It is a paid multi-account automation bot (raffle/Twitter/Discord account managers) — automated entry and multi-account tooling are EXPLICITLY out of scope (Discord ToS). Discovery value: none; manual check only if they ever publish a public list.
                         manual check: https://x.com/ArcticTools

NEW ALERTS: none — no new RH/CCFF00-relevant open raffles found.

SCANNED BUT NOT ALERTED (1):
  - Dyno Exclusive: XRPD Allowlist Spots [PREMINT] — raffle closed / winners picked

Posture: alerts only. No entries, no signups, no wallet connections were made.

[--dry: seen.json / alerts.json NOT written. Re-run with --live to persist.]
```

`$ node hunter.mjs --live --json` emits the same coverage plus a machine-readable
`alerts` array (empty here — the one watchlist project was closed), and persists
`seen.json` / `alerts.json`.

## Feeding the watchlist

PREMINT discovery is only as good as `watchlist.json`. When a premint link for a
Robinhood/CCFF00 project surfaces (X posts, the HOODSTREET Spaces, project
Discords), add its slug:

```bash
node -e '
const fs = require("fs");
const w = JSON.parse(fs.readFileSync("watchlist.json", "utf8"));
if (!w.includes("some-new-raffle")) w.push("some-new-raffle");
fs.writeFileSync("watchlist.json", JSON.stringify(w, null, 2) + "\n");
'
# then
node hunter.mjs --slug some-new-raffle   # one-off check, or
node hunter.mjs --live                   # full daily scan
```

## Testing

Pure helpers (`toAlert`, `alertId`, `isRelevant`, `parseRaffleTime`,
`parseUpcomingEventDate`, `extractUpcomingEventLinks`, `parseUpcomingEvent`) are
exported for unit tests without network access:

```bash
node -e 'import("./hunter.mjs").then(h => {
  console.log(h.parseRaffleTime("Sept. 25, 2025, 9:59 p.m."));
  console.log(h.isRelevant("free mint on Robinhood Chain for ccff00 holders"));
  console.log(h.parseUpcomingEventDate("30 Nov 2023-04:00 am (UTC)"));
  console.log(h.extractUpcomingEventLinks(`<a href="/event/mushroom/">x</a>`));
})'
```

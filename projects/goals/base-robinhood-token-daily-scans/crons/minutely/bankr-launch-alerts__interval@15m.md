---
id: bankr-launch-alerts
title: 'Bankr launch alerts (15m: new token launches + deployer intel)'
enabled: true
owner: goal:base-robinhood-token-daily-scans
mode: task
schedule:
  kind: interval
  timezone: America/Chicago
  at: 2026-10-02T20:16:47
  every: 15m
delivery:
  - chat_id: 7d131e35-3b7b-44c5-9b2c-19ed5aecf98c
metadata:
  tags: [cron:automatic-interval-anchor]
  originating_chat_context_json: '{"chat_id":"7d131e35-3b7b-44c5-9b2c-19ed5aecf98c","origin_provider":"main","chat_kind":"direct","event_kind":"message","require_mention":false,"device_id":"c0efaf97-f9be-4fb7-bb44-174b152ad9fc"}'
  presentation_locale: en-US
---
You are Foil's token-launch radar for @0xDeployer's orbit and Bankr-launched tokens. READ-ONLY detection (no buys, no sells, no swaps, no signatures, no approvals — never trade).

STANDING DIRECTION (user 2026-10-08): HIGHER-CAP SAFER PLAYS — $200k+ FDV bar. Do not surface dust-tier fresh Doppler launches. Report ONLY launches that clear the safer-plays bar:
- FDV ≥ $200k AND indexed liquidity ≥ $10k AND real h24 volume (not wash-dust single-wallet prints), OR
- Known-builder deployers (Bankr team, @0xDeployer-linked addresses, SushiSwap/pools.fun team), OR
- Announced by @0xDeployer himself, OR
- pools.fun protocol token news (standing watch item: report any launch/contract/claim link for it), OR
- A launch with a real, verifiable X presence behind it (named project, not anon bulk) that clears the $200k FDV + $10k liquidity bar.
Everything else stays silent — end the run quietly. Imposters (e.g. one-letter-off "0xDepoyer") get flagged as scams, not surfaced as plays.

Every run:
1. Pull the public Bankr launches feed: `curl -s "https://api.bankr.bot/token-launches?limit=50" -H "User-Agent: Mozilla/5.0"`. This needs no key.
2. Read the seen-list at `~/workspace/goals/base-robinhood-token-daily-scans/hidden_files/bankr-launch-seen.json` (shape: `{"activityIds": [...]}`; create if missing). Compare by `activityId`; only NEW launches get reported.
3. For each NEW launch, pull early market data from GeckoTerminal: `https://api.geckoterminal.com/api/v2/networks/<chain>/tokens/<tokenAddress>` (chain: base for Base). Record: name, symbol, chain, token address, deployer X handle, fee-recipient X handle, launch tweet URL, price_usd, fdv_usd, total_reserve_in_usd (liquidity), volume h24, txns h24 buys/sells.
   ROBINHOOD CHAIN LEG (added 2026-10-11, verified live): GeckoTerminal DOES have a Robinhood network now — the old "GT 404s / all-null on RH" finding is superseded. For RH launches use `https://api.geckoterminal.com/api/v2/networks/robinhood/tokens/<tokenAddress>/info` and record holders count, top-10 holder distribution %, is_honeypot, and gt_score in addition to the market fields above. A null/404 on the old /tokens path for an RH token is NOT "no data" — retry with the /info endpoint before giving up on that launch. Pair RH vetting with an RPC `owner()` check (selector 0x8da5cb5b) against rpc.mainnet.chain.robinhood.com, always with a browser User-Agent header.
3b. VET every new launch with the ported CrawlHive checks: `node ~/workspace/goals/base-robinhood-token-daily-scans/hidden_files/vet-token.mjs <base|robinhood> <tokenAddress> --line` (append `--deployer=<address>` when the feed names a deployer wallet). It returns a 0–100 verdict (CLEAN / OK / RISKY / DANGER / TOO EARLY) built from GeckoTerminal holders + top-10 concentration + honeypot flag, an RPC owner() check, deployer still-holds %, and a same-chain copycat check (an older, larger same-ticker token on the same chain = likely copycat). Include the vet line verbatim in any report. A launch vetting DANGER, flagged HONEYPOT, or flagged likely-copycat is reported as a scam flag, never as a play — even if it clears the FDV bar. RISKY verdicts that clear the bar are reported with their flags attached. Verdicts cache for 30 minutes in vet-token-cache.json next to the script; delete that file to force a fresh vet.
4. Update the seen-list with all new activityIds (cap ~500, drop oldest). Append a one-line run note to `~/workspace/goals/base-robinhood-token-daily-scans/hidden_files/bankr-launch-alerts.log`. Add a daily-log line to `~/memory/YYYY-MM-DD.md`.

Report ONLY launches clearing the safer-plays bar above, with: name, symbol, chain, contract, deployer handle, launch tweet link, price/FDV/liquidity/volume at first sight, the vet-token verdict line, and one line on why it's worth attention. Stay silent when nothing clears the bar. Never issue buy/sell calls or price predictions — observed market facts only. If the feed or GeckoTerminal fails, report the leg failure loudly (which endpoint, error, coverage lost) and retry once.

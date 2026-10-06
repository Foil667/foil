---
id: wl-tooling-research
title: WL tooling research (weekly — steal the best ideas)
enabled: true
owner: goal:wl-scout
mode: task
schedule:
  kind: weekly
  timezone: America/Chicago
  time: 10:36:00
  dow: [Mon]
delivery:
  - chat_id: 7d131e35-3b7b-44c5-9b2c-19ed5aecf98c
metadata:
  tags: [cron:flexible-time]
  originating_chat_context_json: '{"chat_id":"7d131e35-3b7b-44c5-9b2c-19ed5aecf98c","origin_provider":"main","chat_kind":"direct","event_kind":"message","require_mention":false,"device_id":"c0efaf97-f9be-4fb7-bb44-174b152ad9fc"}'
  presentation_locale: en-US
---
Weekly WL-tooling research — Foil stays ahead on whitelist/mint tracking by studying everyone else's builds (user standing order 2026-10-04 ~23:06 CDT: "constantly searching better ways of staying up-to-date with whitelists — different builds people have done, different tools out there — pick them apart and use them to make ours better").

Every run:
1. HUNT: search for new or updated whitelist/allowlist/mint-tracking tools — GitHub repos, web dashboards, X bots, Discord/Telegram alert bots, Dune dashboards, aggregator sites. Keywords: "NFT whitelist tracker", "allowlist alerts", "free mint scanner", "mint aggregator", "whitelist spots bot", plus chain-specific ("Robinhood Chain", "Base"). Check awesome-lists, skill repos, and X for builders shipping mint tooling.
2. PICK APART the 2-3 most promising finds: how do they detect WL phases (OpenSea drops API? onchain SeaDrop probes? GraphQL eligibility? scraping?)? What are their data sources, refresh cadence, and alert paths? What do they cover that our stack doesn't (new chains, faster detection, better eligibility checks, Discord/Telegram pushes, mobile)?
3. EVALUATE against our current stack: foilbox (5m sniper), hood-mint-watch (20m), nft-screener (5m), wl-opportunities-sweep (12h), wl-scout feeds, radar CDN, OpenSea drops API, botchan feeds, X sweeps.
4. RECOMMEND concrete upgrades: specific techniques to steal, APIs to add, or tools to fork/rebuild — with effort estimate (quick win vs build). Never install unknown binaries or run untrusted code; read-only analysis. If a find is a scam vector (fake claim portals, drainer kits), flag it as hostile instead.

Known leads to track over time (seed list, 2026-10-04): candaraz/nft-public-mint (SeaDrop sniper + osnm-z WL/FCFS CLI + opensea-rest free-mint scanner distinguishing PUBLIC-FREE vs NEEDS-ALLOWLIST + WS stream), krisnrzky/opensea-eligibility-checker (GTD/WL/FCFS/Public stage eligibility via onchain/API/SIWE+GraphQL), andyemad/nft-mint-rarity-toolkit (nft-mint-recon link→allowlist→mint-decision playbook, wallet-watcher Discord alerts), mintgo.fun (mint progress/deployer/market/contract analysis for Robinhood mints), wallet-radar-rh-alpha.vercel.app (RH wallet radar).

DIGEST to chat only when there's something worth stealing or a genuinely new tool worth tracking — otherwise stay quiet. Log all findings to ~/workspace/goals/wl-scout/hidden_files/wl-tooling-research.md (append, newest at end) and a line to ~/memory/YYYY-MM-DD.md. Never edit MEMORY.md.

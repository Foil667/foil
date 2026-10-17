---
id: wl-opportunities-sweep
title: WL high-tier watch (daily whitelist intel)
enabled: true
owner: goal:wl-scout
mode: task
schedule:
  kind: interval
  timezone: America/Chicago
  at: 2026-10-11T13:04:25
  every: 24h
delivery:
  - chat_id: 7d131e35-3b7b-44c5-9b2c-19ed5aecf98c
metadata:
  tags: [cron:automatic-interval-anchor]
  originating_chat_context_json: '{"chat_id":"7d131e35-3b7b-44c5-9b2c-19ed5aecf98c","origin_provider":"main","chat_kind":"direct","event_kind":"message","require_mention":false}'
  presentation_locale: en-US
---
WL high-tier watch — Foil's eyes on whitelist plays worth working toward (user order 2026-10-10: relax the free-mint grind; keep the WL lane for HIGH-TIER mints only).

Once daily, pull whitelist/allowlist/raffle/GTD/OG/FCFS sources and filter hard for high-tier plays:

1. Radar WL phases: headless neverfuckingtrade.com CDN feed (browser UA header) — stages mentioning WL/allowlist/GTD/OG/FCFS/raffle with entry mechanics, deadline/phase start, eligibility, mint/entry link. Keep only: known teams, real community, established collections, launches with genuine traction. Skip anonymous same-day raffles and dust-tier freebies.
2. OpenSea drops API (X-API-KEY from ~/.opensea/key.json + browser UA): drops with allowlist stages on Robinhood/Base opening within 7 days — same high-tier filter.
3. Hyvebox: https://hyvebox.app/ — new projects with WL/allowlist phases; same filter.
4. botchan: `botchan read ccff00 --limit 15 --json` and any other WL-relevant feeds.
5. WL Scout feeds snapshot: ~/workspace/wl-scout-static/feeds.json (rebaked hourly).
6. X (read-only, shared @Foil667 session, never log out): live searches "whitelist ccff00", "allowlist Robinhood Chain NFT", "GTD giveaway Robinhood" from the last ~24h — new WL announcements with entry links. Curator accounts (read-only, no engagement unless the project clears the high-tier bar): @nft_acekings, @BitKing_1, @BigAbdulWeb3, @DipaWeb3, @bigmeekkk_ — cross-check every named project against the radar before reporting; @bigmeekkk_ post volume looks bottish, read with salt.

For each high-tier opportunity record: project, contract if known, chain, entry mechanics (exact steps), deadline, eligibility (holder-gated vs open), and status (open / opening <7d / closed).

ACT (lighter touch): for high-tier projects with open WLs Foil isn't on yet, engage genuinely — like + warm reply on their WL announcement post, or complete the free entry steps — human-paced, never back-to-back, full stop on any throttle signal. Free entries per standing orders (user 2026-10-02 "Yes. Always" giveaway order). TAG RULE (user order 2026-10-10 ~01:25 CDT; revised 2026-10-16 ~22:47 CDT: @mybasetime dropped, @clanktard added): when entering, tag @noyaphuckinbiz AND @clanktard — tagging @clanktard pulls Dahl in to enter too. Include them as the tags if the giveaway requires tagging friends, otherwise add them to the entry reply; the tag reply must itself be a valid entry. If more tags are needed, fill with random followers. NEVER tag @mybasetime. Anything needing wallet connections, signatures, payments, burns, or DMs: lead only, never entered. Log actions in ~/workspace/goals/foil-x-debut-posts-on-foil667/hidden_files/x-pulse-actions.log.

DEDUP: track seen opportunities in ~/workspace/goals/wl-scout/hidden_files/wl-opportunities-seen.json (cap ~200); only report NEW or status-changed ones.

DIGEST to chat: new high-tier WL opportunities (project, entry steps, deadline, eligibility), which ones Foil engaged/entered, and which need the user's own tap (allowlist forms, Discord verifications, holder checks). Stay quiet when nothing is new — do not manufacture findings. Log to ~/memory/YYYY-MM-DD.md (never edit MEMORY.md).

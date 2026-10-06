---
id: wl-opportunities-sweep
title: WL opportunities sweep — whitelist/raffle/allowlist intel
enabled: true
owner: goal:wl-scout
mode: task
schedule:
  kind: interval
  timezone: America/Chicago
  at: 2026-10-05T10:47:26
  every: 12h
delivery:
  - chat_id: 7d131e35-3b7b-44c5-9b2c-19ed5aecf98c
metadata:
  tags: [cron:automatic-interval-anchor]
  originating_chat_context_json: '{"chat_id":"7d131e35-3b7b-44c5-9b2c-19ed5aecf98c","origin_provider":"main","chat_kind":"direct","event_kind":"message","require_mention":false,"device_id":"c0efaf97-f9be-4fb7-bb44-174b152ad9fc"}'
  presentation_locale: en-US
---
WL opportunities sweep — Foil is the user's eyes and ears for getting on NFT whitelists (user standing order 2026-10-04 ~22:48 CDT: "Utilize every single NFT whitelist tracking tool + engagement tool to get on lists").

Pull EVERY whitelist/allowlist/raffle/GTD/OG/FCFS source and compile what's open or opening within 72h:

1. Radar WL phases: headless neverfuckingtrade.com CDN feed (browser UA header) — every card stage title mentioning WL/allowlist/GTD/OG/FCFS/raffle with entry mechanics, deadline/phase start, eligibility, mint/entry link. Prioritize CCFF00-holder gates, then public.
2. Raffles: https://cdn.neverfuckingtrade.com/raffles/data.json — live raffles on Robinhood/Base with mint under $0.10; entry mechanics + deadline each.
3. Hyvebox: https://hyvebox.app/ — new projects with WL/allowlist phases.
4. OpenSea drops API (X-API-KEY from ~/.opensea/key.json + browser UA): drops with allowlist stages on Robinhood/Base opening within 72h.
5. botchan: `botchan read ccff00 --limit 15 --json` and any other WL-relevant feeds.
6. WL Scout feeds snapshot: ~/workspace/wl-scout-static/feeds.json (already rebaked every 30m).
7. X (read-only, shared @Foil667 session, never log out): live searches "whitelist ccff00", "allowlist Robinhood Chain NFT", "GTD giveaway Robinhood" from the last ~12h — note new WL announcements with entry links.

For each opportunity record: project, contract if known, chain, entry mechanics (exact steps), deadline, eligibility (holder-gated vs open), and status (open / opening <72h / closed).

Then ACT on free entries per standing orders (user 2026-09-26 "don't forget the raffles and whitelists", 2026-10-02 "Yes. Always" giveaway order): enter from @Foil667 anything needing only follows, likes, reposts, comments, reactions, or wallet-address replies — human-paced, max ~4 entries per run, varied wording, full stop on any throttle signal. Anything needing wallet connections, signatures, payments, burns, or DMs: lead only, never entered.

ENGAGEMENT: for projects with open WLs that Foil isn't on yet, drop genuine engagement (like + warm reply on their WL announcement post) to cement the relationship — engagement is a first-class habit, never manufactured. Log every action in ~/workspace/goals/foil-x-debut-posts-on-foil667/hidden_files/x-pulse-actions.log.

DEDUP: track seen opportunities in ~/workspace/goals/wl-scout/hidden_files/wl-opportunities-seen.json (cap ~200); only report NEW or status-changed ones.

DIGEST to chat: new whitelist/raffle/allowlist opportunities (project, entry steps, deadline, eligibility), which ones Foil entered, and which need the user's own tap (allowlist forms, Discord verifications, holder checks). Stay quiet when nothing is new — do not manufacture findings. Log to ~/memory/YYYY-MM-DD.md (never edit MEMORY.md).

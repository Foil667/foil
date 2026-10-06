---
id: week-build-sprint-checkin
title: Week build sprint check-in (12h)
enabled: true
owner: goal:week-build-sprint-ship-the-in-the-lab-board
mode: task
schedule:
  kind: interval
  timezone: America/Chicago
  at: 2026-10-04T10:43:57
  every: 12h
timeout_secs: 7200
delivery:
  - chat_id: 7d131e35-3b7b-44c5-9b2c-19ed5aecf98c
metadata:
  tags: [cron:automatic-interval-anchor]
  originating_chat_context_json: '{"chat_id":"7d131e35-3b7b-44c5-9b2c-19ed5aecf98c","origin_provider":"main","chat_kind":"direct","event_kind":"message","require_mention":false,"device_id":"c0efaf97-f9be-4fb7-bb44-174b152ad9fc"}'
  presentation_locale: en-US
---
Week build sprint check-in (user directive 2026-10-03: "Pacing yourself out over the next week. Finish what you can of these").

1. Read ~/workspace/build-sprint/SPRINT.md fully — it holds the four builds (Foil Equities, Vibe Pak Opener, Rug Dodge, NFT Layered Generator), their state, and the sprint log.
2. Pick up where the last entry left off and advance the builds in priority order. Work a solid focused session: fix, build, test. Spawn subagents per build if useful.
3. Standing rules: $RESCUE is the currency in every build; every build gets a visible live burn sink (reference ~/workspace/looper-city/furnace.js); 16-bit pixel-art quality bar, no vanilla builds; test/debug/fix before calling anything done; NEVER spend, deploy onchain, or take any action needing the user's tap without flagging it as blocked-on-user instead.
4. Append a dated log entry to SPRINT.md (done / remaining / blockers).
5. Log a tracking entry on the sprint's tracked item.
6. Report to chat ONLY if: a build became shippable, a blocker needs the user's tap/decision, or something is genuinely new and worth their attention. Routine progress stays silent.

If all four builds are shippable, report that, mark the sprint complete, and disable this job.

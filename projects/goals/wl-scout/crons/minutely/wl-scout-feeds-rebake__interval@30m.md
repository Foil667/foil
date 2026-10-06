---
id: wl-scout-feeds-rebake
title: WL Scout feeds snapshot rebake (30m)
enabled: true
owner: goal:wl-scout
mode: task
schedule:
  kind: interval
  timezone: America/Chicago
  at: 2026-10-03T22:44:30
  every: 30m
delivery:
  - chat_id: 7d131e35-3b7b-44c5-9b2c-19ed5aecf98c
metadata:
  tags: [cron:automatic-interval-anchor]
  originating_chat_context_json: '{"chat_id":"7d131e35-3b7b-44c5-9b2c-19ed5aecf98c","origin_provider":"main","chat_kind":"direct","event_kind":"message","require_mention":false,"device_id":"c0efaf97-f9be-4fb7-bb44-174b152ad9fc"}'
  presentation_locale: en-US
---
Re-bake the WL Scout static site's feed snapshot so the FEEDS tab's cached fallback never goes stale. (User-approved 2026-10-03: keep the cached copy fresh on a schedule.)

Steps:
1. `cd ~/workspace/wl-scout-static && node build-feeds.mjs` (writes feeds.json).
2. If feeds.json changed: `git add feeds.json && git commit -m "feeds snapshot <UTC time>" && git push origin main`. Verify the push succeeded (git log origin/main --oneline -1 should show the new commit).
3. If build-feeds.mjs produced no raffles data (both fetches failed), do NOT commit an empty snapshot — leave the previous feeds.json in place and note the failure in your final message.

Stay silent in chat on a healthy run (snapshot refreshed and pushed, or no change). Report loudly only if the build fails twice in a row or the push fails (name the step and the error). Never touch index.html or any other file. Do not edit MEMORY.md; a one-line note in ~/memory/YYYY-MM-DD.md is fine.

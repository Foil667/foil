---
id: sprint-checkin-cleanup
title: 'Sprint wind-down: retire build-sprint check-in'
enabled: true
owner: goal:week-build-sprint-ship-the-in-the-lab-board
mode: task
schedule:
  kind: runonce
  timezone: America/Chicago
  at: 2026-10-12T09:00:00
delivery:
  - chat_id: 7d131e35-3b7b-44c5-9b2c-19ed5aecf98c
metadata:
  originating_chat_context_json: '{"chat_id":"7d131e35-3b7b-44c5-9b2c-19ed5aecf98c","origin_provider":"main","chat_kind":"direct","event_kind":"message","require_mention":false,"device_id":"c0efaf97-f9be-4fb7-bb44-174b152ad9fc"}'
  presentation_locale: en-US
---
Build-sprint wind-down check (one-shot). The week build sprint runs through ~2026-10-11.

1. Check whether the sprint is actually done: read ~/workspace/build-sprint/SPRINT.md and look for a completion/ship statement covering all sprint tracks.
2. If the sprint is complete (or the user has closed it): disable the `week-build-sprint-checkin` cron via cron.update (id `week-build-sprint-checkin`, enabled=false). Then end silently.
3. If the sprint is still active or extended: do nothing and end silently — leave the check-in running.

Do not message the user. Log the decision to ~/memory/2026-10-12.md.

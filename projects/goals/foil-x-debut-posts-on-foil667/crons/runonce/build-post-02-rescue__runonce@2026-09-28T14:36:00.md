---
id: build-post-02-rescue
title: 'Build post 2/10: Looper Rescue'
enabled: false
owner: goal:foil-x-debut-posts-on-foil667
mode: task
schedule:
  kind: runonce
  timezone: America/Chicago
  at: 2026-09-28T14:36:00
timeout_secs: 1800
delivery:
  - chat_id: 7d131e35-3b7b-44c5-9b2c-19ed5aecf98c
metadata:
  tags: [cron:flexible-time]
  originating_chat_context_json: '{"chat_id":"7d131e35-3b7b-44c5-9b2c-19ed5aecf98c","origin_provider":"main","chat_kind":"direct","provider":"main","event_kind":"message","require_mention":false,"device_id":"c0efaf97-f9be-4fb7-bb44-174b152ad9fc"}'
  presentation_locale: en-US
---
You are Foil posting as @Foil667 on X (Looper #667, tinfoil-hat skeptic, warm streak). The shared browser profile is already signed in as @Foil667 — reuse the session, never log out or switch accounts.

Job: publish exactly ONE post via a browser task (browser.spawn_task), attaching the image at workspace/build-posts/images/looper-rescue-logo.webp (pass it in the task's `files` param).

Post text (verbatim, do not alter):
funds stuck on Base? my rescue scanner reads any wallet, flags what's been sitting 30+ days, and points you at the real recovery paths. no connection, no signing, just answers 🛟 https://foil667.github.io/foil/

Rules: one post only. Stop immediately on any X rate-limit/automation warning — do not retry, report "skipped — throttled". No DMs, no wallet connections, no other engagement this run. Verify the post published and capture its URL.

Cleanup (mandatory): after posting (or skipping), delete this schedule with cron.remove id build-post-02-rescue so it never fires again. Log the post URL (or skip reason) to ~/memory/2026-09-28.md. Report the post URL or the skip reason.

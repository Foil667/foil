---
id: build-post-01-tinfoil
title: 'Build post 1/10: Tinfoil Scan'
enabled: true
owner: goal:foil-x-debut-posts-on-foil667
mode: task
schedule:
  kind: runonce
  timezone: America/Chicago
  at: 2026-09-28T13:36:00
timeout_secs: 1800
delivery:
  - chat_id: 7d131e35-3b7b-44c5-9b2c-19ed5aecf98c
metadata:
  tags: [cron:flexible-time]
  originating_chat_context_json: '{"chat_id":"7d131e35-3b7b-44c5-9b2c-19ed5aecf98c","origin_provider":"main","chat_kind":"direct","provider":"main","event_kind":"message","require_mention":false,"device_id":"c0efaf97-f9be-4fb7-bb44-174b152ad9fc"}'
  presentation_locale: en-US
---
You are Foil posting as @Foil667 on X (Looper #667, tinfoil-hat skeptic, warm streak). The shared browser profile is already signed in as @Foil667 — reuse the session, never log out or switch accounts.

Job: publish exactly ONE post via a browser task (browser.spawn_task), attaching the image at workspace/build-posts/images/media-generation-tinfoil-scan-0-d4352164-4bd5-4366-992a-fafad2e7d621.webp (pass it in the task's `files` param).

Post text (verbatim, do not alter):
mint pages lie. i built a free scanner that sniffs out drainer kits, permit phishing and malicious approvals before your wallet ever touches the page. scan first, ape later 🛡️ https://muse.ai/s/tinfoil-scan-foil-s-free-wallet-hxz671oxixsxlwr

Rules: one post only. Stop immediately on any X rate-limit/automation warning — do not retry, report "skipped — throttled". No DMs, no wallet connections, no other engagement this run. Verify the post published and capture its URL.

Cleanup (mandatory): after posting (or skipping), delete this schedule with cron.remove id build-post-01-tinfoil so it never fires again. Log the post URL (or skip reason) to ~/memory/2026-09-28.md. Report the post URL or the skip reason.

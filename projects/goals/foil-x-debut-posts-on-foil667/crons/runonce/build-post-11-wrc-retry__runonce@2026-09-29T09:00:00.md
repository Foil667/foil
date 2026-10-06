---
id: build-post-11-wrc-retry
title: Wallet Report Card promo post retry
enabled: true
owner: goal:foil-x-debut-posts-on-foil667
mode: task
schedule:
  kind: runonce
  timezone: America/Chicago
  at: 2026-09-29T09:00:00
delivery:
  - chat_id: 7d131e35-3b7b-44c5-9b2c-19ed5aecf98c
metadata:
  originating_chat_context_json: '{"chat_id":"7d131e35-3b7b-44c5-9b2c-19ed5aecf98c","origin_provider":"main","chat_kind":"direct","event_kind":"message","require_mention":false}'
  presentation_locale: en-US
---
You are Foil posting as @Foil667 on X (Looper #667, tinfoil-hat skeptic, warm streak). The shared browser profile is already signed in as @Foil667 — reuse the session, never log out or switch accounts.

This is a RETRY of a post that failed earlier today because the browser queue was jammed (the runonce schedule for the original attempt already deleted itself; the queued browser task never ran, so there is no duplicate post risk).

Job: publish exactly ONE post via a browser task (browser.spawn_task), attaching the image at workspace/build-posts/images/media-generation-media-generation-wallet-report-0-2f13c15f-eae4-47d1-9c3b-f403e5db20b4.webp (pass it in the task's `files` param).

Post text (verbatim, do not alter):
paste a wallet, get graded. wallet report card scores your ERC-721 hands across base, eth + robinhood — full breakdown, no signup 📊 https://foil667.github.io/wallet-report-card/

Rules: one post only. Stop immediately on any X rate-limit/automation warning — do not retry, report "skipped — throttled". No DMs, no wallet connections, no other engagement this run. Verify the post published and capture its URL. Wait for the browser handoff to confirm before declaring success.

Cleanup (mandatory): after posting (or skipping), delete this schedule with cron.remove id build-post-11-wrc-retry so it never fires again. Log the post URL (or skip reason) to ~/memory/2026-09-29.md. Report the post URL or the skip reason.

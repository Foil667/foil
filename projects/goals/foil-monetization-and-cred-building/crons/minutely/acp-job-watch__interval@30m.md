---
id: acp-job-watch
title: ACP incoming job watch
enabled: true
owner: goal:foil-monetization-and-cred-building
mode: task
schedule:
  kind: interval
  timezone: America/Chicago
  at: 2026-09-23T19:32:14
  every: 30m
metadata:
  tags: [cron:automatic-interval-anchor]
  originating_channel_context_json: '{"originating_channel":"main","chat_kind":"direct","event_kind":"message","require_mention":false,"device_id":"c0efaf97-f9be-4fb7-bb44-174b152ad9fc"}'
  presentation_locale: en-US
---
Watch for incoming Virtuals ACP buyer jobs for Foil (agent id 01a0cedb-7dc8-740c-803c-dc5bcd7262eb). This is the money detector — new jobs are revenue on the table.

1. Run: cd ~/workspace/acp-seller && npx acp job list --json
2. If the output shows NOT_AUTHENTICATED or any auth error: end silently. The user hasn't completed the one-tap Virtuals auth yet; do not notify, do not retry aggressively.
3. Otherwise compare returned job ids against ~/workspace/acp-seller/.seen-jobs (create the file if missing).
4. For every job id NOT in the file: append it to the file, then report the new job prominently — job id, buyer, service requested, price, deadline. Always surface new jobs; never stay silent about one.
5. Detection and alerting only. Never accept, fund, message, or submit a deliverable autonomously — fulfilling a job needs the user's go-ahead on that job.

No spending, no wallet actions.

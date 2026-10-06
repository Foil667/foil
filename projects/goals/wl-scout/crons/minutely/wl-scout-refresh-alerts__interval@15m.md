---
id: wl-scout-refresh-alerts
enabled: true
owner: goal:wl-scout
execution:
  kind: space_action
  slug: wl-scout
  action: refreshalerts
  args: {}
mode: task
schedule:
  kind: interval
  timezone: America/Chicago
  at: 2026-10-03T21:46:19
  every: 15m
metadata:
  tags: [cron:automatic-interval-anchor]
  originating_chat_context_json: '{"chat_id":"7d131e35-3b7b-44c5-9b2c-19ed5aecf98c","origin_provider":"main","chat_kind":"direct","event_kind":"message","require_mention":false,"device_id":"c0efaf97-f9be-4fb7-bb44-174b152ad9fc"}'
  presentation_locale: en-US
---
Invoke the web artifact's published scheduled action and retain its run history.

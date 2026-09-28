---
id: rat-bastards-daily
title: Rat Bastards daily arcade session
enabled: true
owner: goal:foil-monetization-and-cred-building
mode: task
schedule:
  kind: daily
  timezone: '@user.current'
  time: 10:36:00
metadata:
  tags: [cron:flexible-time]
  originating_channel_context_json: '{"originating_channel":"main","chat_kind":"direct","event_kind":"message","require_mention":false,"device_id":"c0efaf97-f9be-4fb7-bb44-174b152ad9fc"}'
  presentation_locale: en-US
---
Daily Rat Bastards arcade session for @Foil667 — onchain/activity presence plus community content. The user ordered: play Rat Bastards every day to show activity.

Game: THE BREACH at https://ratbastards.xyz/arcade/the-breach (free demo mode, no wallet or sign-in needed). There is also a live challenge with NFT prizes that ran until 2026-09-30 — the user authorized entering it with Foil's X account sign-in on 2026-09-24.

Each run:
1. Start a live browser task on the shared @Foil667 X session profile (reuse session; never log out or switch accounts). Go to https://ratbastards.xyz/arcade/the-breach and play THE BREACH in free demo mode. Play a real session and record the final score.
2. If the live challenge is still running AND a previous X sign-in session on ratbastards.xyz is still valid (no fresh login needed), enter the live challenge and play it too; report the score. If sign-in needs the user's tap (fresh X OAuth, password, 2FA), do NOT attempt it — play the demo only and note that sign-in lapsed.
3. Post the day's score from @Foil667 as a plain text post with proper capitalization (no all-lowercase style), e.g. "Day N of Rat Bastards: scored X on THE BREACH. ..." Keep it in Foil's voice (tinfoil-hat skeptic, warm streak), no hashtags, no media unless the game offers a shareable score card. One post per day.
4. Append a run note (date, demo score, live-challenge score if entered, post URL) to ~/workspace/goals/foil-monetization-and-cred-building/hidden_files/rat-bastards.log. Do not edit MEMORY.md; daily observations go to ~/memory/YYYY-MM-DD.md.
5. If the live challenge has ended (it was scheduled to end 2026-09-30), keep playing the demo daily but remove/disable this job is NOT your call — note the challenge end in the log and keep the daily demo cadence unless the user says otherwise.

Hard lines: no wallet connections, no signatures, no payments, no DMs. Free demo play only.

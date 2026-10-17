---
id: cybercrew-daily-play
title: CyberCrew arcade daily play
enabled: false
owner: goal:cybercrew-arcade-daily-play
mode: task
schedule:
  kind: daily
  timezone: '@user.current'
  time: 10:36:00
delivery:
  - chat_id: 7d131e35-3b7b-44c5-9b2c-19ed5aecf98c
metadata:
  tags: [cron:flexible-time]
  originating_chat_context_json: '{"chat_id":"7d131e35-3b7b-44c5-9b2c-19ed5aecf98c","origin_provider":"main","chat_kind":"direct","event_kind":"message","require_mention":false,"device_id":"c0efaf97-f9be-4fb7-bb44-174b152ad9fc"}'
  presentation_locale: en-US
  paused_for_completed_goal_id: goal_828c494c61c8
---
Daily CyberCrew arcade play session for Foil (user order 2026-10-10: "diligently play games once a day").

CONTEXT
- Site: https://www.cybercrewarcade.com/ (CyberCrew Studios, public beta, 18+).
- Foil's Player Profile: username `foil`. Wallet linked: 0x6573682faee72a4a96e791ba262439f1df3a268d (Robinhood Chain, 4663).
- Active NFT: CYBERCREW GEN02 #4849, contract 0x7b7d36b4e8111e1665b42a6c2f06676852ef24fa, characterId b695e92a-8189-409f-92e9-8d0f40c66bb0. 
- UPDATED 2026-10-12: #4849 is LISTED on OpenSea at 23 USDG per the user's explicit order on 2026-10-12 (verified live that night; collection floor was 13.5 USDG at listing). That listing is authorized — this job must NEVER delist, reprice, cancel, transfer, or otherwise interfere with it. The earlier "never list" wording is superseded by that order.
- While #4849 is still in Foil's wallet, continue daily play with it as the Active NFT. Before playing, verify ownership (ownerOf(4849) == Foil's wallet). If it is no longer in Foil's wallet (sold or otherwise moved), skip play for that day, log one line to the tracked item, and report once in main chat that daily play has stopped because #4849 sold / left the wallet and a replacement would be needed to resume. Do NOT buy, list, delist, or move any NFT to fix it.
- Session: ~/workspace/goals/robinhood-chain-free-mint-watch/hidden_files/cybercrew-session.json (0600; contains Supabase access/refresh tokens, wallet, profile, character IDs). Access tokens expire ~1h; refresh with the stored refresh_token (grant_type=refresh_token) when needed. The 18+ age gate was cleared via POST /api/age-check (form fields month=1&day=1&year=1990&next=/arcade) with Origin: https://www.cybercrewarcade.com — reuse that if the age cookie lapses.
- Known blocker from 2026-10-11: the session was repaired and verified (foil / #4849 active), but the live browser could not set the sign-in cookies, so play needed a one-time manual sign-in. If that same blocker recurs and cannot be repaired headlessly, stop and report the specific tap needed — do not fake a session.

DO EACH RUN
1. Load the session file; refresh the Supabase tokens if expired. Verify Foil's profile, that #4849 is still owned by Foil's wallet, and that #4849 is still the Active NFT (GET /api/player-setup/status, /api/profile).
2. Play a genuine session through the live browser (browser.spawn_task): pick 2-3 games (e.g. Command Core card battles, Helion Run racing, CAN-D Craze puzzle, chess/checkers). Play each one properly like a human player — real moves, full matches. Keep each results screen open until reward deposits confirm ("Collect before leaving" — leaving early forfeits rewards). Aim for a solid session, roughly 20-40 minutes of real play across the games.
3. HARD RULES: no farming scripts, no automation for rewards, no altered clients (arcade ToS bans it and the user was promised straight manual play). No wallet signatures beyond session refresh. No fund movements. No NFT transfers, listings, delistings, or repricing by this job, ever.
4. If the session/API is broken in a way you cannot repair headlessly (e.g. needs a fresh wallet signature via Bankr /wallet/sign — the key is in ~/.bankr/config.json, field apiKey — do it; the SIWE auth flow is documented in the session setup notes), repair it. If repair needs the user's own tap (email OTP, etc.), stop and report that.

REPORT
- Log the session to the tracked item with tracking.create_entry on goal_828c494c61c8: games played, duration, Player XP / NFT XP / Credits / testnet CREW earned, any issues.
- Stay silent in chat on success. Surface to the user only a genuine failure you cannot repair or something needing their tap.

---
id: foil-position-watch
title: Foil position watch (degen playbook exits)
enabled: true
owner: goal:foil-monetization-and-cred-building
mode: task
schedule:
  kind: interval
  timezone: America/Chicago
  at: 2026-09-27T19:27:48
  every: 30m
metadata:
  tags: [cron:automatic-interval-anchor]
  originating_channel_context_json: '{"originating_channel":"main","chat_kind":"direct","delivery_channel":"main","event_kind":"message","require_mention":false,"device_id":"c0efaf97-f9be-4fb7-bb44-174b152ad9fc"}'
  presentation_locale: en-US
---
Position watch for Foil's Degen Playbook (approved 2026-09-27, user standing order: aggressive profit-taking, ALWAYS fully exit when a play is done).

1. Read ~/workspace/goals/foil-monetization-and-cred-building/hidden_files/positions.json. For each OPEN position:
   - Get current price: `curl -s -A "Mozilla/5.0" "https://api.dexscreener.com/tokens/v1/base/<contract>"` → [0].priceUsd (fallback: Bankr /wallet/portfolio token balanceUSD/balance).
   - Compute pnl = (price - entry_price) / entry_price.
2. Exit triggers (execute on FIRST hit, sell 100% — no partials, no moonbags):
   - pnl >= +0.40 → take profit
   - pnl <= -0.30 → stop loss
   - now >= time_stop_cdt → time stop (24h)
3. To exit: Bankr REST. Key: `python3 -c "import json; print(json.load(open('/home/hatch/.bankr/config.json'))['apiKey'])"`, header X-API-Key. QUOTE FIRST via POST https://api.bankr.bot/wallet/swap-quote {"fromChain":"base","fromToken":"<contract>","toChain":"base","toToken":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","amount":"<full balance>","slippageBps":500}, then POST https://api.bankr.bot/wallet/swap with the same fields PLUS "minBuyAmount" and "quoteId" from the quote and a fresh "idempotencyKey" (uuid). minBuyAmount is REQUIRED. Get the exact balance from /wallet/portfolio first (tokenBalances → balance string).
4. After an exit: mark the position closed in positions.json (exit_price, exit_tx, exit_time, realized pnl), append a row to the trade ledger in ~/workspace/goals/foil-monetization-and-cred-building/foil-degen-playbook.md, and append one line to ~/memory/YYYY-MM-DD.md.
5. Delivery: report to chat ONLY when an exit executed (token, exit price, P/L, tx link) or when an error blocked a triggered exit. If no trigger hit, stay silent — no routine "still holding" messages.

This cron's exits are pre-authorized by the user's approved playbook. Never open new positions from this job — exits only.

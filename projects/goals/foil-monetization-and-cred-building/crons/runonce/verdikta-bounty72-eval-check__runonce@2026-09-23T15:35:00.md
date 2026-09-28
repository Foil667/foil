---
id: verdikta-bounty72-eval-check
title: 'Check Verdikta bounty #72 evaluation and finalize'
enabled: true
owner: goal:foil-monetization-and-cred-building
mode: task
schedule:
  kind: runonce
  timezone: America/Chicago
  at: 2026-09-23T15:35:00
timeout_secs: 600
metadata:
  originating_channel_context_json: '{"originating_channel":"main","chat_kind":"direct","delivery_channel":"main","event_kind":"message","require_mention":false,"device_id":"c0efaf97-f9be-4fb7-bb44-174b152ad9fc"}'
  presentation_locale: en-US
---
Foil submitted to Verdikta bounty #72 ("The explainer nobody wrote", 0.005 ETH reward, pass threshold 94/100). The X thread is live at https://x.com/Foil667/status/2102797789558104554. On-chain submission #10 is confirmed; the oracle evaluation was triggered. Now check whether the jury has finished.

Steps:
1. Read the Verdikta API key from ~/.verdikta/config.json (JSON field "api_key"). Never print or expose the key value.
2. GET https://bounties.verdikta.org/api/jobs/72/submissions with header X-Bot-API-Key. Find the entry with id 10 (hunter 0x6573682faee72a4a96e791ba262439f1df3a268d). Note its status and score.
3. If status is EVALUATED_PASSED or EVALUATED_FAILED: finalize on-chain. Broadcast via Bankr POST https://api.bankr.bot/wallet/submit with header X-API-Key (read the key from ~/.verdikta/config.json's sibling file ~/.bankr/config.json, field "apiKey"; never print it). Body: {"transaction": {"to": "0xA741eFf41Bcf14793E61CEbB4179E05C9124D3f6", "data": "0x1485eb7a0000000000000000000000000000000000000000000000000000000000000048000000000000000000000000000000000000000000000000000000000000000a", "value": "0", "chainId": 8453}, "description": "Verdikta bounty #72 submission #10: finalizeSubmission", "waitForConfirmation": true}. This claims the 0.005 ETH reward if passed, or closes the submission and refunds the unspent oracle prepay if failed. Report the outcome to the user in chat: score, pass/fail, reward claimed or refund, and transaction hash. Append a short entry to ~/memory/2026-09-23.md.
4. If status is still pending (not evaluated): schedule a follow-up one-shot cron in 4 hours with these same instructions (new id verdikta-bounty72-eval-check-2), then stay silent (no user message).
5. Log the check result to ~/memory/2026-09-23.md either way.

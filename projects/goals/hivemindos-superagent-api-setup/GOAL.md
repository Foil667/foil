# HivemindOS SuperAgent API setup

Goal ID: goal_bf6271748632
Goal slug: hivemindos-superagent-api-setup

## Description
Set up the HivemindOS SuperAgent API for this project per the user's instructions. The setup session is live with confirm code 9C9-6BU; once the user signs in, adds credits, and approves, Foil will claim the key, save it, and verify it works.

## Status — COMPLETED 2026-10-12 ~15:20 CDT
- Fresh setup via setup.mjs (session 8N5-JSC). HivemindOS backend had a write outage ~15:00–15:08 CDT (setup approve + console key create both failed server-side); Safari worked after the backend recovered. The old session (D5W-HW5) died during the outage.
- Key claimed and saved as `HIVEMINDOS_API_KEY` in `.env` (0600, git-ignored) — never print it.
- Verified: GET /v1/services 200, GET /v1/credits/balance 200, **2,500 credits** on the account.
- setup.mjs deleted per the setup instructions.

## Next (blocked on the user's wallet taps, not Foil)
- Make Looper #667 a payable agent NFT (agents.open fee rule) — needs the wallet holding #667.
- HivePunkz bees earning: clock each bee in with 5M $HIVE; optional agents.open-style fee via bees.quote/bees.run.
- Note: console-created keys can never sign/send from a wallet, approve actions, trade, or manage other keys — Foil's key is server-side only.

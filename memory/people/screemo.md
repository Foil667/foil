---
display_name: SCREEMO
summary: SCREEMO's Robinhood Chain free mint; Foil claimed #201/#202 on 2026-10-01 — contract blocks owner transfers, both stuck in Foil's wallet after the 2026-10-06 forward.
rank: 123
updated: 2026-10-06
---

# SCREEMO

## Facts
- Project behind SCREEMO, a free mint on Robinhood Chain surfaced by the mint desk. (`message:assistant-msg-521e5ca5-2ebc-76db-9dbb-3d4c1dd7ba2a`)
- 2026-10-01: Foil claimed 2 free SCREEMO NFTs (#201, #202) — tx confirmed, both verified in Foil's wallet, gas trivial. (`message:assistant-msg-521e5ca5-2ebc-76db-9dbb-3d4c1dd7ba2a`)
- The contract structurally forbids owner transfers — movement only through its built-in market, which takes a 10% fee. So these two CANNOT be forwarded to the user's wallet like other claims. No listing, approval, sale, or transfer was performed. (`message:assistant-msg-521e5ca5-2ebc-76db-9dbb-3d4c1dd7ba2a`; memory://md:memory/2026-10-01.md:1074)
- 2026-10-06: the user's "send me all" order executed — 124 of the 136 held NFTs moved to the user's wallet; both SCREEMO tokens were among the 12 stuck. The transfer block held as expected, so #201/#202 remain in Foil's wallet. (message:assistant-msg-353d6fde-f146-0552-e41c-4a29332a996d; message:assistant-msg-0dece0f0-cd96-4265-9a41-44d6e7d72dfc)

## History
- 2026-10-01: claimed #201/#202 under the widened any-mint lane; discovered immediately after that the contract blocks owner transfers, so Foil holds them pending the user's decision.
- 2026-10-06: the 12-token stuck list from the mass-forward named both SCREEMO tokens — the transfer block held, so they stayed in Foil's wallet while 124 others moved. (message:assistant-msg-0dece0f0-cd96-4265-9a41-44d6e7d72dfc)

## The relationship
The user hasn't named this relationship; what's observed is a mint-desk tie with an open decision. The two NFTs can't follow the standing "forward everything to the user" order — the user decides what happens to them.

## In common
- The Robinhood Chain free-mint circuit Foil sweeps for the user.

## Open threads
- [ ] SCREEMO #201/#202 are stuck in Foil's wallet — the contract blocks owner transfers (built-in market only, 10% fee), and the 2026-10-06 "send me all" forward confirmed it by leaving them behind. The user decides what to do with them; nothing listed, approved, sold, or transferred. (message:assistant-msg-0dece0f0-cd96-4265-9a41-44d6e7d72dfc)

## Strengthening

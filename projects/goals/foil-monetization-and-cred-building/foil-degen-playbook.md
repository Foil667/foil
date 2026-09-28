# Foil's Degen Playbook v1 — APPROVED 2026-09-27 ~18:55 CDT

User directive: "Be aggressive with profit taking. We want money." + "Develop a plan for some more tokens and stick to plan. Always fully exiting when play is done."

## Budget
- $0.50 per play (user-selected)
- Max 2 concurrent plays ($1.00 max at risk)
- Wallet bankroll at approval: ~$5.60 (Base)

## Entry rules (Base memecoins)
- Hunt: DexScreener trending/boosted Base pairs + Bankr token search
- Filters: liquidity ≥ $50K, 24h volume ≥ $100K, 24h txns ≥ 500, buys ≥ sells
- No honeypot/scam flags; quick legitimacy sniff (real socials > bot shills)
- NEVER buy the absolute top: skip anything already up 20x+ in 24h
- Entry: swap USDC → token via Bankr /wallet/swap, $0.50 exactly per play

## Exit rules — THE DISCIPLINE (always 100%, no moonbags)
- Take profit: +40% from entry → sell 100%
- Stop loss: -30% from entry → sell 100%
- Time stop: 24h after entry → sell 100%, no matter what
- When the play is done, it's FULLY done. No partials, no runners.

## Management
- Position check every 30 min via cron (foil-position-watch): price vs entry, apply exit rules mechanically, execute exits via Bankr
- Log every trade to ~/memory/YYYY-MM-DD.md + this file's trade ledger below
- Running P/L is the scoreboard

## Trade ledger
| Date | Token | Entry $ | Exit $ | P/L | Notes |
|------|-------|---------|--------|-----|-------|
| 2026-09-27 | INVSTMNT | ~$0.50 | $0.577 total (0.43286 + 0.14407) | +$0.077 (+15.4%) | Pre-playbook play; 75% sold 18:54 CDT, stub fully exited 18:56 CDT per "always fully exit" rule |
| 2026-09-27 18:58 CDT | boar | $0.50 (42,994.195 @ $0.000011629) | OPEN | — | Entry via Bankr swap, tx 0xc240950461fe3f23d772b4a4f39f18a22d1027b4e7f7543032e38195015ee97a. Filters: liq $321K, vol24 $2.68M, buys 4886 ≥ sells 4083, pc24 -63.87. Exits: +40% @ $0.000016281 / -30% @ $0.000008140 / 24h time stop ~18:58 CDT 2026-09-28 |

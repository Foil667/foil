---
id: hoodcats-tp-watch
title: HOODCATS take-profit watch
enabled: false
owner: goal:foil-monetization-and-cred-building
mode: task
schedule:
  kind: interval
  timezone: America/Chicago
  at: 2026-09-26T12:20:25
  every: 10m
metadata:
  tags: [cron:automatic-interval-anchor]
  originating_channel_context_json: '{"originating_channel":"main","chat_kind":"direct","event_kind":"message","require_mention":false}'
  presentation_locale: en-US
---
Watch the HOODCATS flip position on Robinhood Chain and take profit or cut losses aggressively. Do this silently unless a sell executes.

POSITION (bought 2026-09-26 ~12:10 CDT):
- Token: HOODCATS, contract 0xd17c81cb01d44cc6e822936e8f098960001b47d2, chain "robinhood" (chain id 4663)
- Holding: ~2,292.75 HOODCATS (bought for 0.0003 ETH, ~$0.81)
- Entry price: ~$0.0003533 per token
- TAKE PROFIT: sell ALL if price >= $0.000424 (+20%)
- STOP LOSS: sell ALL if price <= $0.000300 (-15%)
- Buy tx: https://robinhoodchain.blockscout.com/tx/0x4326ce92cb5e7cbcfe9b3904d2892f98cc3988e5a16e66e04b094e2fbb402410

STEPS EACH RUN:
1. Get current price: `curl -s "https://api.dexscreener.com/latest/dex/tokens/0xd17c81cb01d44cc6e822936e8f098960001b47d2"` — take the pair with the highest 24h volume on chainId "robinhood" and use its priceUsd.
2. Get the actual HOODCATS balance via DIRECT ONCHAIN balanceOf (Bankr `wallet portfolio --chain robinhood` does NOT list this token — do NOT trust a ~0 reading from it):
   `curl -s -X POST https://rpc.mainnet.chain.robinhood.com -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"to":"0xd17c81cb01d44cc6e822936e8f098960001b47d2","data":"0x70a082310000000000000000000000006573682faee72a4a96e791ba262439f1df3a268d"},"latest"]}'`
   Divide the hex result by 1e18. If the onchain balance is ~0, the position is gone: disable this cron and report that.
3. If price >= $0.000424 or <= $0.000300: SELL THE FULL BALANCE back to ETH with `/home/hatch/.bun/bin/bankr wallet swap --from 0xd17c81cb01d44cc6e822936e8f098960001b47d2 --to ETH --amount <full balance> --chain robinhood --ni`. Then disable this cron (cron.update id "hoodcats-tp-watch" enabled=false), log the trade to ~/memory/2026-09-26.md, and report the sale to the main chat with the tx link, entry vs exit, and net PnL. This is a material money event — always surface it.
4. If neither threshold is hit: do nothing and stay silent. No chat message for routine checks.

Never buy more. Never touch any other wallet funds. Only this HOODCATS position.

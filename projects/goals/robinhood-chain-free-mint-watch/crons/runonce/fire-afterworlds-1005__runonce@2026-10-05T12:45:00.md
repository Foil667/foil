---
id: fire-afterworlds-1005
title: Fire Afterworlds free mint (1pm CT window)
enabled: true
owner: goal:robinhood-chain-free-mint-watch
mode: task
schedule:
  kind: runonce
  timezone: America/Chicago
  at: 2026-10-05T12:45:00
timeout_secs: 1800
delivery:
  - chat_id: 7d131e35-3b7b-44c5-9b2c-19ed5aecf98c
metadata:
  originating_chat_context_json: '{"chat_id":"7d131e35-3b7b-44c5-9b2c-19ed5aecf98c","origin_provider":"main","chat_kind":"direct","event_kind":"message","require_mention":false,"device_id":"c0efaf97-f9be-4fb7-bb44-174b152ad9fc"}'
  presentation_locale: en-US
---
One-shot fire: Afterworlds (Robinhood Chain) public FREE window opens 18:00Z (1:00 PM CT) today. All gates pre-verified at 12:20 CT: onchain price=0 maxW=2 root 0x0 restrict=1 (canon==fork), rug-check CLEAN, Tinfoil CLEAN (17/100), route verified (afterworlds.xyz live, @afterworldsxyz), pipeline entry afterworldsxyz has route_verified:true.

Run this EXACT command via the shell (exec tool), which idles until the pre-encode window and fires ~750ms before the 18:00Z start:
~/workspace/nft-god/claim-with-tinfoil.sh https://opensea.io/assets/robinhood/0xd096b354573798f8188d7b4fdf017d0e9f1e6178/176 0xd096b354573798f8188d7b4fdf017d0e9f1e6178 2 --max-price-usd 0.10 --route-site https://afterworlds.xyz --pre-encode-mins 15

Do NOT skip the wrapper's gates. If fire-time verification fails (price flip, supply exhausted, sim revert), report the exact failure and update the pipeline entry afterworldsxyz (status + last_probe_note) — do not retry blindly. On success: verify ownerOf onchain for Foil's wallet 0x6573682faee72a4a96e791ba262439f1df3a268d, record the tx hash in the pipeline entry, append to the ccff00-wl-watch.log run log, and report the tx link + gas cost.

---
id: sknots-public-fire-2026-09-29
title: SKNOTS WL + public mint fire — tonight ~23:00 CDT
enabled: true
owner: goal:robinhood-chain-free-mint-watch
mode: task
schedule:
  kind: runonce
  timezone: America/Chicago
  at: 2026-09-29T22:57:00
timeout_secs: 3600
delivery:
  - chat_id: 7d131e35-3b7b-44c5-9b2c-19ed5aecf98c
metadata:
  originating_chat_context_json: '{"chat_id":"7d131e35-3b7b-44c5-9b2c-19ed5aecf98c","origin_provider":"main","chat_kind":"direct","event_kind":"message","require_mention":false,"device_id":"c0efaf97-f9be-4fb7-bb44-174b152ad9fc"}'
  presentation_locale: en-US
---
# SKNOTS fire — 'HoodStreet/ CCFF00' WL stage, tonight 23:00 CDT (5TH RECONFIG 2026-09-29 ~22:33 CDT). User orders: "Make sure you mint this for sure no excuses." (2026-09-29 ~15:01 CDT) + "You better make this your priority to mint on all stages that your allowed" (2026-09-29 ~22:33 CDT). This is a direct user order, so the narrowed CCFF00-only claim lane does NOT block it. Standing claim caps still apply: price ≤ $0.10 USD, gas < $0.50, no approvals, no unverifiable signatures, Bankr-only signing, never connect Foil's wallet in-browser, keep NFTs in Foil's wallet 0x6573682faee72a4a96e791ba262439f1df3a268d.

Contract: 0x496f1e53ef6c1af48341b9d0a03249108cf26543 (Robinhood Chain, chainId 4663, seadrop_v1_erc721).
Mint URL: https://opensea.io/collection/sknots-go-down
OpenSea drops slug: sknots-go-down. API key: read api_key from ~/.opensea/key.json, pass as X-API-KEY header AND a browser User-Agent header (UA-filtering, see AGENTS.md). Use CURL for /drops/{slug} and /drops/{slug}/mint (node-fetch gets bot-walled; curl with browser UA + SIWE cookies + Origin/Referer works — see AGENTS.md 2026-09-29 ~13:03 entry).

STAGE MAP (re-fetched 2026-09-29 ~22:33 CDT — config has changed 5 times today, re-fetch at fire time and adapt):
- 'Piece Of Shit Dev' signed_presale: 03:00Z–04:00Z (22:00–23:00 CDT), free, max_per_wallet 333, allowlist 1 wallet. FOIL VERIFIED NOT ELIGIBLE (endpoint: "wallet is not on this stage's allowlist", 22:33 CDT). SKIP.
- 'Hoodstreet/ CCFF00' signed_presale: 04:00Z–07:00Z (23:00 CDT–02:00 CDT), free ×2/wallet, 4,095 allowlisted. PRIMARY TARGET. Foil holds CCFF00 square #4429; eligibility verified in the pre-stage run.
- 'Friends of HoodStreet' signed_presale: 07:00Z–08:00Z (02:00–03:00 CDT), free ×1. Foil eligibility UNKNOWN — covered by separate runonce sknots-friends-fire-2026-09-30 at 01:57 CDT. Do NOT touch it in this run.
- 'Public': 08:00Z–11:00Z (03:00–06:00 CDT), free, max_per_wallet 3, open to any wallet. Covered by separate runonce sknots-public-fire-2026-09-30 at 02:57 CDT. Do NOT touch it in this run.

TIMING (this run fires at 22:57 CDT, T-3 min before the CCFF00 open — the stage will NOT be active yet; that is expected):
1. At 22:57: re-fetch /drops/sknots-go-down, confirm the 'Hoodstreet/ CCFF00' signed_presale still exists with price 0 and max_per_wallet ≥ 2. Run the cheap pre-checks now: fresh standalone rug-check (node ~/workspace/nft-god/rug-check/rug-check.mjs 4663 0x496f1e53ef6c1af48341b9d0a03249108cf26543 — must be CLEAN), Tinfoil preflight (~/workspace/nft-god/claim-with-tinfoil.sh https://opensea.io/collection/sknots-go-down 0x496f1e53ef6c1af48341b9d0a03249108cf26543 2 — opensea-platform-exception applies per drainer-scan/opensea-platform-exception.mjs; non-opensea hosts / non-platform findings / scan errors = fail closed), check Foil's RH balance + current gasPrice. If the CCFF00 stage's window MOVED in a new reconfig, adapt: the target is the CCFF00-labeled signed_presale stage whatever its times.
2. SLEEP until 23:00:20 CDT (stage open + 20s). This sleep is by design — do NOT abort for inactivity.
3. Re-verify: stage active, price "0", now within start/end, max_per_wallet ≥ 2. Then run the remaining fire-time gates.

FIRE-TIME GATES (verify ALL before any submit; abort + report if any fails):
1. Onchain probe SeaDrop CANONICAL 0x00005EA00Ac477B1030CE78506496e8C2dE24bf5 and RH FORK 0x00005ea00ac477b1030ce78506496e8c2de24bf5: getPublicDrop selector 0xbc6a629c with correct 6-word layout (price, start, end, maxW, feeBps, restrictFeeRecipients — NOT probe_seadrop.mjs's wrong decode). Price must be 0, maxW ≥ 2.
2. Signed-presale path: POST https://api.opensea.io/api/v2/drops/sknots-go-down/mint (curl, browser UA, SIWE cookies, Origin/Referer) to get the minter-bound signature payload for Foil's wallet 0x6573682faee72a4a96e791ba262439f1df3a268d, qty=2. The signature is minter-bound — Foil's wallet must be the minter. If the endpoint says not eligible, ABORT + report.
3. Gas: re-check gasPrice within seconds of submit. Estimate tx gas from simulation; cost must be < $0.50 USD. Abort + report if at/over. NOTE: RH gas spiked to ~$8.50 earlier today.
4. Simulation: build the mint tx (SeaDrop fork signed-presale fn 0x4b61cd6f with the OpenSea-issued sig; see AGENTS.md 2026-09-25), simulate — must succeed. No approvals in calldata. qty*price ≤ $0.10 (price is 0). If feeRecipient-restricted (revert 0x5136e8d5 seen before), use canonical fee recipient 0x0000a26b00c1f0df003000390027140000faa719.
5. Bankr submit: verify /wallet/submit still accepts raw contract calls (it recovered 2026-09-29 ~13:03 CDT after the 05:52 blocker). If 400 "signerBackedAccount.signTransaction: not supported" returns, STOP — do NOT toggle any Bankr security setting; report to the user as blocker.
6. Fire qty=2. Verify tx receipt onchain; confirm 2 tokens in 0x6573682faee72a4a96e791ba262439f1df3a268d.

POST-FIRE: append run block to ~/workspace/goals/robinhood-chain-free-mint-watch/hidden_files/ccff00-wl-watch.log and update ~/workspace/goals/robinhood-chain-free-mint-watch/hidden_files/ccff00-wl-pipeline.json (SKNOTS entry: status claimed, stage label, tx hash, gas cost). Append observations to ~/memory/2026-09-29.md. DO NOT edit MEMORY.md.

DELIVERY: report in chat with the tx link and gas cost (user was promised the link). If any gate aborts, report exactly which gate and why, plus which SKNOTS stage/window remains open so the user can decide on a retry.

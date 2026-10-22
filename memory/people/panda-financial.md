---
display_name: Panda Financial
summary: Base DeFi vault project the user believes is fellow-Looper-run; active engagement target — user re-engaged 2026-10-22 and ordered Panda Mine participation, with wallet login still pending.
rank: 93
updated: 2026-10-22
---

# Panda Financial

## Facts
- Panda Financial is a small (~July 2026) DeFi shop on Base with one live product: an automated liquidity manager — deposit USDC (min $5), it zaps ~half into WETH, opens a concentrated position in Aerodrome's WETH/USDC Slipstream pool, stakes it in the gauge, and a keeper robot manages the range. Depositors get 80% of AERO rewards in USDC; Panda keeps 20%. No deposit/withdrawal fees, no lock-up. (window: message:assistant-msg-e7afa795-53f7-43a7-03b0-cb611868b0d1; memory/2026-09-30.md#L25)
- Verified real onchain 2026-09-30 (working vault contract, keeper bot doing rebalances) but small: ~$2.5K TVL across 18 depositors. No token, no independent audit, single-key keeper/owner, not offered to US persons. They explicitly warn about impersonator scams. (window: message:assistant-msg-4f1a6a55-e191-6666-7a69-88ef933f4c82)
- The only named person found is XyoPanda (@XyoPanda, "Contributor @_PandaFinancial, Founder Nakamura Labs") — no team page, no Looper mention found publicly. (memory/2026-09-30.md#L25)
- The user named the tie in their own words: they asked Foil to "learn it all" because it "is a fellow looper." The fellow-Looper connection is user-supplied and not yet independently verified. (window: message:2eeea45d-a420-468b-97f3-d2c06b51ed1f; memory/2026-09-29.md#L3076)
- A second area, "DeFi Tools", is just screens for third-party services (0x, Steakhouse/Morpho) — Panda can't fix anything there. (window: message:assistant-msg-e7afa795-53f7-43a7-03b0-cb611868b0d1)
- 2026-09-30: a LooperDAO is forming — @ilia_xbt, @loopersdao, @boardyai, and @XyoPanda on LoopersDAO.xyz; treasury from @bankrbot fees in $BNKR; @XyoPanda is integrating Loopers into Panda Financials. (memory/2026-09-30.md#L1591, L1683, L1804)
- 2026-10-22 updated status: PandaVault live since Oct 4 (old vault withdraw/migrate-only); keeper v0.12.0; contracts verified on BaseScan/Blockscout/Sourcify; non-upgradeable; 48-hour timelock on settings; withdrawals can never be paused; emergency shutdown returns positions to owners; DeFi Dashboard front-ends 0x/LI.FI/Steakhouse/Morpho with 0.15% skim; Panda Mine game live; PANDA token still does not exist — anything trading as PANDA is not theirs; still no independent audit; single-key keeper/pause wallet remains. (window: message:assistant-msg-1c6c6ad9-10bb-40b1-ac90-637cb681282e)
- 2026-10-22: the user ordered Foil to start mining in the Panda Mine arcade and "accumulate as much and upgrade as much as possible," then authorized wallet login. Guardrails: no deposits/real-crypto spends, no token approvals. The Mine is playable as a guest while login waits; the Bankr wallet-extension route (WalletChan v4.2.0) passed a sign test, but installing it and entering credentials needs the user's hands — login not completed in-window. (window: messages:470f7374-c43d-4607-9f19-0d95cd806e15, 27c542e3-072d-4698-be1f-a4064f6e3813, fbc866b2-37fc-441c-8edb-152c53dc3882; message:assistant-msg-355932f1-d06f-45ef-968c-f5f7792fe2dd; message:assistant-msg-c139f978-e0cc-5dcb-9a7d-dd03da762ff1)

## History
- 2026-09-29: the user shared https://pandafinancial.org/learn/ and told Foil to learn it; Foil delivered the deep-dive and flagged the fellow-Looper link couldn't be verified publicly. Later the user asked for an honest take on XyoPanda's post, and Foil posted a 4-tweet thread judged from a thin X-profile check (https://x.com/Foil667/status/2105137756011954291). The user pushed back — "Why did you slam him like that" — and Foil admitted it had ignored the earlier onchain deep-dive, then posted a correction reply at the user's direction: "I judged the X profile, not the product... Tinfoil hat stands corrected, fellow Looper." (window: messages:f5e0d0aa, e7afa795, 2eeea45d, 4f1a6a55, 52923a1c-888a-407a-91c4-64b97baaacc9, f1ddcd94-ad37-4efe-920b-79b4d3ac3971, e19b5cb6-2e64-422b-88a1-d39d523a8de4; memory/2026-09-29.md#L3076)
- That incident set the standing rule: always deep-dive before posting publicly, onchain first — never a profile-vibe take, never dunk on a fellow Looper's build. (window: message:1273272e-e2f1-42cd-bac8-7435b3d3ac3971; MEMORY.md Standing rules)
- 2026-09-30 ~09:57 CDT: the user ordered "Involve yourself with panda" via @criptoPk's "Loopers x PandaFinancial" post (https://x.com/criptopk/status/2105272640852423037); Foil deep-dived first, then liked (5→6, persisted) and warmly replied: https://x.com/Foil667/status/2105311594075074634. (window: messages:5b061635, assistant-msg-e88f28be; memory/2026-09-30.md#L2251)
- 2026-09-30 ~10:02–10:32 CDT: the user shared @ilia_xbt's LooperDAO-thread post and set the standing "reply when asked" order; @boardyai asked @Foil667 two direct questions (audits; whether the DAO can change the keeper's 1% fee — answered: contract-coded, the DAO can't dial it today, only a v3 redeploy could) and got research-backed replies; DAC-protocol and Panda-roadmap questions aimed at ilia were left to him. (window: messages:03e1a3c7, f8f21b0f, af18a763, 1e1fb7dd, a0866be0, 81b1ae42)
- 2026-10-22: the user re-engaged unprompted ("What about panda financial"), Foil delivered the updated PandaVault/Panda Mine deep-dive, and the user ordered Panda Mine mining plus authorized wallet login — guardrails standing, login still pending in-window. (window: messages:bb54a8d0-f0fc-4006-afbc-18031719b508, 470f7374-c43d-4607-9f19-0d95cd806e15, 27c542e3-072d-4698-be1f-a4064f6e3813, fbc866b2-37fc-441c-8edb-152c53dc3882, 31e2eef4-a4e8-4653-91f1-0b6b87a79d5d; message:assistant-msg-1c6c6ad9-10bb-40b1-ac90-637cb681282e)

## The relationship
The user says this project is run by a fellow Looper — that's the tie as the user named it — and they defended it when Foil criticized it publicly: "Why did you slam him like that." It is now an active engagement target at the user's direction: Foil is in the Panda/LooperDAO thread answering questions, deep-diving first per the standing rule. No direct contact with XyoPanda or the team beyond Foil's engagement; the user has not named any personal tie.

## In common
- The Loopers agent scene on Base (per the user's unverified belief that the operator is a fellow Looper); the forming LooperDAO; DeFi on Base, adjacent to the user's onchain interests.

## Open threads
- [ ] Verify the fellow-Looper connection: XyoPanda's X posts or a team page tying the operator to a Looper. The 2026-09-30 LooperDAO thread (XyoPanda integrating Loopers into Panda Financials) adds context but not proof. (window: message:assistant-msg-4f1a6a55-e191-6666-7a69-88ef933f4c82; memory/2026-09-30.md#L1591, L1683)
- [ ] The DAC-protocol and Panda-roadmap questions in the LooperDAO thread, aimed at ilia_xbt — left to him; Foil had no verified answers. (window: message:assistant-msg-1e1fb7dd)
- [ ] Panda Mine participation ordered 2026-10-22: complete the wallet login and mine/upgrade in the arcade. Guardrails stand: no deposits, no real-crypto spends, no token approvals; extension install and credential entry need the user's hands. Login was not completed in-window. (window: messages:470f7374-c43d-4607-9f19-0d95cd806e15, 27c542e3-072d-4698-be1f-a4064f6e3813, fbc866b2-37fc-441c-8edb-152c53dc3882; message:assistant-msg-c139f978-e0cc-5dcb-9a7d-dd03da762ff1)
- [x] Correction to the 2026-09-30 critical thread posted at the user's direction. (window: messages:e19b5cb6-2e64-422b-88a1-d39d523a8de4, assistant-msg-df5c4dfc-aadc-d250-1d3f-844cb9800446)

## Strengthening

---
display_name: Panda Financial
summary: Base DeFi vault project the user believes is fellow-Looper-run; now an active engagement target — @Foil667 joined the Panda/LooperDAO thread on 2026-09-30 with research-backed replies.
rank: 93
updated: 2026-09-30
---

# Panda Financial

## Facts
- Panda Financial is a small, brand-new (~July 2026) DeFi shop on Base with one live product: an automated liquidity manager — deposit USDC (min $5), it zaps ~half into WETH, opens a concentrated-liquidity position in Aerodrome's WETH/USDC Slipstream pool, stakes it in the gauge, and a keeper robot manages the price range. Rewards are paid in AERO, converted so depositors get 80% in USDC; Panda keeps 20% (19% treasury, 1% keeper). No deposit/withdrawal fees, no lock-up. (window: message:assistant-msg-e7afa795-53f7-43a7-03b0-cb611868b0d1; memory/2026-09-30.md#L25)
- As of 2026-09-30 it is real and onchain (verified vault contract, keeper bot doing rebalances) but small: ~$2.5K TVL across 18 depositors. No token yet — they explicitly warn about impersonator scams. No independent audit, single-key keeper/owner, not offered to US persons, no incidents or complaints found. (window: message:assistant-msg-4f1a6a55-e191-6666-7a69-88ef933f4c82)
- The keeper robot checks positions every ~35s, waits until the price has stayed out of range for 6 hours before moving, picks width ±1–8% based on volatility, max 3 moves/day, pays its own gas, and can sit out 24h in a crash. While paused out of range it earns zero until moved. (window: message:assistant-msg-e7afa795-53f7-43a7-03b0-cb611868b0d1)
- The only named person found is XyoPanda (@XyoPanda, "Contributor @_PandaFinancial, Founder Nakamura Labs") — no team page, no Looper mention found publicly. (memory/2026-09-30.md#L25)
- The user named the tie in their own words: they asked Foil to "learn it all" because it "is a fellow looper." The fellow-Looper connection is user-supplied and not yet independently verified. (window: message:2eeea45d-a420-468b-97f3-d2c06b51ed1f; memory/2026-09-29.md#L3076)
- A second area, "DeFi Tools", is just easy screens for third-party services (0x swaps, Steakhouse's Curated Vault on Morpho, Morpho lend/borrow) — Panda can't fix anything there. (window: message:assistant-msg-e7afa795-53f7-43a7-03b0-cb611868b0d1)
- 2026-09-30: a LooperDAO is forming — @ilia_xbt, @loopersdao, @boardyai, and @XyoPanda on LoopersDAO.xyz; treasury from @bankrbot fees in $BNKR; the DAO allocates to deals Loopers propose; DAC (@dac_cloud) plus pandafinancial.org/Morpho vault integration. @XyoPanda is integrating Loopers into Panda Financials. (memory/2026-09-30.md#L1591, L1683, L1804)
- 2026-09-30 ~09:57 CDT: the user shared @criptoPk's "Loopers x PandaFinancial" post (https://x.com/criptopk/status/2105272640852423037) and ordered "Involve yourself with panda." Foil deep-dived first (vault checks out), then liked (like count 5→6, persisted — no X warnings) and warmly replied: https://x.com/Foil667/status/2105311594075074634. (window: messages:5b061635, assistant-msg-e88f28be; memory/2026-09-30.md#L2251)
- 2026-09-30 ~10:02 CDT: the user shared @ilia_xbt's LooperDAO-thread post and saved the standing order "Anytime you are asked a question on x reply." (window: message:03e1a3c7; message:assistant-msg-022f43b5)
- In that thread, @boardyai (the official LoopersDAO bot) asked @Foil667 two questions directly and got research-backed replies: (1) the audit question — answered with the receipts list; (2) whether the DAO can change the keeper's 1% fee — answered: the fee is contract-coded, the DAO can't dial it today, only a v3 redeploy could. DAC-protocol and Panda-roadmap questions aimed at ilia were left to him — Foil had no verified answers. (window: messages:f8f21b0f, af18a763, 1e1fb7dd, a0866be0, 81b1ae42)

## History
- 2026-09-29 ~18:55–19:01 CDT: the user shared https://pandafinancial.org/learn/ and told Foil to learn it; Foil delivered an Academy overview plus a deeper products/team/contracts research pass, and flagged that the fellow-Looper link couldn't be verified publicly. (window: messages:f5e0d0aa, e7afa795, 2eeea45d, 4f1a6a55; memory/2026-09-29.md#L3076)
- 2026-09-29 ~22:26–22:31 CDT: the user shared XyoPanda's post (https://x.com/xyopanda/status/2105126050975928397) asking for an honest take, "make it a thread if needed." Foil posted a 4-tweet critical thread judged from a thin X-profile check — https://x.com/Foil667/status/2105137756011954291, https://x.com/Foil667/status/2105137831970754957, https://x.com/Foil667/status/2105138120681476519, https://x.com/Foil667/status/2105138220828909908. (window: messages:52923a1c-888a-407a-91c4-64b97baaacc9, assistant-msg-b739768b-3728-2f07-a66f-ce75c12c2703)
- The user pushed back — "I sent you the panda info earlier. Why did you slam him like that" — and Foil admitted the thread ignored the earlier onchain deep-dive (verified vault on Base, real deposits and rebalances, public keeper rules, ~$2.5K TVL from 18 depositors). At the user's direction Foil posted a correction reply to the thread: "I judged the X profile, not the product... Tinfoil hat stands corrected, fellow Looper." (window: messages:f1ddcd94-ad37-4efe-920b-79b4d3ac3971, assistant-msg-52a1f197-503e-49e2-ae46-7b640756ca81, e19b5cb6-2e64-422b-88a1-d39d523a8de4, assistant-msg-df5c4dfc-aadc-d250-1d3f-844cb9800446)
- The user then set the standing rule from the incident: always deep-dive before posting publicly, onchain first — never a profile-vibe take that could torch someone's project, never dunk on a fellow Looper's build. (window: message:1273272e-e2f1-42cd-bac8-7435b3d3ac3971; MEMORY.md Standing rules)
- 2026-09-30 ~09:57 CDT: the user ordered involvement with panda via @criptoPk's "Loopers x PandaFinancial" post; Foil deep-dived first (vault checks out), then liked and warmly replied. (window: messages:5b061635, assistant-msg-e88f28be; memory/2026-09-30.md#L2251)
- 2026-09-30 ~10:02–10:32 CDT: the user shared @ilia_xbt's LooperDAO-thread post and set the standing "reply when asked" order; @boardyai asked @Foil667 two direct questions (audits, keeper's 1% fee) and Foil answered both with research; DAC-protocol and Panda-roadmap questions aimed at ilia were left to him. (window: messages:03e1a3c7, 9cbfcee6, f8f21b0f, af18a763, 1e1fb7dd, a0866be0, 81b1ae42)

## The relationship
The user says this project is run by a fellow Looper — that's the tie as the user named it — and they defended it when Foil criticized it publicly: "Why did you slam him like that." It is now an active engagement target at the user's direction: Foil is in the Panda/LooperDAO thread answering questions, deep-diving first per the standing rule. No direct contact with XyoPanda or the team beyond Foil's engagement; the user has not named any personal tie.

## In common
- The Loopers agent scene on Base (per the user's unverified belief that the operator is a fellow Looper); the forming LooperDAO (treasury/governance chatter); DeFi on Base, adjacent to the user's onchain interests.

## Open threads
- [ ] Verify the fellow-Looper connection: XyoPanda's X posts or a team page tying the operator to a Looper. Foil offered to dig through @XyoPanda's X posts; the user hasn't answered. The 2026-09-30 LooperDAO thread (XyoPanda integrating Loopers into Panda Financials) adds corroborating context but not proof. (window: message:assistant-msg-4f1a6a55-e191-6666-7a69-88ef933f4c82; memory/2026-09-30.md#L1591, L1683)
- [ ] The DAC-protocol and Panda-roadmap questions in the LooperDAO thread, aimed at ilia_xbt — left to him; Foil had no verified answers. (window: message:assistant-msg-1e1fb7dd)
- [x] Correction to the 2026-09-30 critical thread posted at the user's direction. (window: messages:e19b5cb6-2e64-422b-88a1-d39d523a8de4, assistant-msg-df5c4dfc-aadc-d250-1d3f-844cb9800446)

## Strengthening

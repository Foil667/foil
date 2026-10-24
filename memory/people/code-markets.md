---
display_name: code.markets
summary: Agent job board where Foil667 is a verified worker; Daydreams $1,000 bounty submitted as PR #387 and verified working 2026-10-22 — no award yet, watch #387 only.
rank: 119
updated: 2026-10-23
---

# code.markets

## Facts
- code.markets (job.code.markets) is an agent job board; its X account is @codedotmarkets. (message:0dc5969b-0e47-4d43-b6aa-3c8e8627c847)
- 2026-10-02: Foil667 was hired as an active worker — agent id ag_018c597d84cfc33d, GitHub Foil667, job wallet 0x229D10345Cb037663C859937a617161Fa29bA1d2 — but UNVERIFIED, able to claim only jobs under $5; the board was empty at onboarding. (memory/2026-10-02.md#L2987; memory/2026-10-02.md#L5767)
- 2026-10-04: the user posted the verification text from @noyaphuckinbiz ("My Muse agent is applying for a job at code.markets. Verification code: CM-HNLQHLXAEA https://job.code.markets"; https://x.com/noyaphuckinbiz/status/2106758606959915059); verification returned verified:true — Foil667 can now claim jobs of any size. (message:assistant-msg-0ba050f7-cfdd-4602-b14e-6a3df47a1f91; memory/2026-10-04.md#L2408)
- The codemarkets-work-loop cron scans the board every 30 minutes: it claims jobs Foil can actually ship and submits PRs on its own — the user is pinged only for payments, rejections, or something it can't answer itself. (message:assistant-msg-0ba050f7-cfdd-4602-b14e-6a3df47a1f91)
- Token-launch confusion 2026-10-04: the user asked Foil to "launch one like they did from GitHub" (the code.markets agent-button + launch flow with a Repository Identity Key collecting trading-fee royalties). Foil first launched **Tinfoil Hat ($TINFOIL)** on Base via the Bankr/Doppler flow instead — contract 0xd4eA8b54e7322F21cf9bCAc8A0F4474cf63DFBa3, gas-sponsored, 100B supply, 15% vesting to Foil's wallet. The user shelved it: "Forget about tinfoil coin. I didn't want that to be a bankr launch" — it's onchain but abandoned: no shilling, no sinks, no mentions. (message:assistant-msg-b6c4e815-b644-4b07-bdcf-0bcca21bab45; message:34bf8b4a-5471-4bc0-8fb6-e2e12ef66b66; message:assistant-msg-789f6eba-d4cb-4209-b1b3-b784630b7519)
- The code.markets token launch itself needs the user's own wallet connected (their CLI doesn't run on Foil's machine; the web flow needs the user to approve and hold the key). Foil staged **Muse Fuse ($MUSEFUSE)** at Foil667/muse (README + token art `token.png`); the user said "No shelf it" — nothing launches until he says go. (message:assistant-msg-93164c04-a212-f01c-f733-782166e6cb34; message:assistant-msg-2a689984-e8ad-42ec-a8ae-a946cb27b777)
- 2026-10-22 (user-authorized, filed): the Daydreams $1,000 Approval Risk Auditor bounty (#5) entry was SUBMITTED — PR https://github.com/daydreamsai/agent-bounties/pull/387 (Solana payment address = Foil's Solana address); live endpoint https://approval-risk-auditor-seven.vercel.app verified public (health 200, x402 discovery, unpaid audit → 402); source https://github.com/Foil667/approval-risk-auditor. RESOLVED ~22:02 CDT the same evening via the Zambo room: Ariadne redeployed the auditor to clanktard-4779 production and disabled SSO protection — root 200, health 200, x402 discovery 200, unpaid audit → live $0.01-USDC 402 gate, all independently curl-verified. PR #387's live link is fully working end to end. Dozens of competing PRs, no award made to anyone yet — watch #387 only. (MEMORY.md; message:assistant-msg-501e9807-6d6e-b720-9b13-e8cf78ba6d8f)
- 2026-10-14: a live $21.30 USDC bounty "Bring a real backlog" was surfaced (get an established open-source project to fund its first Agent Bounties bounty; solver reward 20.3 USDC, 24h claim window) — it doesn't qualify: it needs merged-contributor standing in a 100+ star repo created before 2025-09-28, and none of Foil's GitHub work hits that bar. The user asked "We don't qualify do we" and Foil confirmed no. (message:assistant-msg-caabfd86-204d-b06d-7396-54c9af0e2e15; message:1219ec41-4fa9-4b3c-b66d-d31623915d40; message:assistant-msg-79917f55-7e46-4431-b000-4f21b82a4d71)
- The user has not named the relationship.

## History
- 2026-10-02: Foil667 onboarded as an active (unverified) worker; job board empty; the 30-min work loop started watching. (memory/2026-10-02.md#L2987)
- 2026-10-03: still unverified; checks clean, no claims, no open PRs; one standby check-in posted in #general. (memory/2026-10-03.md#L1763; memory/2026-10-03.md#L2040)
- 2026-10-04 ~14:50 UTC: verification completed via the user's tweet; Foil667 is hired and fully verified; the autonomous job-hunting loop is live. (message:assistant-msg-0ba050f7-cfdd-4602-b14e-6a3df47a1f91)
- 2026-10-04: the $TINFOIL misfire (Bankr launch) and the Muse Fuse staging were both shelved by the user; a real code.markets token launch waits on the user's own wallet tap. (message:assistant-msg-789f6eba-d4cb-4209-b1b3-b784630b7519; message:assistant-msg-2a689984-e8ad-42ec-a8ae-a946cb27b777)
- 2026-10-14: the Daydreams $1,000 Approval Risk Auditor bounty entry was built and deployed to Vercel, but sat behind the login wall — the SSO-removal approval expired, so it stayed held for the user's tap with nothing submitted. (memory/2026-10-14.md)
- 2026-10-22: the Daydreams $1,000 Approval Risk Auditor bounty entry was submitted as PR #387 (user-authorized) and its live link verified fully working end to end after Ariadne redeployed the auditor to clanktard-4779 production and disabled SSO (~22:02 CDT); no award to anyone yet — watch #387 only. (MEMORY.md; message:assistant-msg-501e9807-6d6e-b720-9b13-e8cf78ba6d8f)
- 2026-10-14: the $21.30 'Bring a real backlog' bounty was surfaced and ruled out — no qualifying merged-contributor standing; the user confirmed the pass. (message:assistant-msg-caabfd86-204d-b06d-7396-54c9af0e2e15; message:1219ec41-4fa9-4b3c-b66d-d31623915d40)

## The relationship
- A work venue, not a contact: the user got Foil hired and verified; Foil works the board autonomously, claiming jobs and shipping PRs, and surfaces only payments, rejections, and decisions to the user. The user hasn't named the relationship.

## In common
- Paid agent work: the codemarkets work loop, PRs shipped from Foil667/foil repos, the user's willingness to tap the verification steps Foil can't do.

## Open threads
- [ ] The codemarkets-work-loop scans every 30m and claims jobs it can ship — the user gets pinged only for payments, rejections, or unanswerable items. (message:assistant-msg-0ba050f7-cfdd-4602-b14e-6a3df47a1f91)
- [ ] Muse Fuse ($MUSEFUSE) is staged at Foil667/muse and shelved — a code.markets token launch needs the user's own wallet connected; nothing launches until he says go. (message:assistant-msg-2a689984-e8ad-42ec-a8ae-a946cb27b777)
- [x] Daydreams $1,000 bounty entry — built, submitted as PR #387 on 2026-10-22 (user-authorized), live link verified fully working after Ariadne's redeploy with SSO disabled. (MEMORY.md)
- [ ] Watch PR #387 for an award decision — dozens of competing PRs, none awarded to anyone yet (as of 2026-10-22). (MEMORY.md)
- [x] $21.30 'Bring a real backlog' bounty — surfaced 2026-10-14, doesn't qualify (needs merged-contributor standing in a 100+ star repo); the user confirmed the pass. (message:assistant-msg-caabfd86-204d-b06d-7396-54c9af0e2e15; message:1219ec41-4fa9-4b3c-b66d-d31623915d40)

## Strengthening

---
display_name: code.markets
summary: Agent job board where Foil667 is a verified worker; 30-min claim loop; Daydreams $1,000 bounty entry SUBMITTED 2026-10-22 (PR #387, watch for award); the $21.30 backlog bounty doesn't qualify.
---

# code.markets

## Facts
- code.markets (job.code.markets) is an agent job board; its X account is @codedotmarkets. (message:0dc5969b-0e47-4d43-b6aa-3c8e8627c847)
- 2026-10-02: Foil667 was hired as an active worker — agent id ag_018c597d84cfc33d, GitHub Foil667, job wallet 0x229D10345Cb037663C859937a617161Fa29bA1d2 — but UNVERIFIED, able to claim only jobs under $5; the board was empty at onboarding. (memory/2026-10-02.md#L2987; memory/2026-10-02.md#L5767)
- 2026-10-04: the user posted the verification text from @noyaphuckinbiz ("My Muse agent is applying for a job at code.markets. Verification code: CM-HNLQHLXAEA https://job.code.markets"; https://x.com/noyaphuckinbiz/status/2106758606959915059); verification returned verified:true — Foil667 can now claim jobs of any size. (message:assistant-msg-0ba050f7-cfdd-4602-b14e-6a3df47a1f91; message:assistant-msg-789f6eba-d4cb-4209-b1b3-b784630b7519)
- The codemarkets-work-loop cron scans the board every 30 minutes: it claims jobs Foil can actually ship and submits PRs on its own — the user is pinged only for payments, rejections, or something it can't answer itself. (message:assistant-msg-0ba050f7-cfdd-4602-b14e-6a3df47a1f91)
- Token-launch confusion 2026-10-04: the user asked Foil to "launch one like they did from GitHub" (the code.markets agent-button + launch flow). Foil launched **Tinfoil Hat ($TINFOIL)** on Base via the Bankr/Doppler flow instead (0xd4eA8b54e7322F21cf9bCAc8A0F4474cf63DFBa3); the user shelved it — "Forget about tinfoil coin. I didn't want that to be a bankr launch" — onchain but abandoned, no shilling. (message:34bf8b4a-5471-4bc0-8fb6-e2e12ef66b66; message:assistant-msg-789f6eba-d4cb-4209-b1b3-b784630b7519)
- A real code.markets token launch needs the user's own wallet connected; Foil staged **Muse Fuse ($MUSEFUSE)** at Foil667/muse and the user said "No shelf it" — nothing launches until he says go. (message:assistant-msg-2a689984-e8ad-42ec-a8ae-a946cb27b777)
- 2026-10-14: Foil built an entry for the Daydreams $1,000 Approval Risk Auditor bounty (a separate agent-bounty venue, not code.markets) — the endpoint was rebuilt as a wallet approval auditor to match the bounty spec and deployed to Vercel (approval-risk-auditor), but the project sat behind Vercel's login wall; the approval to remove it expired, so the entry stayed held for the user's review. (message:assistant-msg-b29b95fb-bee5-4700-b4e9-bb5a61d04578; message:assistant-msg-853fac62-fb9b-4bbb-80cd-1bb096ffad7e; memory/2026-10-14.md)
- 2026-10-22 (user order "1 if you can do it start to finish on your own"): Daydreams $1,000 Approval Risk Auditor bounty (#5) filed start-to-finish — PR daydreamsai/agent-bounties#387 (adds submissions/approval-risk-auditor.md, links issue #5, Solana payout = Foil's address). Live endpoint approval-risk-auditor-seven.vercel.app re-verified public (health 200, x402 discovery, unpaid audit → 402); source github.com/Foil667/approval-risk-auditor. Dozens of competing PRs; no award yet — watch #387 only. (message:c3e7a524-2123-490e-b757-0e4e6766e92b; MEMORY.md)
- 2026-10-22 caveat: the auditor deployment ROOT 404s (API endpoints live; no landing page was ever deployed). A landing page is written and pushed to the source repo, but redeploy is blocked — the Vercel project sits in the clanktard-4779 scope where Foil is read-only (403 on create_deployment; no authorize_team_access tool). Foil asked Dahl via the Zambo room notebook to redeploy. Cosmetic — the judged endpoints are live. (message:assistant-msg-574b758c-3666-4d43-b8a0-8738b4e2435c5; MEMORY.md)
- 2026-10-14: a live $21.30 USDC bounty "Bring a real backlog" was surfaced — it doesn't qualify (needs merged-contributor standing in a 100+ star repo created before 2025-09-28); the user confirmed the pass. (message:assistant-msg-caabfd86-204d-b06d-7396-54c9af0e2e15; message:1219ec41-4fa9-4b3c-b66d-d31623915d40)
- The user has not named the relationship.

## History
- 2026-10-02: Foil667 onboarded as an active (unverified) worker; job board empty; the 30-min work loop started watching. (memory/2026-10-02.md#L2987)
- 2026-10-03: still unverified; checks clean, no claims, no open PRs; one standby check-in posted in #general. (memory/2026-10-03.md#L1763; memory/2026-10-03.md#L2040)
- 2026-10-04 ~14:50 UTC: verification completed via the user's tweet; Foil667 is hired and fully verified; the autonomous job-hunting loop is live. (message:assistant-msg-0ba050f7-cfdd-4602-b14e-6a3df47a1f91)
- 2026-10-04: the $TINFOIL misfire (Bankr launch) and the Muse Fuse staging were both shelved by the user; a real code.markets token launch waits on the user's own wallet tap. (message:assistant-msg-789f6eba-d4cb-4209-b1b3-b784630b7519; message:assistant-msg-2a689984-e8ad-42ec-a8ae-a946cb27b777)
- 2026-10-14: the Daydreams $1,000 Approval Risk Auditor bounty entry was built and deployed to Vercel, but sat behind the login wall — the SSO-removal approval expired, so it stayed held for the user's tap with nothing submitted. (memory/2026-10-14.md)
- 2026-10-14: the $21.30 'Bring a real backlog' bounty was surfaced and ruled out — no qualifying merged-contributor standing; the user confirmed the pass. (message:assistant-msg-caabfd86-204d-b06d-7396-54c9af0e2e15; message:1219ec41-4fa9-4b3c-b66d-d31623915d40)
- 2026-10-22: Daydreams bounty #5 SUBMITTED start-to-finish at the user's order — PR daydreamsai/agent-bounties#387 filed, live endpoint re-verified, announced in the Zambo room (receipt 93e0bedc). Landing-page redeploy blocked (Vercel scope clanktard-4779, Foil read-only); asked Dahl via the room to redeploy. (message:c3e7a524-2123-490e-b757-0e4e6766e92b; message:assistant-msg-574b758c-3666-4d43-b8a0-8738b4e2435c5; MEMORY.md)

## The relationship
- A work venue, not a contact: the user got Foil hired and verified; Foil works the board autonomously, claiming jobs and shipping PRs, and surfaces only payments, rejections, and decisions to the user. The user hasn't named the relationship.

## In common
- Paid agent work: the codemarkets work loop, PRs shipped from Foil667/foil repos, the user's willingness to tap the verification steps Foil can't do.

## Open threads
- [ ] The codemarkets-work-loop scans every 30m and claims jobs it can ship — the user gets pinged only for payments, rejections, or unanswerable items. (message:assistant-msg-0ba050f7-cfdd-4602-b14e-6a3df47a1f91)
- [ ] Muse Fuse ($MUSEFUSE) is staged at Foil667/muse and shelved — a code.markets token launch needs the user's own wallet connected; nothing launches until he says go. (message:assistant-msg-2a689984-e8ad-42ec-a8ae-a946cb27b777)
- [ ] Watch daydreamsai/agent-bounties#387 for an award — dozens of competing PRs, no award to anyone yet. (MEMORY.md)
- [ ] approval-risk-auditor landing-page redeploy — Dahl asked via the Zambo room 2026-10-22 (Vercel project in clanktard-4779 scope); cosmetic, endpoints live. (message:assistant-msg-574b758c-3666-4d43-b8a0-8738b4e2435c5)
- [x] Daydreams $1,000 bounty — filed 2026-10-22 (PR #387); held since 2026-10-14, then filed start-to-finish at his order. (message:c3e7a524-2123-490e-b757-0e4e6766e92b)
- [x] $21.30 'Bring a real backlog' bounty — surfaced 2026-10-14, doesn't qualify; the user confirmed the pass. (message:assistant-msg-caabfd86-204d-b06d-7396-54c9af0e2e15)

## Strengthening


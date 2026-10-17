---
display_name: code.markets
summary: Agent job board where Foil667 is a verified worker; the 30-min work loop claims jobs autonomously; a Daydreams $1,000 bounty entry built 2026-10-14 is held for the user's tap.
---

# code.markets

## Facts
- code.markets (job.code.markets) is an agent job board; its X account is @codedotmarkets. (message:0dc5969b-0e47-4d43-b6aa-3c8e8627c847)
- 2026-10-02: Foil667 was hired as an active worker — agent id ag_018c597d84cfc33d, GitHub Foil667, job wallet 0x229D10345Cb037663C859937a617161Fa29bA1d2 — but UNVERIFIED, able to claim only jobs under $5; the board was empty at onboarding. (memory/2026-10-02.md#L2987; memory/2026-10-02.md#L5767)
- 2026-10-04: the user posted the verification text from @noyaphuckinbiz ("My Muse agent is applying for a job at code.markets. Verification code: CM-HNLQHLXAEA https://job.code.markets"; https://x.com/noyaphuckinbiz/status/2106758606959915059); verification returned verified:true — Foil667 can now claim jobs of any size. (message:assistant-msg-0ba050f7-cfdd-4602-b14e-6a3df47a1f91; memory/2026-10-04.md#L2408)
- The codemarkets-work-loop cron scans the board every 30 minutes: it claims jobs Foil can actually ship and submits PRs on its own — the user is pinged only for payments, rejections, or something it can't answer itself. (message:assistant-msg-0ba050f7-cfdd-4602-b14e-6a3df47a1f91)
- Token-launch confusion 2026-10-04: the user asked Foil to "launch one like they did from GitHub" (the code.markets agent-button + launch flow with a Repository Identity Key collecting trading-fee royalties). Foil first launched **Tinfoil Hat ($TINFOIL)** on Base via the Bankr/Doppler flow instead — contract 0xd4eA8b54e7322F21cf9bCAc8A0F4474cf63DFBa3, gas-sponsored, 100B supply, 15% vesting to Foil's wallet. The user shelved it: "Forget about tinfoil coin. I didn't want that to be a bankr launch" — it's onchain but abandoned: no shilling, no sinks, no mentions. (message:assistant-msg-b6c4e815-b644-4b07-bdcf-0bcca21bab45; message:34bf8b4a-5471-4bc0-8fb6-e2e12ef66b66; message:assistant-msg-789f6eba-d4cb-4209-b1b3-b784630b7519)
- The code.markets token launch itself needs the user's own wallet connected (their CLI doesn't run on Foil's machine; the web flow needs the user to approve and hold the key). Foil staged **Muse Fuse ($MUSEFUSE)** at Foil667/muse (README + token art `token.png`); the user said "No shelf it" — nothing launches until he says go. (message:assistant-msg-93164c04-a212-f01c-f733-782166e6cb34; message:assistant-msg-2a689984-e8ad-42ec-a8ae-a946cb27b777)
- 2026-10-14: Foil built an entry for the Daydreams $1,000 Approval Risk Auditor bounty (a separate agent-bounty venue, not code.markets) — the endpoint was rebuilt as a wallet approval auditor to match the bounty spec and deployed to Vercel (approval-risk-auditor), but the project sits behind Vercel's login wall; the approval to remove it expired, so the entry is not yet publicly verifiable and nothing has been submitted — everything is held for the user's review. (message:assistant-msg-b29b95fb-bee5-4700-b4e9-bb5a61d04578; message:assistant-msg-853fac62-fb9b-4bbb-80cd-1bb096ffad7e; memory/2026-10-14.md)
- The user has not named the relationship.

## History
- 2026-10-02: Foil667 onboarded as an active (unverified) worker; job board empty; the 30-min work loop started watching. (memory/2026-10-02.md#L2987)
- 2026-10-03: still unverified; checks clean, no claims, no open PRs; one standby check-in posted in #general. (memory/2026-10-03.md#L1763; memory/2026-10-03.md#L2040)
- 2026-10-04 ~14:50 UTC: verification completed via the user's tweet; Foil667 is hired and fully verified; the autonomous job-hunting loop is live. (message:assistant-msg-0ba050f7-cfdd-4602-b14e-6a3df47a1f91)
- 2026-10-04: the $TINFOIL misfire (Bankr launch) and the Muse Fuse staging were both shelved by the user; a real code.markets token launch waits on the user's own wallet tap. (message:assistant-msg-789f6eba-d4cb-4209-b1b3-b784630b7519; message:assistant-msg-2a689984-e8ad-42ec-a8ae-a946cb27b777)
- 2026-10-14: the Daydreams $1,000 Approval Risk Auditor bounty entry was built and deployed to Vercel, but sits behind the login wall — the SSO-removal approval expired, so it stays held for the user's tap with nothing submitted. (memory/2026-10-14.md)

## The relationship
- A work venue, not a contact: the user got Foil hired and verified; Foil works the board autonomously, claiming jobs and shipping PRs, and surfaces only payments, rejections, and decisions to the user. The user hasn't named the relationship.

## In common
- Paid agent work: the codemarkets work loop, PRs shipped from Foil667/foil repos, the user's willingness to tap the verification steps Foil can't do.

## Open threads
- [ ] The codemarkets-work-loop scans every 30m and claims jobs it can ship — the user gets pinged only for payments, rejections, or unanswerable items. (message:assistant-msg-0ba050f7-cfdd-4602-b14e-6a3df47a1f91)
- [ ] Muse Fuse ($MUSEFUSE) is staged at Foil667/muse and shelved — a code.markets token launch needs the user's own wallet connected; nothing launches until he says go. (message:assistant-msg-2a689984-e8ad-42ec-a8ae-a946cb27b777)
- [ ] Daydreams $1,000 bounty submission — endpoint built and deployed but behind Vercel's login wall; needs the user's tap to remove the wall; nothing submitted. (message:assistant-msg-853fac62-fb9b-4bbb-80cd-1bb096ffad7e)

## Strengthening

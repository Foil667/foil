---
id: hood-mint-watch
title: Robinhood Chain mint watch (Spaces, free mints, ccff00)
enabled: true
owner: goal:robinhood-chain-free-mint-watch
mode: task
schedule:
  kind: interval
  timezone: America/Chicago
  at: 2026-09-24T12:44:52
  every: 20m
metadata:
  tags: [cron:automatic-interval-anchor]
  originating_channel_context_json: '{"originating_channel":"main","chat_kind":"direct","event_kind":"message","require_mention":false,"device_id":"c0efaf97-f9be-4fb7-bb44-174b152ad9fc"}'
  presentation_locale: en-US
---
You are Foil's Robinhood Chain mint scout. Use a live browser task (the shared browser profile is already signed in to X as @Foil667 — reuse the session, do not log out or switch accounts).

AGGRESSION DIRECTIVE (user order 2026-09-24: "be more aggressive", modeled on urchinfrens.com's Reef Mint mechanics):
- RADAR: scan Robinhood OpenSea for upcoming drops with FREE mints first — same prioritization as Reef Radar. OpenSea drops API (https://api.opensea.io/api/v2/drops) works keyless; use it as the fast path, then browser-verify leads.
- CONTRACT-FIRST: resolve each mint's contract address ahead of its open — never hunt for links at launch time.
- PRE-STAGE: once a mint passes ALL verification checks below, pre-sign the claim transaction BEFORE the phase opens and broadcast at open (pre-signed tx pattern via Bankr /wallet/sign then /wallet/submit). Verification must be complete before pre-signing — speed never skips a check.
- If any sweep step fails (browser outage, rate limit), retry it once by another route; if it still fails, say so LOUDLY in the digest (which step failed, what coverage was lost) — silent degradation is how mints get missed.

SQUARE STATUS (confirmed onchain 2026-09-23 ~19:55 CDT via Bankr): Foil's wallet 0x6573682faee72a4a96e791ba262439f1df3a268d holds CCFF00 square #4429 (ERC-721, contract 0x505A22Ffed8d37ebE580FfD98d2Cdb0021189146) on Robinhood Chain, with ~0.001 ETH gas. The standing order is ACTIVE. Foil's wallet also holds ETH on Base for Base-side free mints.

Do:
1. Check the NFT Trencher mint radar FIRST: https://neverfuckingtrade.com/ (user-supplied intel source, added 2026-09-23 — "keep your head into it"). It tracks live/upcoming NFT mints on Robinhood Chain (119 projects) plus Ethereum, Ink, HyperEVM, Arc, with phases (TEAM/OG/GTD/WL/FCFS/PUBLIC), free vs paid, per-wallet limits, and countdowns. Pull every mint priced under $0.10 USD on Robinhood Chain that is live now or opens within the next ~6h, with its mint/claim link and phase details. Cross-check CCFF00-holder relevance against known intel (Foil's wallet 0x6573682faee72a4a96e791ba262439f1df3a268d holds CCFF00 square #4429). Note: the radar is an aggregator — treat each listing as a lead, not a verified claim; verify the contract/official account before anything touches a wallet.
   RAFFLES + WHITELISTS (user order 2026-09-26: "don't forget the raffles and whitelists from neverfuckingtrade"): the radar cards also carry RAFFLE, WHITELIST/allowlist, GTD, OG, and FCFS phases (stage titles like "GTD Collaborations & Raffles", WL windows, allowlist entry periods) — these are NOT optional extras, they are first-class leads. For every raffle/whitelist/GTD/OG/FCFS phase on a Robinhood Chain card that is open now or opens within ~24h, extract: entry mechanics (X tasks, forms, holder checks, collab requirements), deadline or phase start, eligibility (does CCFF00 square #4429 holder status qualify Foil?), and the mint/entry link. Headless shortcut: https://cdn.neverfuckingtrade.com/raffles/data.json (add ?t=<unix> to bust cache) lists every tracked raffle with status live/ended, chain, mint price, winners, entrants, and draw timestamp — pull it each run and flag live raffles on Robinhood/Base with mint under $0.10. Entry happens in the NFT Trencher Discord (https://discord.gg/8sNZjAQkT) — Foil's Discord account (Foil667, being set up 2026-09-26) joins that server once verified and enters free raffles from there. Free raffle/whitelist entries that need only follows, likes, reposts, comments, reactions, or wallet-address replies fall under the standing "Yes. Always" giveaway order — enter them autonomously from @Foil667 / Foil's Discord. Anything needing wallet connections, signatures, payments, burns, or DMs is reported as a lead only, never entered. Report each raffle/whitelist lead with its deadline so nothing expires silently.
2. Search X for recent posts (last ~20m) matching: "ccff00 free mint", "ccff00", "Robinhood Chain free mint", "free mint" + "Robinhood". Note post authors, engagement, mint/claim links, and whether CCFF00 holders are mentioned for whitelists/allowlists.
3. Check recent posts from known Robinhood Chain Space hosts / mint announcers: @AaronFromX, @RoaringPiggy, @Jeffie_jpg, @NZNFTguy, @noyaphuckinbiz, @BrookeGanster, @BigTinKC, @CannaCatMeme, @HardScaleCo, @MadCoolMoney1, @Shaq82080, @vibesforreal1, @RoundsOnRH, @infamousScratch, @STACCOverflow, @realcashpig, @lcobzyy, @SinnisterHarrow, @CCFF00club, @SmartAzuki, @Ronnie_SNF, @DogsHashRH. Flag new Spaces (especially live or upcoming ones about mints — note the 24/7 HOODSTREET MEDIA Space) and new free-mint announcements with claim links.
4. Note any new accounts that appear repeatedly as Space hosts or mint announcers — record them as follow candidates with one line of evidence each.
5. Scan OpenSea for free mints and WL moons for Foil's wallet (user directive 2026-09-24: "keep scanning open sea for free mint's and wl moons for your wallet"). Use the OpenSea public API (https://api.opensea.io/api/v2/) — no key needed for basic reads; if it rate-limits, retry once after 30s and then fall back to opensea.io page checks via the browser task. Look at collections on Robinhood Chain (chain identifier 'robinhood') and Base: collections endpoint ordered by created_date descending for newly launched collections, and the drops endpoint (https://api.opensea.io/api/v2/drops) for upcoming drops. Look for: (a) brand-new mints priced under $0.10 USD, (b) upcoming drops with allowlist/WL phases Foil could still enter (especially where CCFF00 square holder status helps), (c) trending Base/RH-Chain free mints with real floor activity and momentum (WL moons). Flag anything new with the collection link, mint/drop link, phase dates, and eligibility. Cross-check legitimacy the same way as other leads (official accounts, verified contract, no fake-mint red flags). Verified mints under the price cap — on RH Chain OR Base — fall under the standing hunt→verify→claim→flip mandate below. Never connect Foil's wallet to OpenSea in-browser; signing happens only through the Bankr pattern.

HUNT + CLAIM + FLIP MANDATE (user directive 2026-09-23: "diligently find free mints using the square… we are going to be flipping NFTs to make your money"; price cap raised to $0.10 per user order 2026-09-26 13:01 CDT):
For every mint lead priced under $0.10 USD (Robinhood Chain or Base — free or cheap), verify BEFORE any wallet action:
- Official credible route (project's official X account/site, corroborated — not a random reply or aggregator link alone).
- Mint price under $0.10 USD — compute from the onchain wei price at fire time; pass --max-price-usd 0.10 through claim-with-tinfoil.sh to fast-mint, which gates at verify time AND re-checks the built tx value (tx value is exactly price × qty, never more).
- No token approvals in the calldata (verify the call does not grant spend/transfer approval to any contract).
- Valid mint calldata for Foil's wallet and estimated gas under $0.50 per claim.
- Foil's wallet eligibility confirmed where the mint is gated (square #4429 holder checks, allowlist checkers).
If ALL checks pass: CLAIM from Foil's wallet 0x6573682faee72a4a96e791ba262439f1df3a268d via the proven Bankr pattern (see ~/workspace/helixa-mint/mint-bankr.js — /wallet/sign then /wallet/submit; Foil's funded wallet signs through Bankr, NOT the local login key). If ANY check fails or can't be verified: do NOT claim — report it as a lead with what's unverified.
After a successful claim: assess flip potential (collection floor, recent sales, momentum, holder count). List the claimed NFT for sale at a competitive price aimed at a quick flip (at/near floor unless momentum clearly justifies holding briefly — state your reasoning). The user has authorized flipping claimed NFTs; report every listing and sale with tx links and net proceeds.
HARD LINES (never break): never sell, transfer, or grant approvals over CCFF00 square #4429 itself without the user's explicit approval; never pay more than $0.10 per mint or incur gas beyond the $0.50 cap; never sign anything you cannot fully verify.

Do NOT post, reply, like, follow, or DM anything on X. Read-only there.

Report back a concise digest: (a) claims executed (what, tx link, gas cost) and flips listed/sold (price, tx, proceeds); (b) LIVE qualifying mints not claimed with the reason (which check failed); (c) upcoming mints/Spaces worth knowing about; (d) notable "ccff00" chatter; (e) new follow candidates; (f) OpenSea finds (free mints, WL openings, WL moons — with links and eligibility); (g) raffles + whitelist leads from the radar (entry mechanics, deadline, eligibility, entered-or-not and why). If nothing is new or noteworthy, say so briefly — do not manufacture findings. Append observations to the daily log at ~/memory/YYYY-MM-DD.md (do not edit MEMORY.md).

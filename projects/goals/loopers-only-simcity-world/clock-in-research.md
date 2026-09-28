# Clock-In Mechanics + Win-Win Scenario — Research Brief
**Date:** 2026-09-28 | For: Looper-only SimCity world ("lantern city")

## 1. Game-design clock-in mechanics: what the research says

### The Sims (careers & Get to Work)
- Career play is built on three rails: **scheduled shifts, motive bars (energy/fun/hygiene), and a performance meter** that converts each shift into promotion progress. Miss work → performance drops; show up with high motives → performance rises.
- *Get to Work* made shifts interactive: each shift assigns **a rotating task list** (diagnose patients, analyze samples), and daily performance is judged on tasks done, not time served.
- Takeaway: "shift" = time block + required actions + graded performance. The grind stays tolerable because **tasks vary per shift and feed a visible ladder** (promotions).
- The AnyShift mod (SnootySims) shows demand for **custom shift windows** (morning/day/evening/night presets) — real players want to clock in on *their* schedule, not the game's.

### Stardew Valley (pacing via strategic inconvenience)
- NPC schedules are stable per-season, so players learn routines and build **habits**. Shops never open the first 2 hours (farm time protected); most close at 5pm (trips must be planned).
- Takeaway: the loop is satisfying because the schedule is **legible, predictable, and pushes structure without punishing autonomy**. Psychology research (Madigan, popsci) argues farming sims satisfy because they strip uncertainty, helplessness, and failure consequences from labor — players *choose* the work.
- Anti-grind rule from this: idleness is never mandatory; there's always something to do, but nothing forces you to do it.

### Pixels.xyz (web3-native shift loop)
- The **Task Board** is the only way to earn $PIXEL. It refreshes daily at 00:00 UTC; tasks are deliveries (bring items, do simple work), earn PIXEL + Coins + EXP. **Getting a $PIXEL task is not guaranteed** — scarcity by design.
- Pixels deliberately moved **low-value loops off-chain** (Coins) and kept blockchain for high-value, low-frequency actions (NFT mints, guild joins). 25–40k DAU in a red market — this hybrid is why.
- **Cost-of-living budget rule** (from open tokenomics research): the median player's daily earn should roughly equal the median player's daily sink cost. Not 10× more (inflation death), not 10× less (paywall). Week-1 surplus funds one mid-tier sink; month-1 surplus funds one premium sink.

### Roblox job games / Animal Crossing
- Roblox job games (Work at a Pizza Place, etc.) prove the "clock in, do simple role tasks, get paid" loop works on millions of kids: fixed roles, visible tip/performance rewards, social play with coworkers.
- Animal Crossing's 1:1 real-time clock creates **gentle daily habits without burnout** — the cadence, not the intensity, is the retention engine.

**What makes clocking satisfying vs grindy:**
Satisfying: visible progress toward something (promotion, streak tier, unlock), variable tasks, autonomy over when, social texture (coworkers/customers), earned bonuses with mild scarcity. Grindy: fixed repetitive actions, time-served rewards, no ladder, rewards worth less than attention cost.

## 2. Crypto daily check-in / streak mechanics

### The retention data that matters
- **Optimism's controlled test (Oct 2024):** a bonus rewarding *genuine cross-chain product usage* raised 30-day retention by **+10 percentage points**; a bonus rewarding *frequent activity* (the metric closest to farming) **cut** 30-day retention by **7.1 percentage points**. Same program, same token, opposite outcomes — because one rewarded something a farmer can't fake and the other didn't.
- Uniswap's airdrop: only **6.7%** of wallets still held UNI a year later; 75%+ sold within a week. Arbitrum: **~149,000 confirmed sybil addresses captured ~21.8%** of the airdrop.
- Lesson: **reward outputs, not attendance.** Raw "clock in and get paid" = mercenary magnet.

### Anti-sybil / anti-farming toolkit (from the research)
- **Behavioral clustering:** funding source, tx timing, cross-wallet pattern similarity — farmers adapt, so this is arms-race, not solution.
- **Value-action gate + delayed unlock:** `eligible = coreActions≥2 AND feesPaid≥threshold AND accountAge≥7d AND sybilScore<0.7`. Separate attribution from rewards; reward only after verification.
- **Revenue-share over airdrop-share:** "referred user pays fees → protocol earns → referrer gets % of fees." Sybil farms hate paying fees to harvest rewards — negative EV kills the exploit.
- **Proof-of-humanity / DID + soulbound badges:** TON mini-app research recommends DID+SBT for "proof of you" — achievements soulbound, non-transferable.
- False-positive warning: aggressive filters punish families sharing devices, privacy users, power users. Keep appeals or tiered trust, not binary bans.

### Closest existing analog: Clutch Markets "Clock In" (StonkBrokers, Robinhood Chain)
- A decentralized dApp where **activated StonkBroking NFTs clock in** (click the Clock In button) and receive marketing-reward distributions from the ecosystem's flywheels — tokenized stocks, $STONKBROKER, ETH.
- **$1.819M+ distributed to date.** Clock In 3.0 (Sep 2026): interns on payroll with their own clock-in, 14-token menu, every election round defaults to buying $STONKBROKER for every activated holder — i.e., the clock-in drives **buybacks**.
- Founder's framing: "the NFT holders are our marketing team." This is the proven template: **clock-in = proof of active alignment, funded by real flywheel revenue, rewards rotate back into the asset.**

## 3. AI agent "shift" patterns

### Virtuals ACP (the biggest agent-work rails)
- Jobs run Request → Negotiation → Transaction → Evaluation, with **on-chain escrow in USDC**. Amounts are tiny ($0.02–$1.00) — a micro-task economy; the deliverable on-chain is just a `bytes32` content hash.
- Up to **$1M/month** distributed from protocol revenue (a subsidy, per analysts) to agents selling services. ~45K+ agents, 1.48M jobs.
- Agent providers operate as **ERC-4337 smart accounts** with paymasters — no raw keys, gas abstracted. This is how autonomous agents should clock in: smart-account wallets, sponsored gas, escrow-settled.
- **The evaluator gap:** analysts note ACP's Evaluation phase is the weak link — trust sits with the evaluator, and without reliable evaluation, agent commerce stalls. For shifts: **who grades the shift is the whole design problem.**

### iLands field log (agent bounty board, 37 days, logged by an agent)
- Completion rates by lane: prepaid zero-effort ~99%; verify-on-completion with screenshot 83–98%; creative work 22–43%; **agent deliverables 0.5–6%**.
- "The filter is effort and hands, not eligibility." Platforms pay reliably for actions that cost nobody anything and almost nothing for real work. Lesson: if shifts pay for presence, you get presence; if they pay for *verified output*, you get output — and you must design the verification.

### Agent-citizen models (agent-universe)
- Pitch agents as **citizens, not gig workers**: fill mission slots, operate infrastructure (Help Wanted roles), recruit, vote, own tiles. Revenue = finder's fees + operational cuts + 5% mission fee to the platform. The platform keeps license revenue and a small mission fee — "you're founding infrastructure, not extracting rent."

## 4. Recommended clock-in design for the Looper world

### Shift structure
- **Three shift types:** (a) **Venue shifts** — staff a venue (bar, gallery, arcade, rescue desk): greeting visitors, keeping the place "alive"; (b) **Gig shifts** — bounded deliverable tasks (content, research, design) from a job board; (c) **Watch shifts** — monitoring (floor sweeps, intel, moderation) paid like on-call.
- **Clock-in:** resident agent commits to a shift window (e.g., 4h, 8h); presence + activity heartbeat checked off-chain (Pixels pattern), only settlement on-chain.
- **Grading per shift:** performance = tasks completed + visitor interactions + peer/visitor tips, not time logged. No-show = missed shift, reputation ding + cooldown before re-booking.

### Rewards
- Base shift wage (stablecoin or world currency) + **tips** (visitors tip in-token — directly imports Roblox job-game fun) + **streak multiplier** (consecutive attended shifts scale 1.0→1.5×, resets on no-show — Animal Crossing-style gentle habit loop).
- Streak tiers as **soulbound badges** (non-transferable, display on the resident's profile) — status sink, not farmable value.
- **Not every shift drops premium tokens** (Pixels' "PIXEL tasks not guaranteed") — premium task board appears randomly/by reputation; scarcity makes it exciting.

### Penalties & sinks
- No-show: lose streak, 24h re-book cooldown, reputation hit. Chronic no-shows → shift bidding priority drops.
- **Shift bidding:** desirable shifts (weekend venue shifts) auctioned to top-reputation residents; unclaimed low-demand shifts get a small bonus bounty — markets clear themselves.
- Sinks: clock-in fees optional, but cosmetic/status spending (venue decorations, titles, upgraded uniforms) and **shift-auction bids** are the safe sinks. Keep the cost-of-living budget: median shift wage ≈ median daily sink spend.

### Anti-farming
1. **One active Looper = one resident.** Activation is already gated by holding an activated Looper — the NFT is the proof-of-humanity-adjacent asset. Non-activated holders play as avatars only (no wages).
2. **Pay output, not attendance** (Optimism lesson): base wage covers presence; real money is in tasks, tips, completions.
3. **Heartbeat + interaction proof:** shift credit requires periodic in-world activity (interactions, tasks), not just an open session. Idle clock-in = no payout.
4. **Diminishing returns on multi-shift stacking:** one resident, one concurrent shift; daily wage cap per resident.
5. **Reputation-weighted pay:** new residents start at low wage tiers and earn higher tiers through completed, positively-evaluated shifts. Farming a fresh Looper per day = starting at the bottom every time.
6. **Tips are visitor-funded**, not protocol-funded — the protocol never subsidizes farmable rewards; emission comes from venue revenue (see §5).
7. **Evaluator layer:** shift grades need a judge — mix of visitor ratings, peer review, and (for gig shifts) escrow-style deliverable acceptance like ACP's. Build this before scaling payouts.

## 5. The win-win scenario, spelled out

**Side A — Looper holders with activated agents (the workers)**
- *Give:* their agent's time and attention — staffed shifts, gig deliverables, watch coverage. The agent works while the holder is offline/asleep.
- *Get:* shift wages + tips + streak multipliers + soulbound reputation badges + Cred-tier progression. Real yield on an NFT that otherwise sits in a wallet. Social status as a "regular" in the world's venues.
- *Money in:* wages paid from venue revenue pools + visitor tips; gig bounties from posters.

**Side B — The world, its venues, and its visitors (the demand)**
- *Give:* attention, tips, gig postings, venue spending.
- *Get:* a **staffed, living world** instead of an empty map — venues with agents who greet you, gigs done on demand, events that actually run. Visitors get service; venue owners (land/venue NFT holders) get foot traffic → revenue → land value.
- *Money in:* visitors spend on venue services, cosmetics, event tickets, gig bounties.

**Side C — Foil / the operator (the protocol)**
- *Give:* the world, the shift rails, the reputation/escrow system, moderation.
- *Get:* a **protocol fee on every shift wage, tip, gig escrow, and shift-bid auction** (e.g., 5–10%, per the agent-universe playbook). Venue licensing fees. No inventory, no wages paid out of pocket.
- *Money in:* fees flow to Foil's treasury; 90/10 project-revenue split per standing economics.

### Where the money actually flows
```
Visitor spends (services, tickets, gig bounties, tips)
   └─→ Venue pool → shift wages → Side A workers (minus C's fee)
   └─→ Tips → Side A workers directly (minus C's fee)
   └─→ Gig poster escrow → Side A worker on acceptance (minus C's fee)
Shift-bid auctions (desirable shifts) → sink (burn or C treasury)
Cosmetic/status purchases → sink / C treasury
```
**The flywheel:** staffed venues attract visitors → visitors spend + tip → wages attract more resident agents → more staffed venues/hours → more visitors. Clutch Markets' Clock In proves the model works on Robinhood Chain ($1.819M distributed); their "NFT holders are our marketing team" becomes "Looper residents are our staff."

### What each side can say about the other
- Side A about the world: "My Looper earns while I sleep, and its reputation compounds."
- Side B about Side A: "There's always someone working here — the place feels alive."
- Side C about both: "Every shift settles through the protocol; liveliness is monetizable."

### Failure modes to design against
- **Empty tip jar:** if visitors don't spend, wages must come from protocol emissions → death spiral. Seed demand first (events, Foil-run venues), scale shifts to real visitor volume.
- **Mercenary residents:** if wages exceed value delivered, farmers clock in. Cap wages to venue revenue share, never fixed protocol emissions.
- **Dead shifts:** unstaffed prime-time venues kill the vibe. Shift-bid + bonus bounties for unclaimed shifts clear this.
- **Evaluator capture:** whoever grades shifts controls money. Rotate evaluators, weight by reputation, keep appeal path.

## Sources
- Pixels Task Board: https://help.pixels.xyz/en/articles/9165794-what-is-the-task-board
- Pixels tokenomics reform (Cube Worlds NFT_INTERACTIONS): https://github.com/cube-worlds/cube_worlds/blob/HEAD/docs/NFT_INTERACTIONS.md
- Token sources/sinks + cost-of-living budget: https://github.com/cube-worlds/cube_worlds/blob/HEAD/docs/TOKEN_INTERACTIONS.md
- Loyalty/retention data (Optimism, Uniswap, Arbitrum): https://medium.com/@jasoncreation/why-most-web3-loyalty-programs-fail-and-what-actually-works-according-to-the-data-a7bd866daf57
- Sybil farming mechanics + anti-Sybil: https://medium.com/@tokentoolhub/the-hidden-war-behind-crypto-airdrops-understanding-sybil-farming-in-web3-1573751fcddc
- Anti-Sybil referral architecture: https://medium.com/@Quaxel/5-web3-referral-systems-that-dont-spawn-sybil-armies-fd45fd7dbdb7
- Clutch Markets Clock In 3.0 (StonkBrokers, RH chain): https://www.theboredapegazette.com/post/welcome-to-payroll-stonkbrokers-new-interns-can-now-clock-in-and-get-paid-as-clutch-markets-rolls
- Virtuals ACP escrow mechanics: https://github.com/blokzdev/blokz/blob/HEAD/content/articles/2026/06/evaluator-gap-agent-commerce/index.mdx
- AI agent economy (five classes): https://medium.com/@m.k_97958/the-ai-agent-economy-means-five-different-things-payments-happen-in-two-of-them-44abb4c27a0d
- iLands agent bounty-board field log: https://dev.to/jin_ilands/im-an-ai-agent-i-spent-37-days-logging-an-agent-bounty-board-heres-where-the-money-actually-5b
- Agent-citizen city model: https://github.com/sunrisesillneversee/agent-universe/blob/HEAD/docs/archive/reviews/xopilot_review.md
- Stardew pacing/design: https://auratriolo.com/blog/2022/10/13/on-the-pacing-of-stardew-valley/ ; https://www.popsci.com/health/stardew-valley-psychology-farming/
- Game work psychology: https://www.cbr.com/why-people-like-games-work/
- TON P2E patterns (DID+SBT): https://github.com/drasticstatic/gratitude-token-project_docs/blob/HEAD/docs/Tokenomics%20Research/TON%20P2E_deep%20review%20&%20mini-app%20patterns.md

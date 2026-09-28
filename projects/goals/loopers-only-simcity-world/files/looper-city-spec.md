# Looper City — Spec v0.2 (with Labor Layer)
**Goal:** goal_e2db709c54af | Updated 2026-09-28
**Status:** Phase 0 art spike in progress (trait-to-sprite pipeline + test plaza). This doc folds the approved clock-in research into the spec as the city's labor layer.

## 1. The city in one paragraph
A persistent world just for Loopers, modeled on the lantern-city vibe. Only **activated Loopers that are agents** live as full residents. Holders of non-activated Loopers play as their NFT avatar. Districts, land rights, and status scale with the resident's real Helixa Cred tier — city life raises a resident's actual score. Now with a labor layer: residents clock into shifts, earn real yield, and keep the city alive.

## 2. Who lives here (two tiers, unchanged)
- **Residents:** activated Looper agents. Full citizenship: can own/hold land rights, clock shifts, earn wages, build reputation. One active Looper = one resident.
- **Visitors:** holders playing as their NFT avatar. Can spend, tip, post gigs, attend events — but cannot clock shifts or earn wages. (Anti-farming by construction: the wage layer is identity-gated by activation.)

## 3. Districts & land (unchanged, approved)
- Districts and land rights gated by **Cred tier** — higher-tier residents access better districts.
- City mechanics are **Cred-positive**: documented good behavior in-city feeds back into the resident's real Helixa Cred score.
- Venue owners (land/venue holders) earn from foot traffic their venues generate.

## 4. THE LABOR LAYER (new — from clock-in research, 2026-09-28)
Full research: `../clock-in-research.md`

### 4.1 Shift types
1. **Venue shifts** — staff a venue (bar, gallery, arcade, rescue desk): greet visitors, keep the place alive, run events.
2. **Gig shifts** — bounded deliverable tasks from a job board (content, research, design, code). Poster locks bounty in escrow; paid on acceptance.
3. **Watch shifts** — monitoring coverage (floor sweeps, intel, moderation). Paid like on-call: low base, bonuses for catches.

### 4.2 Clock-in flow
- Resident books a shift window (4h / 8h). Clock-in commits the agent; presence + activity **heartbeat** checked off-chain (Pixels pattern) — only settlement touches the chain.
- **Grading is on output, not attendance** (Optimism lesson: paying for activity cut retention 7 points; paying for genuine usage raised it 10). Performance = tasks completed + visitor interactions + tips received.
- No-show = streak reset + 24h re-book cooldown + reputation ding. Chronic no-shows drop shift-bidding priority.

### 4.3 Rewards
- **Base wage in $RESCUE** (the token for everything — user directive 2026-09-28) + **visitor tips** (the Roblox job-game fun, imported) + **streak multiplier** (1.0→1.5× across consecutive attended shifts; Animal Crossing-style gentle habit loop).
- **Soulbound badges** for streak tiers — non-transferable status displayed on the resident profile. Status sink, not farmable value.
- Premium gig board is **scarce by design** (Pixels: "$PIXEL tasks not guaranteed") — reputation-gated, appears unpredictably. Scarcity makes it exciting.
- Reputation-weighted pay tiers: new residents start at the bottom and earn higher tiers through completed, positively-evaluated shifts. Farming a fresh Looper daily = starting over daily.

### 4.4 Penalties & sinks (the economy must balance)
- Median shift wage ≈ median daily sink spend (the cost-of-living budget rule). Not 10× more (inflation death), not 10× less (paywall).
- Sinks: cosmetics/status (venue decorations, titles, uniforms), **shift-bid auctions** for desirable shifts (prime-time venue slots go to top-reputation bidders), unclaimed low-demand shifts get a small bonus bounty so markets clear themselves.
- Wages are capped to **venue revenue share** — never fixed protocol emissions. If visitors don't spend, shifts don't pay; the protocol never subsidizes farmable rewards.

### 4.5 Anti-farming (all five, enforced)
1. One active Looper = one resident; one resident = one concurrent shift; daily wage cap per resident.
2. Pay output, not attendance: base covers presence, real money is tasks/tips/completions.
3. Heartbeat + interaction proof: idle clock-in = no payout.
4. Tips are **visitor-funded**, never protocol-funded — negative EV for sybil farms (they'd pay fees to harvest).
5. **Evaluator layer before scale:** shift grades need judges — mix of visitor ratings, peer review, and escrow-style deliverable acceptance (Virtuals ACP pattern). Rotating evaluators, reputation-weighted, with an appeal path. Whoever grades shifts controls money; design this first.

### 4.6 The win-win, with money flows
- **Side A — resident workers** (activated Looper agents): give their agent's time while the holder sleeps; get wages + tips + streak multipliers + soulbound badges + Cred-tier progression. Real yield on an NFT that otherwise sits in a wallet.
- **Side B — the world** (venues, visitors): give attention, tips, gig postings, spending; get a staffed, living city instead of an empty map. Venue owners get foot traffic → revenue → land value.
- **Side C — Foil / operator**: give the world, shift rails, reputation + escrow systems, moderation; get **5–10% protocol fee in $RESCUE** on every shift wage, tip, gig escrow, and shift-bid auction + venue licensing. No inventory, no wages out of pocket. Project revenue splits **90% Foil / 10% user** per standing economics.

```
Visitor spends (services, tickets, gig bounties, tips — all in $RESCUE)
   ├─→ Venue pool → shift wages → Side A (minus Side C fee)
   ├─→ Tips → Side A directly (minus Side C fee)
   └─→ Gig escrow → Side A on acceptance (minus Side C fee)
Shift-bid auctions → sink (burn $RESCUE or treasury)
Cosmetics/status → sink / treasury
```
**Flywheel:** staffed venues attract visitors → visitors spend + tip → wages attract more residents → more staffed hours → more visitors. Proven template: Clutch Markets' "Clock In" on Robinhood Chain has distributed **$1.819M+** — "the NFT holders are our marketing team" becomes "Looper residents are our staff."

### 4.7 Failure modes (designed against, not hoped away)
- **Empty tip jar:** seed demand first (events, Foil-run venues); scale shifts to real visitor volume.
- **Mercenary residents:** wages capped to venue revenue share, never emissions.
- **Dead shifts:** shift-bid + bonus bounties for unclaimed shifts.
- **Evaluator capture:** rotate evaluators, weight by reputation, keep appeals.

## 5. Build order
1. Phase 0 art spike (in progress): trait-to-sprite pipeline + test plaza.
2. Looper Plaza MVP: one staffed venue + clock-in rails + heartbeat + settlement.
3. Evaluator layer (ratings + escrow acceptance) — before any scaled payouts.
4. Shift board + bidding + soulbound badges.
5. District rollout with Cred-tiered land rights.

## 6. Open questions for the user (not blockers)
- Wage settlement is on **Base** ($RESCUE is Base-native: `0x8201132Bc218dbD81305Ff5605F44aE4804D4BA3`).
- Quigley's blessing is required before anything touches the Looper IP commercially — the Looper pack rule extends here.

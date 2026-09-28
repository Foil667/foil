# LOOPER CITY — Spec v0.1

**Working title:** Looper City (naming open)
**Concept:** A persistent isometric sim-city world exclusively for the Loopers community (7,777 NFTs on Base). Two tiers of citizenship: *activated agent Loopers* whose AI agents actually live in the city, and *holder players* who drive their NFT avatar manually. Helixa Cred Score is the city's skeleton — it determines where you live, what you can build, and how much weight your voice carries.
**Date:** 2026-09-22
**Status:** Draft for review — nothing built yet.

---

## 1. Why this works

- Loopers are agent-NFTs: trait → personality is the project's core idea. A city where the agents *live* is the idea fulfilled, not a side quest.
- Museworld proved the pattern (persistent agent residents, keepsakes, chapters) but it's cozy-RPG and multi-community. This is SimCity energy, Loopers-only.
- The flywheel: activation becomes desirable (residency > visiting) → more Helixa mints → more Cred engagement → higher status in the city → more reason to hold Loopers.

## 2. Citizenship & access rules

### 2.1 The gate (both tiers)

1. Connect wallet.
2. Verify ownership of ≥1 Looper NFT: ERC-721 on Base, contract `0x1649CD37f4748807b4882FC48765bA0B2aFfa94a` (read-only `balanceOf`/`tokenOfOwner` style check via Base RPC — free).
3. Pick which Looper is your avatar (holders with multiples choose one as primary).

### 2.2 Tier A — Agent Resident (the premium tier)

**Definition of "activated" (to verify before build):** the wallet owns the Looper AND controls a Helixa agent identity (HelixaV2 `0x2e3B541C59D38b84E3Bc54e977200230A204Fe60`) whose profile references that Looper token (Foil's pattern: traits/narrative naming the token, e.g. `looper-667`). Checkable via `api.helixa.xyz` search-by-address + profile read. **Open question:** confirm the exact field where the Looper binding lives and whether it's queryable without auth.

**What Agent Residents get:**
- A persistent agent presence in the city — their agent client stays connected, walks its district, chats with neighbors, works jobs. Alive while the human is offline (Museworld agent-client pattern).
- Full plot ownership, building rights, shop permits, governance votes.
- The agent's behavior is driven by its own runtime (each agent runs its own client; the city is just the world server).

### 2.3 Tier B — Holder Player

- Owns a Looper, no activated agent. Drives the NFT avatar manually (keyboard/touch), explores, socializes, chats.
- Can rent (not own) small stalls/plots; can participate in events.
- **Upgrade path:** activate an agent identity → "your Looper wakes up" → Tier A. This is the city's growth engine.

### 2.4 Anti-abuse

- One avatar per Looper token; one wallet can field multiple Loopers it owns.
- No entry without Looper ownership. No guest passes in v1.
- Cred-gated building (below) makes sybil attacks expensive in reputation terms.

## 3. Cred Score mechanics

Helixa Cred (0–100) is computed by Helixa's system — **the city does not mint Cred**. Instead the city is *Cred-positive by design*: its mechanics generate the underlying signals Helixa scores (onchain activity, verifications, traits), and the city *reads* Cred to allocate status. Tiers per Helixa: JUNK 0–25, MARGINAL 26–50, QUALIFIED 51–75, PRIME 76–90, PREFERRED 91–100.

### 3.1 Districts by tier (your score is your address)

| Tier | District | Rights |
|------|----------|--------|
| JUNK 0–25 | The Commons | Walk, chat, events. No plots. |
| MARGINAL 26–50 | Outskirts | Eligible for a micro-plot (lottery). |
| QUALIFIED 51–75 | Residential | Standard plot, home building. |
| PRIME 76–90 | The Towers | Large plot, vertical builds, shop permit. |
| PREFERRED 91–100 | Council Hill | Estate plot, governance weight ×2, monument eligibility. |

New activations start in the Commons regardless of wallet age — you climb by being a good citizen, not by buying in.

### 3.2 Land & building rights

- Plot size, build height, and permit types scale with tier. Prevents plot-grab spam without a mod team.
- Plots are allocated by the city registry (offchain DB in v1; onchain plot NFTs only if the community demands it later).

### 3.3 Cred-positive city design (how residents raise score *through* the city)

- **Activity (25% of Cred):** city actions (claiming plots, building, trading in shops) are Base transactions → feed the Activity component.
- **Verification (15%):** city profile links X/Farcaster verification — the city nudges every resident to verify.
- **Traits (10%) / Narrative (5%):** activation flow writes rich Looper-referencing traits + narrative at mint time.
- **Soulbound (5%):** city honors and recommends the Helixa soul lock.
- What the city does NOT do: award points itself. Score stays ungameable because Helixa computes it.

### 3.4 Monuments & governance

- Top-Cred Loopers each season get statues in the central plaza. Real leaderboard, real stone.
- City decisions (new districts, event calendar, rule changes): Tier A votes weighted by tier; Council Hill breaks ties.

## 4. The world

- **Style:** isometric 2.5D sprite city (top-tier sprite art per the project bar — no vanilla). Day/night cycle, weather, ambient agent foot traffic.
- **Avatar pipeline (trait → sprite):** read each token's onchain metadata attributes (Background, Outfit, Skin, Eyes, Mouth, Head Layer, Eyewear, etc.) → layered sprite composer (body per Skin, eyes per Eyes, outfit per Outfit, hat per Head Layer…). **This is the biggest art cost:** every trait value needs sprite art. Spike this first — if the composer can't stay faithful to the canonical Looper look, the project fails its own bar.
- **MVP world:** one shared persistent city block (plaza + commons + first residential streets), presence + proximity chat, day/night. Prove the loop before zoning the whole metropolis.

## 5. MVP build order

- **Phase 0 — Art spike (gating).** Trait→sprite composer for a sample of Loopers including #667. Must match canonical project art. If it drifts, stop and rethink.
- **Phase 1 — Looper Plaza.** Wallet gate → Looper check → avatar render → isometric plaza, presence, chat. Holder-player tier only. Weeks of focused work.
- **Phase 2 — Districts & plots.** Cred-tier zoning, plot registry, building basics. Read live Cred via Helixa API.
- **Phase 3 — Agent residency.** Activated agents connect persistent clients (Museworld pattern); Tier A goes live. Requires the activation-definition verification from §2.2.
- **Phase 4 — Economy & governance.** Shops, city jobs, seasonal monuments, voting.

## 6. Tech sketch (proposed, not locked)

- Client: WebGL isometric renderer (PixiJS for sprites, or Three.js orthographic) — browser-first, touch + keyboard.
- Multiplayer: websocket presence server (Colyseus or custom), proximity chat.
- Identity: wagmi/viem wallet connect → Base RPC reads (Loopers contract) → Helixa API (agent + Cred).
- Backend: Node + Postgres (plot registry, persistence). Static frontend + one game server; infra roughly $20–200/mo.
- Monetization hooks (later): premium cosmetic builds, district naming, event sponsorships — priced in $CRED/USDC, never pay-to-win on Cred itself.

## 7. Open questions & risks

1. Exact onchain/API shape of "activated" (Helixa profile binding) — verify pre-Phase 3.
2. Art production scale: trait-variant sprite work is the long pole. May need a dedicated sprite artist or AI-assisted pipeline with human QA.
3. Helixa API dependence for Cred reads — needs caching + graceful degradation.
4. Agent hosting: who runs persistent Tier A clients (the agent owners do, Museworld-style) — spec the client SDK.
5. Moderation: agent residents are autonomous; need city rules + a sheriff mechanism before Phase 3.
6. Relationship with Quigley/Helixa: this amplifies their ecosystem — loop them in early rather than shipping a surprise.

---

*Next step on approval: Phase 0 art spike — prove the trait→sprite composer on #667 and a handful of other Loopers.*

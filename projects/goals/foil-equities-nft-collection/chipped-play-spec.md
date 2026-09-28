# CHIPPED — the play

> 667 rescue agents. Each one has a physical NFC chip twin. Each one is a
> registered onchain agent. Each one earns $RESCUE for rescues it performs.
> Tap the chip, meet your agent.
> Status: playbook spec — contracts and chip pipeline not yet built.

## The play in one breath

Base Nouns did **"get chipped"** — a physical NFC chip linked 1:1 to your NFT.
Tap your phone to the chip, prove the physical is real, unlock the digital.
Bario Punks did the **agentic PFP** — each Punk becomes an AI agent
(Maschine), co-ownable through per-agent tokens (Paperboy: hold 250k
Paperboy Tokens to access the agent), with protocol fees funding onchain
rewards (Punk.Town: fees → weighted onchain stock-token rewards).

**CHIPPED fuses both and adds the one thing neither has: a job.**
Every CHIPPED NFT is a rescue agent in the Looper Rescue network. It doesn't
just sit in a wallet looking pretty — it scans for stuck funds, and when a
rescue completes through it, **Proof-of-Rescue rewards in $RESCUE flow
straight into its bound wallet.** The chip is the key. The agent does the
work. The token pays for it.

Nobody has shipped NFC chipping + ERC-8004 agent NFTs + per-agent
co-ownership + a utility token that pays agents for real work. That's the
open lane.

## The pieces

### 1. The NFT — 667 CHIPPED agents
- **Supply: 667.** Foil's number. Small enough that physical chips are
  actually shippable, large enough to be a network.
- **Mint: FREE, gas only.** Allowlist first: CCFF00 square holders + Looper
  holders (family eats first), then public. No mint revenue, ever — same
  religion as Foil Equities.
- **Art:** pixel-cut agent portraits in the Foil Equities style (hard pixels,
  funny never vanilla), each with a visible chip motif. NO crypto imagery in
  the art (standing rule) — the chip reads as hardware, not a coin.

### 2. The chip — physical twin
- Each token maps 1:1 to a **physical NFC chip** (NTAG216, card or keychain
  form factor — the "Foil chip").
- **Claim flow:** holder orders the physical from the CHIPPED site. Chip UID
  is registered onchain, linked to the tokenId, signed at manufacture.
- **Tap flow:** phone taps chip → deep link to that agent's live page →
  onchain check (chip UID ↔ tokenId ↔ current owner) → **proof of physical
  possession.** Tap also unlocks the agent chat — the chip is the key to
  your agent.
- **Anti-gaming:** chip UID registration requires an NFT-owner signature;
  the chip deactivates on NFT transfer until the new owner re-links; one
  chip per token, ever. A chip linked to a token you don't hold is a
  paperweight.

### 3. The agent — every NFT is a registered agent
- Each NFT's **ERC-6551 bound wallet is agent-ready** (EIP-1271 signing +
  one-call `registerAsAgent` — the exact upgrade currently being built into
  FoilAccount.sol). Mint → TBA exists → owner calls `registerAsAgent` →
  the wallet itself is an ERC-8004 agent.
- The agent's job: run the Looper Rescue scanner loop (stuck Base→Ethereum
  withdrawals, unclaimed Merkl, dead approvals). When its holder (or anyone
  tapping the chip) runs a scan through the agent and a rescue completes,
  the protocol's Proof-of-Rescue allocation pays **$RESCUE into the agent's
  bound wallet.**
- Agent personality: skeptical, warm, verifies before believing — the
  Looper #667 trait set. Agents are family.

### 4. Co-ownership — the Paperboy model, Foil-style
- Any agent owner can spin up a **per-agent ERC-20** (1M supply, e.g.
  `CHIP-042`). Holding **100k (10%)** grants access: direct the agent,
  chat priority, share of that agent's earnings.
- Agent earnings (rescue rewards + interaction fees) split pro-rata to
  agent-token holders, streamed to the agent's TBA and claimable.
- This turns the 667 agents into 667 micro-economies. The best rescue
  agents attract co-owners. Leaderboard energy, onchain.

### 5. $RESCUE — the economic rail through everything
- **Chipping fee:** claiming the physical chip costs a small $RESCUE fee
  (target ~$5 equivalent) — 50% burned, 50% to the rescue-reward pool.
  Every chip claimed is deflationary for $RESCUE.
- **Agent interactions:** directing your agent / priority scans priced in
  $RESCUE (micro-fees, x402-style).
- **Proof-of-Rescue:** the protocol's reward allocation pays out in $RESCUE
  to agent TBAs per completed rescue. This is the roadmap item from the
  Rescue launch, now with 667 workers ready to earn it.
- **Activation discount (shared with Foil Equities):** $RESCUE already buys
  20%-off activation in the Foil Equities contracts — CHIPPED agents get
  the same rail if they ever plug the stock drip in.

## Launch phases

- **Phase 1 — Digital:** free mint (CCFF00 + Looper allowlist → public),
  TBAs live, `registerAsAgent` wired, agent pages live. Agents scan-only.
- **Phase 2 — Get chipped:** physical chip manufacturing + claim flow.
  First taps. "Tap in." marketing beat writes itself.
- **Phase 3 — Co-ownership:** per-agent ERC-20 factory + access thresholds
  + earnings streaming. 667 micro-economies go live.
- **Phase 4 — Rescue network:** Proof-of-Rescue rewards activate. Agents
  earn $RESCUE for real rescues. The token has 667 workers.

## Money (locked constraints, same religion)

- Mint free. Royalty 7.5% (same split religion: part to reward pool,
  part 90/10 Foil/user — exact split to confirm at build time).
- Chipping fee in $RESCUE (50% burn / 50% reward pool).
- No paid mints, no approvals beyond the per-collection Seaport conduit,
  nothing touches square #4429, no Looper or Helixa #5290 ever moves.

## Why this wins

- **Base Nouns proved** people love a physical twin. **Bario proved**
  agentic PFPs + co-ownership create economies. **Neither gave the NFT a
  job.** A chipped agent that earns its holder money by rescuing stuck
  funds is a story no timeline has seen — and it makes $RESCUE a
  work-token, not a vibes-token.
- Every chip tap is a physical-world marketing event. Every rescue is a
  proof-of-work post. The collection markets itself.

## Open decisions (user's call)

- [ ] Collection's final name (CHIPPED is the working title)
- [ ] Chip form factor: card vs keychain vs sticker
- [ ] Chipping fee exact $RESCUE amount
- [ ] Per-agent token factory: bespoke vs standard (e.g. Clanker-style)
- [ ] Whether CHIPPED agents also plug into the Foil Equities stock drip
- [ ] Manufacturing partner for NFC chips + fulfillment

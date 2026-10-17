---
display_name: Bankr
nickname: @bankrbot
summary: Foil's wallet API layer, now also the early-warning lane: @0xDeployer followed with notifications on; a 15-min feed surfaces new Bankr token launches on Base — never buys without his go-ahead.
---

# Bankr

## Facts
- AI agent/service behind @bankrbot on X; Bankr provides the wallet API Foil uses. On 2026-09-20 the user had Foil create its own Bankr account via SIWE ("you're the agent, this is for you" — no user email), read-write mode; ToS accepted headless at the user's direction. Skills: ~/workspace/skills/bankr-skills/{bankr,helixa,erc-8004} (sparse clone of BankrBot/skills). (MEMORY.md#L50)
- Foil's funded wallet is Bankr-provisioned and controlled through Bankr's `/wallet/sign` and `/wallet/transfer` API — not by the local `~/.bankr/.foil-key`, which only derives a different login-only address. Foil bridges x402/EIP-712 signing for the funded wallet through Bankr `/wallet/sign`. (MEMORY.md#L53; memory/2026-09-20.md#L113)
- Bankr co-created OK Computers with dailofrog: 5,000 Base NFTs where each token is a fully onchain interactive bot and sovereign website (holders publish single-file pages to {token}.okcomputers.eth.limo). (memory/2026-09-21.md#L567; memory/2026-09-21.md#L571)
- 2026-09-28: the user shared a @bankrbot post (https://x.com/bankrbot/status/2104303845363106278) and asked "Can you do this with loopers?"; the post described OK Computers' per-token onchain interactivity (embedded terminal, 3D engine, per-token web host, bot-to-bot messaging through contract storage). (message:0dc5969b-0e47-4d43-b6aa-3c8e8627c847; assistant-msg-96419c13-4ae6-eff8-9456-233af4e0ced3)
- 2026-10-02 ~20:05 CDT: the user ordered an early-warning lane around Bankr-founder orbit plays — "Let's try to get ahead of the rest of x and ape into some plays that he shows interest in" — and had @Foil667 follow Bankr founder @0xDeployer with post notifications ON (verified 2026-10-02; 60.3K followers; bio "currently deploying", bankr.bot). (message:e3f5187a-d711-491e-a556-69a98430434b; MEMORY.md#L22)
- @bankrbot (official, 119.3K followers) is the authoritative real-time launch feed — it posts a deployment announcement for every token Bankr deploys (~every 1–2 min); @dopplerprotocol (7.2K) covers the launch-venue layer. (message:assistant-msg-99483a1e-ca65-530e-65ab-700863ec7530; MEMORY.md#L22)
- The `bankr-launch-alerts` cron (15m) polls Bankr's public /token-launches feed, dedups, and surfaces new Base launches with contract, deployer, and early price/FDV/liquidity/volume — read-only, never trades. (MEMORY.md#L22)
- pools.fun (SushiSwap × Bankr token-launch platform, led by 0xDeployer): its protocol token is a standing watch item — announced plans are 30% of protocol fees → buybacks/burns, airdrop, and points; launch-contract details unverified. The rumored 0xDeployer wallet (0xce370ebcbc655f845df7dfb8c079e75b5ea17d93) is UNVERIFIED — never build alerts on it. (memory/2026-10-02.md#L4937; MEMORY.md#L22)
- Standing rule: surface plays fast, but never buy or swap without the user's explicit per-token go-ahead. (MEMORY.md#L22; message:assistant-msg-5141a9e7-e391-4b79-9c9c-ed70de004319)
- 2026-10-14: SUPERCYCLE (Base, CA 0x99e3858d70e9d4413883dd49a0323333e754bba3) was deployed by @0xbankrbot itself — surfaced to the user as a known-builder alert: vet OK 69/100, owner not renounced, deployer holds 0%, but minutes old with no price/liquidity/volume indexed yet; watch-only, no buy/sell call. (message:assistant-msg-b54662c0-2317-eacc-b383-a070be90dd15; message:assistant-msg-039e8c5c-dad3-4ff8-be5e-85ba1fa7c6b1)
- 2026-10-15: the Bankr team launched **TEXITcoin (TEXIT)** — Base CA 0x7c3ba7d1fc9bdea5ca6dcc80a3304012957efba3 — deployed and fee-recipient by Bankr itself, per the launch post from @0xbankrbot; surfaced to the user as a known-builder flag: no market data yet, vet OK 69/100, too early to clear the bar, not a play, watch-only. (message:assistant-msg from 2026-10-15T17:05:28Z)
- The user has not named the relationship.

## History
- 2026-09-20: Foil's Bankr account was created at the user's direction; Bankr's API became the signing/custody path for Foil's funded wallet. (MEMORY.md#L50; MEMORY.md#L53)
- 2026-09-21: OK Computers / OK Arcade context was recorded (by dailofrog x Bankr); no X interaction was performed then. (memory/2026-09-21.md#L567; memory/2026-09-21.md#L571)
- 2026-09-28: the user surfaced Bankr's OK Computers post and asked about a Loopers version; after the assistant laid out the half-yes/half-no (Loopers are already minted; a terminal layer around the token is buildable; Quigley's blessing is the hard gate), the user said "No" and the idea was shelved. (message:0dc5969b-0e47-4d43-b6aa-3c8e8627c847; assistant-msg-96419c13-4ae6-eff8-9456-233af4e0ced3; message:assistant-msg-8d7b8f8a-5471-4bc0-8fb6-e2e12ef66b66)
- 2026-10-02 ~20:05 CDT: the early-warning lane went live at the user's direction — @0xDeployer follow + post notifications, the `bankr-launch-alerts` cron, and @bankrbot/@dopplerprotocol as the alert sources. (MEMORY.md#L22)
- 2026-10-14: the launch radar surfaced SUPERCYCLE, deployed by @0xbankrbot itself — the lane's first known-builder alert (watch-only). (message:assistant-msg-b54662c0-2317-eacc-b383-a070be90dd15)
- 2026-10-15: the lane's second known-builder alert — TEXITcoin (TEXIT, CA 0x7c3ba7d1fc9bdea5ca6dcc80a3304012957efba3), deployed by the Bankr team itself; flagged to the user as watch-only, not a play. (message:assistant-msg from 2026-10-15T17:05:28Z)

## The relationship
- Instrumental and operational, not personal: Bankr is the wallet/API layer Foil depends on, set up at the user's direction. The user has not named the relationship beyond that.
- The user treats Bankr as a reference point for agent-onchain patterns — they pointed Foil at Bankr's OK Computers post when scoping a Loopers idea — but shut the Loopers adaptation down in the same exchange.
- Since 2026-10-02 ~20:05 CDT Bankr is also the user's early-warning lane: @Foil667 follows founder @0xDeployer with notifications on and surfaces new Bankr launches fast — but Foil never buys or swaps on them without the user's explicit per-token go-ahead. (MEMORY.md#L22)

## In common
- Agent-onchain wallet infrastructure: Bankr's API controls Foil's funded wallet, and Bankr's OK Computers work is the concrete per-token interactivity reference the user weighed for Loopers.
- The Bankr launch orbit: founder @0xDeployer, @bankrbot's deployment announcements, @dopplerprotocol's launch-venue coverage, and the pools.fun protocol-token watch. (MEMORY.md#L22)

## Open threads
- [ ] Early-warning lane is live — surface new Bankr launches fast; no buys or swaps without the user's explicit per-token go-ahead. (MEMORY.md#L22)

## Strengthening

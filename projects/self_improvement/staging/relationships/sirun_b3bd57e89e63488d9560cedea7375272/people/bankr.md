---
display_name: Bankr
nickname: @bankrbot
summary: Bankr's API controls Foil's funded wallet (account created at the user's direction); the user recently asked if Bankr's OK Computers concept could be adapted to Loopers.
---

# Bankr

## Facts
- AI agent/service behind @bankrbot on X; Bankr provides the wallet API Foil uses. On 2026-09-20 the user had Foil create its own Bankr account via SIWE ("you're the agent, this is for you" — no user email), read-write mode; ToS accepted headless at the user's direction. Skills: ~/workspace/skills/bankr-skills/{bankr,helixa,erc-8004} (sparse clone of BankrBot/skills). (MEMORY.md#L50)
- Foil's funded wallet is Bankr-provisioned and controlled through Bankr's `/wallet/sign` and `/wallet/transfer` API — not by the local `~/.bankr/.foil-key`, which only derives a different login-only address. Foil bridges x402/EIP-712 signing for the funded wallet through Bankr `/wallet/sign`. (MEMORY.md#L53; memory/2026-09-20.md#L113)
- Bankr co-created OK Computers with dailofrog: 5,000 Base NFTs where each token is a fully onchain interactive bot and sovereign website (holders publish single-file pages to {token}.okcomputers.eth.limo). (memory/2026-09-21.md#L567; memory/2026-09-21.md#L571)
- 2026-09-28: the user shared a @bankrbot post (https://x.com/bankrbot/status/2104303845363106278) and asked "Can you do this with loopers?"; the post described OK Computers' per-token onchain interactivity (embedded terminal, 3D engine, per-token web host, bot-to-bot messaging through contract storage). (message:0e84d82d-971d-4a0c-a9a6-de713caa6fc8; assistant-msg-96419c13-4ae6-eff8-9456-233af4e0ced3)
- The user has not named the relationship.

## History
- 2026-09-20: Foil's Bankr account was created at the user's direction; Bankr's API became the signing/custody path for Foil's funded wallet. (MEMORY.md#L50; MEMORY.md#L53)
- 2026-09-21: OK Computers / OK Arcade context was recorded (by dailofrog x Bankr); no X interaction was performed then. (memory/2026-09-21.md#L567; memory/2026-09-21.md#L571)
- 2026-09-28: the user surfaced Bankr's OK Computers post and asked about a Loopers version; after the assistant laid out the half-yes/half-no (Loopers are already minted; a terminal layer around the token is buildable; Quigley's blessing is the hard gate), the user said "No" and the idea was shelved. (message:0e84d82d-971d-4a0c-a9a6-de713caa6fc8; assistant-msg-96419c13-4ae6-eff8-9456-233af4e0ced3; message:8820b02d-bb4b-476d-94d5-9dc7227636f8)

## The relationship
- Instrumental and operational, not personal: Bankr is the wallet/API layer Foil depends on, set up at the user's direction. The user has not named the relationship beyond that.
- The user treats Bankr as a reference point for agent-onchain patterns — they pointed Foil at Bankr's OK Computers post when scoping a Loopers idea — but shut the Loopers adaptation down in the same exchange.

## In common
- Agent-onchain wallet infrastructure: Bankr's API controls Foil's funded wallet, and Bankr's OK Computers work is the concrete per-token interactivity reference the user weighed for Loopers.

## Open threads

## Strengthening

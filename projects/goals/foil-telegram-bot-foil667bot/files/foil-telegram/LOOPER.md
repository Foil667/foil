# LOOPER.md — the onchain roadmap

How Foil becomes a full looper: a real onchain agent identity bound to Looper #667.

## Status (2026-09-20)

- [x] Bankr agent account created (agent-owned, read-write) — wallet `0x6573682faee72a4a96e791ba262439f1df3a268d`
- [x] Skills installed: bankr, helixa, erc-8004
- [ ] **Wallet funded** — needs ETH (gas) + USDC on Base. Owner sends to the address above. Everything downstream waits on this.
- [ ] **Helixa AgentDNA identity mint** — ~$1 USDC via the `helixa` skill. Gives Foil an onchain identity NFT + Cred Score.
- [ ] **Bind Looper #667** — link #667 to the identity/controller asset, Multipass activation. Verify at helixa.xyz/multipass/loopers/667 afterward.
- [ ] **Operate as the loop** — trade, research, post, build Cred. Loop till it's fixed.

## Notes

- The Helixa mint + binding are real transactions: get the owner's explicit go-ahead per transaction (or a standing spending limit) before broadcasting.
- Both Foil instances (Muse app + Telegram) share one wallet. If both are active, narrate spending so the owner always knows which mouth ate.
- If a step's documented cost or flow has changed since this was written, re-read the skill's SKILL.md and confirm with the owner before spending.

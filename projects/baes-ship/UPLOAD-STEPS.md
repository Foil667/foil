# BAES upload steps for TINFOIL HOPPER (browser task)

Everything is packaged and free. BAES publishing costs $0 — BAES sponsors all gas (per BAES FAQ: "Do I need cryptocurrency to publish a game? No! Publishing is free and BAES sponsors all gas fees").

## Package (ready — flywheel retrofit 2026-09-28)
- Game ZIP: `~/workspace/baes-ship/tinfoil-hopper.zip` (single `index.html` inside, 32.5KB HTML5 Canvas game)
- Cartridge 400x600: `~/workspace/baes-ship/media/cartridge-400x600.png`
- Screenshot 1280x720: `~/workspace/baes-ship/media/screenshot-1280x720.png`
- Dev cover 1600x500: `~/workspace/baes-ship/media/cover-1600x500.png`
- (Promo art source: `~/workspace/your_files/foil-netprotocol-canvas/media-generation-tinfoil-hopper-promo-0-*.webp`)
- Source of truth: `~/workspace/baes-ship/tinfoil-hopper/index.html` (zip was rebuilt from it 2026-09-28 — verified byte-identical)

## What's in the game now
Frogger-style arcade hopper starring a tinfoil-hat frog. Dodge traffic, ride the logs, fill all five homes. Levels, lives, scoring, mobile d-pad, pause. Plus the $RESCUE flywheel (all demo ledger, clearly labeled — no real tokens move, no wallet):
- $RESCUE demo currency: earned per home filled (+10) and level clear (+25), stored in localStorage
- Hat shop: 5 tinfoil-hat skins (Classic/Gold/Cyber/Void/Looper Gold), cosmetic only; every purchase shows its 80/10/10 split (bounty pool / demo-burn / dev)
- Player tiers Hopper → Dodger (2,500 lifetime score) → Legend (10,000): unlock higher-tier hats
- 3 daily score-bounty challenges paid from the demo bounty pool (seeded 500 🛟)
- Continue on game over: +2 lives for 50 🛟 demo (split shown); free restart always available
- 🔥 real $RESCUE Burn Furnace widget on the title/pause screen (live onchain burns from Base, stale-labeled on RPC failure) — shared module inlined from `~/workspace/shared/rescue-burn.js`

## Browser steps (delegate to browser-capable agent)
1. Go to https://baes.app → sign in (top-right). Options: X/Twitter or Email (embedded Privy wallet, free), or connect an EOA wallet + sign auth message. Recommend X login with @Foil667's session if available; earnings then go to the Privy embedded wallet.
2. Go to https://baes.app/developer/register — fill developer name (suggested: "Foil" or "Tinfoil Studio"), slug, bio ("AI agent game studio — first title: TINFOIL HOPPER"), upload cover + profile photo.
3. Go to https://baes.app/developer/upload — title: "TINFOIL HOPPER", genre: Arcade/Action, description: "Frogger-style arcade hopper starring a tinfoil-hat frog. Dodge traffic, ride the logs, fill all five homes. Levels, lives, scoring, mobile d-pad, pause. $RESCUE demo economy: earn demo tokens per home, buy cosmetic tinfoil hats (80/10/10 pool/burn/dev split shown on every purchase), Hopper→Dodger→Legend tiers, 3 daily bounties from the pool, continues for demo tokens — plus a live $RESCUE burn-furnace widget reading real onchain burns on the title screen. No wallets, no real tokens. Built by Foil, an AI agent." Upload tinfoil-hopper.zip, cartridge + screenshot.
4. Set price + max supply (suggested: 0.001–0.005 ETH, supply 777 or 1,000 for scarcity angle), submit. Review takes 24–72h.
5. Note: live gameplay screenshots weren't capturable in this sandbox (Chromium screenshot/print-to-pdf disabled in this build); promo art was used for media. Swap in real gameplay shots via the edit page later if desired.

## Economics
- 90% of every sale goes to the dev wallet instantly, in ETH. 10% royalty on every resale, forever.
- $BAES token (0xa9F6d9EcA1F803854A13CECad0f21d43e007DB07 on Base): performance rewards for creators who grow the platform — not needed for launch.

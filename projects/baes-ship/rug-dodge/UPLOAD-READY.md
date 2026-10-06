# RUG DODGE — UPLOAD-READY

Status: **built, tested, packaged. NOT published** — upload to baes.app is a
separate user-approved step (see `~/workspace/baes-ship/UPLOAD-STEPS.md`).

## What's packaged

- `index.html` (47,029 bytes) — complete single-file HTML5 Canvas game. No
  external assets, no CDN deps, no build step needed at serve time. The only
  network URLs in the file: an `https://x.com/Foil667` footer link and the
  Base RPC `https://mainnet.base.org` used read-only by the burn furnace
  widget. No fetch/CDN/fonts at runtime.
- `rug-dodge.zip` — contains **only** `index.html`, byte-verified identical
  to the built source (rebuilt by build.sh, re-zipped 2026-10-03 ~22:50 CDT).
- `media/cartridge-400x600.png` — cartridge/box art (exact 400×600).
- `media/screenshot-1280x720.png` — 16-bit gameplay key art (exact 1280×720).
- `media/cover-1600x500.png` — developer cover banner (exact 1600×500).
- `media/gameplay-capture.png` — **real in-engine capture** (888×890) taken
  from headless Chromium driving actual gameplay (frog, shield, rugs,
  telegraphs, near-miss/shield floaters all live-rendered).
- `src/` — build sources (`head.html` + `game.js`); `build.sh` reassembles
  `index.html`. `test/smoke.mjs` — the 28-assertion headless test suite.

## Suggested BAES listing fields

- **Title:** RUG DODGE
- **Genre:** Arcade / Action
- **Description (draft):** "You're a tinfoil-hat frog and the rugs are
  falling. Dodge the rug-pull rain in escalating waves, grab VERIFY shields
  to reveal the safe lanes (but watch out — some magnifiers are MIMICS 😤),
  chain near-miss combos, and survive. Earn demo $RESCUE per wave, spend it
  on cosmetic hat skins, and chase daily score bounties from the pool. Verify
  before you believe."
- **Suggested price:** 0.001–0.005 ETH
- **Suggested supply:** 777 or 1,000

## Game summary

16-bit pixel-art arena dodge-em-up (416×416 canvas). Frog moves free in
8 directions (WASD/arrows + drag-to-move on touch). Rugs rain from the top
in escalating waves with fair telegraphed warning stripes; rug types: roll
(straight), zig (sine), fast (wave 4+). FUD imps drift across mid-arena from
wave 3. Pickups: VERIFY shield (6s invuln + green safe lanes), heart (+1
life), and rug-pull MIMICS disguised as shields that burst into fast rugs —
"verify before you believe." Near-miss combos with escalating score,
particles, screen shake, hit-stop, hit flash, i-frames, wave banners, and
chiptune-style square-wave SFX. 3 lives, pause (P/button), panels pause the
game, mobile-friendly layout.

$RESCUE flywheel (demo ledger in localStorage — no real tokens, no wallets):
earn per wave (+10) and milestones (+25 every 5 waves); cosmetic hat shop
with the 80/10/10 split shown on every purchase (bounty pool / demo-burn /
dev); Hopper/Dodger/Legend tiers unlocking skins; seeded daily score
bounties paid from the pool; continue-after-game-over for 50 demo $RESCUE,
free restart always available; live $RESCUE Burn Furnace widget (shared
`~/workspace/shared/rescue-burn.js` inlined byte-verbatim) on title/pause/
game-over screens, honestly labeled stale/offline when the RPC is
unreachable — numbers are never invented.

## Test results

- `node --check` on game source: clean.
- 28-assertion DOM-shim suite (`test/smoke.mjs`): **all pass** — lifecycle,
  collisions, shield, mimic burst, near-miss combo, wave clear + payout,
  game over, continue, restart-arm guard, bounties, shop/tier gating, pause,
  all render states.
- 2026-10-03 ~22:50 CDT (networked host): **live burn-sync path verified
  for the first time** — `RescueBurn.getStatus()` against real Base hit all
  40 log chunks in ~23s: `ok:true, stale:false, total "0.00", txCount 0`.
  Zero $RESCUE burns exist onchain as of block 52,189,282 (independent raw
  `eth_getLogs` cross-check agreed); the in-game widget will honestly show
- Real headless Chromium (chrome-headless-shell, current 47,029-byte build):
  page loads with **zero page errors / zero uncaught exceptions**; 900
  frames driven live via `#testhook` → wave 2, pause/unpause, game over,
  restart-arm guard all verified; canvas renders real pixels (title
  screenshot captured 2026-10-03: frog sprite, HUD, eco bar, Burn Furnace
  widget "syncing with Base…").
- 2026-10-03 ~22:50 CDT polish pass (no Chromium re-run after the edit;
  changes are input handlers + DOM label sync only, all covered by the
  DOM-shim suite): anti-accidental-restart guard (900ms arm after death —
  frantic taps right after dying no longer insta-restart), PLAY/PAUSE button
  labels follow state (▶ PLAY / ▶ RESUME / II PAUSE), auto-pause when the tab
  goes to background. Rebuilt 47,029 bytes, re-zipped, 28/28 green.
- Zip verified: single `index.html`, byte-identical to source.

## Needs a human eye

1. **Gameplay feel** — difficulty curve, frog speed, and rug density were
   tuned by sim, not by a human player. A 2-minute playtest on desktop +
   phone would confirm the fun.
2. **Burn furnace live glance** — the live-sync path now verified end-to-end
   on a networked host (ok:true, 0 burns onchain — honest "0.00 burnt
   (live)"). Worth one glance on the player's own device the first time they
   open it.
3. Media is AI key art (plus one real capture) — fine for a listing, but the
   user may want to art-direct the cartridge.

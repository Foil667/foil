# MARKET FOLKLORE — Trait Forge assembly plan

## Layer architecture (trait folders for Trait Forge)

Five folders, bottom to top render order:

1. **Background** — hard pixel environments, NO crypto imagery (no
   candles, coins, charts, tickers — user hard rule 2026-09-24): Void Grid,
   Basement, Slime Pits, Static Storm, Back Alley. (~8 variants)
2. **Character** — pixel-art archetype sprites: Whale, Bagholder,
   Diamond Hands, Oracle, Paper Hands, Insider. Chunky, aggressive,
   arcade-boss energy. (~6 variants, uneven rarity — Whale rarest)
3. **Expression** — pixel face variants: bloodshot, dead-inside, manic
   grin, sweating panic, smug. (~6 variants)
4. **Prop** — pixel props: bags, tendies box, rocket, empty wallet,
   diamond chunk. (~8 variants, "No trait chance" ~25%; no coins/charts)
5. **Overlay** — scanlines, dither, glitch, grime, vignette. (~5 variants)

Combination math: 8×6×6×8×5 = 11,520 max combos — comfortably above 667.
Smart Rarity auto-balances; verify it doesn't shrink below 667 before paying.

## Assembly: forge.mjs (ours, not Trait Forge)

User directive 2026-09-24: **"Build one yourself."** So we did —
`scripts/forge.mjs` is our own trait combiner. Same capabilities as
Trait Forge, zero per-generation fees, exact OpenSea metadata:

- **Layers:** `layers/<NN>-<Folder>/<trait>.png` — trait name = filename.
- **Rarity:** per-trait `exact` count, `targetPct`, `minPct`, or even split;
  per-folder `noTraitChance` ("None" trait); verified exact in self-test.
- **Rules:** `{ trait: "Folder.Trait", onlyWith: "Folder.Trait" }` —
  constrained traits placed only on eligible editions, topological folder
  order; 0 rule breaks in self-test.
- **Seeded + deterministic:** same seed + manifest = byte-identical run.
  Unique-combination repair with warnings when combos are exhausted.
- **Preview:** `--preview 16` renders samples + per-edition metadata.
- **Export:** `--build` writes images (webp/png/jpg) + per-edition JSON in
  exact OpenSea `attributes: [{trait_type, value}]` format +
  `collection.json` + `rarity-report.json` + `project.json` backup.
- **Synthetic trait:** Drip Tier (1–5 weighted, `display_type: number`).

Usage:
```
node scripts/forge.mjs --preview 16     # samples + report, free
node scripts/forge.mjs --build           # full 667 run
node scripts/forge.mjs --metadata-only  # JSON only, skip renders
```

Self-test: `layers-test/` (20 editions, quotas/rules/determinism all green).

## Layer production (the real art — after credit reset 2026-09-27)

## OpenSea traits (from metadata)

Archetype · Expression · Market Medium (background) · Prop · Generation
(Base/Robinhood) · Drip Tier (numeric stat). Trait_type names locked —
typos split filters.

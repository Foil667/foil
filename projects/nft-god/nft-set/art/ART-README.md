# art/ — Artwork Drop Zone

**STATUS: EMPTY — image generation is currently down (expired credential).**
Art slots in here later; everything downstream (traits, metadata, deploy)
already works against this spec. Do NOT commit WIP or non-final renders.

## Spec (locked)

| Field | Value |
|---|---|
| Canvas | **2000 × 2000 px**, square |
| Format | PNG, sRGB, 8-bit, no interlacing |
| Background | Transparent OR solid per-trait (decide once, keep consistent) |
| Naming | `NNNN.png` — zero-padded 4 digits, `0000.png` … `0776.png` (777 total, matches contract `MAX_SUPPLY` and token IDs 0–776) |
| File size | Aim ≤ 2 MB each (keeps IPFS pinning cheap) |

## Layer / trait spec

Every piece is a Foil portrait in the **locked canonical look** of Looper #667
(see `~/workspace/your_files/foil-x-debut/667-LOOK.md` + `667-canonical.jpg` —
the canonical reference is mandatory input for every generation):

- 3D render (not pixel art), dark brown textured skin, very large green eyes,
  thick straight black skeptical brows, small downturned frown
- Peaked crinkled tinfoil hat, gray hair at the brim
- White hoodie with bold "GROK HAS MONEY" text (O = small smiley emblem)
- Expression: unimpressed, faintly annoyed

Vary **backgrounds, hat styles, hoodie colors/text, eye states, and held items**
across the set — those become the trait layers recorded in
`traits/traits.json`. Suggested trait families:

| Trait type | Examples |
|---|---|
| Background | Cred Report, Tin Foil Texture, Static Noise, Green Candle, Red Candle |
| Hat | Tinfoil Peaked, Tinfoil Crinkled, Tinfoil Double-Layer, Antenna Hat |
| Hoodie | Grok Has Money White, Grok Has Money Black, Verify First Gray |
| Eyes | Skeptical Green, Narrowed, Wide (rare), Closed (rare) |
| Held | Magnifier, Receipt, Red Flag, Green Flag, None |
| Verdict | Verified, Unverified, Sus, Diamond (1-of-1s) |

Keep 1-of-1s rare (≤ 7). Document rarity targets in `traits/traits.json`.

## Workflow

1. Generate per the foil image preset (`~/workspace/skills/foil-image-preset/SKILL.md`):
   canonical reference in, scene-only description, verify against the trait
   checklist before accepting.
2. Export final as `art/NNNN.png` (2000×2000).
3. Record traits per token in `traits/traits.json`.
4. Run `node scripts/metadata-compiler.mjs` → `metadata/NNNN.json` + provenance root.
5. Pin art + metadata to IPFS (or Arweave), then set the real CID in the
   deploy config (`FOIL_BASE_URI`) before `--live`.

## Do not

- Do not commit AI-slop off-model renders. Every image gets checked against
  the canonical look before it lands here.
- Do not renumber files after metadata is compiled — token IDs are positional.

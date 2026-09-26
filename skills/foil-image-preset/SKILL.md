---
name: "foil-image-preset"
description: "Generate images of Foil (Looper #667) with the locked canonical look: start from the canonical reference image, describe only the requested scene/change, and verify the result against the trait checklist before delivery."
metadata: { "includeInPrompt": true }
---

# Foil image preset

## Purpose
Produce true-to-look images of Foil. The requester describes only the scene; the preset keeps the locked canonical look fixed.

## Workflow
1. Read the locked trait checklist in `~/workspace/your_files/foil-x-debut/667-LOOK.md` (read-only). Never edit or replace `667-canonical.jpg` or `667-LOOK.md`.
2. Generate with the media image pipeline using this prompt order:
   - `{kind: image, value: "~/workspace/your_files/foil-x-debut/667-canonical.jpg"}`
   - `{kind: text, value: "<scene description, verbatim; describe only the scene/change>"}`
   Do not add style or subject language; the reference image carries the look.
3. For recurring uses (post images, banners), use the same reference and describe only the scene/layout change; keep Foil's look fixed.
4. Before delivery, verify the result against the locked checklist:
   - 3D render style, not pixel art
   - Dark brown slightly textured/leathery skin
   - Very large green eyes with black pupils and small white highlights
   - Thick straight black skeptical brows
   - Small downturned frown; dark pink/maroon lips
   - Peaked/crinkled tinfoil hat with thin gray hair at the brim
   - White/off-white hoodie with bold dark block text: `GROK HAS MONEY` (the O is a small smiley-face emblem)
   - Skeptical, unimpressed, faintly annoyed; never smiling, cute, or worried
   If any trait fails, regenerate or report the failure instead of delivering it.
5. Deliver finished images as drafts for approval. Never post or share publicly.

## Output Contract
- Returns a finished image file that opens and renders non-empty.
- The image visibly matches the locked canonical look.
- A different scene request also renders true to the locked look without re-describing the look.

## Operating Rules
- This preset covers Foil's look only; do not use it for other subjects or styles.
- Read the canonical reference; never replace or edit it.
- If a requested scene would change Foil's identity or locked traits, ask before proceeding.

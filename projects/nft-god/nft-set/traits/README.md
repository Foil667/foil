# traits/ — Trait Assignments

`traits.json` maps token ID → attribute list, consumed by
`scripts/metadata-compiler.mjs`. See `traits.example.json` for the format.

```json
{
  "0": { "attributes": [
    {"trait_type": "Hat", "value": "Tinfoil Peaked"},
    {"trait_type": "Eyes", "value": "Skeptical Green"},
    {"trait_type": "Background", "value": "Cred Report"},
    {"trait_type": "Verdict", "value": "Verified"}
  ] }
}
```

Rules:
- Keys are token IDs as strings (`"0"` … `"776"`).
- Token IDs not listed get a default `Generation` attribute (compiler warns).
- Keep trait_type spelling consistent — OpenSea groups by exact string.
- 1-of-1s: mark with `"Verdict": "Diamond"` (≤ 7 total) and note them here.

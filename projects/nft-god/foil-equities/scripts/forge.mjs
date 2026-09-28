// forge.mjs — Foil's own trait combiner. Replaces Trait Forge (trait-forge.art).
// Free, local, no per-generation fees, exact OpenSea metadata schema.
//
// Layers live in layers/<NN>-<Folder>/<trait>.png — trait name = filename.
// Rarity/rules/quotas live in layers/manifest.json.
//
// Usage:
//   node scripts/forge.mjs --preview 16            render 16 samples + rarity report
//   node scripts/forge.mjs --build                 full edition run (images + metadata)
//   node scripts/forge.mjs --metadata-only         metadata + report, skip images
//   node scripts/forge.mjs --manifest layers-test/manifest.json --out out-test
//
// Rarity model per trait: { exact } | { targetPct } | { minPct } | even split.
// Per folder: { noTraitChance } adds a "None" pseudo-trait.
// Rules: { trait: "Folder.Trait", onlyWith: "Folder.Trait" }.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from "node:fs";
import { resolve, dirname, basename, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("/home/hatch/workspace/nft-god/grit/node_modules/sharp");

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = args.indexOf(n);
  return i === -1 ? d : (args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true);
};
const MANIFEST = resolve(ROOT, flag("--manifest", "layers/manifest.json"));
const OUT = resolve(ROOT, flag("--out", "out"));
const LAYERS_DIR = dirname(MANIFEST);
const PREVIEW_N = flag("--preview") === true ? 16 : (flag("--preview") ? parseInt(flag("--preview")) : 0);
const BUILD = args.includes("--build");
const META_ONLY = args.includes("--metadata-only");

// ---------- seeded RNG ----------
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; };
}
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// (R is seeded from the manifest after load, below)

function shuffle(arr, r) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}
function sampleIdx(n, k, r) { // k unique indices from 0..n-1
  const pool = Array.from({ length: n }, (_, i) => i);
  shuffle(pool, r);
  return pool.slice(0, k);
}

// ---------- load manifest ----------
const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const SEED = manifest.seed || "foil-forge";
const R = mulberry32(xmur3(SEED)());
const EDITIONS = manifest.editions || 667;
const SIZE = manifest.size || 1024;

const folders = manifest.folders.map((f, fi) => {
  const dir = join(LAYERS_DIR, readdirSync(LAYERS_DIR).find(d => d.endsWith("-" + f.name) || d === f.name) || f.name);
  if (!existsSync(dir)) throw new Error(`layer folder missing: ${f.name} (looked in ${LAYERS_DIR})`);
  const files = readdirSync(dir).filter(x => [".png", ".webp", ".jpg", ".jpeg"].includes(extname(x).toLowerCase()));
  const traitFiles = {};
  for (const file of files) traitFiles[basename(file, extname(file))] = join(dir, file);
  // every manifest trait must have a file
  for (const t of f.traits) if (!traitFiles[t.name]) throw new Error(`trait file missing: ${f.name}/${t.name}`);
  return { ...f, dir, traitFiles, idx: fi };
});
const folderByName = Object.fromEntries(folders.map(f => [f.name, f]));

// validate rules reference real traits
for (const rule of manifest.rules || []) {
  const [ff, ft] = rule.trait.split(".");
  const [gf, gt] = rule.onlyWith.split(".");
  if (!folderByName[ff]?.traits.some(t => t.name === ft)) throw new Error(`rule trait unknown: ${rule.trait}`);
  if (!folderByName[gf]?.traits.some(t => t.name === gt)) throw new Error(`rule onlyWith unknown: ${rule.onlyWith}`);
}

// ---------- topological folder order (required folders first) ----------
function topoOrder() {
  const deps = new Map(folders.map(f => [f.name, new Set()]));
  for (const rule of manifest.rules || []) {
    const ff = rule.trait.split(".")[0], gf = rule.onlyWith.split(".")[0];
    if (ff !== gf) deps.get(ff).add(gf);
  }
  const order = [], done = new Set();
  let guard = 0;
  while (order.length < folders.length && guard++ < 100) {
    for (const f of folders) {
      if (done.has(f.name)) continue;
      if ([...deps.get(f.name)].every(d => done.has(d))) { order.push(f); done.add(f.name); }
    }
  }
  if (order.length < folders.length) throw new Error("circular trait rules");
  return order;
}

// ---------- quota decks ----------
function buildDeck(folder, assigned) {
  // assigned: { folderName: [traitName|null per edition] } for already-built folders
  const N = EDITIONS;
  const deck = new Array(N).fill(null); // null = unfilled
  const free = () => deck.map((v, i) => v === null ? i : -1).filter(i => i >= 0);

  const noneCount = Math.round((folder.noTraitChance || 0) * N);
  const rulesFor = t => (manifest.rules || []).filter(r => r.trait === `${folder.name}.${t.name}`);

  const traits = folder.traits.map(t => ({ ...t }));
  const exact = traits.filter(t => t.exact != null);
  const mins = traits.filter(t => t.exact == null && t.minPct != null);
  const targets = traits.filter(t => t.exact == null && t.minPct == null && t.targetPct != null);
  const evens = traits.filter(t => t.exact == null && t.minPct == null && t.targetPct == null);

  const exactSum = exact.reduce((s, t) => s + t.exact, 0);
  const minSum = mins.reduce((s, t) => s + Math.floor(t.minPct / 100 * N), 0);
  if (noneCount + exactSum + minSum > N) throw new Error(`quotas exceed editions in ${folder.name}`);

  let rest = N - noneCount - exactSum - minSum;
  const quotas = new Map();
  for (const t of exact) quotas.set(t.name, t.exact);
  for (const t of mins) quotas.set(t.name, Math.floor(t.minPct / 100 * N));

  // targets get proportional share of rest, evens split what's left
  const targetSum = targets.reduce((s, t) => s + t.targetPct, 0);
  let used = 0;
  const remainders = [];
  for (const t of targets) {
    const q = targetSum > 0 ? Math.floor(t.targetPct / targetSum * rest) : 0;
    quotas.set(t.name, q); used += q;
    remainders.push([t.name, (t.targetPct / targetSum * rest) - q]);
  }
  let leftover = rest - used;
  if (evens.length) {
    const per = Math.floor(leftover / evens.length);
    for (const t of evens) { quotas.set(t.name, per); leftover -= per; }
    remainders.push(...evens.map(t => [t.name, 0.999 - evens.indexOf(t) * 0.001]));
  }
  remainders.sort((a, b) => b[1] - a[1]);
  for (const [name] of remainders) { if (leftover <= 0) break; quotas.set(name, quotas.get(name) + 1); leftover--; }

  // "None" pseudo-trait
  const allQuotas = [...quotas.entries()];
  if (noneCount > 0) allQuotas.push(["__NONE__", noneCount]);
  const qSum = allQuotas.reduce((s, [, q]) => s + q, 0);
  if (qSum !== N) { // fix rounding drift on the largest quota
    allQuotas.sort((a, b) => b[1] - a[1]);
    allQuotas[0][1] += N - qSum;
  }

  // 1. constrained traits first: only place on editions where requirement holds
  for (const t of traits) {
    for (const rule of rulesFor(t)) {
      const [gf, gt] = rule.onlyWith.split(".");
      const q = quotas.get(t.name) || 0;
      const eligible = free().filter(i => assigned[gf][i] === gt);
      if (eligible.length < q) throw new Error(`rule unsatisfiable: ${rule.trait} needs ${q} of ${rule.onlyWith}, only ${eligible.length} eligible`);
      for (const i of sampleIdx(eligible.length, q, R).map(k => eligible[k])) deck[i] = t.name;
      quotas.set(t.name, 0);
    }
  }
  // 2. unconstrained traits fill remaining slots via shuffled quota deck
  const pool = [];
  for (const [name, q] of allQuotas) { const left = quotas.get(name) ?? q; for (let k = 0; k < left; k++) pool.push(name === "__NONE__" ? null : name); }
  shuffle(pool, R);
  const slots = free();
  if (pool.length !== slots.length) throw new Error(`deck mismatch in ${folder.name}: ${pool.length} vs ${slots.length}`);
  slots.forEach((idx, k) => deck[idx] = pool[k]);
  return deck;
}

// ---------- generate ----------
const ordered = topoOrder();
const assigned = {}; // folderName -> [trait|null]
for (const f of ordered) assigned[f.name] = buildDeck(f, assigned);

// uniqueness: repair duplicate combos by swapping within folders
const comboKey = i => ordered.map(f => `${f.name}:${assigned[f.name][i] ?? "None"}`).join("|");
{
  const seen = new Map();
  let fixes = 0;
  for (let i = 0; i < EDITIONS; i++) {
    const k = comboKey(i);
    if (!seen.has(k)) { seen.set(k, i); continue; }
    // try swapping each folder's pick with a later edition until unique
    let fixed = false;
    for (const f of ordered) {
      for (let j = i + 1; j < EDITIONS && !fixed; j++) {
        [assigned[f.name][i], assigned[f.name][j]] = [assigned[f.name][j], assigned[f.name][i]];
        // check rules still hold for both editions
        if (rulesHold(i) && rulesHold(j) && ![...seen.keys()].includes(comboKey(i))) { seen.set(comboKey(i), i); fixed = true; fixes++; }
        else [assigned[f.name][i], assigned[f.name][j]] = [assigned[f.name][j], assigned[f.name][i]]; // revert
      }
      if (fixed) break;
    }
    if (!fixed) console.warn(`warn: duplicate combo kept at edition ${i + 1}`);
  }
  if (fixes) console.log(`repaired ${fixes} duplicate combinations`);
}
function rulesHold(i) {
  for (const rule of manifest.rules || []) {
    const [ff, ft] = rule.trait.split(".");
    const [gf, gt] = rule.onlyWith.split(".");
    if (assigned[ff][i] === ft && assigned[gf][i] !== gt) return false;
  }
  return true;
}

// ---------- metadata ----------
const dripTier = i => { // deterministic 1-5 weighted: 1 common … 5 rare
  const r = mulberry32(xmur3(SEED + ":drip:" + i)())();
  return r < 0.4 ? 1 : r < 0.65 ? 2 : r < 0.82 ? 3 : r < 0.94 ? 4 : 5;
};
const editionMeta = i => {
  const attrs = ordered.map(f => ({
    trait_type: f.traitType || f.name,
    value: assigned[f.name][i] ?? "None",
  }));
  attrs.push({ trait_type: "Generation", value: manifest.generation || "Genesis" });
  attrs.push({ trait_type: "Drip Tier", display_type: "number", value: dripTier(i) });
  return {
    name: `${manifest.name} #${i + 1}`,
    description: manifest.description,
    image: `${manifest.imageBase}${i + 1}.${manifest.format || "webp"}`,
    external_url: manifest.externalUrl,
    attributes: attrs,
  };
};

// ---------- render ----------
async function renderEdition(i, outPath) {
  const layers = [];
  for (const f of ordered) {
    const t = assigned[f.name][i];
    if (!t) continue;
    layers.push({ input: await sharp(f.traitFiles[t]).resize(SIZE, SIZE, { fit: "fill" }).toBuffer() });
  }
  if (!layers.length) throw new Error(`edition ${i + 1} has no layers`);
  const base = sharp(layers[0].input);
  if (layers.length > 1) base.composite(layers.slice(1));
  const fmt = manifest.format || "webp";
  const pipeline = fmt === "png" ? base.png() : fmt === "jpg" || fmt === "jpeg" ? base.jpeg({ quality: manifest.quality || 86 }) : base.webp({ quality: manifest.quality || 86 });
  await pipeline.toFile(outPath);
}

// ---------- rarity report ----------
function rarityReport() {
  const report = { seed: SEED, editions: EDITIONS, folders: {} };
  for (const f of ordered) {
    const counts = {};
    for (let i = 0; i < EDITIONS; i++) { const t = assigned[f.name][i] ?? "None"; counts[t] = (counts[t] || 0) + 1; }
    report.folders[f.name] = Object.fromEntries(Object.entries(counts).map(([t, c]) => [t, { count: c, pct: +(c / EDITIONS * 100).toFixed(2) }]));
  }
  return report;
}

// ---------- run ----------
const t0 = Date.now();
mkdirSync(OUT, { recursive: true });
const t = manifest;
const doImages = BUILD || PREVIEW_N > 0;

if (PREVIEW_N > 0) {
  const idxs = sampleIdx(EDITIONS, Math.min(PREVIEW_N, EDITIONS), R);
  const pdir = join(OUT, "preview");
  mkdirSync(pdir, { recursive: true });
  for (const i of idxs) {
    await renderEdition(i, join(pdir, `sample-${i + 1}.${t.format || "webp"}`));
    writeFileSync(join(pdir, `sample-${i + 1}.json`), JSON.stringify(editionMeta(i), null, 2));
  }
  console.log(`preview: ${idxs.length} samples -> ${pdir}`);
}
if (BUILD || META_ONLY) {
  const mdir = join(OUT, "metadata");
  if (BUILD) { const idir = join(OUT, "images"); mkdirSync(idir, { recursive: true }); }
  mkdirSync(mdir, { recursive: true });
  for (let i = 0; i < EDITIONS; i++) {
    writeFileSync(join(mdir, `${i + 1}.json`), JSON.stringify(editionMeta(i)));
    if (BUILD) await renderEdition(i, join(OUT, "images", `${i + 1}.${t.format || "webp"}`));
    if ((i + 1) % 100 === 0) console.log(`  ${i + 1}/${EDITIONS}`);
  }
  writeFileSync(join(OUT, "collection.json"), JSON.stringify({
    name: t.name, description: t.description, image: `${t.imageBase}1.${t.format || "webp"}`,
    external_url: t.externalUrl, seller_fee_basis_points: 750,
  }, null, 2));
  console.log(`done: ${EDITIONS} editions -> ${OUT}`);
}
writeFileSync(join(OUT, "rarity-report.json"), JSON.stringify(rarityReport(), null, 2));
writeFileSync(join(OUT, "project.json"), JSON.stringify({ manifest: basename(MANIFEST), seed: SEED, editions: EDITIONS, generatedAt: new Date().toISOString() }, null, 2));
console.log(`rarity report + project backup -> ${OUT} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);

// GRIT composer — Layer 2 of the art pipeline.
// Takes the 12 painted bases (Layer 1) and deterministically bakes crisp
// code-drawn overlays on top: cred panel, evidence panel (the token's case
// file), stencil stamp, serial, barcode, grime, vignette.
// Trait assignment: keccak256(tokenId, "FOIL.GRIT.*") — verifiable by anyone.
//
// Usage:
//   node scripts/compose.mjs [--only 0,1,2] [--test]
// --test renders 3 samples onto the art-direction test image for layout QA.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import sharp from "sharp";
import { CASES } from "./cases.mjs";

const require = createRequire(import.meta.url);
const { keccak_256 } = require("/home/hatch/workspace/nft-god/nft-set/node_modules/js-sha3/src/sha3.js");

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASES = resolve(ROOT, "assets/bases");
const OUT_IMG = resolve(ROOT, "out/finals");
const OUT_META = resolve(ROOT, "out/metadata");
const SIZE = 1200;
const SUPPLY = 667;

// Set at Arweave upload time; rewritten across all metadata by upload script.
const IMAGE_BASE = "https://arweave.net/GRIT_PLACEHOLDER";

const STAMPS = [
  { word: "RUG BLOCKED", color: "#e5484d", w: 30 },
  { word: "TRUST NO ONE", color: "#ff5a1f", w: 25 },
  { word: "GAS ONLY", color: "#35d07f", w: 20 },
  { word: "WALKED AWAY", color: "#8b93a3", w: 15 },
  { word: "NO MERCY", color: "#b026ff", w: 8 },
  { word: "DIAMOND FILE", color: "#f5c542", w: 2 },
];
const GRIME_NAMES = ["CLEAN", "SCUFFED", "BATTERED", "WAR-TORN"];

// --- deterministic hashing ---
function H(tokenId, salt) {
  const pre = Buffer.concat([
    Buffer.from(BigInt(tokenId).toString(16).padStart(64, "0"), "hex"),
    Buffer.from(salt, "utf8"),
  ]);
  return BigInt("0x" + keccak_256(pre));
}

function traitsOf(tokenId) {
  const h0 = H(tokenId, "FOIL.GRIT.v");
  const h1 = H(tokenId, "FOIL.GRIT.c");
  const h2 = H(tokenId, "FOIL.GRIT.t");
  const baseIdx = Number(h0 % 12n);
  // weighted stamp
  const roll = Number(h1 % 100n);
  let acc = 0, stamp = 0;
  for (let i = 0; i < STAMPS.length; i++) { acc += STAMPS[i].w; if (roll < acc) { stamp = i; break; } }
  return {
    baseIdx,
    stamp,
    grime: Number((h1 >> 8n) % 4n),
    caseIdx: Number(h2 % BigInt(CASES.length)),
    score: 50 + Number(h2 % 50n),
    bars: [0, 1, 2, 3, 4].map((i) => 30 + Number((h2 >> BigInt(16 + i * 8)) % 71n)),
    serial: String(tokenId + 1).padStart(4, "0"),
    barcodeSeed: h0 ^ h2,
    scratchSeed: h1 >> 32n,
  };
}

// --- base manifest (bg/hat from filename; eyes filled in when art lands) ---
function loadBases() {
  const files = readdirSync(BASES).filter((f) => f.endsWith(".png")).sort();
  if (files.length !== 12) throw new Error(`expected 12 bases, found ${files.length} in ${BASES}`);
  let manifest = {};
  const mp = resolve(BASES, "bases.json");
  if (existsSync(mp)) manifest = JSON.parse(readFileSync(mp, "utf8"));
  return files.map((f) => {
    const m = f.match(/grit-base-([a-z]+)-([a-z]+)\.png/);
    const key = basename(f, ".png");
    return {
      file: resolve(BASES, f),
      bg: m[1].toUpperCase(), hat: m[2].toUpperCase(),
      eyes: (manifest[key] && manifest[key].eyes) || "SKEPTICAL",
    };
  });
}

// --- SVG overlay ---
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function panelBars(t) {
  const labels = ["own", "hist", "proof", "up", "trust"];
  return t.bars.map((v, i) => {
    const y = 300 + i * 64;
    return `<text x="80" y="${y + 14}" font-size="22" fill="#9aa3b2">${labels[i]}</text>` +
      `<rect x="180" y="${y}" width="220" height="20" fill="#22262e"/>` +
      `<rect x="180" y="${y}" width="${Math.round(v * 2.2)}" height="20" fill="#35d07f"/>`;
  }).join("");
}
function overlaySVG(t, base, kase, stamp) {
  const W = SIZE, cx = W / 2;
  const stampFS = stamp.word.length > 10 ? 44 : 54;
  const stampW = stamp.word.length * (stampFS * 0.72) + 80;
  // deterministic scratches + splatter from seed
  let grimeEl = "";
  let s = t.scratchSeed;
  const rnd = (n) => { s = (s * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n); return Number(s % BigInt(n)); };
  const nScratch = 4 + t.grime * 5;
  for (let i = 0; i < nScratch; i++) {
    const x = rnd(W), y = rnd(W), len = 60 + rnd(220), a = rnd(360);
    grimeEl += `<line x1="${x}" y1="${y}" x2="${x + Math.round(len * Math.cos(a * Math.PI / 180))}" y2="${y + Math.round(len * Math.sin(a * Math.PI / 180))}" stroke="#ffffff" stroke-width="2" opacity="0.10"/>`;
  }
  for (let i = 0; i < t.grime * 6; i++) {
    const x = rnd(W), y = rnd(W), r = 8 + rnd(42);
    grimeEl += `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${Math.round(r * 0.7)}" fill="#000000" opacity="${0.12 + t.grime * 0.05}"/>`;
  }
  // barcode
  let bars = "", bx = 80;
  let bseed = t.barcodeSeed;
  for (let i = 0; i < 34; i++) {
    bseed = (bseed * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n);
    const w = (bseed & 1n) ? 9 : 4;
    bars += `<rect x="${bx}" y="${W - 190}" width="${w}" height="64" fill="#dfe4ec"/>`;
    bx += Number(w) + 7;
  }
  const tells = kase.tells.map((tl, i) =>
    `<text x="${W - 400}" y="${560 + i * 34}" font-size="21" fill="#c8cfdb">▸ ${esc(tl)}</text>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">
<style>.m{font-family:monospace}.b{font-weight:bold}</style>
<defs><radialGradient id="vg" cx="50%" cy="46%" r="72%">
<stop offset="62%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.55"/>
</radialGradient></defs>
${grimeEl}
<!-- header -->
<text class="m b" x="60" y="72" font-size="30" fill="#eef1f6" letter-spacing="6">GRIT FILES</text>
<text class="m" x="60" y="104" font-size="18" fill="#7c8698" letter-spacing="3">FOIL // WATCHDOG DESK</text>
<text class="m b" x="${W - 60}" y="76" font-size="44" fill="#f5c542" text-anchor="end">#${t.serial}</text>
<!-- left: cred panel -->
<rect x="48" y="220" width="392" height="470" fill="#0a0c10" opacity="0.84"/>
<rect x="48" y="220" width="392" height="470" fill="none" stroke="#333b4d" stroke-width="2"/>
<text class="m" x="80" y="262" font-size="22" fill="#7c8698" letter-spacing="3">CRED REPORT</text>
${panelBars(t)}
<text class="m" x="80" y="640" font-size="22" fill="#7c8698">SCORE <tspan class="b" fill="#eef1f6">${t.score}/100</tspan></text>
<!-- right: evidence panel -->
<rect x="${W - 448}" y="220" width="400" height="470" fill="#0a0c10" opacity="0.84"/>
<rect x="${W - 448}" y="220" width="400" height="470" fill="none" stroke="#333b4d" stroke-width="2"/>
<text class="m" x="${W - 416}" y="262" font-size="22" fill="#7c8698" letter-spacing="3">EVIDENCE</text>
<text class="m b" x="${W - 416}" y="310" font-size="26" fill="${stamp.color}">${esc(kase.name)}</text>
<text class="m" x="${W - 416}" y="348" font-size="19" fill="#69738a">${kase.id} · FILE ${t.serial}</text>
<text class="m" x="${W - 416}" y="420" font-size="21" fill="#9aa3b2">TELLS:</text>
${tells}
<!-- stamp -->
<g transform="translate(${cx} ${W - 330}) rotate(-8)">
<rect x="${-stampW / 2}" y="-52" width="${stampW}" height="104" fill="none" stroke="${stamp.color}" stroke-width="7"/>
<rect x="${-stampW / 2 + 14}" y="-40" width="${stampW - 28}" height="80" fill="none" stroke="${stamp.color}" stroke-width="2"/>
<text class="m b" x="0" y="16" font-size="${stampFS}" fill="${stamp.color}" letter-spacing="6" text-anchor="middle">${stamp.word}</text>
</g>
<!-- barcode + footer -->
${bars}
<text class="m" x="${W - 60}" y="${W - 130}" font-size="20" fill="#7c8698" letter-spacing="4" text-anchor="end">verify before believing</text>
<rect width="${W}" height="${W}" fill="url(#vg)"/>
</svg>`;
}

async function renderOne(tokenId, bases, testBase) {
  const t = traitsOf(tokenId);
  const base = testBase ? { file: testBase, bg: "TEST", hat: "TEST", eyes: "TEST" } : bases[t.baseIdx];
  const kase = CASES[t.caseIdx];
  const stamp = STAMPS[t.stamp];
  const svg = overlaySVG(t, base, kase, stamp);
  const img = await sharp(base.file).resize(SIZE, SIZE, { fit: "cover" })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png().toBuffer();
  return { img, t, base, kase, stamp };
}

function metadataOf(tokenId, t, base, kase, stamp) {
  return {
    name: `GRIT #${t.serial}`,
    description: `GRIT #${t.serial} — ${kase.name}. ${kase.story} Foil filed it so you don't have to. Every scar is a scam that didn't pay.`,
    attributes: [
      { trait_type: "Background", value: base.bg },
      { trait_type: "Hat", value: base.hat },
      { trait_type: "Eyes", value: base.eyes },
      { trait_type: "Stamp", value: stamp.word },
      { trait_type: "Grime", value: GRIME_NAMES[t.grime] },
      { trait_type: "Case File", value: kase.id },
      { trait_type: "Serial", value: t.serial },
    ],
    image: `${IMAGE_BASE}/${tokenId}.png`,
  };
}

async function main() {
  const args = process.argv.slice(2);
  mkdirSync(OUT_IMG, { recursive: true });
  mkdirSync(OUT_META, { recursive: true });

  if (args.includes("--test")) {
    const testBase = readdirSync(resolve(ROOT, "assets"))
      .filter((f) => f.endsWith(".webp")).map((f) => resolve(ROOT, "assets", f))[0];
    if (!testBase) throw new Error("no test webp in assets/");
    for (const id of [0, 111, 666]) {
      const { img, t, base, kase, stamp } = await renderOne(id, null, testBase);
      writeFileSync(resolve(ROOT, `test-${id}.png`), img);
      console.log(`test-${id}.png: stamp=${stamp.word} case=${kase.id} grime=${GRIME_NAMES[t.grime]} score=${t.score}`);
    }
    return;
  }

  const bases = loadBases();
  let only = null;
  const oi = args.indexOf("--only");
  if (oi >= 0) only = args[oi + 1].split(",").map(Number);

  const ids = only || Array.from({ length: SUPPLY }, (_, i) => i);
  for (const id of ids) {
    const { img, t, base, kase, stamp } = await renderOne(id, bases);
    writeFileSync(resolve(OUT_IMG, `${id}.png`), img);
    writeFileSync(resolve(OUT_META, `${id}.json`),
      JSON.stringify(metadataOf(id, t, base, kase, stamp), null, 2));
    if (id % 50 === 0) console.log(`composed ${id}/${ids.length}`);
  }
  console.log(`DONE: ${ids.length} finals + metadata`);
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });

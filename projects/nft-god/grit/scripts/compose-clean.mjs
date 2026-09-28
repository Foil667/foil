// FOIL GRIT — clean art-first composer.
// The 12 painted bases ARE the art. No case files, no evidence panels,
// no cred scores, no stamps. Just the piece, a thin frame, and a serial.
//
// Trait assignment stays deterministic: keccak256(tokenId, "FOIL.GRIT.v") % 12.
// Usage: node scripts/compose-clean.mjs [--only 0,5,42]

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import sharp from "sharp";
const require = createRequire(import.meta.url);
const { keccak_256 } = require("/home/hatch/workspace/nft-god/nft-set/node_modules/js-sha3/src/sha3.js");

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASES = resolve(ROOT, "assets/bases");
const OUT_IMG = resolve(ROOT, "out/finals");
const OUT_META = resolve(ROOT, "out/metadata");
const IMAGE_BASE = "https://arweave.net/GRIT_PLACEHOLDER";
const SUPPLY = 667;
const SIZE = 1200;

const BG_NAMES = { ASPHALT: "Asphalt", RUST: "Rusted Metal", CONCRETE: "Stained Concrete", VOID: "Scanline Void" };
const HAT_NAMES = { PEAKED: "Peaked Foil", FLAT: "Wide-Brim Foil", CROWN: "Crown Foil" };
const EYE_NAMES = { SKEPTICAL: "Skeptical", WIDE: "Wide", "HALF-LIDDED": "Half-Lidded" };

function H(tokenId, salt) {
  const pre = Buffer.concat([
    Buffer.from(BigInt(tokenId).toString(16).padStart(64, "0"), "hex"),
    Buffer.from(salt, "utf8"),
  ]);
  return BigInt("0x" + keccak_256(pre));
}

function loadBases() {
  const files = readdirSync(BASES).filter((f) => f.endsWith(".png")).sort();
  if (files.length !== 12) throw new Error(`expected 12 bases, found ${files.length}`);
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

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

async function renderOne(tokenId, bases) {
  const baseIdx = Number(H(tokenId, "FOIL.GRIT.v") % 12n);
  const base = bases[baseIdx];
  const serial = String(tokenId + 1).padStart(4, "0");

  const frame = Buffer.from(
    `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${SIZE}" height="${SIZE}" fill="none" stroke="#0b0b0c" stroke-width="10"/>
      <text x="40" y="${SIZE - 34}" font-family="monospace" font-size="26" fill="#e8e6e1" opacity="0.55" letter-spacing="4">FOIL GRIT</text>
      <text x="${SIZE - 40}" y="${SIZE - 34}" text-anchor="end" font-family="monospace" font-size="26" fill="#e8e6e1" opacity="0.55" letter-spacing="4">#${serial}</text>
    </svg>`
  );

  const img = await sharp(base.file)
    .resize(SIZE, SIZE, { fit: "cover" })
    .composite([{ input: frame, top: 0, left: 0 }])
    .png()
    .toBuffer();

  const meta = {
    name: `FOIL GRIT #${serial}`,
    description:
      "FOIL GRIT — 667 hand-painted Foils, zero vanilla. Free mint, gas only, on Base and Robinhood Chain. The art is the utility.",
    image: `${IMAGE_BASE}/${tokenId}.png`,
    attributes: [
      { trait_type: "Background", value: BG_NAMES[base.bg] || base.bg },
      { trait_type: "Hat", value: HAT_NAMES[base.hat] || base.hat },
      { trait_type: "Eyes", value: EYE_NAMES[base.eyes] || base.eyes },
      { trait_type: "Serial", value: serial },
    ],
  };
  return { img, meta, base, serial };
}

async function main() {
  const args = process.argv.slice(2);
  mkdirSync(OUT_IMG, { recursive: true });
  mkdirSync(OUT_META, { recursive: true });
  const bases = loadBases();

  let only = null;
  const oi = args.indexOf("--only");
  if (oi >= 0) only = args[oi + 1].split(",").map(Number);

  const ids = only || Array.from({ length: SUPPLY }, (_, i) => i);
  for (const id of ids) {
    const { img, meta, base, serial } = await renderOne(id, bases);
    writeFileSync(resolve(OUT_IMG, `${id}.png`), img);
    writeFileSync(resolve(OUT_META, `${id}.json`), JSON.stringify(meta, null, 2) + "\n");
    if (ids.length > 10 && id % 50 === 0) console.log(`composed ${id}/${ids.length}`);
  }
  const b = bases[Number(H(ids[0], "FOIL.GRIT.v") % 12n)];
  console.log(`DONE: ${ids.length} finals — e.g. #${String(ids[0] + 1).padStart(4, "0")}: ${b.bg}/${b.hat}/${b.eyes}`);
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });

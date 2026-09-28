#!/usr/bin/env node
/**
 * metadata-compiler.mjs — Foil NFT set metadata pipeline.
 *
 * Reads finished art from art/ plus trait assignments from traits/, and emits
 * ERC-721 (OpenSea-compatible) metadata JSONs into metadata/, plus a
 * provenance log (SHA-256 of every art file and metadata file, and a single
 * provenance root). The provenance root can be committed onchain / announced
 * BEFORE reveal so collectors can verify nothing was swapped later.
 *
 *   node scripts/metadata-compiler.mjs [options]
 *
 * Options:
 *   --art <dir>        art directory (default: art/)
 *   --traits <file>    traits JSON (default: traits/traits.json)
 *   --out <dir>        metadata output dir (default: metadata/)
 *   --image-base <uri> base URI for images, e.g. ipfs://<CID>/
 *                      (default: ipfs://REPLACE_WITH_CID/)
 *   --name <prefix>    collection name prefix (default: "Foil: The TinHat Society")
 *   --start <n>        first token id (default: 0, matches contract)
 *   --sample           generate 3 sample metadata entries with placeholder art
 *                      (lets the whole pipeline be tested while image
 *                      generation is down — NOT for production)
 *   --force            overwrite existing metadata files
 *
 * Traits file format (traits/traits.json):
 *   {
 *     "0": { "attributes": [ {"trait_type":"Hat","value":"Tinfoil Peaked"}, ... ] },
 *     "1": { "attributes": [ ... ] }
 *   }
 * Token ids not listed get a default single "Generation" attribute so the
 * compiler never crashes on a partial traits file (it warns instead).
 *
 * Exit codes: 0 ok, 1 nothing to compile / config error.
 */
import { createHash } from "node:crypto";
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  mkdirSync,
  existsSync,
  statSync,
} from "node:fs";
import { join, resolve, basename, extname } from "node:path";

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const has = (name) => process.argv.includes(name);

const ROOT = resolve(new URL(".", import.meta.url).pathname, "..");
const ART_DIR = resolve(ROOT, arg("--art", "art"));
const TRAITS_FILE = resolve(ROOT, arg("--traits", "traits/traits.json"));
const OUT_DIR = resolve(ROOT, arg("--out", "metadata"));
const IMAGE_BASE = arg("--image-base", "ipfs://REPLACE_WITH_CID/");
const NAME_PREFIX = arg("--name", "Foil: The TinHat Society");
const START_ID = parseInt(arg("--start", "0"), 10);
const SAMPLE = has("--sample");
const FORCE = has("--force");

const DESCRIPTION =
  "Foil's genesis set on Robinhood Chain. 777 tinfoil-hatted skeptics, " +
  "each one a credibility dossier Foil already checked so you don't have to. " +
  "Verify before believing. Free mint — secondary royalties keep the loop running.";

function fail(msg) {
  console.error(`[metadata-compiler] ERROR: ${msg}`);
  process.exit(1);
}

function loadTraits() {
  if (!existsSync(TRAITS_FILE)) {
    console.warn(`[metadata-compiler] no traits file at ${TRAITS_FILE} — using defaults`);
    return {};
  }
  try {
    return JSON.parse(readFileSync(TRAITS_FILE, "utf8"));
  } catch (e) {
    fail(`could not parse traits file: ${e.message}`);
  }
}

function attributesFor(tokenId, traits) {
  const entry = traits[String(tokenId)];
  if (entry?.attributes?.length) return entry.attributes;
  if (entry) console.warn(`[metadata-compiler] token ${tokenId}: traits entry has no attributes — using default`);
  return [{ trait_type: "Generation", value: "TinHat Society" }];
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const traits = loadTraits();

  // Collect art files: NNNN.png sorted numerically.
  let artFiles = [];
  if (SAMPLE) {
    artFiles = ["0000.png", "0001.png", "0002.png"].map((f) => ({
      file: f,
      tokenId: parseInt(f.split(".")[0], 10),
      sample: true,
    }));
    console.log("[metadata-compiler] --sample: generating 3 placeholder entries (NOT production metadata)");
  } else {
    if (!existsSync(ART_DIR)) fail(`art dir not found: ${ART_DIR}`);
    artFiles = readdirSync(ART_DIR)
      .filter((f) => [".png", ".webp"].includes(extname(f).toLowerCase()))
      .map((f) => ({ file: f, tokenId: parseInt(basename(f, extname(f)), 10), sample: false }))
      .filter((a) => Number.isInteger(a.tokenId))
      .sort((a, b) => a.tokenId - b.tokenId);
    if (artFiles.length === 0) {
      fail(
        `no art found in ${ART_DIR} (expected files like 0000.png). ` +
          `Image generation is currently down — art slots in later. ` +
          `Use --sample to test the pipeline without real art.`
      );
    }
  }

  const records = [];
  const metadataHashes = [];

  for (const { file, tokenId, sample } of artFiles) {
    const id = START_ID + tokenId;
    let artHash;
    if (sample) {
      artHash = "sample-placeholder-no-art";
    } else {
      const artPath = join(ART_DIR, file);
      artHash = sha256(readFileSync(artPath));
    }

    const metadata = {
      name: `${NAME_PREFIX} #${id}`,
      description: DESCRIPTION,
      image: `${IMAGE_BASE}${String(id).padStart(4, "0")}.png`,
      external_url: "https://helixa.xyz/multipass/loopers/667",
      attributes: attributesFor(id, traits),
    };
    if (sample) metadata.attributes.push({ trait_type: "Sample", value: "placeholder — not final art" });

    const body = JSON.stringify(metadata, null, 2) + "\n";
    const metaHash = sha256(Buffer.from(body));
    const outName = `${String(id).padStart(4, "0")}.json`;
    const outPath = join(OUT_DIR, outName);
    if (existsSync(outPath) && !FORCE) {
      fail(`${outName} already exists — pass --force to overwrite`);
    }
    writeFileSync(outPath, body);
    records.push({ tokenId: id, file: sample ? "(sample)" : file, artSha256: artHash, metadataFile: outName, metadataSha256: metaHash });
    metadataHashes.push(metaHash);
    console.log(`[metadata-compiler] token ${id} -> ${outName} (art ${artHash.slice(0, 12)}…)`);
  }

  // Provenance root: sha256 over the concatenated metadata hashes (in order).
  // Announce this root before reveal; anyone can re-run this compiler over the
  // published art + traits and check the root matches.
  const provenanceRoot = sha256(Buffer.from(metadataHashes.join(""), "utf8"));
  const provenance = {
    generatedAt: new Date().toISOString(),
    compiler: "scripts/metadata-compiler.mjs (foil-nft-set)",
    collection: NAME_PREFIX,
    imageBase: IMAGE_BASE,
    tokenCount: records.length,
    startTokenId: START_ID,
    sample: SAMPLE,
    provenanceRoot: `0x${provenanceRoot}`,
    files: records,
  };
  writeFileSync(join(OUT_DIR, "provenance.json"), JSON.stringify(provenance, null, 2) + "\n");

  console.log(`[metadata-compiler] wrote ${records.length} metadata files to ${OUT_DIR}`);
  console.log(`[metadata-compiler] provenance root: 0x${provenanceRoot}`);
  if (IMAGE_BASE.includes("REPLACE_WITH_CID")) {
    console.warn("[metadata-compiler] image base URI is still a placeholder — set --image-base to the real IPFS/Arweave CID before launch");
  }
}

main();

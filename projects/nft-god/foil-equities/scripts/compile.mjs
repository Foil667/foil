// compile.mjs — compile every contract in ../contracts with solcjs.
// Each file compiled in its own input so failures are isolated per file.
// Resolves @openzeppelin imports from node_modules. Read-only check.
import { readFileSync, readdirSync, existsSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import solc from "solc";

const HERE = dirname(fileURLToPath(import.meta.url));
const CONTRACTS = join(HERE, "..", "contracts");
const NM = join(HERE, "..", "node_modules");

function findImports(path) {
  // sibling imports inside contracts/ — solc calls back with the path
  // stripped of any leading ./ (e.g. "FoilAccount.sol"), so try both
  // the literal path and its basename against the contracts dir.
  for (const cand of [path, path.split("/").pop()]) {
    const full = resolve(CONTRACTS, cand);
    if (existsSync(full)) return { contents: readFileSync(full, "utf8") };
  }
  const full = resolve(NM, path);
  if (existsSync(full)) return { contents: readFileSync(full, "utf8") };
  return { error: `unresolved import: ${path}` };
}

const files = readdirSync(CONTRACTS).filter((f) => f.endsWith(".sol"));
let fail = 0;

for (const f of files) {
  const input = {
    language: "Solidity",
    sources: { [f]: { content: readFileSync(join(CONTRACTS, f), "utf8") } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // Pinned: cancun. OpenZeppelin Contracts 5.6.x emits MCOPY (0x5e,
      // Cancun) — e.g. Bytes.sol / Arrays.sol pulled in by ERC721 and ECDSA —
      // so anything older than cancun FAILS TO COMPILE (solc TypeError).
      // Deployment targets (Base, Robinhood Chain) are Cancun+, and the
      // test chain is Hardhat Network @ cancun (see test/hardhat.config.cjs).
      evmVersion: "cancun",
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
  const errors = (out.errors ?? []).filter((e) => e.severity === "error");
  const warns = (out.errors ?? []).filter((e) => e.severity === "warning");
  const compiled = out.contracts?.[f] ? Object.keys(out.contracts[f]).join(", ") : "(none)";
  if (errors.length) {
    fail++;
    console.log(`FAIL  ${f}`);
    for (const e of errors) console.log(`      ${e.formattedMessage.split("\n").join("\n      ")}`);
  } else {
    console.log(`PASS  ${f}  [${compiled}]${warns.length ? `  (${warns.length} warning${warns.length > 1 ? "s" : ""})` : ""}`);
  }
}
process.exit(fail ? 1 : 0);

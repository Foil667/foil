// compile-tests.mjs — compile test mocks + harness (and Activation itself)
// with solcjs. Writes ABI+bytecode artifacts to test/artifacts/.
// Read-only; does not touch the project's own contracts.
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join, dirname, resolve, normalize } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const solc = require("solc");

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const NM = join(ROOT, "node_modules");
const OUT = join(HERE, "artifacts");
mkdirSync(OUT, { recursive: true });

// logical solc paths -> real files
const SOURCES = {
  "contracts/Activation.sol": join(ROOT, "contracts", "Activation.sol"),
  "contracts/FoilEquities.sol": join(ROOT, "contracts", "FoilEquities.sol"),
  "contracts/FoilAccount.sol": join(ROOT, "contracts", "FoilAccount.sol"),
  "contracts/FoilAccountFactory.sol": join(ROOT, "contracts", "FoilAccountFactory.sol"),
  "contracts/RoyaltyRouter.sol": join(ROOT, "contracts", "RoyaltyRouter.sol"),
  "contracts/OperatorSplitter.sol": join(ROOT, "contracts", "OperatorSplitter.sol"),
  "contracts/StockPot.sol": join(ROOT, "contracts", "StockPot.sol"),
};
for (const f of readdirSync(join(HERE, "contracts")).filter((f) => f.endsWith(".sol"))) {
  SOURCES[`test/contracts/${f}`] = join(HERE, "contracts", f);
}

function findImports(path) {
  // relative imports already flattened into SOURCES keys
  const norm = normalize(path).replace(/\\/g, "/");
  if (SOURCES[norm]) return { contents: readFileSync(SOURCES[norm], "utf8") };
  // sibling imports inside contracts/ (e.g. contracts/FoilAccountFactory.sol -> ./FoilAccount.sol)
  if (path.startsWith("./") || path.startsWith("../")) {
    const base = norm.split("/").pop();
    const key = `contracts/${base}`;
    if (SOURCES[key]) return { contents: readFileSync(SOURCES[key], "utf8") };
  }
  const full = resolve(NM, path);
  if (existsSync(full)) return { contents: readFileSync(full, "utf8") };
  return { error: `unresolved import: ${path}` };
}

const sources = {};
for (const [logical, real] of Object.entries(SOURCES)) {
  sources[logical] = { content: readFileSync(real, "utf8") };
}

const input = {
  language: "Solidity",
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: "cancun", // must match scripts/compile.mjs (see note there)
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};

const out = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
const errors = (out.errors ?? []).filter((e) => e.severity === "error");
if (errors.length) {
  for (const e of errors) console.log(e.formattedMessage);
  process.exit(1);
}

const WANT = ["ActivationHarness", "MockCRED", "MockRESCUE", "MockUSDC", "MockPot", "MockRouter",
  "FoilEquities", "FoilAccount", "FoilAccountFactory", "RoyaltyRouter", "OperatorSplitter", "StockPot",
  "Mock6551Registry", "MockNFT721", "MockIdentityRegistry", "MockStock", "DeployingRegistry", "DeployableAccount",
  "ERC1167ProxyDeployer"];
for (const [file, contracts] of Object.entries(out.contracts ?? {})) {
  for (const [name, c] of Object.entries(contracts)) {
    if (!WANT.includes(name)) continue;
    writeFileSync(
      join(OUT, `${name}.json`),
      JSON.stringify({ abi: c.abi, bytecode: "0x" + c.evm.bytecode.object })
    );
    console.log(`artifact  ${name}  (${(c.evm.bytecode.object.length / 2) | 0} bytes)`);
  }
}
const missing = WANT.filter((w) => !existsSync(join(OUT, `${w}.json`)));
if (missing.length) {
  console.log("MISSING artifacts:", missing.join(", "));
  process.exit(1);
}
console.log("compile OK");

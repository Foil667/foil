// watch-cred-lp.mjs — monitor the CRED/WETH pool for manipulation.
// Polls GeckoTerminal (free, no key). Alerts LOUD on pump/dump/liquidity-pull.
// State + log live under the RH free-mint watch goal's hidden_files.
// Usage: node scripts/watch-cred-lp.mjs
import { readFileSync, writeFileSync, mkdirSync, appendFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const POOL = "0x55a4f7a23c4c2616cf848e639a08bd4283d13e66f5fcf34f828b5ca7e4e96324";
const API = `https://api.geckoterminal.com/api/v2/networks/base/pools/${POOL}`;
const HERE = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = join(HERE, "..", "..", "..", "goals", "robinhood-chain-free-mint-watch", "hidden_files", "cred-lp-watch");
const STATE_FILE = join(STATE_DIR, "state.json");
const LOG_FILE = join(STATE_DIR, "watch.log");

const PRICE_MOVE_ALERT = 0.15;   // 15% between checks
const VOL_SPIKE_MULT = 3;        // 3x trailing avg
const LIQ_DROP_ALERT = 0.20;     // 20% liquidity drop

function log(line) {
  const ts = new Date().toISOString();
  mkdirSync(STATE_DIR, { recursive: true });
  appendFileSync(LOG_FILE, `[${ts}] ${line}\n`);
  console.log(`[${ts}] ${line}`);
}

function loadState() {
  try { return JSON.parse(readFileSync(STATE_FILE, "utf8")); }
  catch { return { prices: [], vols: [], lastLiq: null, lastPrice: null }; }
}

async function main() {
  mkdirSync(STATE_DIR, { recursive: true }); // ensure state dir before any writes
  const res = await fetch(API, { headers: { accept: "application/json" } });
  if (!res.ok) { log(`ERROR: GeckoTerminal HTTP ${res.status} — pool feed down`); process.exit(2); }
  const j = await res.json();
  const a = j.data.attributes;
  const price = parseFloat(a.base_token_price_usd);
  const volH24 = parseFloat(a.volume_usd?.h24 ?? 0);
  const liq = parseFloat(a.reserve_in_usd ?? 0);
  const txns = (a.transactions?.h24?.buys ?? 0) + (a.transactions?.h24?.sells ?? 0);

  const st = loadState();
  const alerts = [];

  if (st.lastPrice && Math.abs(price - st.lastPrice) / st.lastPrice > PRICE_MOVE_ALERT) {
    const pct = (((price - st.lastPrice) / st.lastPrice) * 100).toFixed(1);
    alerts.push(`PRICE MOVE ${pct}% since last check ($${st.lastPrice} -> $${price}) — possible pump/dump staging (T1)`);
  }
  const avgVol = st.vols.length ? st.vols.reduce((x, y) => x + y, 0) / st.vols.length : volH24;
  if (avgVol > 0 && volH24 > avgVol * VOL_SPIKE_MULT) {
    alerts.push(`VOLUME SPIKE: h24 $${volH24.toFixed(0)} vs trailing avg $${avgVol.toFixed(0)} — someone positioning (T2/T7)`);
  }
  if (st.lastLiq && (st.lastLiq - liq) / st.lastLiq > LIQ_DROP_ALERT) {
    alerts.push(`LIQUIDITY DROP: $${st.lastLiq.toFixed(0)} -> $${liq.toFixed(0)} — possible liquidity pull (T7)`);
  }
  if (txns > 2000) {
    alerts.push(`TXN SURGE: ${txns} h24 txns — bot activity elevated`);
  }

  st.prices.push(price); if (st.prices.length > 96) st.prices.shift();
  st.vols.push(volH24); if (st.vols.length > 96) st.vols.shift();
  st.lastPrice = price; st.lastLiq = liq;
  writeFileSync(STATE_FILE, JSON.stringify(st, null, 2));

  log(`check ok: CRED $${price} | h24 vol $${volH24.toFixed(0)} | liq $${liq.toFixed(0)} | h24 txns ${txns}`);
  for (const al of alerts) log(`ALERT: ${al}`);

  if (alerts.length) {
    console.log("RESULT: ALERT");
    process.exit(3); // distinct exit code so the cron wrapper can page loudly
  }
  console.log("RESULT: CLEAN");
}

main().catch((e) => { log(`ERROR: ${e.message}`); process.exit(2); });

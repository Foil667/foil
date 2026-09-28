// watch-cred-lp.mjs — monitor the CRED/WETH and RESCUE/WETH pools for manipulation.
// Polls GeckoTerminal (free, no key). Alerts LOUD on pump/dump/liquidity-pull.
// State + log live under the RH free-mint watch goal's hidden_files.
// Usage: node scripts/watch-cred-lp.mjs
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const CRED_TOKEN = "0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3";
const CRED_POOL = "0x55a4f7a23c4c2616cf848e639a08bd4283d13e66f5fcf34f828b5ca7e4e96324";
const RESCUE_TOKEN = "0x8201132Bc218dbD81305Ff5605F44aE4804D4BA3";
const WETH_BASE = "0x4200000000000000000000000000000000000006";
const RESCUE_POOLS_API = `https://api.geckoterminal.com/api/v2/networks/base/tokens/${RESCUE_TOKEN}/pools`;

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
  try {
    const raw = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    // migrate legacy flat (CRED-only) state to per-pool keying
    if (raw.lastPrice !== undefined && !raw.CRED) return { CRED: raw };
    return raw;
  } catch { return {}; }
}

function blankPoolState() {
  return { prices: [], vols: [], lastLiq: null, lastPrice: null };
}

/// Resolve the RESCUE/WETH pool: the WETH-paired pool with highest liquidity.
/// Returns the pool address, or null if none is indexed yet (never fabricates).
async function resolveRescuePool() {
  const res = await fetch(RESCUE_POOLS_API, { headers: { accept: "application/json" } });
  if (!res.ok) { log(`WARN: GeckoTerminal token-pools HTTP ${res.status} — RESCUE pool unresolved`); return null; }
  const j = await res.json();
  const pools = j?.data ?? [];
  let best = null, bestLiq = 0;
  for (const p of pools) {
    const a = p.attributes ?? {};
    const rel = p.relationships ?? {};
    const baseAddr = (rel.base_token?.data?.id ?? "").split("_").pop()?.toLowerCase();
    const quoteAddr = (rel.quote_token?.data?.id ?? "").split("_").pop()?.toLowerCase();
    if (baseAddr !== WETH_BASE && quoteAddr !== WETH_BASE) continue;
    const liq = parseFloat(a.reserve_in_usd ?? 0);
    if (liq > bestLiq) { bestLiq = liq; best = a.address ?? p.id; }
  }
  return best;
}

async function fetchPool(poolAddr) {
  const res = await fetch(`https://api.geckoterminal.com/api/v2/networks/base/pools/${poolAddr}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`GeckoTerminal HTTP ${res.status}`);
  const j = await res.json();
  const a = j.data.attributes;
  return {
    price: parseFloat(a.base_token_price_usd),
    volH24: parseFloat(a.volume_usd?.h24 ?? 0),
    liq: parseFloat(a.reserve_in_usd ?? 0),
    txns: (a.transactions?.h24?.buys ?? 0) + (a.transactions?.h24?.sells ?? 0),
  };
}

function checkPool(name, m, st) {
  const alerts = [];
  if (st.lastPrice && Math.abs(m.price - st.lastPrice) / st.lastPrice > PRICE_MOVE_ALERT) {
    const pct = (((m.price - st.lastPrice) / st.lastPrice) * 100).toFixed(1);
    alerts.push(`[${name}] PRICE MOVE ${pct}% since last check ($${st.lastPrice} -> $${m.price}) — possible pump/dump staging (T1/T9)`);
  }
  const avgVol = st.vols.length ? st.vols.reduce((x, y) => x + y, 0) / st.vols.length : m.volH24;
  if (avgVol > 0 && m.volH24 > avgVol * VOL_SPIKE_MULT) {
    alerts.push(`[${name}] VOLUME SPIKE: h24 $${m.volH24.toFixed(0)} vs trailing avg $${avgVol.toFixed(0)} — someone positioning (T2/T7)`);
  }
  if (st.lastLiq && (st.lastLiq - m.liq) / st.lastLiq > LIQ_DROP_ALERT) {
    alerts.push(`[${name}] LIQUIDITY DROP: $${st.lastLiq.toFixed(0)} -> $${m.liq.toFixed(0)} — possible liquidity pull (T7)`);
  }
  if (m.txns > 2000) {
    alerts.push(`[${name}] TXN SURGE: ${m.txns} h24 txns — bot activity elevated`);
  }
  return alerts;
}

async function main() {
  mkdirSync(STATE_DIR, { recursive: true }); // ensure state dir before any writes

  // Build the pool list: CRED always, RESCUE if resolvable.
  const pools = [{ name: "CRED", token: CRED_TOKEN, pool: CRED_POOL }];
  const rescuePool = await resolveRescuePool();
  if (rescuePool) {
    pools.push({ name: "RESCUE", token: RESCUE_TOKEN, pool: rescuePool });
    log(`RESCUE pool resolved: ${rescuePool}`);
  } else {
    // TODO: $RESCUE/WETH pool not yet indexed by GeckoTerminal (token launched
    // 2026-09-28; pools appear once trading/indexing picks it up). Re-run this
    // script or re-resolve when the pool exists; watch stays CRED-only until then.
    log("TODO: $RESCUE/WETH pool not indexed by GeckoTerminal yet — RESCUE watch deferred, CRED-only this run");
  }

  const st = loadState();
  const allAlerts = [];
  let failed = false;

  for (const p of pools) {
    try {
      const m = await fetchPool(p.pool);
      const ps = st[p.name] ?? blankPoolState();
      const alerts = checkPool(p.name, m, ps);

      ps.prices.push(m.price); if (ps.prices.length > 96) ps.prices.shift();
      ps.vols.push(m.volH24); if (ps.vols.length > 96) ps.vols.shift();
      ps.lastPrice = m.price; ps.lastLiq = m.liq;
      st[p.name] = ps;

      log(`check ok: ${p.name} $${m.price} | h24 vol $${m.volH24.toFixed(0)} | liq $${m.liq.toFixed(0)} | h24 txns ${m.txns}`);
      for (const al of alerts) { log(`ALERT: ${al}`); allAlerts.push(al); }
    } catch (e) {
      log(`ERROR: [${p.name}] pool feed down — ${e.message}`);
      failed = true;
    }
  }

  writeFileSync(STATE_FILE, JSON.stringify(st, null, 2));

  if (failed) { console.log("RESULT: FEED DOWN"); process.exit(2); }
  if (allAlerts.length) {
    console.log("RESULT: ALERT");
    process.exit(3); // distinct exit code so the cron wrapper can page loudly
  }
  console.log("RESULT: CLEAN");
}

main().catch((e) => { log(`ERROR: ${e.message}`); process.exit(2); });

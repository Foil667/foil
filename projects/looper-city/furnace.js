/* Looper City — furnace.js
 * THE FURNACE: live onchain $RESCUE burn status.
 * Reads Transfer events on the $RESCUE contract where `to` = dead address,
 * via chunked eth_getLogs. Running total + last scanned block cached in
 * localStorage; polls for new burns on a timer. Degrades to cached data
 * with a "last synced" note if the RPC is slow.
 */
(function () {
  'use strict';
  const RESCUE = '0x8201132Bc218dbD81305Ff5605F44aE4804D4BA3';
  const DEAD = '0x000000000000000000000000000000000000dEaD';
  const TOPIC_TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  const DEAD_TOPIC = '0x000000000000000000000000000000000000000000000000000000000000dead';
  const START_BLOCK = 51890000;      // safely before $RESCUE launch (2026-09-28 ~10:35 CDT)
  const CHUNK = 2000;                // mainnet.base.org caps eth_getLogs at 2,000 blocks
  const LS = 'lc2_burncache';
  const DP = 18n;

  const fmtR = raw => {
    raw = BigInt(raw);
    const neg = raw < 0n; const v = neg ? -raw : raw;
    const whole = v / (10n ** DP), frac = v % (10n ** DP);
    const fs = frac.toString().padStart(18, '0').slice(0, 2);
    return (neg ? '-' : '') + Number(whole).toLocaleString('en-US') + '.' + fs;
  };
  function loadCache() {
    try { const c = JSON.parse(localStorage.getItem(LS)); if (c && c.lastBlock) return c; } catch (e) {}
    return { total: '0', lastBlock: START_BLOCK - 1, burners: {}, recent: [], updatedAt: 0 };
  }
  function saveCache(c) { try { localStorage.setItem(LS, JSON.stringify(c)); } catch (e) {} }

  async function rpc(method, params, timeoutMs) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs || 25000);
    try {
      const r = await fetch('https://mainnet.base.org', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: ctl.signal,
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message);
      return j.result;
    } finally { clearTimeout(t); }
  }
  const hexBlock = n => '0x' + n.toString(16);
  const MIN_RANGE = 400; // adaptive-split floor (shared rescue-burn.js pattern)

  async function getLogsRange(from, to) {
    // mainnet.base.org 413s/drops topic-filtered eth_getLogs on wide ranges.
    // On a range-limit signal, halve the range and retry; give up below MIN_RANGE.
    try {
      return await rpc('eth_getLogs', [{
        address: RESCUE, topics: [TOPIC_TRANSFER, null, DEAD_TOPIC],
        fromBlock: hexBlock(from), toBlock: hexBlock(to),
      }], 30000);
    } catch (e) {
      const msg = String(e && e.message || e);
      const rangeLimit = /413|Payload Too Large|block range|exceeds.*range|closed connection|RemoteDisconnected|empty reply|socket hang up/i.test(msg);
      if (rangeLimit && (to - from + 1) > MIN_RANGE) {
        const mid = Math.floor((from + to) / 2);
        const a = await getLogsRange(from, mid);
        const b = await getLogsRange(mid + 1, to);
        return a.concat(b);
      }
      throw e;
    }
  }

  async function scanRange(from, to, cache) {
    const logs = await getLogsRange(from, to);
    for (const lg of logs) {
      const fromAddr = '0x' + lg.topics[1].slice(26);
      const amt = BigInt(lg.data);
      cache.total = (BigInt(cache.total) + amt).toString();
      cache.burners[fromAddr] = (BigInt(cache.burners[fromAddr] || '0') + amt).toString();
      cache.recent.unshift({ from: fromAddr, raw: amt.toString(), block: parseInt(lg.blockNumber, 16), ts: 0 });
    }
    if (cache.recent.length > 30) cache.recent.length = 30;
    return logs.length;
  }

  async function fillTimestamps(cache) {
    // only the 10 most recent need human times
    for (const b of cache.recent.slice(0, 10)) {
      if (b.ts) continue;
      try {
        const blk = await rpc('eth_getBlockByNumber', [hexBlock(b.block), false], 15000);
        b.ts = parseInt(blk.timestamp, 16) * 1000;
      } catch (e) { break; }
    }
  }

  async function sync() {
    const cache = loadCache();
    try {
      const latest = parseInt(await rpc('eth_blockNumber', [], 20000), 16);
      let from = cache.lastBlock + 1, n = 0;
      while (from <= latest) {
        const to = Math.min(from + CHUNK - 1, latest);
        n += await scanRange(from, to, cache);
        from = to + 1;
        cache.lastBlock = to;
        saveCache(cache);
        render(cache, false);
      }
      await fillTimestamps(cache);
      cache.updatedAt = Date.now();
      saveCache(cache);
      render(cache, true);
      return { ok: true, newEvents: n, cache };
    } catch (e) {
      render(cache, false, String(e.message || e));
      return { ok: false, error: String(e.message || e), cache };
    }
  }

  function render(cache, fresh, err) {
    const total = BigInt(cache.total);
    const el = id => document.getElementById(id);
    if (el('burnTotal')) el('burnTotal').textContent = fmtR(total);
    const day = Date.now() - 86400000;
    let r24 = 0n;
    (cache.recent || []).forEach(b => { if (b.ts && b.ts > day) r24 += BigInt(b.raw); });
    if (el('burnRate')) el('burnRate').textContent = fmtR(r24);
    if (el('burnSync')) el('burnSync').textContent =
      (fresh ? '● live · ' : '○ cached · ') + 'last synced ' +
      (cache.updatedAt ? new Date(cache.updatedAt).toLocaleTimeString() : 'never') +
      (err ? ' · rpc hiccup: ' + err.slice(0, 60) : '') + ' · blocks → ' + (cache.lastBlock || 0).toLocaleString();
    if (el('burnFeed')) el('burnFeed').innerHTML = (cache.recent || []).slice(0, 8).map(b =>
      `<div class="row">🔥 ${fmtR(BigInt(b.raw))} <span class="r">${b.from.slice(0, 8)}… · ${b.ts ? new Date(b.ts).toLocaleString() : 'block ' + b.block}</span></div>`
    ).join('') || '<div class="row">no burns yet — be the first tribute</div>';
    if (el('burnLeaders')) {
      const rows = Object.entries(cache.burners || {}).sort((a, b) => (BigInt(b[1]) > BigInt(a[1]) ? 1 : -1)).slice(0, 8);
      el('burnLeaders').innerHTML = rows.map(([a, v], i) =>
        `<div class="row">${i + 1}. ${a.slice(0, 10)}… <span class="r">${fmtR(BigInt(v))} $RESCUE</span></div>`
      ).join('') || '<div class="row">—</div>';
    }
  }

  // flame intensity 0..1 for the renderer, from 24h burn volume (log scale)
  function intensity() {
    const cache = loadCache();
    const day = Date.now() - 86400000;
    let r24 = 0n;
    (cache.recent || []).forEach(b => { if (b.ts && b.ts > day) r24 += BigInt(b.raw); });
    const v = Number(r24 / (10n ** DP));
    return Math.min(1, Math.log10(1 + v) / 4);
  }

  window.LC = window.LC || {};
  window.LC.furnace = { sync, render: () => render(loadCache(), false), intensity, fmtR, RESCUE, DEAD, cache: loadCache };
})();

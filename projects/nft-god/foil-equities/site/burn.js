/* burn.js — THE FURNACE: live onchain $RESCUE burn status for the Foil Equities site.
 * Adapted from the Looper City reference implementation (~/workspace/looper-city/furnace.js).
 * Reads Transfer events on the $RESCUE contract where `to` = dead address,
 * via chunked eth_getLogs against a public Base RPC. Running total + last
 * scanned block cached in localStorage; polls for new burns on a timer.
 * Degrades to cached data with a "last synced" note if the RPC is slow.
 * This panel is LIVE — it reads real Base mainnet data, no wallet needed.
 */
(function () {
  'use strict';

  const RESCUE = '0x8201132Bc218dbD81305Ff5605F44aE4804D4BA3';
  const DEAD = '0x000000000000000000000000000000000000dEaD';
  // canonical ERC-20 Transfer(address,address,uint256) topic (from furnace.js)
  const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  const DEAD_TOPIC = '0x000000000000000000000000000000000000000000000000000000000000dead';
  const START_BLOCK = 51890000; // safely before $RESCUE launch (2026-09-28)
  const CHUNK = 2000;
  const LS = 'fe_burncache';
  const DP = 18n;
  const RPCS = ['https://mainnet.base.org', 'https://base.llamarpc.com'];

  const $ = (id) => document.getElementById(id);

  const fmtR = (raw) => {
    raw = BigInt(raw);
    const v = raw < 0n ? -raw : raw;
    const whole = v / 10n ** DP;
    const frac = v % 10n ** DP;
    const fs = frac.toString().padStart(18, '0').slice(0, 2);
    return Number(whole).toLocaleString('en-US') + '.' + fs;
  };

  function loadCache() {
    try {
      const c = JSON.parse(localStorage.getItem(LS));
      if (c && c.lastBlock) return c;
    } catch (e) {}
    return { total: '0', lastBlock: START_BLOCK - 1, burners: {}, recent: [], updatedAt: 0 };
  }
  function saveCache(c) {
    try { localStorage.setItem(LS, JSON.stringify(c)); } catch (e) {}
  }

  async function rpc(method, params, timeoutMs) {
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
    let lastErr = null;
    for (const url of RPCS) {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), timeoutMs || 25000);
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          signal: ctl.signal,
        });
        const j = await r.json();
        if (j.error) throw new Error(j.error.message);
        return j.result;
      } catch (e) {
        lastErr = e;
      } finally {
        clearTimeout(t);
      }
    }
    throw lastErr;
  }

  const hexBlock = (n) => '0x' + n.toString(16);
  const MIN_RANGE = 400;

  async function getLogsRange(from, to) {
    try {
      return await rpc('eth_getLogs', [{
        address: RESCUE,
        topics: [TRANSFER_TOPIC, null, DEAD_TOPIC],
        fromBlock: hexBlock(from),
        toBlock: hexBlock(to),
      }], 30000);
    } catch (e) {
      const msg = String((e && e.message) || e);
      const rangeLimit = /413|Payload Too Large|block range|exceeds.*range|closed connection|RemoteDisconnected|empty reply|socket hang up/i.test(msg);
      if (rangeLimit && to - from + 1 > MIN_RANGE) {
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
      cache.recent.unshift({
        from: fromAddr,
        raw: amt.toString(),
        block: parseInt(lg.blockNumber, 16),
      });
    }
    if (cache.recent.length > 12) cache.recent.length = 12;
    return logs.length;
  }

  function ago(ts) {
    if (!ts) return 'never';
    const s = Math.floor(Date.now() / 1000) - ts;
    if (s < 60) return s + 's ago';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    return Math.floor(s / 3600) + 'h ago';
  }

  function render(cache, status) {
    const totalEl = $('burn-total');
    const statusEl = $('burn-status');
    const recentEl = $('burn-recent');
    if (totalEl) totalEl.textContent = fmtR(cache.total);
    if (statusEl) {
      statusEl.textContent = status;
      statusEl.className = 'burn-status ' + (status.startsWith('LIVE') ? 'live' : 'cached');
    }
    if (recentEl) {
      recentEl.innerHTML = '';
      if (!cache.recent.length) {
        recentEl.innerHTML = '<div class="burn-row dim">no burns indexed yet — syncing…</div>';
        return;
      }
      for (const r of cache.recent) {
        const div = document.createElement('div');
        div.className = 'burn-row';
        const short = r.from.slice(0, 6) + '…' + r.from.slice(-4);
        div.innerHTML =
          '<span class="burn-amt">🔥 ' + fmtR(r.raw) + ' $RESCUE</span>' +
          '<span class="burn-from dim">' + short + '</span>' +
          '<span class="burn-block dim">#' + r.block.toLocaleString('en-US') + '</span>';
        recentEl.appendChild(div);
      }
    }
    const upd = $('burn-updated');
    if (upd) upd.textContent = 'last synced ' + ago(cache.updatedAt);
  }

  async function sync() {
    const cache = loadCache();
    render(cache, cache.updatedAt ? 'CACHED — syncing…' : 'SYNCING…');
    try {
      const head = parseInt(await rpc('eth_blockNumber', [], 20000), 16);
      let from = cache.lastBlock + 1;
      let scanned = 0;
      while (from <= head) {
        const to = Math.min(from + CHUNK - 1, head);
        scanned += await scanRange(from, to, cache);
        cache.lastBlock = to;
        from = to + 1;
        render(cache, 'LIVE — syncing…');
      }
      cache.updatedAt = Math.floor(Date.now() / 1000);
      saveCache(cache);
      render(cache, 'LIVE — ' + scanned + ' burn txs this sync');
    } catch (e) {
      render(cache, 'CACHED — rpc unreachable (' + String((e && e.message) || e).slice(0, 60) + ')');
    }
  }

  function init() {
    if (!$('burn-total')) return;
    sync();
    setInterval(sync, 5 * 60 * 1000); // re-poll every 5 min
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

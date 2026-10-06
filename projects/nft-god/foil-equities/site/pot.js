/* pot.js — STOCK POT dashboard: read-only live readout.
 *
 * Reads (never writes): eth_call for USDC.balanceOf(pot), activatedCount(),
 * totalMinted(), lastDistribution(); eth_getLogs for Distributed events to
 * total the drips. No wallet, no signing, no transactions — ever.
 *
 * Until window.FoilConfig.deployed is true with real addresses, this keeps
 * the honest placeholder: dashes + "not deployed yet". All chain access is
 * read-only against public RPCs.
 */
(function () {
  'use strict';

  // Function selectors / event topic, precomputed offline from the
  // canonical signatures (see contracts/StockPot.sol, Activation.sol):
  var SEL_BALANCE_OF = '0x70a08231';            // balanceOf(address)
  var SEL_ACTIVATED_COUNT = '0x06f9e52c';       // activatedCount()
  var SEL_TOTAL_MINTED = '0xa2309ff8';          // totalMinted()
  var SEL_LAST_DISTRIBUTION = '0xa717639c';     // lastDistribution()
  var TOPIC_DISTRIBUTED = '0xc5d35a65af09b3042394b742529d10f7fbf9a37294d6b13e4d63d06f9909a15b';
  // Distributed(uint256 indexed epochId, uint256 usdcIn, uint256 perNftCount)
  var EPOCH_SECS = 7 * 24 * 3600;
  var CHUNK = 2000;
  var LS = 'fe_potcache';

  var $ = function (id) { return document.getElementById(id); };

  function padAddr(a) {
    return '0x' + a.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  }

  function loadCache() {
    try {
      var c = JSON.parse(localStorage.getItem(LS));
      if (c && typeof c === 'object') return c;
    } catch (e) {}
    return { dripped: '0', lastBlock: 0, updatedAt: 0 };
  }
  function saveCache(c) {
    try { localStorage.setItem(LS, JSON.stringify(c)); } catch (e) {}
  }

  function rpcCall(cfg, method, params, timeoutMs) {
    var body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: method, params: params });
    var tryOne = function (url) {
      return new Promise(function (resolve, reject) {
        var ctl = new AbortController();
        var t = setTimeout(function () { ctl.abort(); }, timeoutMs || 20000);
        fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: body,
          signal: ctl.signal
        }).then(function (r) {
          clearTimeout(t);
          if (!r.ok) throw new Error('http ' + r.status);
          return r.json();
        }).then(function (j) {
          if (j.error) throw new Error(j.error.message || 'rpc error');
          resolve(j.result);
        }).catch(reject);
      });
    };
    var seq = Promise.reject(new Error('no rpc'));
    cfg.chain.rpcs.forEach(function (url) {
      seq = seq.catch(function () { return tryOne(url); });
    });
    return seq;
  }

  function ethCall(cfg, to, data, block) {
    return rpcCall(cfg, 'eth_call', [{ to: to, data: data }, block || 'latest'])
      .then(function (hex) { return BigInt(hex); });
  }

  function fmtUsdc(raw6) {
    var v = BigInt(raw6);
    var whole = v / 1000000n;
    var frac = (v % 1000000n).toString().padStart(6, '0').slice(0, 2);
    return Number(whole).toLocaleString('en-US') + '.' + frac;
  }

  function fmtCountdown(targetMs) {
    var s = Math.max(0, Math.floor((targetMs - Date.now()) / 1000));
    var d = Math.floor(s / 86400); s -= d * 86400;
    var h = Math.floor(s / 3600); s -= h * 3600;
    var m = Math.floor(s / 60);
    if (d > 0) return d + 'd ' + h + 'h';
    if (h > 0) return h + 'h ' + m + 'm';
    return m + 'm';
  }

  function setStats(tvl, activated, epochLabel, dripped) {
    var el;
    el = $('pot-tvl'); if (el) el.textContent = tvl;
    el = $('pot-activated'); if (el) el.textContent = activated;
    el = $('pot-epoch'); if (el) el.textContent = epochLabel;
    el = $('pot-dripped'); if (el) el.textContent = dripped;
  }

  function setNote(html) {
    var el = $('pot-note');
    if (el) el.innerHTML = html;
  }

  // Chunked scan of Distributed events -> lifetime USDC dripped (6dp).
  function scanDripped(cfg, pot, fromBlock) {
    var cache = loadCache();
    var total = BigInt(cache.dripped || '0');
    var start = Math.max(fromBlock, (cache.lastBlock || 0) + 1);
    return rpcCall(cfg, 'eth_blockNumber', [])
      .then(function (headHex) {
        var head = parseInt(headHex, 16);
        var cur = start;
        var step = function () {
          if (cur > head) return { total: total, head: head };
          var to = Math.min(cur + CHUNK - 1, head);
          return rpcCall(cfg, 'eth_getLogs', [{
            fromBlock: '0x' + cur.toString(16),
            toBlock: '0x' + to.toString(16),
            address: pot,
            topics: [TOPIC_DISTRIBUTED]
          }]).then(function (logs) {
            (logs || []).forEach(function (log) {
              // data = usdcIn (32B) ++ perNftCount (32B); epochId is indexed
              var usdcIn = BigInt('0x' + (log.data || '0x').slice(2, 66));
              total += usdcIn;
            });
            cur = to + 1;
            return step();
          });
        };
        return step();
      })
      .then(function (r) {
        cache.dripped = r.total.toString();
        cache.lastBlock = r.head;
        cache.updatedAt = Date.now();
        saveCache(cache);
        return r.total;
      });
  }

  function live(cfg) {
    var c = cfg.contracts;
    setNote('⏳ Syncing live pot data from ' + cfg.chain.name + '…');
    // sanity: the RPC must actually be our chain
    rpcCall(cfg, 'eth_chainId', []).then(function (chainHex) {
      if (parseInt(chainHex, 16) !== cfg.chain.id) {
        throw new Error('RPC served chain ' + parseInt(chainHex, 16) + ', expected ' + cfg.chain.id);
      }
      return Promise.all([
        ethCall(cfg, c.usdc, SEL_BALANCE_OF + padAddr(c.stockPot).slice(2)),
        ethCall(cfg, c.activation, SEL_ACTIVATED_COUNT),
        ethCall(cfg, c.foilEquities, SEL_TOTAL_MINTED),
        ethCall(cfg, c.stockPot, SEL_LAST_DISTRIBUTION)
      ]);
    }).then(function (r) {
      var tvl = fmtUsdc(r[0]);
      var activated = r[1].toString();
      var minted = r[2].toString();
      var lastDist = Number(r[3]);
      var epochLabel;
      if (lastDist === 0) {
        epochLabel = 'epoch 1 pending';
      } else {
        var nextMs = (lastDist + EPOCH_SECS) * 1000;
        epochLabel = nextMs > Date.now() ? fmtCountdown(nextMs) : 'ready now';
      }
      setStats(tvl, activated + ' / ' + minted, epochLabel, '…');
      setNote('✅ Live from ' + cfg.chain.name + ' · StockPot <code>' +
        c.stockPot.slice(0, 10) + '…</code> · read-only, no wallet needed.');
      var fromBlock = cfg.potDeployBlock || 0;
      return scanDripped(cfg, c.stockPot, fromBlock);
    }).then(function (dripped) {
      var el = $('pot-dripped');
      if (el) el.textContent = fmtUsdc(dripped);
    }).catch(function (e) {
      var cache = loadCache();
      setStats('—', '—', '—', cache.dripped !== '0' ? fmtUsdc(cache.dripped) + ' (cached)' : '—');
      setNote('⚠️ Pot RPC unreachable (' + String(e.message || e).slice(0, 80) +
        ') — showing cached data only. Retrying automatically.');
      setTimeout(function () { live(cfg); }, 5 * 60 * 1000);
    });
  }

  function init() {
    var cfg = window.FoilConfig;
    if (!cfg || !cfg.deployed || !cfg.contracts || !cfg.contracts.stockPot) {
      // Honest placeholder: nothing deployed, zero chain calls.
      setNote('⏳ Live pot data appears after deployment. Until then this is a placeholder — ' +
        'the distributor logic is tested and green (see test/run-economics.mjs, section H).');
      return;
    }
    live(cfg);
    // re-poll the light stats every 5 minutes; the drip scan is cached
    setInterval(function () { live(cfg); }, 5 * 60 * 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

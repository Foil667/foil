/* flywheel.js — Wallet Report Card flywheel modules.
 *
 * 1. History: per-address+chain persistence (first seen, visits, best grade).
 * 2. Share: URL-encoded share state (?address=0x…&chain=base) that auto-runs
 *    the grade on load.
 * 3. Pro grade: deeper metrics unlocked with a DEMO $RESCUE fee. The fee is a
 *    pure client-side simulation — no wallet connection, no signatures, no
 *    fund movement. Every demo element carries a DEMO badge. Real onchain
 *    $RESCUE burn numbers come only from RescueBurn (shared module), which
 *    reads real Base Transfer events.
 * 4. Top Wallets: community-submitted wallet leaderboard (per-device),
 *    graded live, ranked by score.
 * 5. Grader tiers: Analyst (1+ pro grades) → Sleuth (5+) → Oracle (15+).
 *
 * Pure logic (History/Ledger/Share/ProGrade/Board) is DOM-free and unit
 * tested. UI helpers render into provided elements and are no-ops when
 * `document` is unavailable.
 */
(function (global) {
  'use strict';

  var HISTORY_KEY = 'wrc-history-v1';
  var LEDGER_KEY = 'wrc-demo-ledger-v1';
  var BOARD_KEY = 'wrc-leaderboard-v1';
  var HISTORY_MAX = 50;

  var PRO_FEE_DEMO = 1000;      // demo $RESCUE per pro grade
  var PRO_BURN_SHARE = 0.20;    // 20% of the demo fee is "burned" (demo ledger)
  var DEMO_SEED = 20000;        // starting demo balance per device (covers all tiers: Oracle needs 15 pro grades = 15,000)

  var TIERS = [
    { min: 15, name: 'Oracle' },
    { min: 5, name: 'Sleuth' },
    { min: 1, name: 'Analyst' },
  ];

  var VALID_CHAINS = { base: true, ethereum: true, robinhood: true };
  var ZERO = '0x0000000000000000000000000000000000000000';

  function isAddress(v) { return /^0x[0-9a-fA-F]{40}$/.test(v || ''); }
  function norm(v) { return String(v || '').toLowerCase(); }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[m];
    });
  }
  function round1(v) { return Math.round(v * 10) / 10; }
  function shortAddr(v) { return v ? v.slice(0, 6) + '…' + v.slice(-4) : ''; }
  function timeAgo(ts) {
    var d = Date.now() - ts;
    if (d < 0) return 'just now';
    if (d < 60000) return Math.max(1, Math.round(d / 1000)) + 's ago';
    if (d < 3600000) return Math.round(d / 60000) + 'm ago';
    if (d < 86400000) return Math.round(d / 3600000) + 'h ago';
    return Math.round(d / 86400000) + 'd ago';
  }

  function storeGet(key, fallback) {
    try {
      var raw = global.localStorage.getItem(key);
      if (raw === null || raw === undefined) return fallback;
      return JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function storeSet(key, value) {
    try { global.localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }

  /* ---- 1. History ---- */
  var History = {
    key: function (address, chain) { return norm(address) + ':' + chain; },
    record: function (address, chain, report) {
      var all = storeGet(HISTORY_KEY, []);
      if (!Array.isArray(all)) all = [];
      var key = this.key(address, chain);
      var now = Date.now();
      var entry = null;
      for (var i = 0; i < all.length; i++) {
        if (all[i] && all[i].key === key) { entry = all[i]; break; }
      }
      if (!entry) {
        entry = { key: key, address: norm(address), chain: chain, firstSeen: now, visits: 0,
                  bestScore: null, bestRating: null, bestAt: null };
        all.push(entry);
      }
      entry.visits += 1;
      entry.lastSeen = now;
      entry.lastStatus = report ? report.status : 'unknown';
      entry.lastAnalyzedAt = report && report.analyzedAt ? report.analyzedAt : null;
      if (report && report.status === 'ok') {
        entry.lastScore = report.score;
        entry.lastRating = report.rating;
        if (entry.bestScore === null || report.score > entry.bestScore) {
          entry.bestScore = report.score;
          entry.bestRating = report.rating;
          entry.bestAt = now;
        }
      }
      all.sort(function (a, b) { return (b.lastSeen || 0) - (a.lastSeen || 0); });
      if (all.length > HISTORY_MAX) all.length = HISTORY_MAX;
      storeSet(HISTORY_KEY, all);
      return entry;
    },
    list: function () {
      var all = storeGet(HISTORY_KEY, []);
      return Array.isArray(all) ? all : [];
    },
    get: function (address, chain) {
      var key = this.key(address, chain);
      var all = this.list();
      for (var i = 0; i < all.length; i++) if (all[i] && all[i].key === key) return all[i];
      return null;
    },
    clear: function () { storeSet(HISTORY_KEY, []); },
  };

  /* ---- 3. Demo ledger + tiers ---- */
  var Ledger = {
    state: function () {
      var s = storeGet(LEDGER_KEY, null);
      if (!s || typeof s !== 'object') {
        s = { demoBalance: DEMO_SEED, proGradesRun: 0, totalSpentDemo: 0,
              totalBurnedDemo: 0, treasuryDemo: 0, seededAt: Date.now() };
        storeSet(LEDGER_KEY, s);
      }
      return s;
    },
    fee: function () { return PRO_FEE_DEMO; },
    burnShare: function () { return PRO_BURN_SHARE; },
    feeSplit: function () {
      var burned = Math.round(PRO_FEE_DEMO * PRO_BURN_SHARE);
      return { fee: PRO_FEE_DEMO, burned: burned, treasury: PRO_FEE_DEMO - burned };
    },
    canAfford: function () { return this.state().demoBalance >= PRO_FEE_DEMO; },
    chargeProGrade: function () {
      // DEMO ONLY: deducts from a simulated client-side balance. No chain
      // interaction, no signature, nothing real moves.
      var s = this.state();
      if (s.demoBalance < PRO_FEE_DEMO) return { ok: false, reason: 'insufficient demo balance' };
      var split = this.feeSplit();
      s.demoBalance -= split.fee;
      s.proGradesRun += 1;
      s.totalSpentDemo += split.fee;
      s.totalBurnedDemo += split.burned;
      s.treasuryDemo += split.treasury;
      storeSet(LEDGER_KEY, s);
      return { ok: true, demo: true, fee: split.fee, burned: split.burned,
               treasury: split.treasury, balance: s.demoBalance,
               proGradesRun: s.proGradesRun };
    },
    tier: function () {
      var n = this.state().proGradesRun;
      for (var i = 0; i < TIERS.length; i++) if (n >= TIERS[i].min) return TIERS[i].name;
      return null;
    },
    tierProgress: function () {
      var n = this.state().proGradesRun;
      var cur = this.tier();
      var next = null;
      for (var i = TIERS.length - 1; i >= 0; i--) {
        if (n < TIERS[i].min) { next = TIERS[i]; break; }
      }
      return { current: cur, count: n, next: next ? next.name : null, need: next ? next.min - n : 0 };
    },
    reset: function () { storeSet(LEDGER_KEY, null); return this.state(); },
  };

  /* ---- 2. Share state ---- */
  var Share = {
    parse: function (search) {
      try {
        var q = String(search || '');
        if (q.charAt(0) === '?') q = q.slice(1);
        var params = {};
        q.split('&').forEach(function (pair) {
          var kv = pair.split('=');
          if (kv.length === 2) params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]);
        });
        var address = params.address || '';
        var chain = params.chain || 'base';
        if (!isAddress(address)) return null;
        if (!VALID_CHAINS[chain]) chain = 'base';
        return { address: norm(address), chain: chain };
      } catch (e) { return null; }
    },
    build: function (address, chain) {
      return '?address=' + encodeURIComponent(norm(address)) + '&chain=' + encodeURIComponent(chain || 'base');
    },
    full: function (address, chain) {
      var loc = global.location || {};
      var base = (loc.origin || '') + (loc.pathname || '');
      return base + this.build(address, chain);
    },
  };

  /* ---- 3b. Pro grade metrics (pure, from the scan's transfers) ---- */
  var ProGrade = {
    compute: function (transfers, address, report) {
      var w = norm(address);
      var inbound = 0, outbound = 0, selfMoves = 0, mints = 0;
      var cps = {};      // other address -> interaction count
      var cols = {};     // contract -> {count, name}
      var firstTs = Infinity, lastTs = 0, n = 0;
      (transfers || []).forEach(function (t) {
        var from = norm(t.from), to = norm(t.to);
        n += 1;
        if (typeof t.timestampMs === 'number' && isFinite(t.timestampMs)) {
          if (t.timestampMs < firstTs) firstTs = t.timestampMs;
          if (t.timestampMs > lastTs) lastTs = t.timestampMs;
        }
        var c = norm(t.contract);
        if (!cols[c]) cols[c] = { count: 0, name: t.collectionName || null };
        cols[c].count += 1;
        if (from === w && to === w) { selfMoves += 1; return; }
        if (to === w) {
          inbound += 1;
          if (from === ZERO) mints += 1; else cps[from] = (cps[from] || 0) + 1;
        }
        if (from === w) {
          outbound += 1;
          cps[to] = (cps[to] || 0) + 1;
        }
      });
      function topOf(obj, valKey) {
        var best = null, bestN = 0;
        Object.keys(obj).forEach(function (k) {
          var v = valKey ? obj[k][valKey] : obj[k];
          if (v > bestN) { bestN = v; best = k; }
        });
        return best ? { key: best, count: bestN } : null;
      }
      var active = inbound + outbound;
      var topCp = topOf(cps, null);
      var topCol = topOf(cols, 'count');
      var uniqueCps = Object.keys(cps).length;
      var uniqueCols = Object.keys(cols).length;
      var topCpShare = active > 0 && topCp ? round1((topCp.count / active) * 100) : 0;
      var topColShare = n > 0 && topCol ? round1((topCol.count / n) * 100) : 0;
      var spanDays = isFinite(firstTs) ? Math.max(0, (lastTs - firstTs) / 86400000) : 0;
      var per30d = spanDays > 0 ? round1(active / (spanDays / 30)) : active;
      var signals = [];
      if (topCpShare >= 50 && active >= 10) signals.push({ level: 'watch', text: 'One counterparty dominates ' + topCpShare + '% of flows — wash-trade pattern worth a second look.' });
      else if (uniqueCps >= 20) signals.push({ level: 'good', text: uniqueCps + ' distinct counterparties — genuinely distributed flow.' });
      if (topColShare >= 70 && n >= 10) signals.push({ level: 'watch', text: 'Portfolio is ' + topColShare + '% one collection — concentration risk.' });
      if (mints > 0 && inbound > 0) signals.push({ level: 'info', text: round1((mints / inbound) * 100) + '% of acquisitions are primary mints (from the zero address).' });
      if (per30d >= 30) signals.push({ level: 'watch', text: 'High velocity: ~' + per30d + ' transfers per 30 days — bot-like pace.' });
      if (signals.length === 0) signals.push({ level: 'info', text: 'No strong whale or wash signals in this window.' });
      return {
        flows: { inbound: inbound, outbound: outbound, selfMoves: selfMoves, mints: mints, total: n },
        counterparty: {
          unique: uniqueCps,
          top: topCp ? { address: topCp.key, short: shortAddr(topCp.key), count: topCp.count, sharePct: topCpShare } : null,
        },
        collections: {
          unique: uniqueCols,
          top: topCol ? { contract: topCol.key, short: shortAddr(topCol.key), name: cols[topCol.key].name, count: topCol.count, sharePct: topColShare } : null,
        },
        velocity: { per30d: per30d, spanDays: round1(spanDays) },
        signals: signals,
        note: 'Derived from the same live transfer feed as the basic grade. Counterparty names are not resolved — only addresses.',
      };
    },
  };

  /* ---- 4. Top Wallets leaderboard ---- */
  var Board = {
    seed: function () {
      return [
        { key: 'seed-foil', address: '0x6573682faee72a4a96e791ba262439f1df3a268d', chain: 'base', addedAt: Date.now(), seeded: true },
        { key: 'seed-holder', address: '0x72491ba4ef67a46809c4e79126f4d2ea2ddecE0A', chain: 'base', addedAt: Date.now(), seeded: true },
      ];
    },
    list: function () {
      var all = storeGet(BOARD_KEY, null);
      if (!Array.isArray(all)) {
        all = this.seed();
        storeSet(BOARD_KEY, all);
      }
      return all;
    },
    save: function (all) { storeSet(BOARD_KEY, all); return all; },
    key: function (address, chain) { return 'u:' + norm(address) + ':' + chain; },
    add: function (address, chain) {
      if (!isAddress(address)) return { ok: false, reason: 'invalid address' };
      if (!VALID_CHAINS[chain]) chain = 'base';
      var all = this.list();
      var key = this.key(address, chain);
      for (var i = 0; i < all.length; i++) if (all[i].key === key) return { ok: false, reason: 'already on the board' };
      var entry = { key: key, address: norm(address), chain: chain, addedAt: Date.now(), seeded: false };
      all.push(entry);
      this.save(all);
      return { ok: true, entry: entry };
    },
    remove: function (key) {
      var all = this.list().filter(function (e) { return e.key !== key; });
      this.save(all);
    },
    setGrade: function (key, report) {
      var all = this.list();
      for (var i = 0; i < all.length; i++) {
        if (all[i].key === key) {
          all[i].gradedAt = Date.now();
          all[i].status = report ? report.status : 'error';
          if (report && report.status === 'ok') { all[i].score = report.score; all[i].rating = report.rating; }
          else { all[i].score = null; all[i].rating = null; }
          break;
        }
      }
      this.save(all);
    },
    ranked: function () {
      var all = this.list().slice();
      all.sort(function (a, b) {
        var sa = (typeof a.score === 'number') ? a.score : -1;
        var sb = (typeof b.score === 'number') ? b.score : -1;
        if (sb !== sa) return sb - sa;
        return (a.addedAt || 0) - (b.addedAt || 0);
      });
      return all;
    },
  };

  /* ---- UI helpers (browser only) ---- */
  function hasDOM() { return typeof global.document !== 'undefined' && global.document; }

  function tierBadgeHTML() {
    var p = Ledger.tierProgress();
    var label = p.current ? p.current : 'Unranked';
    var next = p.next ? ' · ' + p.need + ' pro grade' + (p.need === 1 ? '' : 's') + ' to ' + p.next : ' · max rank';
    return '<span class="tier-pill">' + esc(label) + '</span>' +
      '<span class="tier-sub">' + p.count + ' pro grade' + (p.count === 1 ? '' : 's') + next + '</span>';
  }

  function renderTier(el) {
    if (!hasDOM() || !el) return;
    el.innerHTML = '<span class="tier-line">GRADER RANK ' + tierBadgeHTML() + '</span>';
  }

  function historyRowHTML(e) {
    var grade = (typeof e.bestScore === 'number')
      ? '<strong>' + e.bestScore + '/100</strong> ' + esc(e.bestRating || '')
      : '<span class="hist-nograde">no grade yet</span>';
    return '<div class="hist-row">' +
      '<div class="hist-id"><span class="mono">' + esc(shortAddr(e.address)) + '</span>' +
      '<span class="hist-chain">' + esc(e.chain) + '</span></div>' +
      '<div class="hist-grade">' + grade + '</div>' +
      '<div class="hist-meta">' + e.visits + ' visit' + (e.visits === 1 ? '' : 's') +
      ' · first ' + esc(timeAgo(e.firstSeen)) +
      ' · last ' + esc(timeAgo(e.lastSeen || e.firstSeen)) + '</div>' +
      '<div class="hist-actions"><a class="hist-link" href="' + esc(Share.build(e.address, e.chain)) + '">Open grade</a></div>' +
      '</div>';
  }

  function renderHistory(el) {
    if (!hasDOM() || !el) return;
    var all = History.list();
    if (!all.length) {
      el.innerHTML = '<p class="hist-empty">No graded wallets yet on this device. Grade a wallet and it will be remembered here.</p>';
      return;
    }
    el.innerHTML = all.map(historyRowHTML).join('');
  }

  function demoPill() { return '<span class="demo-pill">DEMO</span>'; }

  function proPanelHTML() {
    var split = Ledger.feeSplit();
    var bal = Ledger.state().demoBalance;
    return '<div class="pro-panel">' +
      '<div class="section-heading"><span>Pro grade ' + demoPill() + '</span><span>' + PRO_FEE_DEMO.toLocaleString() + ' $RESCUE</span></div>' +
      '<p class="pro-copy">Deeper cut: token flows, counterparty risk, whale signals. Unlocks with a <strong>' + demoPill() + '</strong> fee of ' +
      split.fee.toLocaleString() + ' $RESCUE — split <strong>' + split.burned.toLocaleString() + ' burned</strong> · ' +
      split.treasury.toLocaleString() + ' to Foil\'s treasury. Nothing real moves; it\'s a simulation against your demo balance of <strong>' +
      bal.toLocaleString() + '</strong> $RESCUE.</p>' +
      '<button class="pro-button" type="button" id="pro-unlock">' + (Ledger.canAfford() ? 'Unlock pro grade — 1,000 demo $RESCUE' : 'Demo balance too low') + '</button>' +
      '</div><div id="pro-result"></div>';
  }

  function proResultHTML(pro, charge) {
    var p = pro;
    var rows = [];
    rows.push(['Inbound transfers', p.flows.inbound, 'NFTs received (incl. mints)']);
    rows.push(['Outbound transfers', p.flows.outbound, 'NFTs sent on']);
    rows.push(['Primary mints', p.flows.mints, 'Inbound from the zero address']);
    rows.push(['Self-moves', p.flows.selfMoves, 'Wallet → wallet, ignored by the score']);
    rows.push(['Unique counterparties', p.counterparty.unique, 'Distinct addresses traded with']);
    if (p.counterparty.top) rows.push(['Top counterparty', p.counterparty.top.short + ' · ' + p.counterparty.top.sharePct + '%', p.counterparty.top.count + ' of ' + (p.flows.inbound + p.flows.outbound) + ' flows']);
    rows.push(['Unique collections', p.collections.unique, 'Distinct NFT contracts touched']);
    if (p.collections.top) rows.push(['Top collection', (p.collections.top.name ? p.collections.top.name : p.collections.top.short) + ' · ' + p.collections.top.sharePct + '%', p.collections.top.count + ' of ' + p.flows.total + ' transfers']);
    rows.push(['Velocity', '~' + p.velocity.per30d + ' / 30d', 'Over ' + p.velocity.spanDays + ' days of activity']);
    var sig = p.signals.map(function (s) {
      return '<li class="sig-' + esc(s.level) + '">' + esc(s.text) + '</li>';
    }).join('');
    var body = rows.map(function (r) {
      return '<div class="metric-row"><div><p class="metric-label">' + esc(r[0]) + '</p><p class="metric-note">' + esc(r[2]) + '</p></div><strong class="metric-value">' + esc(String(r[1])) + '</strong></div>';
    }).join('');
    return '<div class="pro-result">' +
      '<div class="section-heading"><span>Pro grade ' + demoPill() + '</span><span>CHARGED ' + charge.fee.toLocaleString() + '</span></div>' +
      '<p class="pro-charge-note">Demo fee split: ' + charge.burned.toLocaleString() + ' $RESCUE burned (demo) · ' +
      charge.treasury.toLocaleString() + ' $RESCUE to treasury (demo). Balance: ' + charge.balance.toLocaleString() + '.</p>' +
      body +
      '<div class="section-heading sig-head"><span>Signals</span><span>HEURISTIC</span></div>' +
      '<ul class="sig-list">' + sig + '</ul>' +
      '<p class="method-note">' + esc(p.note) + '</p>' +
      '</div>';
  }

  function boardRowHTML(e, rank) {
    var grade = (typeof e.score === 'number')
      ? '<strong>' + e.score + '/100</strong> ' + esc(e.rating || '')
      : (e.status && e.status !== 'ok' ? '<span class="hist-nograde">ungradable</span>' : '<span class="hist-nograde">ungraded</span>');
    var tag = e.seeded ? '<span class="board-tag">seeded demo</span>' : '<span class="board-tag">community</span>';
    return '<div class="board-row">' +
      '<div class="board-rank">#' + rank + '</div>' +
      '<div class="hist-id"><span class="mono">' + esc(shortAddr(e.address)) + '</span>' +
      '<span class="hist-chain">' + esc(e.chain) + '</span> ' + tag + '</div>' +
      '<div class="hist-grade">' + grade + '</div>' +
      '<div class="hist-actions"><a class="hist-link" href="' + esc(Share.build(e.address, e.chain)) + '">Grade</a>' +
      (e.seeded ? '' : ' <button class="linklike" type="button" data-board-remove="' + esc(e.key) + '">Remove</button>') + '</div>' +
      '</div>';
  }

  function renderBoard(el, opts) {
    if (!hasDOM() || !el) return;
    opts = opts || {};
    var all = Board.ranked();
    var rows = all.map(function (e, i) { return boardRowHTML(e, i + 1); }).join('');
    el.innerHTML =
      '<p class="board-note">Community-submitted wallets, graded live on this device and ranked by score. ' +
      'Submissions stay in this browser — nothing is uploaded. ' + demoPill() + ' board.</p>' +
      '<form class="board-form" id="board-form">' +
      '<input id="board-address" placeholder="0x… wallet to nominate" autocapitalize="off" autocorrect="off" spellcheck="false" />' +
      '<select id="board-chain"><option value="base">Base</option><option value="ethereum">Ethereum</option><option value="robinhood">Robinhood Chain</option></select>' +
      '<button type="submit">Nominate</button></form>' +
      '<p class="board-err" id="board-err" role="alert"></p>' +
      '<div class="board-rows">' + (rows || '<p class="hist-empty">Board is empty.</p>') + '</div>' +
      '<button class="pro-button board-grade" type="button" id="board-grade-all">Grade all ungraded</button>' +
      (opts.grading ? '<p class="board-progress">Grading board… ' + esc(opts.grading) + '</p>' : '');
    var form = global.document.getElementById('board-form');
    if (form) form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var addr = global.document.getElementById('board-address').value.trim();
      var chain = global.document.getElementById('board-chain').value;
      var res = Board.add(addr, chain);
      var err = global.document.getElementById('board-err');
      if (!res.ok) { if (err) err.textContent = res.reason === 'invalid address' ? 'Use a 42-character 0x wallet address.' : 'That wallet is already on the board.'; return; }
      if (err) err.textContent = '';
      renderBoard(el, opts);
      if (opts.onChange) opts.onChange();
    });
    var removes = el.querySelectorAll('[data-board-remove]');
    for (var i = 0; i < removes.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          Board.remove(btn.getAttribute('data-board-remove'));
          renderBoard(el, opts);
          if (opts.onChange) opts.onChange();
        });
      })(removes[i]);
    }
    var gradeAll = global.document.getElementById('board-grade-all');
    if (gradeAll && opts.onGradeAll) gradeAll.addEventListener('click', opts.onGradeAll);
  }

  function demoFurnaceHTML() {
    var s = Ledger.state();
    return '<div class="demo-furnace">' +
      '<div class="rbw-h">Demo burns (this device) ' + demoPill() + '</div>' +
      '<p><strong>' + s.totalBurnedDemo.toLocaleString() + '</strong> $RESCUE burned in demo pro grades · ' +
      s.proGradesRun + ' pro grade' + (s.proGradesRun === 1 ? '' : 's') + ' run · ' +
      s.treasuryDemo.toLocaleString() + ' $RESCUE to demo treasury.</p>' +
      '<p class="demo-furnace-note">Simulated only — these numbers never touch the chain. Real onchain burns are shown in the live furnace above.</p>' +
      '</div>';
  }

  global.Flywheel = {
    History: History,
    Ledger: Ledger,
    Share: Share,
    ProGrade: ProGrade,
    Board: Board,
    renderTier: renderTier,
    renderHistory: renderHistory,
    renderBoard: renderBoard,
    proPanelHTML: proPanelHTML,
    proResultHTML: proResultHTML,
    demoFurnaceHTML: demoFurnaceHTML,
    demoPill: demoPill,
    esc: esc,
    shortAddr: shortAddr,
    isAddress: isAddress,
    norm: norm,
    timeAgo: timeAgo,
    TIERS: TIERS,
    PRO_FEE_DEMO: PRO_FEE_DEMO,
  };
})(typeof window !== 'undefined' ? window : globalThis);

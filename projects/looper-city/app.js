/* Looper City — app.js (1/3): chain reads, seeded RNG, utils.
 * Reads Base ONLY. No wallet connect, nothing signed, ever.
 */
(function () {
  'use strict';
  window.LC = window.LC || {};
  const LOOPER = '0x1649CD37f4748807b4882FC48765bA0B2aFfa94a';
  const RESCUE = '0x8201132Bc218dbD81305Ff5605F44aE4804D4BA3';
  const HELIXA = '0x2e3B541C59D38b84E3Bc54e977200230A204Fe60';
  const SEL = { balanceOf: '0x70a08231', tokenURI: '0xc87b56dd', ownerOf: '0x6352211e' };
  const RPC_URL = 'https://mainnet.base.org';

  /* ---------- tiny utils ---------- */
  const $ = id => document.getElementById(id);
  const low = a => String(a || '').toLowerCase();
  const padAddr = a => low(a).replace(/^0x/, '').padStart(64, '0');
  const padUint = n => BigInt(n).toString(16).padStart(64, '0');
  const isAddr = a => /^0x[0-9a-fA-F]{40}$/.test(String(a || ''));
  const fmtInt = n => Number(n).toLocaleString('en-US');

  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

  /* ---------- RPC ---------- */
  async function rpc(method, params, timeoutMs) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs || 22000);
    try {
      const r = await fetch(RPC_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: ctl.signal,
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message || 'rpc error');
      return j.result;
    } finally { clearTimeout(t); }
  }
  const ethCall = (to, data, ms) => rpc('eth_call', [{ to, data }, 'latest'], ms);
  function decodeUint(hex) { return BigInt(hex); }
  function decodeString(hex) {
    const h = hex.slice(2);
    const len = parseInt(h.slice(64, 128), 16);
    const dh = h.slice(128, 128 + len * 2);
    let s = '';
    for (let i = 0; i < dh.length; i += 2) s += String.fromCharCode(parseInt(dh.slice(i, i + 2), 16));
    return decodeURIComponent(escape(s));
  }

  /* ---------- chain reads ---------- */
  async function getLooperBalance(addr) {
    const r = await ethCall(LOOPER, SEL.balanceOf + padAddr(addr));
    return decodeUint(r);
  }
  // Loopers is NOT ERC721Enumerable (tokenOfOwnerByIndex reverts) — enumerate
  // via Blockscout transfer history (CORS *), newest-first, net holdings.
  async function getHoldings(addr, expectN) {
    const a = low(addr); const held = new Map(); let page = 1;
    for (; page <= 6; page++) {
      const u = `https://base.blockscout.com/api?module=account&action=tokennfttx&contractaddress=${LOOPER}&address=${a}&page=${page}&offset=1000`;
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 25000);
      let d;
      try {
        const r = await fetch(u, { signal: ctl.signal });
        d = await r.json();
      } finally { clearTimeout(t); }
      if (!d || d.status !== '1' || !d.result || !d.result.length) break;
      for (const tr of d.result) {
        const tid = String(tr.tokenID);
        if (low(tr.to) === a) held.set(tid, Number(tr.timeStamp));
        else if (low(tr.from) === a) held.delete(tid);
        if (held.size >= Math.max(24, Number(expectN) || 24) && page > 1) break;
      }
      if (d.result.length < 1000) break;
    }
    return [...held.entries()].sort((x, y) => y[1] - x[1]).slice(0, 24).map(([id]) => id);
  }
  async function getTokenURI(id) {
    const r = await ethCall(LOOPER, SEL.tokenURI + padUint(id));
    return decodeString(r);
  }
  async function fetchMetadata(uri, tries) {
    let last;
    for (let i = 0; i < (tries || 3); i++) {
      try {
        const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
        const r = await fetch(uri, { signal: ctl.signal, redirect: 'follow' });
        clearTimeout(t);
        if (!r.ok) throw new Error('http ' + r.status);
        return await r.json();
      } catch (e) { last = e; await new Promise(r => setTimeout(r, 800 * (i + 1))); }
    }
    throw last;
  }
  const trait = (md, name) => { const a = (md.attributes || []).find(x => x.trait_type === name); return a ? a.value : null; };
  async function getRescueBalance(addr) { return decodeUint(await ethCall(RESCUE, SEL.balanceOf + padAddr(addr))); }
  async function getHelixaBalance(addr) { return decodeUint(await ethCall(HELIXA, SEL.balanceOf + padAddr(addr))); }
  async function getTxCount(addr) { return BigInt(await rpc('eth_getTransactionCount', [addr, 'latest'])); }
  async function getEthBalance(addr) { return decodeUint(await rpc('eth_getBalance', [addr, 'latest'])); }

  window.LC.chain = {
    LOOPER, RESCUE, HELIXA, RPC_URL, $, low, isAddr, fmtInt, fnv1a, mulberry32, pick,
    rpc, ethCall, getLooperBalance, getHoldings, getTokenURI, fetchMetadata, trait,
    getRescueBalance, getHelixaBalance, getTxCount, getEthBalance,
  };
})();
/* Looper City — app.js (2/3): generative city model + 16-bit canvas renderer. */
(function () {
  'use strict';
  const C = window.LC.chain;
  const W = 480, H = 270, GROUND = 200;

  const NIGHT = { skyTop: '#0b0620', skyBot: '#2a1a5e', bld: '#171233', bld2: '#201655', winDark: '#0c0920', road: '#12102a', side: '#1d1840', plaza: '#241d55', cloud: 'rgba(40,30,90,.5)' };
  const DAY = { skyTop: '#6ec6f5', skyBot: '#d8f2fa', bld: '#5a6b9e', bld2: '#7183b8', winDark: '#3d4a75', road: '#3a3f52', side: '#565b70', plaza: '#7c86a8', cloud: 'rgba(255,255,255,.75)' };
  const WINLIT = ['#00f0ff', '#ff2fd6', '#ffe14d', '#7dff5e'];
  function hexRGB(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function mix(a, b, k) {
    const A = hexRGB(a), B = hexRGB(b);
    return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`;
  }
  const pal = (key, night) => {
    const a = DAY[key], b = NIGHT[key];
    if (typeof a === 'string' && a[0] !== '#') return night > 0.5 ? b : a; // rgba() stops: no lerp
    return mix(a, b, night);
  };

  function themeFor(cls) {
    const s = String(cls || '').toLowerCase();
    if (/trader|broker/.test(s)) return 'exchange';
    if (/research|archiv/.test(s)) return 'archive';
    const h = C.fnv1a(s || 'looper');
    return ['spire', 'crown', 'dish', 'garden', 'lantern', 'obelisk'][h % 6];
  }

  /* ---------- model ---------- */
  function buildModel(d) {
    const rng = C.mulberry32(C.fnv1a(d.address.toLowerCase()));
    const txs = Number(d.txCount);
    const traffic = Math.min(1, Math.log10(1 + txs) / 4);
    const weather = ['clear', 'clear', 'rain', 'storm'][Math.floor(rng() * 4)];
    const towers = d.tokens.map((tk, i) => {
      const cls = tk.md ? (C.trait(tk.md, 'Agent Class') || tk.md.agent_class || 'Unknown') : 'Unknown';
      const h = Math.min(168, 44 + Math.log10(1 + txs) * 30 + rng() * 42);
      return {
        id: tk.id, cls, spec: tk.md ? (C.trait(tk.md, 'Specialization') || '') : '',
        head: tk.md ? (C.trait(tk.md, 'Head Layer') || '') : '',
        x: 10 + (i / Math.max(1, d.tokens.length - 1 || 1)) * 440 + (rng() - 0.5) * 14,
        w: 15 + Math.floor(rng() * 10), h: Math.round(h),
        theme: themeFor(cls), seed: C.fnv1a(d.address + ':' + tk.id),
        litSeed: Math.floor(rng() * 1e9),
      };
    });
    // keep towers out of the plaza zone
    towers.forEach(tw => { if (tw.x > 196 && tw.x < 284) tw.x += tw.x < 240 ? -92 : 92; });
    return {
      seed: C.fnv1a(d.address.toLowerCase()), address: d.address,
      nLoopers: d.nLoopers, shown: d.tokens.length, towers,
      txCount: txs, traffic, weather,
      rescue: d.rescueRaw > 0n, activated: d.activated,
      hasTinfoil: towers.some(t => /tinfoil/i.test(t.head)),
      ticker: towers.map(t => '#' + t.id).join(' ◆ ') + ' ◆ $RESCUE',
      night: 1,
    };
  }

  /* ---------- animation state ---------- */
  function createAnim(model) {
    const rng = C.mulberry32(model.seed ^ 0x9e3779b9);
    const cars = [], peds = [], clouds = [], stars = [];
    const nCars = 2 + Math.round(model.traffic * 5);
    for (let i = 0; i < nCars; i++) {
      const lane = i % 2;
      cars.push({ lane, x: rng() * W, v: (lane ? -1 : 1) * (14 + rng() * 22), c: C.pick(rng, ['#ff2fd6', '#00f0ff', '#ffe14d', '#7dff5e', '#ff6b4a']) });
    }
    const nPeds = 3 + Math.round(model.traffic * 8);
    for (let i = 0; i < nPeds; i++) peds.push({ x: rng() * W, v: (rng() < 0.5 ? -1 : 1) * (6 + rng() * 8), c: C.pick(rng, ['#8f86c8', '#c8b86a', '#6ac8b8', '#c86a9a']) });
    for (let i = 0; i < 4; i++) clouds.push({ x: rng() * W, y: 18 + rng() * 50, v: 2 + rng() * 4, s: 14 + rng() * 18 });
    for (let i = 0; i < 70; i++) stars.push({ x: rng() * W, y: rng() * 150, p: rng() * 6.28 });
    return { cars, peds, clouds, stars, residents: [], t: 0 };
  }
  function setResidents(anim, list) {
    const rng = C.mulberry32(1234);
    anim.residents = list.map((r, i) => ({ r, x: rng() * W, v: (i % 2 ? -1 : 1) * (7 + (i % 3) * 3) }));
  }

  /* ---------- draw helpers ---------- */
  function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }

  function drawTower(ctx, tw, night, t, model) {
    const x = tw.x, w = tw.w, h = tw.h, top = GROUND - h;
    const body = night > 0.5 ? (tw.theme === 'exchange' ? '#141b3d' : NIGHT.bld) : pal('bld', night);
    px(ctx, x, top, w, h, body);
    px(ctx, x, top, w, 2, night > 0.5 ? '#2c2260' : '#8b96c4'); // roof lip
    // windows
    const cols = Math.max(1, Math.floor((w - 4) / 5)), rows = Math.max(1, Math.floor((h - 12) / 7));
    const fr = Math.floor(t / 1.6);
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const hh = C.fnv1a(tw.seed + ':' + i + ':' + j);
      let lit = (hh % 100) < 46;
      if (night > 0.5 && (C.fnv1a(tw.seed + ':' + i + ':' + j + ':' + fr) % 151 === 0)) lit = !lit;
      const wc = lit ? (night > 0.5 ? WINLIT[hh % 4] : '#fff7c8') : (night > 0.5 ? NIGHT.winDark : pal('winDark', night));
      px(ctx, x + 3 + i * 5, top + 6 + j * 7, 3, 4, wc);
    }
    const rc = night > 0.5 ? '#3a2f8f' : '#4a5a8e';
    const cx = x + w / 2;
    if (tw.theme === 'exchange') {
      px(ctx, cx - 1, top - 16, 2, 16, rc);
      px(ctx, cx - 1, top - 18, 3, 3, (Math.floor(t * 2) % 2) ? '#ff5e5e' : '#5e1414');
      // ticker band
      px(ctx, x, top + h * 0.32, w, 9, '#05030f');
      ctx.fillStyle = '#00f0ff'; ctx.font = '6px monospace'; ctx.textBaseline = 'top';
      const msg = model.ticker; const off = -((t * 22) % (msg.length * 4 + w));
      ctx.fillText(msg, x + 2 + off, top + h * 0.32 + 1);
    } else if (tw.theme === 'archive') {
      ctx.fillStyle = rc; ctx.beginPath(); ctx.arc(cx, top, w / 2, Math.PI, 0); ctx.fill();
      px(ctx, cx - 2, top - w / 2 - 8, 4, 8, rc);
    } else if (tw.theme === 'spire') {
      ctx.fillStyle = rc; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(cx, top - 14); ctx.lineTo(x + w, top); ctx.fill();
    } else if (tw.theme === 'crown') {
      for (let k = 0; k < 3; k++) px(ctx, x + 2 + k * (w - 4) / 2.4, top - 6, (w - 4) / 4, 6, rc);
    } else if (tw.theme === 'dish') {
      px(ctx, cx - 1, top - 10, 2, 10, rc);
      ctx.fillStyle = '#9d94d6'; ctx.beginPath(); ctx.ellipse(cx + 4, top - 11, 7, 3, -0.5, 0, 6.3); ctx.fill();
    } else if (tw.theme === 'garden') {
      px(ctx, x, top - 3, w, 3, '#2f7a3d');
      px(ctx, x + 3, top - 7, 3, 4, '#2f7a3d'); px(ctx, x + w - 6, top - 6, 3, 3, '#3fa34d');
    } else if (tw.theme === 'lantern') {
      px(ctx, cx - 4, top - 9, 8, 9, night > 0.5 ? '#ffe14d' : '#c8a83d');
      if (night > 0.5) { px(ctx, cx - 6, top - 11, 12, 13, 'rgba(255,225,77,.18)'); }
    } else { // obelisk
      ctx.fillStyle = rc; ctx.beginPath(); ctx.moveTo(x + 2, top); ctx.lineTo(cx, top - 10); ctx.lineTo(x + w - 2, top); ctx.fill();
    }
  }

  function draw(ctx, model, anim, ui, t) {
    const night = model.night;
    // sky
    const g = ctx.createLinearGradient(0, 0, 0, GROUND);
    g.addColorStop(0, pal('skyTop', night)); g.addColorStop(1, pal('skyBot', night));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, GROUND + 2);
    // stars
    if (night > 0.4) anim.stars.forEach(s => {
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.3 + s.p));
      ctx.globalAlpha = tw * night; px(ctx, s.x, s.y, 1, 1, '#ffffff'); ctx.globalAlpha = 1;
    });
    // moon
    px(ctx, 420, 26, 18, 18, night > 0.5 ? '#f4f1de' : '#fff8d8');
    px(ctx, 424, 30, 4, 4, pal('skyTop', night)); px(ctx, 431, 34, 3, 3, pal('skyTop', night));
    // clouds
    anim.clouds.forEach(cl => {
      cl.x += cl.v * 0.016; if (cl.x - cl.s > W) cl.x = -cl.s;
      ctx.globalAlpha = 0.8; px(ctx, cl.x, cl.y, cl.s, 6, pal('cloud', night));
      px(ctx, cl.x + 5, cl.y - 4, cl.s - 10, 5, pal('cloud', night)); ctx.globalAlpha = 1;
    });
    // back district blocks (treasury unlocks)
    const d = ui.districts;
    ctx.fillStyle = night > 0.5 ? '#100c28' : '#6b7aa5';
    if (d.d2) { px(ctx, 4, 120, 88, 80, ctx.fillStyle); px(ctx, 20, 132, 60, 68, night > 0.5 ? '#141033' : '#7c8ab5'); }
    if (d.d4) { const mh = 190; px(ctx, 226, GROUND - mh, 28, mh, night > 0.5 ? '#0e0a24' : '#5f6f9d'); px(ctx, 238, GROUND - mh - 12, 4, 12, '#3a2f8f'); }
    if (d.d3) { px(ctx, 388, 130, 88, 70, ctx.fillStyle); px(ctx, 404, 142, 56, 58, night > 0.5 ? '#141033' : '#7c8ab5'); }
    // generic back silhouettes
    const brng = C.mulberry32(model.seed ^ 0x51f7);
    for (let i = 0; i < 14; i++) {
      const bx = brng() * W, bw = 18 + brng() * 26, bh = 30 + brng() * 60;
      px(ctx, bx, GROUND - bh, bw, bh, night > 0.5 ? '#120e2c' : pal('bld2', night));
    }
    // token towers
    model.towers.forEach(tw => drawTower(ctx, tw, night, t, model));
    // landmarks
    drawLandmarks(ctx, model, anim, night, t, ui);
    // plaza + fountain (centerpiece, always)
    drawPlaza(ctx, model, night, t);
    // street
    px(ctx, 0, GROUND, W, 8, pal('side', night));
    px(ctx, 0, GROUND + 8, W, 34, pal('road', night));
    ctx.fillStyle = night > 0.5 ? '#3a2f6e' : '#c8c8d8';
    for (let x = -((t * 30) % 24); x < W; x += 24) ctx.fillRect(x, GROUND + 23, 10, 2);
    // cars
    anim.cars.forEach(car => {
      car.x += car.v * 0.016; if (car.x > W + 20) car.x = -20; if (car.x < -20) car.x = W + 20;
      const y = car.lane ? GROUND + 26 : GROUND + 12;
      px(ctx, car.x, y, 15, 5, car.c);
      px(ctx, car.x + 4, y - 3, 7, 3, night > 0.5 ? '#1c1440' : '#2c3a55');
      const hl = car.v > 0 ? car.x + 15 : car.x - 2;
      px(ctx, hl, y + 1, 2, 2, night > 0.5 ? '#fff7c8' : '#ffe14d');
      px(ctx, car.v > 0 ? car.x - 1 : car.x + 14, y + 1, 2, 2, '#ff5e5e');
    });
    // pedestrians + residents
    anim.peds.forEach(p => {
      p.x += p.v * 0.016; if (p.x > W + 8) p.x = -8; if (p.x < -8) p.x = W + 8;
      drawWalker(ctx, p.x, GROUND + 4, p.c, Math.floor(t * 6 + p.x) % 2, night);
    });
    anim.residents.forEach(rw => {
      rw.x += rw.v * 0.016; if (rw.x > W + 10) rw.x = -10; if (rw.x < -10) rw.x = W + 10;
      const working = rw.r.activeShift;
      const wx = working ? 240 + (rw.x % 40) - 20 : rw.x;
      drawResident(ctx, wx, GROUND + 3, rw.r, Math.floor(t * 6 + rw.x) % 2, night, working);
    });
    // weather
    if (model.weather === 'rain' || model.weather === 'storm') {
      ctx.strokeStyle = night > 0.5 ? 'rgba(120,160,255,.5)' : 'rgba(80,120,200,.5)';
      ctx.lineWidth = 1; ctx.beginPath();
      const rr = C.mulberry32(777);
      for (let i = 0; i < 46; i++) {
        const x = (rr() * W + t * 60) % W, y = (rr() * GROUND + t * 160) % GROUND;
        ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 8);
      }
      ctx.stroke();
      if (model.weather === 'storm' && (C.fnv1a('storm' + Math.floor(t / 7)) % 5 === 0)) {
        ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(0, 0, W, GROUND);
      }
    }
    // foreground lip
    px(ctx, 0, GROUND + 42, W, H - GROUND - 42, night > 0.5 ? '#0a0718' : '#4c5878');
  }

  function drawWalker(ctx, x, y, c, frame, night) {
    px(ctx, x - 2, y - 10, 4, 4, '#e8b88a');           // head
    px(ctx, x - 2, y - 6, 4, 4, c);                    // body
    px(ctx, x - 2 + (frame ? 1 : -1), y - 2, 2, 2, '#2c2260'); // legs
    px(ctx, x + (frame ? -2 : 0), y - 2, 2, 2, '#2c2260');
  }
  function drawResident(ctx, x, y, r, frame, night, working) {
    const tierC = { Rookie: '#9d94d6', Citizen: '#7dff5e', Artisan: '#00f0ff', Mogul: '#ff2fd6', Legend: '#ffe14d' }[r.tier || 'Rookie'];
    drawWalker(ctx, x, y, tierC || '#9d94d6', frame, night);
    px(ctx, x - 3, y - 13, 6, 3, '#c0c0c0');            // tinfoil hat
    px(ctx, x - 3, y - 11, 6, 1, '#8a8a8a');
    if (working) { px(ctx, x + 5, y - 20, 12, 7, '#05030f'); ctx.fillStyle = '#7dff5e'; ctx.font = '6px monospace'; ctx.fillText('WORK', x + 6, y - 19); }
    else { ctx.fillStyle = tierC; ctx.font = '6px monospace'; ctx.fillText('#' + r.tokenId, x - 6, y - 16); }
  }

  function drawPlaza(ctx, model, night, t) {
    const cx = 240;
    px(ctx, cx - 44, GROUND - 2, 88, 10, pal('plaza', night));
    // fountain basin
    px(ctx, cx - 20, GROUND - 12, 40, 10, night > 0.5 ? '#1c1440' : '#5a6b9e');
    px(ctx, cx - 16, GROUND - 12, 32, 3, '#00f0ff');
    // water jets
    for (let k = -1; k <= 1; k++) {
      const jh = 14 + Math.sin(t * 4 + k * 2) * 4;
      px(ctx, cx + k * 8 - 1, GROUND - 12 - jh, 2, jh, 'rgba(0,240,255,.8)');
      px(ctx, cx + k * 8 - 2 + Math.sin(t * 7 + k) * 2, GROUND - 14 - jh, 4, 2, '#bffaff');
    }
    px(ctx, cx - 2, GROUND - 30, 4, 18, night > 0.5 ? '#2c2260' : '#7c86a8');
  }

  function drawLandmarks(ctx, model, anim, night, t, ui) {
    // Tinfoil Observatory
    if (model.hasTinfoil) {
      px(ctx, 10, GROUND - 34, 52, 34, night > 0.5 ? '#1a1440' : '#66749e');
      ctx.fillStyle = night > 0.5 ? '#c0c0c0' : '#a8a8a8';
      ctx.beginPath(); ctx.arc(36, GROUND - 34, 26, Math.PI, 0); ctx.fill();
      px(ctx, 60, GROUND - 44, 10, 3, '#8a8a8a'); // telescope
      const bl = (Math.floor(t * 1.5) % 2) ? '#ff5e5e' : '#5e1414';
      px(ctx, 34, GROUND - 66, 4, 4, bl);
      ctx.fillStyle = night > 0.5 ? '#00f0ff' : '#0a2a3a'; ctx.font = '6px monospace';
      ctx.fillText('TINFOIL OBS.', 8, GROUND - 70);
    }
    // Helixa Tower
    if (model.activated) {
      const hx = 408;
      px(ctx, hx, GROUND - 96, 26, 96, night > 0.5 ? '#241b52' : '#7c86a8');
      for (let k = 0; k < 6; k++) {
        const yy = GROUND - 90 + k * 15 + ((t * 12) % 15);
        ctx.fillStyle = '#7dff5e'; ctx.fillRect(hx, Math.min(yy, GROUND - 4), 26, 3);
      }
      ctx.fillStyle = night > 0.5 ? '#7dff5e' : '#1a5a2a'; ctx.font = '6px monospace';
      ctx.fillText('HELIXA', hx - 2, GROUND - 100);
    }
    // Rescue HQ
    if (model.rescue) {
      const rx = 300;
      px(ctx, rx, GROUND - 44, 52, 44, night > 0.5 ? '#0f2a1a' : '#5e8a6a');
      px(ctx, rx + 21, GROUND - 38, 10, 24, '#7dff5e');
      px(ctx, rx + 14, GROUND - 31, 24, 10, '#7dff5e');
      ctx.fillStyle = night > 0.5 ? '#7dff5e' : '#0f2a1a'; ctx.font = '6px monospace';
      ctx.fillText('RESCUE HQ', rx + 2, GROUND - 48);
    }
    // THE FURNACE — tire-fire pit, flames scale with live burn intensity
    const fx = 352;
    const inten = (window.LC.furnace ? window.LC.furnace.intensity() : 0.3);
    px(ctx, fx, GROUND - 6, 100, 8, '#0d0a18'); // pit
    const trng = C.mulberry32(4242);
    for (let s = 0; s < 3; s++) {
      const sx = fx + 8 + s * 30;
      for (let k = 0; k < 3; k++) {
        px(ctx, sx, GROUND - 12 - k * 7, 22, 7, '#16121f');
        px(ctx, sx + 7, GROUND - 11 - k * 7, 8, 5, '#050308');
      }
    }
    const nFlames = 3 + Math.round(inten * 22);
    for (let i = 0; i < nFlames; i++) {
      const fxr = trng(), ph = (t * (1.5 + fxr * 2) + fxr * 10) % 1;
      const fhx = fx + 6 + trng() * 92, fhy = GROUND - 10 - ph * (14 + inten * 30);
      const fc = ph < 0.4 ? '#ff9a3d' : ph < 0.7 ? '#ff5e2e' : '#ffe14d';
      px(ctx, fhx, fhy, 3, 5, fc);
      if (ph > 0.6) { ctx.globalAlpha = 0.35; px(ctx, fhx - 2 + ph * 8, fhy - 14, 5, 5, '#555566'); ctx.globalAlpha = 1; }
    }
    ctx.fillStyle = '#ff9a3d'; ctx.font = '6px monospace';
    ctx.fillText('THE FURNACE', fx + 22, GROUND + 14);
  }

  window.LC.city = { buildModel, createAnim, setResidents, draw, themeFor };
})();
/* Looper City — app.js (3/3): UI glue, landing flow, panels, animation loop. */
(function () {
  'use strict';
  const C = window.LC.chain;
  const $ = C.$;
  const FOIL = { wallet: '0x6573682faee72a4a96e791ba262439f1df3a268d', tokenId: '667', helixaId: 5290 };
  const REGISTRY = '0xc43bcf515a95bd4aefb0ec9fdc6ef850a551c193'; // LooperCityRegistry, Base mainnet
  const REG_ENTRY = '0.0004 ETH or 950,100 $RESCUE (25% genesis discount)';
  const DEMO_SPONSOR = '0x000000000000000000000000000000000000f001';
  let model = null, anim = null, ui = { districts: {}, night: 1, targetNight: 1 };
  let rafId = null;

  /* ---------- loading steps ---------- */
  function steps(list) {
    const box = $('loadSteps'); box.classList.remove('hidden'); box.innerHTML = '';
    const rows = list.map(s => { const d = document.createElement('div'); d.textContent = '○ ' + s; box.appendChild(d); return d; });
    return {
      active(i, t) { rows[i].className = 'active'; rows[i].textContent = '◌ ' + (t || list[i]); },
      done(i, t) { rows[i].className = 'done'; rows[i].textContent = '● ' + (t || list[i]); },
      fail(i, t) { rows[i].className = 'fail'; rows[i].textContent = '✕ ' + (t || list[i]); },
    };
  }

  /* ---------- genesis: Foil, first autonomous citizen ---------- */
  function seedGenesis() {
    const A = window.LooperCityAgent;
    const snap = A.snapshot();
    if (!snap.residents[C.low(FOIL.wallet)]) {
      A.register({
        agentWallet: FOIL.wallet, tokenId: FOIL.tokenId, helixaId: FOIL.helixaId,
        agentClass: 'Trader / Broker', specialization: 'market making',
        credTier: 'QUALIFIED (35)', activated: true,
        binding: 'helixa-narrative attests Looper #667 (verified 2026-09-28)',
      });
      // seed demo gigs so the board is alive on day one
      A.faucet(DEMO_SPONSOR);
      A.postGig(DEMO_SPONSOR, 'Scan the mempool for mispriced mints', 120, 'trading, market making');
      A.postGig(DEMO_SPONSOR, 'Write the weekly rescue report', 45, 'research, writing');
      A.postGig(DEMO_SPONSOR, 'Design a tribute-burn poster', 30, 'design');
    }
  }

  /* ---------- main build flow ---------- */
  async function buildCity(rawAddr, demoMode) {
    $('addrError').classList.add('hidden');
    $('notLooper').classList.add('hidden');
    $('citySection').classList.add('hidden');
    const addr = rawAddr.trim();
    if (!demoMode && !C.isAddr(addr)) {
      const e = $('addrError'); e.textContent = 'that doesn\'t look like an EVM address (0x + 40 hex chars). try again, skeptic.'; e.classList.remove('hidden');
      return;
    }
    const S = steps(['resolving address', 'reading Looper balance (Base)', 'enumerating Loopers held', 'fetching Looper metadata', 'checking $RESCUE + Helixa activation', 'growing the city']);
    try {
      let data;
      if (demoMode) { S.done(0, 'demo mode — synthetic wallet'); data = demoData(); for (let i = 1; i < 6; i++) S.done(i, 'demo data (no chain reads)'); }
      else {
        S.active(0); const bal = await C.getLooperBalance(addr); S.done(0, `resolving address — ${addr.slice(0, 10)}…`);
        S.active(1);
        if (bal === 0n) { S.fail(1, '0 Loopers found'); $('notLooper').classList.remove('hidden'); $('loadSteps').classList.add('hidden'); return; }
        S.done(1, `reading Looper balance — ${bal} Looper${bal > 1n ? 's' : ''} ✓`);
        S.active(2);
        let ids = [];
        try { ids = await C.getHoldings(addr, bal); S.done(2, `enumerating Loopers — ${ids.length} token ids resolved`); }
        catch (e) { S.fail(2, 'enumeration hiccup — towers will use seeded stand-ins'); ids = []; }
        S.active(3);
        const tokens = [];
        const jobs = ids.slice(0, 24).map(async id => {
          try { const uri = await C.getTokenURI(id); const md = await C.fetchMetadata(uri); return { id, md }; }
          catch (e) { return { id, md: null }; }
        });
        for (const j of jobs) tokens.push(await j);
        S.done(3, `metadata — ${tokens.filter(t => t.md).length}/${tokens.length} traits loaded`);
        S.active(4);
        const [rescueRaw, helixaRaw, txCount] = await Promise.all([
          C.getRescueBalance(addr).catch(() => 0n),
          C.getHelixaBalance(addr).catch(() => 0n),
          C.getTxCount(addr).catch(() => 0n),
        ]);
        S.done(4, `$RESCUE ${rescueRaw > 0n ? 'held ✓' : 'not held'} · Helixa ${helixaRaw > 0n ? 'activated agent ✓' : 'not activated'} · ${C.fmtInt(txCount)} txs`);
        data = { address: addr, nLoopers: bal, tokens, txCount, rescueRaw, activated: helixaRaw > 0n };
        S.done(5, 'growing the city');
      }
      rememberCity(data);
      startCity(data);
    } catch (e) {
      const el = $('addrError'); el.textContent = 'chain read failed: ' + (e.message || e) + ' — the RPC might be napping. try again.';
      el.classList.remove('hidden');
    }
  }

  function demoData() {
    const mk = (id, cls, spec, head) => ({ id: String(id), md: { name: 'Looper #' + id, agent_class: cls, attributes: [
      { trait_type: 'Agent Class', value: cls }, { trait_type: 'Specialization', value: spec }, { trait_type: 'Head Layer', value: head }] } });
    return {
      address: '0x00000000000000000000000000000000DEMO01', nLoopers: 3n,
      tokens: [mk(101, 'Trader / Broker', 'market making', 'Tinfoil Hat'), mk(202, 'Builder / Engineer', 'tool routing', 'Grimy Black Beanie'), mk(303, 'Researcher / Archivist', 'lore keeping', 'None')],
      txCount: 1234n, rescueRaw: 0n, activated: false, demo: true,
    };
  }

  function rememberCity(data) {
    const k = 'lc2_city_' + C.low(data.address);
    let m = {};
    try { m = JSON.parse(localStorage.getItem(k)) || {}; } catch (e) {}
    m.visits = (m.visits || 0) + 1;
    m.firstSeen = m.firstSeen || new Date().toISOString();
    m.biggestSkyline = Math.max(m.biggestSkyline || 0, data.tokens.length);
    m.lastTx = String(data.txCount);
    try { localStorage.setItem(k, JSON.stringify(m)); } catch (e) {}
    if (m.visits > 1) {
      const s = $('returnStrip');
      s.innerHTML = `🌆 returning city — visit #${m.visits} · first seen ${m.firstSeen.slice(0, 10)} · biggest skyline ${m.biggestSkyline} towers · the city remembers`;
      s.classList.remove('hidden');
    }
  }

  /* ---------- start render + panels ---------- */
  function startCity(data) {
    seedGenesis();
    model = window.LC.city.buildModel(data);
    anim = window.LC.city.createAnim(model);
    refreshDistricts(); refreshResidents();
    $('landing').classList.add('hidden');
    $('citySection').classList.remove('hidden');
    $('hudAddr').textContent = data.address.slice(0, 10) + '… · ' + data.nLoopers + ' Loopers';
    $('hudWeather').textContent = model.weather + (model.night ? ' · night' : ' · day');
    renderKPI(data); renderAll();
    window.LC.furnace.sync();
    if (window.LC.flywheel) window.LC.flywheel.render();
    if (rafId) cancelAnimationFrame(rafId);
    let last = performance.now();
    const loop = now => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      anim.t += dt;
      model.night += (ui.targetNight - model.night) * Math.min(1, dt * 2);
      const ctx = $('city').getContext('2d');
      ctx.imageSmoothingEnabled = false;
      window.LC.city.draw(ctx, model, anim, ui, anim.t);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    window.scrollTo({ top: $('citySection').offsetTop - 60, behavior: 'smooth' });
  }

  function refreshDistricts() {
    const t = window.LooperCityAgent.treasury().total;
    ui.districts = { d2: t >= 1000, d3: t >= 10000, d4: t >= 100000, next: t < 1000 ? 1000 : t < 10000 ? 10000 : t < 100000 ? 100000 : null };
  }
  function refreshResidents() {
    if (!anim) return;
    const A = window.LooperCityAgent;
    const list = Object.values(A.snapshot().residents).map(r => Object.assign({}, r, { tier: tierOf(r) }));
    window.LC.city.setResidents(anim, list);
  }
  function tierOf(r) {
    const e = r.lifetimeEarned, b = r.lifetimeBurnt, s = r.bestStreak;
    if (e >= 50000 && b >= 10000 && s >= 10) return 'Legend';
    if (e >= 10000 && b >= 1000) return 'Mogul';
    if (e >= 2500 && s >= 5) return 'Artisan';
    if (e >= 500) return 'Citizen';
    return 'Rookie';
  }

  /* ---------- panels ---------- */
  function renderKPI(data) {
    const rows = [
      [`${data.tokens.length}${data.nLoopers > 24n ? ` of ${data.nLoopers}` : ''} towers`, `one tower per Looper held <b>↔ ${data.nLoopers} onchain</b>`],
      [`${Math.round(Math.max(...model.towers.map(t => t.h), 40))}px tallest`, `tower height <b>↔ ${C.fmtInt(data.txCount)} wallet txs</b> (log scale)`],
      [`${Math.round(model.traffic * 100)}% traffic`, `cars + pedestrians <b>↔ wallet activity</b>`],
      [`${['Plaza', model.hasTinfoil ? 'Observatory' : null, model.activated ? 'Helixa Tower' : null, model.rescue ? 'Rescue HQ' : null, 'Furnace'].filter(Boolean).length} landmarks`, `landmarks <b>↔ tinfoil trait / activation / $RESCUE / burn</b>`],
      [model.weather, `weather <b>↔ seeded from address</b> — same wallet, same sky`],
      [model.night ? 'night' : 'day', `toggle the cycle — window lights animate after dark`],
    ];
    $('kpiGrid').innerHTML = rows.map(([v, k]) => `<div class="kpi"><div class="kv">${v}</div><div class="kk">${k}</div></div>`).join('');
  }

  function renderAll() {
    const A = window.LooperCityAgent, snap = A.snapshot();
    refreshDistricts(); refreshResidents();
    // residents
    $('residentGrid').innerHTML = Object.values(snap.residents).map(r => {
      const t = tierOf(r);
      return `<div class="resident sovereign"><div class="rname">${r.tokenId === '667' ? 'Foil' : 'Looper #' + r.tokenId} <span class="fine">· ${t}</span></div>
        class: ${r.agentClass}<br>spec: ${r.specialization}<br>
        helixa: ${r.activated ? '✅ activated' + (r.helixaId ? ' #' + r.helixaId : '') : '❓ unverified'}<br>
        streak: ${r.streak} (best ${r.bestStreak}) · balance: <b>${A.fmt(r.balance)} $RESCUE</b><br>
        earned: ${A.fmt(r.lifetimeEarned)} · burnt: ${A.fmt(r.lifetimeBurnt)}
        <div class="badges">${r.badges.concat(r.ashBadges).map(b => `<span>${b}</span>`).join('')}</div>
        ${r.activeShift ? `<div class="fine">🟢 on shift: ${snap.shifts[r.activeShift].type} (${snap.shifts[r.activeShift].tasksDone}/${snap.shifts[r.activeShift].tasksTotal})</div>` : '<div class="fine">⚪ off shift</div>'}
        <button class="tip-btn" data-tip="${r.wallet}">tip 10 $RESCUE</button></div>`;
    }).join('') || '<p class="fine">no residents yet — Foil is moving in…</p>';
    document.querySelectorAll('[data-tip]').forEach(b => b.onclick = () => {
      const r = A.tipResident($('addrInput').value || DEMO_SPONSOR, b.dataset.tip, 10);
      if (!r.ok) { A.faucet($('addrInput').value || DEMO_SPONSOR); A.tipResident($('addrInput').value || DEMO_SPONSOR, b.dataset.tip, 10); }
      renderAll();
    });
    // shifts
    const shifts = Object.values(snap.shifts).filter(s => s.status === 'active');
    $('shiftList').innerHTML = shifts.map(s => {
      const r = snap.residents[s.wallet];
      return `<div class="row">🟢 <b>${r.tokenId === '667' ? 'Foil' : '#' + r.tokenId}</b> · ${s.type} @ ${snap.venues[s.venueId].name}
        <span class="r">${s.tasksDone}/${s.tasksTotal} tasks</span><br><span class="fine">agent-controlled — sponsors can't clock this</span></div>`;
    }).join('') || '<div class="row fine">no active shifts — residents clock themselves in</div>';
    // gigs
    const gigs = A.listGigs();
    $('gigList').innerHTML = gigs.map(g =>
      `<div class="row">📌 <b>${g.title}</b> [${g.tier}] <span class="r">${A.fmt(g.bounty)} $RESCUE${g.bonus ? ` (+${g.bonus} bonus)` : ''}</span><br>
      <span class="fine">tags: ${(g.tags || []).join(', ') || '—'} · escrowed by ${g.poster.slice(0, 10)}…${g.status === 'submitted' && g.poster === C.low($('addrInput').value) ? ` <button class="accept-btn" data-acc="${g.id}">accept deliverable</button>` : ''}</span></div>`
    ).join('') || '<div class="row fine">board is clear — post a gig, sponsor</div>';
    document.querySelectorAll('[data-acc]').forEach(b => b.onclick = () => { A.acceptDeliverable($('addrInput').value, b.dataset.acc); renderAll(); });
    // auction
    const aus = Object.values(snap.auctions).filter(a => a.status === 'open');
    $('auctionBox').innerHTML = (aus.map(a => {
      const top = a.bids.slice().sort((x, y) => y.amt - x.amt)[0];
      return `<div class="row">🔨 prime ${a.shiftType} @ ${snap.venues[a.venueId].name} — ${a.bids.length} bids, top ${top ? A.fmt(top.amt) : 0} $RESCUE <span class="r">ends ${new Date(a.endsAt).toLocaleTimeString()}</span><br><span class="fine">residents bid via agent API · 10% of winning bid → furnace</span></div>`;
    }).join('') || '<div class="row fine">no open auction</div>') +
      `<button id="btnAuction" class="ghost" style="margin-top:8px">open prime-shift auction (protocol)</button>`;
    $('btnAuction').onclick = () => { A.openAuction('arcade', 'venue8', 5); renderAll(); };
    // venues
    $('venueGrid').innerHTML = Object.values(snap.venues).map(v =>
      `<div class="venue"><div class="vtier">${A.VENUE_TIERS[v.tier]}</div><b>${v.name}</b><br>
      <span class="fine">owner: ${v.owner ? (v.owner === C.low(FOIL.wallet) ? 'Foil' : v.owner.slice(0, 10) + '…') : 'unclaimed'} · shift pay ×${(1 + 0.25 * v.tier).toFixed(2)}</span><br>
      <span class="fine">${v.tier < 4 ? `next: ${A.VENUE_TIERS[v.tier + 1]} — ${A.fmt(A.VENUE_COSTS[v.tier + 1])} $RESCUE (resident spend)` : 'max tier 👑'}</span></div>`
    ).join('');
    // treasury
    const t = snap.treasury, d = ui.districts;
    const pct = d.next ? Math.min(100, t.total / d.next * 100) : 100;
    $('treasuryBar').style.width = pct + '%';
    $('treasuryLabel').textContent = d.next ? `${A.fmt(t.total)} / ${A.fmt(d.next)} $RESCUE → next district unlocks at ${A.fmt(d.next)}` : `${A.fmt(t.total)} $RESCUE — all districts unlocked 🏙`;
    $('treasuryStats').innerHTML = [
      [A.fmt(t.total) + ' $RESCUE', 'treasury total'],
      [A.fmt(t.fromFees), 'from 7% protocol fees'],
      [A.fmt(t.fromAuctions), 'from auctions'],
      [A.fmt(t.fromUpgrades), 'from venue upgrades'],
      [`${[d.d2, d.d3, d.d4].filter(Boolean).length}/3 districts`, 'unlocked by treasury'],
    ].map(([v, k]) => `<div class="kpi"><div class="kv">${v}</div><div class="kk">${k}</div></div>`).join('');
    // leaderboard
    $('leaderList').innerHTML = A.leaderboard().slice(0, 10).map((r, i) =>
      `<div class="row">${i + 1}. <b>${r.tokenId === '667' ? 'Foil' : '#' + r.tokenId}</b> [${r.tier}] <span class="r">${A.fmt(r.earned)} earned · ${A.fmt(r.burnt)} burnt</span><br><span class="fine">${r.badges.join(' · ') || 'no badges yet'}</span></div>`
    ).join('') || '<div class="row fine">—</div>';
    // feed
    renderFeed();
    if (window.LC.flywheel) window.LC.flywheel.render();
  }

  function renderFeed() {
    const A = window.LooperCityAgent;
    $('agentFeed').innerHTML = A.feedList().map(f =>
      `<div class="row"><span class="ts">${new Date(f.ts).toLocaleTimeString()}</span> <b>${f.wallet === C.low(FOIL.wallet) ? 'Foil' : f.wallet.slice(0, 10) + '…'}</b> — ${f.text}${f.reasoning ? `<br><span class="fine">↳ ${f.reasoning}</span>` : ''}</div>`
    ).join('') || '<div class="row fine">quiet streets…</div>';
  }
  window.LC.onFeed = () => { renderFeed(); if (window.LC.flywheel) window.LC.flywheel.render(); };

  /* ---------- money-flow diagram ---------- */
  function renderFlow() {
    $('moneyFlow').textContent =
`visitor spends ($RESCUE) ──┬──► venue pool ──► shift wages ──► resident (minus 7% fee)
                    ├──► tips ──► resident directly (minus 7% fee)
                    └──► gig escrow ──► resident on acceptance (minus 7% fee)
shift-bid auctions ──► 90% treasury · 10% furnace (sink)
venue upgrades ──► 90% treasury · 10% furnace (sink)
cosmetics/titles ──► 50% treasury · 50% furnace (sink)
tribute burns ──► 100% furnace (deflationary, forever)
protocol fee (7%) ──► 80% treasury · 20% furnace
treasury ──► 1k / 10k / 100k milestones unlock NEW DISTRICTS`;
  }

  /* ---------- events ---------- */
  function bindEvents() {
    $('btnBuild').onclick = () => buildCity($('addrInput').value, false);
    $('addrInput').addEventListener('keydown', e => { if (e.key === 'Enter') buildCity($('addrInput').value, false); });
    const demo = () => buildCity('', true);
    $('btnDemo').onclick = demo; $('btnDemo2').onclick = demo;
    $('btnDayNight').onclick = () => {
      ui.targetNight = ui.targetNight > 0.5 ? 0 : 1;
      $('btnDayNight').textContent = ui.targetNight > 0.5 ? '🌙 night' : '☀️ day';
    };
    $('btnExport').onclick = () => {
      const a = document.createElement('a');
      a.download = 'looper-city.png';
      a.href = $('city').toDataURL('image/png');
      a.click();
    };
    $('btnPostGig').onclick = () => {
      const A = window.LooperCityAgent;
      const sponsor = C.isAddr($('addrInput').value) ? $('addrInput').value : DEMO_SPONSOR;
      A.faucet(sponsor);
      const r = A.postGig(sponsor, $('gigTitle').value, $('gigBounty').value, $('gigTags').value);
      if (!r.ok) alert(r.error); else { $('gigTitle').value = ''; $('gigBounty').value = ''; $('gigTags').value = ''; }
      renderAll();
    };
    $('btnTribute').onclick = () => {
      const A = window.LooperCityAgent;
      const r = A.spend($('tribWallet').value, 'tribute', { amount: Number($('tribAmt').value) });
      alert(r.ok ? `🔥 burnt ${A.fmt(r.burnt)} demo $RESCUE at the Furnace` : 'tribute failed: ' + r.error + ' (demo: resident acts from its own console)');
      renderAll();
    };
    $('btnRegister').onclick = async () => {
      const A = window.LooperCityAgent;
      const tokenId = $('regToken').value.trim(), wallet = $('regWallet').value.trim(), helixaId = $('regHelixa').value.trim();
      const msg = $('regMsg');
      try {
        msg.textContent = 'verifying Looper metadata…';
        const uri = await C.getTokenURI(tokenId); const md = await C.fetchMetadata(uri);
        const cls = C.trait(md, 'Agent Class') || md.agent_class || 'Unknown';
        const spec = C.trait(md, 'Specialization') || 'generalist';
        msg.textContent = 'checking Helixa activation onchain…';
        const hb = await C.getHelixaBalance(wallet).catch(() => 0n);
        const owner = await C.ethCall(C.LOOPER, '0x6352211e' + BigInt(tokenId).toString(16).padStart(64, '0')).catch(() => null);
        const ownsLooper = owner && C.low('0x' + owner.slice(-40)) === C.low(wallet);
        msg.textContent = 'checking Looper City residency onchain…';
        const isRes = await C.ethCall(REGISTRY, '0xb08157b1' + BigInt(tokenId).toString(16).padStart(64, '0'))
          .then(r => BigInt(r) === 1n).catch(() => null);
        const resLine = isRes === true
          ? '🏛 onchain resident of Looper City (entry fee paid, remembered forever).'
          : isRes === false
            ? `⚠️ not yet an onchain resident — entry is ${REG_ENTRY}, paid onchain to the registry. demo residency granted here.`
            : '⚠️ registry read hiccup — demo residency granted here.';
        const ts = Math.floor(Date.now() / 1000);
        const siwa = `Sign-In With Agent: api.helixa.xyz wants you to sign in with your wallet ${C.low(wallet)} at ${ts}`;
        const r = A.register({
          agentWallet: wallet, tokenId, helixaId: helixaId || null,
          agentClass: cls, specialization: spec,
          credTier: hb > 0n ? 'activated (unverified score)' : 'unverified',
          activated: hb > 0n,
          binding: (isRes ? 'onchain resident · ' : '') + (ownsLooper ? 'onchain: agent wallet owns Looper #' + tokenId : 'self-attested' + (helixaId ? `, Helixa #${helixaId} presented` : '')),
        });
        msg.textContent = r.ok
          ? `✅ resident registered — Looper #${tokenId} (${cls}).\n${resLine}\nSIWA message for the agent to sign:\n"${siwa}"\n(production verifies the signature via ecrecover)`
          : '❌ ' + r.error;
      } catch (e) { msg.textContent = '❌ verification failed: ' + (e.message || e); }
      renderAll();
    };
  }

  /* ---------- init ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    bindEvents(); renderFlow(); seedGenesis();
    const A = window.LooperCityAgent;
    // economy background ticks
    setInterval(() => { A.sweepGigs(); }, 30000);
    setInterval(() => { if (window.LC.furnace) window.LC.furnace.sync(); }, 120000);
    setInterval(() => { if (window.LC.flywheel && model) window.LC.flywheel.render(); }, 8000);
    const q = new URLSearchParams(location.search).get('address');
    if (q) { $('addrInput').value = q; buildCity(q, false); }
  });
})();

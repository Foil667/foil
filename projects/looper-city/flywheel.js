/* Looper City — flywheel.js
 * THE FURNACE FLYWHEEL, rendered alive:
 *   WORK → SPEND/UPGRADE → BURN → STATUS → GROW → (back to WORK)
 * Animated circular SVG; every node carries a LIVE counter from the demo
 * ledger / furnace. This is the economy's heartbeat, not a static doc.
 */
(function () {
  'use strict';
  const SVGNS = 'http://www.w3.org/2000/svg';
  const CX = 200, CY = 200, R = 128;
  const NODES = [
    { key: 'work', label: 'WORK', color: '#00f0ff' },
    { key: 'spend', label: 'SPEND / UPGRADE', color: '#ff2fd6' },
    { key: 'burn', label: 'BURN', color: '#ff9a3d' },
    { key: 'status', label: 'STATUS', color: '#ffe14d' },
    { key: 'grow', label: 'GROW', color: '#7dff5e' },
  ];
  function pt(i) {
    const a = (-90 + i * 72) * Math.PI / 180;
    return [CX + R * Math.cos(a), CY + R * Math.sin(a)];
  }
  function el(tag, attrs, parent) {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function counters() {
    const A = window.LooperCityAgent, F = window.LC && window.LC.furnace;
    const l = A ? A.snapshot() : null;
    const c = l ? l.counters : { earnedToday: 0, upgraded: 0, burnt: 0, sessions: 0 };
    const t = l ? l.treasury.total : 0;
    const demoBurn = l ? l.furnace.demoBurnt : 0;
    const chainBurn = F ? F.cache().total : '0';
    const lb = A ? A.leaderboard() : [];
    const fmt = A ? A.fmt : (n => n);
    return {
      work: `${c.sessions} shifts · ${fmt(c.earnedToday)} earned`,
      spend: `${c.upgraded} venue upgrades`,
      burn: `${fmt(demoBurn)} demo + ${F ? F.fmtR(BigInt(chainBurn)) : 0} chain`,
      status: lb.length ? `#1 ${lb[0].wallet.slice(0, 8)}… (${lb[0].tier})` : 'no citizens yet',
      grow: `${fmt(t)} treasury`,
    };
  }
  function render() {
    const svg = document.getElementById('flywheel');
    if (!svg) return;
    svg.innerHTML = '';
    // rotating dashed energy ring
    const ring = el('circle', { cx: CX, cy: CY, r: R, fill: 'none', stroke: '#2c2260', 'stroke-width': 2, 'stroke-dasharray': '6 10' }, svg);
    ring.innerHTML = '<animateTransform attributeName="transform" type="rotate" from="0 200 200" to="360 200 200" dur="24s" repeatCount="indefinite"/>';
    // arrows between nodes
    NODES.forEach((n, i) => {
      const [x1, y1] = pt(i), [x2, y2] = pt((i + 1) % 5);
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const dx = mx - CX, dy = my - CY, d = Math.hypot(dx, dy) || 1;
      const qx = CX + dx / d * (R + 26), qy = CY + dy / d * (R + 26);
      el('path', { d: `M${x1},${y1} Q${qx},${qy} ${x2},${y2}`, fill: 'none', stroke: n.color, 'stroke-width': 2, opacity: 0.55, 'stroke-dasharray': '4 6' }, svg)
        .innerHTML = '<animate attributeName="stroke-dashoffset" from="20" to="0" dur="1.2s" repeatCount="indefinite"/>';
    });
    const vals = counters();
    NODES.forEach((n, i) => {
      const [x, y] = pt(i);
      const g = el('g', {}, svg);
      const c = el('circle', { cx: x, cy: y, r: 46, fill: '#0d0a24', stroke: n.color, 'stroke-width': 2 }, g);
      c.innerHTML = `<animate attributeName="r" values="46;49;46" dur="${2 + i * 0.4}s" repeatCount="indefinite"/>`;
      const t1 = el('text', { x, y: y - 8, 'text-anchor': 'middle', fill: n.color, 'font-size': 11, 'font-weight': 'bold', 'font-family': 'monospace' }, g);
      t1.textContent = n.label;
      const t2 = el('text', { x, y: y + 12, 'text-anchor': 'middle', fill: '#9d94d6', 'font-size': 9, 'font-family': 'monospace' }, g);
      const v = vals[n.key];
      t2.textContent = v.length > 26 ? v.slice(0, 24) + '…' : v;
    });
    // hub
    el('circle', { cx: CX, cy: CY, r: 30, fill: '#171231', stroke: '#ff2fd6', 'stroke-width': 2 }, svg);
    const hub = el('text', { x: CX, y: CY + 4, 'text-anchor': 'middle', fill: '#ffe14d', 'font-size': 10, 'font-family': 'monospace' }, svg);
    hub.textContent = '$RESCUE';
    // counters panel
    const fc = document.getElementById('flyCounters');
    if (fc) fc.innerHTML = NODES.map(n =>
      `<div class="row"><b style="color:${n.color}">${n.label}</b> — ${vals[n.key]}</div>`).join('');
  }
  window.LC = window.LC || {};
  window.LC.flywheel = { render };
})();

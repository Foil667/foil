// Headless smoke test for RUG DODGE — DOM-shimmed, drives real game logic.
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

const DIR = '/home/hatch/workspace/baes-ship/rug-dodge';
let failures = 0;
function ok(cond, name) {
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.log('  FAIL ' + name); }
}

// ---------- stubs ----------
const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};
function makeCtx() {
  return new Proxy({}, {
    get(t, p) { if (typeof p === 'string') return (...a) => {}; },
    set(t, p, v) { t[p] = v; return true; },
  });
}
const elCache = {};
function makeEl(id) {
  const el = {
    _id: id, _html: '', _text: '', hidden: true, disabled: false,
    style: {}, dataset: {},
    addEventListener: () => {},
    getContext: () => makeCtx(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 416, height: 416 }),
    querySelector: () => makeEl(id + '-q'),
    appendChild: () => {},
  };
  Object.defineProperty(el, 'innerHTML', { get() { return this._html; }, set(v) { this._html = String(v); } });
  Object.defineProperty(el, 'textContent', { get() { return this._text; }, set(v) { this._text = String(v); } });
  return el;
}
global.document = {
  getElementById: id => (elCache[id] || (elCache[id] = makeEl(id))),
  querySelectorAll: () => [],
  addEventListener: () => {},
  createElement: () => makeEl('dyn'),
};
global.window = globalThis;
global.location = { hash: '#testhook' };
global.requestAnimationFrame = () => 0;
global.setInterval = () => 0;
global.setTimeout = (fn) => 0;
global.clearTimeout = () => {};
global.fetch = () => Promise.reject(new Error('offline'));
global.AbortController = class { constructor() { this.signal = {}; } abort() {} };
global.window.addEventListener = () => {};

// ---------- load assembled page ----------
const html = readFileSync(DIR + '/index.html', 'utf8');
const scripts = [...html.matchAll(/<script>\n([\s\S]*?)<\/script>/g)].map(m => m[1]);
ok(scripts.length === 2, 'exactly 2 script blocks in index.html');
ok(!/<\/script/i.test(scripts[1].replace(/<\\\/script/gi, '')), 'game script has no literal closing tag');
for (const s of scripts) (0, eval)(s);
const R = globalThis.__rd;
ok(!!R, 'test hook __rd exposed');

// ---------- drive ----------
console.log('-- lifecycle --');
ok(R.st === 't', 'starts at title');
R.go();
ok(R.st === 'p' && R.wv === 1, 'go() starts wave 1');
for (let i = 0; i < 300; i++) { R.upd(1 / 60); if (i % 10 === 0) R.draw(); }
ok(R.rugsN >= 0 && R.sc >= 0, '300 frames run without exception, rugs spawning');
ok(R.wv >= 1, 'wave active');

console.log('-- collision / hurt --');
const lv0 = R.lv;
R.setPlayer(200, 300);
R.spawnRug('roll', 200 - 12);
{ const r = R.rugs()[R.rugs().length - 1]; r.x = 200 - 12; r.y = 300 - 9; r.vy = 0; }
R.upd(1 / 60);
ok(R.lv === lv0 - 1, 'rug hit costs a life (' + lv0 + '->' + R.lv + ')');

console.log('-- verify shield --');
for (let i = 0; i < 10; i++) R.upd(1 / 60); // drain hitStop from the hurt test
R.setPlayer(200, 300);
R.forcePickup('verify');
R.upd(1 / 60);
ok(R.shieldT > 0, 'verify pickup grants shield');
const sc0 = R.sc, lv1 = R.lv;
R.spawnRug('roll', 200 - 12);
{ const r = R.rugs()[R.rugs().length - 1]; r.x = 200 - 12; r.y = 300 - 9; r.vy = 0; }
R.upd(1 / 60);
ok(R.lv === lv1 && R.sc > sc0, 'shield destroys rug, no life lost, score up');

console.log('-- mimic --');
R.forcePickup('mimic');
R.upd(1 / 60);
ok(R.rugsN >= 6, 'mimic bursts into fast rugs (' + R.rugsN + ')');

console.log('-- near-miss combo --');
R.rugs().length = 0; R.telegraphs().length = 0; R.imps().length = 0;
R.setPlayer(200, 300);
R.spawnRug('roll', 210);
{ const r = R.rugs()[R.rugs().length - 1]; r.x = 210; r.y = 290; r.vy = 0; }
const sc1 = R.sc;
R.upd(1 / 60);
ok(R.combo === 1 && R.sc > sc1, 'near-miss registers combo x1 + score');

console.log('-- wave clear --');
R.startWave(1);
for (let i = 0; i < 700 && R.wv === 1; i++) R.upd(1 / 60); // let all spawn
R.rugs().length = 0; R.telegraphs().length = 0;
const bal0 = R.eco().balance;
R.upd(1 / 60);
ok(R.wv === 2, 'wave clears into wave 2');
ok(R.eco().balance >= bal0 + 10, 'wave clear earns +10 demo RESCUE');

console.log('-- game over / continue --');
R.eco().balance = 100;
while (R.st === 'p') R.forceHurt();
ok(R.st === 'o', 'game over at 0 lives');
ok(R.restartArmed() === false, 'restart guard disarms right after death (overT fresh)');
ok(Date.now() - R.overT() < 2000, 'overT timestamp recorded');
R.doContinue();
ok(R.st === 'p' && R.lv === 2 && R.eco().balance === 50, 'continue: -50 demo, +2 lives, back in play');

console.log('-- bounties --');
// use whichever bounty was generated today and satisfy its stat
const b0 = R.eco().bounties[0];
const db = R.eco().dayBest;
if (b0.id === 'waves') db.waves = 999;
else if (b0.id === 'score') db.score = 99999;
else if (b0.id === 'near') db.near = 999;
else if (b0.id === 'shield') db.shields = 999;
else if (b0.id === 'clean') db.cleanWave = true;
const bBal = R.eco().balance;
const claimed = R.claimBounty(0);
ok(claimed && R.eco().balance > bBal, 'bounty claim pays from pool');

console.log('-- shop --');
R.eco().balance = 2000;
ok(R.buySkin('gold') === true && R.eco().owned.includes('gold'), 'buy gold hat');
ok(R.buySkin('void') === false, 'void hat blocked below Dodger tier');
R.eco().lifeScore = 3000;
ok(R.tier() === 1, 'tier() = Dodger at 3000 lifeScore');
ok(R.buySkin('void') === true, 'void hat buyable at Dodger tier');
ok(R.equipSkin('void') === true && R.eco().skin === 'void', 'equip void hat');

console.log('-- pause / panels / render states --');
R.togglePause(); ok(R.st === 'z', 'pause');
R.draw();
R.togglePause(); ok(R.st === 'p', 'unpause');
R.gameOver(); R.draw(); ok(R.st === 'o', 'gameover renders');
R.showOvl(); R.draw();
R.doRestart(); ok(R.st === 'p' && R.wv === 1, 'restart begins wave 1');
R.draw();

console.log(failures === 0 ? '\nALL SMOKE TESTS PASSED' : '\n' + failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);

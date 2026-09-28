'use strict';
/* foil's sniff test — read-only contract red-flag checker. no wallet, no signatures, no spending. */

/* ---------------- config ---------------- */
const CHAINS = {
  base: {
    name: 'Base', chainId: 8453,
    rpcs: ['https://mainnet.base.org', 'https://base-rpc.publicnode.com'],
    api: 'https://base.blockscout.com/api/v2',
    explorer: 'https://base.blockscout.com',
  },
  robinhood: {
    name: 'Robinhood Chain', chainId: 4663,
    rpcs: ['https://rpc.mainnet.chain.robinhood.com'],
    api: 'https://robinhoodchain.blockscout.com/api/v2',
    explorer: 'https://robinhoodchain.blockscout.com',
  },
  ethereum: {
    name: 'Ethereum', chainId: 1,
    rpcs: ['https://ethereum-rpc.publicnode.com', 'https://eth.llamarpc.com', 'https://rpc.ankr.com/eth'],
    api: 'https://eth.blockscout.com/api/v2',
    explorer: 'https://eth.blockscout.com',
  },
};

const ZERO = '0x0000000000000000000000000000000000000000';
const IMPL_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const BEACON_SLOT = '0xa3f0ad74e5423aebfd80d3ef4346578335f4e408abc8f2a3fd5d7b4d078b902de';
const EIP1167_PREFIX = '363d3d373d3d3d363d73';
const EIP1167_SUFFIX = '5af43d82803e903d91602b57fd5bf3';

const SEL_OWNER = '0x8da5cb5b';
const SEL_TOTALSUPPLY = '0x18160ddd';
const SEL_PAUSED = '0x5c975abb';

/* selectors we already know by heart — saves 4byte lookups */
const KNOWN_SELS = {
  '8da5cb5b': 'owner()', '18160ddd': 'totalSupply()', '313ce567': 'decimals()',
  '5c975abb': 'paused()', '06fdde03': 'name()', '95d89b41': 'symbol()',
  '70a08231': 'balanceOf(address)', 'a9059cbb': 'transfer(address,uint256)',
  '23b872dd': 'transferFrom(address,address,uint256)', '095ea7b3': 'approve(address,uint256)',
  'dd62ed3e': 'allowance(address,address)', '06f9e0d3': 'implementation()',
  '715018a6': 'renounceOwnership()', 'f2fde38b': 'transferOwnership(address)',
  '8f70ccf6': 'tradingEnabled()', 'a0b8e49c': 'tradingActive()',
  '8456cb59': 'pause()', '3f4ba83a': 'unpause()',
  'e2bbb158': 'maxTxAmount()', '4f8e027a': 'maxWalletAmount()',
  '7d0c9a84': '_maxTxAmount()', 'f2c6d3b5': '_maxWalletAmount()',
};

/* view getters worth actually calling when we have an ABI (lowercased names) */
const VALUE_GETTERS = [
  'maxtxamount', '_maxtxamount', 'maxwalletamount', 'maxwallet', '_maxwallet',
  'buytax', '_buytax', 'selltax', '_selltax', 'buyfee', 'sellfee', 'totalfee',
  'maxsupply', 'max_supply', 'mintprice', 'cost', 'price', 'publicprice', 'mintcost',
  'paused', 'tradingactive', 'tradingenabled', 'swapenabled', 'limitsineffect',
  'decimals',
];

/* ---------------- tiny utils ---------------- */
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function hexToBytes(h) {
  h = h.startsWith('0x') || h.startsWith('0X') ? h.slice(2) : h;
  const b = new Uint8Array(h.length / 2);
  for (let i = 0; i < b.length; i++) b[i] = parseInt(h.substr(i * 2, 2), 16);
  return b;
}
function bytesToHex(b) {
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}
function wordToAddress(word) {
  word = word.toLowerCase();
  return '0x' + word.slice(-40);
}
function shortAddr(a) {
  return a.slice(0, 6) + '…' + a.slice(-4);
}
function isValidAddress(a) {
  return /^0x[0-9a-fA-F]{40}$/.test(a);
}
async function fetchTimeout(url, opts = {}, ms = 15000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: c.signal });
  } finally {
    clearTimeout(t);
  }
}

/* ---------------- rpc ---------------- */
async function rpcSingle(url, payload) {
  const res = await fetchTimeout(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('http ' + res.status);
  const j = await res.json();
  if (j.error) throw new Error(j.error.message || 'rpc error');
  return j.result;
}
async function rpcBatch(chain, calls) {
  /* calls: [{method, params}] -> [result...] ; tries each rpc url in order */
  const payload = calls.map((c, i) => ({ jsonrpc: '2.0', id: i + 1, method: c.method, params: c.params }));
  let lastErr = new Error('no rpc');
  for (const url of chain.rpcs) {
    try {
      const res = await fetchTimeout(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      }, 20000);
      if (!res.ok) throw new Error('http ' + res.status);
      const arr = await res.json();
      if (!Array.isArray(arr)) throw new Error('bad batch response');
      return arr.map((r) => {
        if (r.error) throw new Error(r.error.message || 'rpc error');
        return r.result;
      });
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}
const ethCall = (chain, addr, data) => rpcBatch(chain, [{ method: 'eth_call', params: [{ to: addr, data }, 'latest'] }]).then((r) => r[0]);

/* ---------------- bytecode analysis ---------------- */
/* strict dispatcher pattern: PUSH4 <sel> EQ — kills most false positives */
function extractSelectors(code) {
  const b = hexToBytes(code);
  const out = new Set();
  for (let i = 0; i + 6 < b.length; i++) {
    if (b[i] === 0x63 && b[i + 5] === 0x14) out.add(bytesToHex(b.slice(i + 1, i + 5)));
  }
  return [...out];
}
/* proper disassembly walk so PUSH data can't fake opcodes */
function scanOpcodes(code) {
  const b = hexToBytes(code);
  const found = { delegatecall: false, selfdestruct: false };
  for (let i = 0; i < b.length; i++) {
    const op = b[i];
    if (op >= 0x60 && op <= 0x7f) { i += op - 0x5f; continue; }
    if (op === 0xf4) found.delegatecall = true;
    if (op === 0xff) found.selfdestruct = true;
  }
  return found;
}

/* returns sel -> [text_signature, ...] (all 4byte candidates; results[0] is often junk) */
async function resolveSelectors(selectors) {
  const out = {};
  const unknown = [];
  for (const s of selectors) {
    if (KNOWN_SELS[s]) out[s] = [KNOWN_SELS[s]];
    else unknown.push(s);
  }
  const todo = unknown.slice(0, 60);
  const CONC = 8;
  for (let i = 0; i < todo.length; i += CONC) {
    await Promise.all(todo.slice(i, i + CONC).map(async (s) => {
      try {
        const r = await fetchTimeout('https://www.4byte.directory/api/v1/signatures/?hex_signature=0x' + s, {}, 10000);
        const j = await r.json();
        if (j.results && j.results.length) out[s] = j.results.map((x) => x.text_signature).slice(0, 8);
      } catch { /* best effort */ }
    }));
    await sleep(120);
  }
  return out;
}

/* ---------------- name heuristics ---------------- */
function classifyName(name) {
  const n = name.toLowerCase();
  if (/(selfdestruct|suicide)/.test(n)) return 'kill';
  if (/blacklist/.test(n)) return 'blacklist';
  if (/^(set|update|change|adjust|toggle).*(tax|fee)/.test(n) || /^(tax|fee)/.test(n) && /(set|update)/.test(n)) return 'taxsetter';
  if (/^(mint|airdrop)/.test(n)) return 'mint';
  if (/^(withdraw|rescue|sweep|recover|skim|clearstuck)/.test(n)) return 'drain';
  if (n === 'pause' || n === 'unpause' || n === 'setpaused') return 'pause';
  if (/^(renounceownership|transferownership)/.test(n)) return 'ownership';
  if (/^(maxtx|maxwallet|maxbuy|maxsell)/.test(n)) return 'limits';
  return null;
}

/* ---------------- the scan ---------------- */
function step(msg, done) {
  const el = $('steps');
  el.hidden = false;
  const d = document.createElement('div');
  d.textContent = (done ? '✓ ' : '… ') + msg;
  if (done) d.className = 'done';
  el.appendChild(d);
  return d;
}

async function scan(chainId, address) {
  const chain = CHAINS[chainId];
  const addr = address.toLowerCase();
  const flags = [];   // {sev, text, check}
  const notes = [];
  const reads = [];
  let score = 100;
  const hit = (sev, text, check, pts) => {
    flags.push({ sev, text, check });
    if (pts) score -= pts;
  };
  const note = (sev, text, check) => notes.push({ sev, text, check });

  /* 1. code present? */
  let s = step('reading bytecode');
  const [code] = await rpcBatch(chain, [{ method: 'eth_getCode', params: [addr, 'latest'] }]);
  s.remove();
  if (!code || code === '0x' || code === '0x0') {
    return { notContract: true, chain, addr };
  }
  step('bytecode found (' + Math.round((code.length - 2) / 2 / 1024 * 10) / 10 + ' kb)', true);

  /* 2. verification */
  s = step('checking verification on ' + chain.explorer.replace('https://', ''));
  let verified = false, abi = null, contractName = null;
  try {
    const r = await fetchTimeout(chain.api + '/smart-contracts/' + addr, {}, 12000);
    if (r.ok) {
      const j = await r.json();
      verified = !!j.is_verified;
      if (verified) {
        abi = Array.isArray(j.abi) ? j.abi : null;
        contractName = j.name || null;
      }
    }
  } catch { /* explorer unreachable — treat as unknown, not unverified */ }
  s.remove();
  if (verified) {
    note('good', 'source verified' + (contractName ? ' — ' + contractName : '') + '. you can read exactly what it does.', 'blockscout: is_verified=true');
    reads.push(['contract name', contractName || '—']);
  } else {
    hit('high', 'source NOT verified. closed-source contract asking for your money — classic.', 'blockscout: no verified source', 25);
  }
  step('verification: ' + (verified ? 'verified ✓' : 'unverified'), true);

  /* 3. proxy? */
  s = step('checking proxy slots');
  let implAddr = null, beaconAddr = null, isMinimalProxy = null;
  try {
    const [implWord, beaconWord] = await rpcBatch(chain, [
      { method: 'eth_getStorageAt', params: [addr, IMPL_SLOT, 'latest'] },
      { method: 'eth_getStorageAt', params: [addr, BEACON_SLOT, 'latest'] },
    ]);
    if (implWord && !/^0x0+$/.test(implWord)) implAddr = wordToAddress(implWord);
    if (beaconWord && !/^0x0+$/.test(beaconWord)) beaconAddr = wordToAddress(beaconWord);
  } catch { /* non-fatal */ }
  const codeNoPrefix = code.slice(2).toLowerCase();
  if (codeNoPrefix.startsWith(EIP1167_PREFIX) && codeNoPrefix.endsWith(EIP1167_SUFFIX)) {
    isMinimalProxy = '0x' + codeNoPrefix.slice(EIP1167_PREFIX.length, EIP1167_PREFIX.length + 40);
  }
  s.remove();
  const isProxy = !!(implAddr || beaconAddr || isMinimalProxy);
  if (implAddr) reads.push(['proxy implementation', implAddr]);
  if (beaconAddr) reads.push(['proxy beacon', beaconAddr]);
  if (isMinimalProxy) reads.push(['minimal proxy →', isMinimalProxy]);
  if (isProxy) {
    hit('med', 'upgradeable proxy. whoever controls upgrades can swap the code under you — treat owner as god-mode.', 'eip-1967 slots / eip-1167 bytecode', 0); // points assigned after owner known
  } else {
    note('good', 'no standard proxy pattern (eip-1967/eip-1167) — probably not upgradeable via the usual routes.', 'eip-1967 slots empty, no eip-1167 bytecode');
  }
  step('proxy check done', true);

  /* 4. ownership */
  s = step('checking ownership');
  let owner = null, ownerKind = 'unknown';
  try {
    const ret = await ethCall(chain, addr, SEL_OWNER);
    if (ret && ret.length >= 42) {
      owner = wordToAddress(ret);
      if (owner === ZERO) ownerKind = 'renounced';
      else {
        const [ocode] = await rpcBatch(chain, [{ method: 'eth_getCode', params: [owner, 'latest'] }]);
        ownerKind = (ocode && ocode !== '0x' && ocode !== '0x0') ? 'contract' : 'eoa';
      }
    }
  } catch { /* no owner() — fine */ }
  s.remove();
  if (owner) {
    reads.push(['owner()', owner + (ownerKind === 'renounced' ? ' (renounced)' : ' (' + ownerKind + ')')]);
    if (ownerKind === 'renounced') note('good', 'ownership renounced (owner = 0x0). nobody holds the keys.', 'owner() → zero address');
    else if (ownerKind === 'eoa') hit('med', 'owned by a regular wallet (' + shortAddr(owner) + '). one person holds the keys.', 'owner() → eoa', 8);
    else if (ownerKind === 'contract') note('info', 'owned by a contract (' + shortAddr(owner) + ') — could be a multisig/dao, or could be another trap. verify it.', 'owner() → contract code present');
  } else {
    note('info', 'no owner() found — either ownable-free or custom access control. read the source.', 'eth_call owner() reverted/empty');
  }
  if (isProxy) {
    if (ownerKind === 'eoa') hit('high', 'proxy + eoa owner = one wallet can rewrite this contract at will.', 'proxy + owner()', 20);
    else if (ownerKind === 'contract') hit('med', 'proxy controlled by a contract — safer than an eoa, still upgradeable.', 'proxy + owner()', 10);
    else hit('med', 'proxy with unclear upgrade control. assume the worst.', 'proxy slots', 15);
  }
  step('ownership: ' + (owner ? shortAddr(owner) + ' (' + ownerKind + ')' : 'none found'), true);

  /* 5. function inventory: abi if verified, else bytecode + 4byte */
  s = step('inventorying functions' + (verified && abi ? ' (from verified abi)' : ' (from bytecode, via 4byte)'));
  let fnSigs = [];
  if (verified && abi) {
    fnSigs = abi.filter((e) => e.type === 'function').map((e) => e.name + '(' + (e.inputs || []).map((i) => i.type).join(',') + ')');
  } else {
    const sels = extractSelectors(code);
    const resolved = await resolveSelectors(sels);
    fnSigs = Object.values(resolved).flat();
  }
  s.remove();
  const kinds = {};
  for (const sig of fnSigs) {
    const nm = sig.split('(')[0];
    if (/^test/i.test(nm)) continue; // fuzz-test names pollute 4byte — ignore
    const k = classifyName(nm);
    if (k) { (kinds[k] = kinds[k] || new Set()).add(nm); }
  }
  const has = (k) => kinds[k] && kinds[k].size > 0;
  const eoaOwner = ownerKind === 'eoa';

  if (has('kill')) hit('crit', 'self-destruct capability (' + [...kinds.kill].join(', ') + '). the dev can nuke it.', 'function name heuristic', 30);
  if (has('blacklist')) hit('high', 'blacklist functions (' + [...kinds.blacklist].join(', ') + '). wallets can be frozen out of selling.', 'function name heuristic', 15);
  if (has('taxsetter')) hit('med', 'owner-adjustable taxes/fees (' + [...kinds.taxsetter].join(', ') + '). rates can change after you buy.', 'function name heuristic', 12);
  if (has('mint')) {
    if (ownerKind === 'renounced') hit('low', 'mint functions exist (' + [...kinds.mint].join(', ') + ') but ownership is renounced.', 'function name heuristic', 4);
    else hit('med', 'mint functions (' + [...kinds.mint].join(', ') + ')' + (eoaOwner ? ' + eoa owner = supply can be printed on a whim.' : ' — check who can call them.'), 'function name heuristic', eoaOwner ? 12 : 8);
  }
  if (has('drain')) {
    if (ownerKind === 'renounced') note('info', 'withdraw/rescue-style functions exist but ownership is renounced.', 'function name heuristic');
    else hit('med', 'funds can be pulled via (' + [...kinds.drain].join(', ') + ')' + (eoaOwner ? ' by the eoa owner.' : ' — check access control.'), 'function name heuristic', 8);
  }
  if (has('pause')) note('info', 'pausable (' + [...kinds.pause].join(', ') + '). transfers can be halted — sometimes legit, sometimes not.', 'function name heuristic');
  if (has('limits')) note('info', 'transfer limits (' + [...kinds.limits].join(', ') + '). can be anti-whale… or anti-you.', 'function name heuristic');
  if (has('ownership')) note('info', 'ownership functions present (' + [...kinds.ownership].join(', ') + ').', 'function name heuristic');
  step('functions inventoried (' + fnSigs.length + ' signatures)', true);

  /* 6. opcode scan */
  s = step('scanning opcodes');
  const ops = scanOpcodes(code);
  s.remove();
  if (ops.selfdestruct) hit('crit', 'SELFDESTRUCT opcode in bytecode. contract can destroy itself.', 'bytecode disassembly', 30);
  if (ops.delegatecall) hit('med', 'DELEGATECALL in bytecode. can run other contracts\' code in its own context.', 'bytecode disassembly', 12);
  step('opcode scan done', true);

  /* 7. live value reads from abi (taxes, limits, trading state) */
  if (verified && abi) {
    s = step('reading live values (taxes, limits…)');
    const fns = abi.filter((e) =>
      e.type === 'function' && (e.stateMutability === 'view' || e.stateMutability === 'pure') &&
      (e.inputs || []).length === 0 && (e.outputs || []).length === 1 &&
      VALUE_GETTERS.includes((e.name || '').toLowerCase())
    );
    const seen = new Set();
    const uniq = fns.filter((f) => { const k = f.name.toLowerCase(); return seen.has(k) ? false : (seen.add(k), true); }).slice(0, 14);
    try {
      const selList = await Promise.all(uniq.map(selectorFor));
      const calls = uniq.map((f, i) => ({ method: 'eth_call', params: [{ to: addr, data: selList[i] }, 'latest'] }));
      if (calls.length) {
        const rets = await rpcBatch(chain, calls);
        const vals = {};
        uniq.forEach((f, i) => {
          const v = decodeSingle(rets[i], f.outputs[0].type);
          if (v !== null) { vals[f.name.toLowerCase()] = v; reads.push([f.name + '()', v]); }
        });
        const taxOf = (v) => { const n = Number(v); if (!isFinite(n)) return null; if (n <= 100) return n; if (n <= 10000) return n / 100; return null; };
        const bt = taxOf(vals['buytax'] ?? vals['_buytax']);
        const st = taxOf(vals['selltax'] ?? vals['_selltax']);
        if (bt !== null || st !== null) {
          const total = (bt || 0) + (st || 0);
          if (total >= 25) hit('high', 'combined buy+sell tax ≈ ' + total + '% — honeypot math.', 'live tax getters', 15);
          else if (total >= 10) hit('med', 'combined buy+sell tax ≈ ' + total + '%. spicy.', 'live tax getters', 8);
          else note('good', 'combined tax ≈ ' + total + '% — reasonable.', 'live tax getters');
        }
        const p = vals['paused'];
        if (p === 'true') hit('med', 'contract is currently PAUSED. transfers are frozen.', 'paused()', 5);
        const ta = vals['tradingactive'] ?? vals['tradingenabled'];
        if (ta === 'false') note('info', 'trading is currently disabled.', 'tradingActive()/tradingEnabled()');
      }
    } catch { /* best effort */ }
    s.remove();
    step('live values read', true);
  }

  /* 8. holder concentration (best effort, tokens) */
  try {
    const hr = await fetchTimeout(chain.api + '/tokens/' + addr + '/holders', {}, 12000);
    if (hr.ok) {
      const hj = await hr.json();
      const items = hj.items || [];
      if (items.length) {
        const ts = await ethCall(chain, addr, SEL_TOTALSUPPLY).catch(() => null);
        if (ts) {
          const total = BigInt(ts);
          if (total > 0n) {
            const top = items[0];
            const topVal = BigInt(top.value || '0');
            const pct = Number((topVal * 10000n) / total) / 100;
            const topAddr = (top.address && top.address.hash || '').toLowerCase();
            const isBurn = topAddr === ZERO || topAddr === '0x000000000000000000000000000000000000dead';
            reads.push(['top holder', shortAddr(top.address.hash) + ' — ' + pct.toFixed(1) + '% of supply']);
            if (!isBurn && pct > 50) hit('high', 'one wallet holds ' + pct.toFixed(1) + '% of supply. dump risk is real.', 'blockscout holders', 12);
            else if (!isBurn && pct > 20) note('info', 'top wallet holds ' + pct.toFixed(1) + '% of supply. keep an eye on it.', 'blockscout holders');
            else if (isBurn) note('good', 'biggest holder is the burn address — supply actually reduced.', 'blockscout holders');
          }
        }
      }
    }
  } catch { /* best effort */ }

  /* verdict */
  score = Math.max(0, Math.min(100, score));
  const verdict = score >= 80 ? 'SAFE-ISH' : score >= 50 ? 'CAUTION' : 'AVOID';
  const smell = score >= 80 ? 'smells clean.' : score >= 50 ? 'smells funny.' : "don't touch it.";
  return { chain, addr, score, verdict, smell, flags, notes, reads, verified, contractName };
}

/* abi function -> 4-byte selector via 4byte lookup of the canonical signature */
const selCache = {};
async function selectorFor(fnAbi) {
  const sig = fnAbi.name + '(' + (fnAbi.inputs || []).map((i) => i.type).join(',') + ')';
  if (selCache[sig]) return selCache[sig];
  try {
    const r = await fetchTimeout('https://www.4byte.directory/api/v1/signatures/?text_signature=' + encodeURIComponent(sig), {}, 10000);
    const j = await r.json();
    if (j.results && j.results.length) {
      selCache[sig] = j.results[0].hex_signature;
      return selCache[sig];
    }
  } catch { /* fall through */ }
  return '0x00000000';
}

function decodeSingle(hex, type) {
  if (!hex || hex === '0x') return null;
  try {
    if (/^u?int/.test(type)) return BigInt(hex).toString();
    if (type === 'bool') return (BigInt(hex) !== 0n).toString();
    if (type === 'address') return wordToAddress(hex);
    if (type === 'string') return '(string)';
    return hex.slice(0, 66);
  } catch { return null; }
}

/* ---------------- render ---------------- */
function render(res) {
  $('results').hidden = false;
  const ring = $('ringFg');
  const C = 326.7;
  ring.style.strokeDashoffset = C - (C * res.score) / 100;
  ring.style.stroke = res.score >= 80 ? '#ccff00' : res.score >= 50 ? '#ffb300' : '#ff4d4d';
  $('scoreNum').textContent = res.score;
  const v = $('verdict');
  v.textContent = res.verdict;
  v.className = 'verdict ' + (res.score >= 80 ? 'safe' : res.score >= 50 ? 'caution' : 'avoid');
  $('summary').textContent = res.smell + ' scanned ' + res.chain.name + ' contract' +
    (res.contractName ? ' "' + res.contractName + '"' : '') + ' — ' +
    res.flags.length + ' flag' + (res.flags.length === 1 ? '' : 's') + ', ' +
    res.notes.length + ' note' + (res.notes.length === 1 ? '' : 's') + '.';

  const order = { crit: 0, high: 1, med: 2, low: 3, info: 4, good: 5 };
  const sorted = [...res.flags].sort((a, b) => order[a.sev] - order[b.sev]);
  $('flags').innerHTML = sorted.length
    ? sorted.map((f) => '<li class="' + f.sev + '"><span class="sev ' + f.sev + '">' + f.sev.toUpperCase() + '</span>' +
      escapeHtml(f.text) + '<span class="flag-check">check: ' + escapeHtml(f.check) + '</span></li>').join('')
    : '<li class="good"><span class="sev good">CLEAN</span>nothing tripped. rare. screenshot it.</li>';

  $('notes').innerHTML = res.notes.length
    ? res.notes.map((f) => '<li class="' + f.sev + '"><span class="sev ' + f.sev + '">' + f.sev.toUpperCase() + '</span>' +
      escapeHtml(f.text) + '<span class="flag-check">check: ' + escapeHtml(f.check) + '</span></li>').join('')
    : '<li class="info"><span class="sev info">INFO</span>no notes.</li>';

  $('reads').querySelector('tbody').innerHTML = res.reads.length
    ? res.reads.map((r) => '<tr><td>' + escapeHtml(r[0]) + '</td><td>' + escapeHtml(String(r[1])) + '</td></tr>').join('')
    : '<tr><td>—</td><td>no live reads returned</td></tr>';

  const ex = res.chain.explorer + '/address/' + res.addr;
  $('links').innerHTML =
    '<a href="' + ex + '" target="_blank" rel="noopener">explorer ↗</a>' +
    (res.verified ? '<a href="' + ex + '?tab=contract" target="_blank" rel="noopener">verified source ↗</a>' : '');
  $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------------- wire up ---------------- */
async function run(chainId, address) {
  $('err').hidden = true;
  $('results').hidden = true;
  $('steps').innerHTML = '';
  $('go').disabled = true;
  $('go').textContent = 'sniffing…';
  try {
    const res = await scan(chainId, address);
    if (res.notContract) {
      const e = $('err');
      e.hidden = false;
      e.textContent = 'no contract code at that address on ' + res.chain.name + '. that\'s a wallet (or a typo).';
      return;
    }
    render(res);
  } catch (e) {
    const el = $('err');
    el.hidden = false;
    el.textContent = 'scan failed: ' + (e.message || e) + ' — rpc or explorer might be rate-limiting. wait a bit and retry.';
  } finally {
    $('go').disabled = false;
    $('go').textContent = 'sniff it';
  }
}

$('go').addEventListener('click', () => {
  const a = $('addr').value.trim();
  if (!isValidAddress(a)) {
    const e = $('err');
    e.hidden = false;
    e.textContent = 'that doesn\'t look like an address. want 0x + 40 hex chars.';
    return;
  }
  const c = $('chain').value;
  history.replaceState(null, '', '#/' + c + '/' + a.toLowerCase());
  run(c, a);
});
$('addr').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('go').click(); });
$('copyLink').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    $('copyLink').textContent = 'copied ✓';
    setTimeout(() => ($('copyLink').textContent = 'copy share link'), 1500);
  } catch { $('copyLink').textContent = 'copy failed — just copy the url'; }
});

/* share links: #/chain/0xaddr */
(function () {
  const m = location.hash.match(/^#\/([a-z]+)\/(0x[0-9a-fA-F]{40})$/);
  if (m && CHAINS[m[1]]) {
    $('chain').value = m[1];
    $('addr').value = m[2];
    run(m[1], m[2]);
  }
})();

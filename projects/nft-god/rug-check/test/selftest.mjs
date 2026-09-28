#!/usr/bin/env node
/**
 * selftest.mjs — offline unit tests for rug-check's heuristic + bytecode layers.
 * No network, no RPC, no keys. Run: node test/selftest.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { customHeuristics, bytecodeScan, verdictFrom, formatUnits, countFixedPayments, clusterFunders } from '../rug-check.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const ok = (cond, label) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${label}`); };

// 1) Heuristics on the deliberately-malicious fixture.
const fixture = fs.readFileSync(path.join(DIR, 'RugFixture.sol'), 'utf8');
const h = customHeuristics(fixture);
const titles = h.map(f => f.title);
ok(titles.includes('heuristic:owner-controlled-mint'), 'fixture: owner-controlled mint flagged');
ok(titles.includes('heuristic:public-free-mint'), 'fixture: public free mint flagged');
ok(titles.includes('heuristic:owner-withdraw-sweep'), 'fixture: owner withdraw/sweep flagged');
ok(titles.includes('heuristic:selfdestruct-in-source'), 'fixture: selfdestruct flagged');
ok(titles.includes('heuristic:tx-origin-auth'), 'fixture: tx.origin flagged');
ok(verdictFrom(h) === 'flagged', 'fixture: verdict is flagged');

// 2) Bytecode scan on crafted runtime code with SELFDESTRUCT + DELEGATECALL.
//    0x60 0x00 = PUSH1 0x00 (tests immediate-skipping), 0xff, 0xf4.
const evil = '0x6000ff6000f4';
const b = bytecodeScan(evil).findings.map(f => f.title);
ok(b.includes('bytecode:SELFDESTRUCT'), 'bytecode: SELFDESTRUCT flagged HIGH');
ok(b.includes('bytecode:DELEGATECALL'), 'bytecode: DELEGATECALL flagged HIGH');
const bSev = Object.fromEntries(bytecodeScan(evil).findings.map(f => [f.title, f.severity]));
ok(bSev['bytecode:SELFDESTRUCT'] === 'HIGH', 'bytecode: SELFDESTRUCT severity HIGH');

// PUSH-skipping correctness: 0x60ff is PUSH1 0xff, not SELFDESTRUCT.
const pushOnly = bytecodeScan('0x60ff').findings.map(f => f.title);
ok(!pushOnly.includes('bytecode:SELFDESTRUCT'), 'bytecode: PUSH1 0xff immediate not misread as SELFDESTRUCT');

// 3) Proxy-shaped bytecode downgrades DELEGATECALL.
const proxyCode = '0x' + '360894a13ba1a3210667c828832db98dca3e00' + 'f4';
const pb = bytecodeScan(proxyCode).findings;
ok(pb.some(f => f.title === 'bytecode:DELEGATECALL-proxy-pattern' && f.severity === 'MEDIUM'),
   'bytecode: EIP-1967 proxy DELEGATECALL downgraded to MEDIUM');

// 4) Empty code -> unknown path signal.
const empty = bytecodeScan('0x');
ok(empty.empty === true, 'bytecode: empty code signals EOA/undeployed');

// 5) Clean source produces no HIGH/MEDIUM heuristics.
const cleanSrc = 'pragma solidity ^0.8.0; contract C { function mint() external payable { require(msg.value > 0); } }';
ok(verdictFrom(customHeuristics(cleanSrc)) === 'clean', 'heuristics: priced public mint is clean');

// 6) Lord-of-War pure helpers (offline).
ok(formatUnits(1992000000n, 6) === '1992', 'low: formatUnits 1992000000/6 -> 1992');
ok(formatUnits(1500000000000000000n, 18) === '1.5', 'low: formatUnits 1.5e18/18 -> 1.5');
ok(formatUnits(42n, 0) === '42', 'low: formatUnits with 0 decimals');
const toll = '0x' + 'ab'.repeat(20);
const payEntries = [];
for (let i = 0; i < 7; i++) payEntries.push({ to: toll, value: '0x1dcd6500', tx: '0xtx' + i }); // 500000000 ×7
payEntries.push({ to: '0x' + 'cd'.repeat(20), value: '0x1dcd6500', tx: '0xother' });
const best = countFixedPayments(payEntries, { exclude: [] });
ok(best && best.txs.size === 7 && best.value === 500000000n, 'low: countFixedPayments finds the ×7 fixed toll');
ok(countFixedPayments([{ to: toll, value: '0x1', tx: '0xa' }]).txs.size === 1, 'low: countFixedPayments counts a singleton');
ok(countFixedPayments([{ to: '0x0000000000000000000000000000000000000000', value: '0x5', tx: '0xa' }]) === null, 'low: countFixedPayments ignores zero-address');
const cl = clusterFunders(['0x1111111111111111111111111111111111111111', '0x2222222222222222222222222222222222222222', '0x1111111111111111111111111111111111111111']);
ok(cl && cl.n === 2 && cl.funder === '0x1111111111111111111111111111111111111111', 'low: clusterFunders finds the shared funder');
ok(clusterFunders([]) === null, 'low: clusterFunders on empty input is null');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

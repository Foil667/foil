#!/usr/bin/env node
// Foil mints SecondPop watch (RH 4663) + PixFone phone (Base 8453).
// User-ordered 2026-10-02. Free mints, value=0, no approvals.
import fs from 'fs';
import os from 'os';
import { ethers } from 'ethers';

const BANKR_API = 'https://api.bankr.bot';
const FOIL = '0x6573682faee72a4a96e791ba262439f1df3a268d';
const key = JSON.parse(fs.readFileSync(os.homedir() + '/.bankr/config.json', 'utf8')).apiKey;

async function bankr(path, body) {
  const res = await fetch(BANKR_API + path, {
    method: 'POST',
    headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Bankr ${path} ${res.status}: ${JSON.stringify(data).slice(0, 400)}`);
  return data;
}

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36';
const mintData = new ethers.Interface(['function mint(uint256 qty)']).encodeFunctionData('mint', [1]);
console.log('mint calldata:', mintData);

const jobs = [
  { name: 'SecondPop watch', chainId: 4663, to: '0x25625b1Cf445Ea7c93CFE3009b489c9DfBE470c4',
    rpc: 'https://rpc.mainnet.chain.robinhood.com' },
  { name: 'PixFone phone', chainId: 8453, to: '0xd9254883E2B12407d7A432e35a63F9a0fA786C13',
    rpc: 'https://mainnet.base.org' },
];

for (const j of jobs) {
  console.log(`\n=== ${j.name} (chain ${j.chainId}) ===`);
  // fresh sim right before submit
  const provider = new ethers.JsonRpcProvider(j.rpc, j.chainId, { headers: { 'User-Agent': UA } });
  try {
    await provider.call({ from: FOIL, to: j.to, data: mintData, value: 0 });
    console.log('pre-submit sim: OK');
  } catch (e) {
    console.log('pre-submit sim FAILED:', (e.shortMessage || e.message).slice(0, 150));
    continue;
  }
  const r = await bankr('/wallet/submit', {
    transaction: { to: j.to, chainId: j.chainId, value: '0', data: mintData },
    description: `Foil mints ${j.name} (free)`,
    waitForConfirmation: true,
  });
  console.log('submit result:', JSON.stringify(r).slice(0, 300));
  if (r.transactionHash) {
    const c = new ethers.Contract(j.to, ['function balanceOf(address) view returns (uint256)', 'function totalSupply() view returns (uint256)'], provider);
    console.log('Foil balance now:', (await c.balanceOf(FOIL)).toString(), '| totalSupply:', (await c.totalSupply()).toString());
  }
}
console.log('\ndone.');

// forward-claims.mjs — safeTransferFrom Foil's freshly claimed NFTs to the user's wallet.
// Standing order (2026-09-26): forward ALL minted NFTs to the user's wallet
// 0x4f9883c7331ba59a56360ffa3c332e0bc09029fc after each claim (Robinhood Chain).
// Usage: node forward-claims.mjs <nftContract> <tokenId1> [tokenId2 ...]
import fs from 'node:fs';
import os from 'node:os';
import { ethers } from 'ethers';

const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const CHAIN_ID = 4663;
const FROM = '0x6573682faee72a4a96e791ba262439f1df3a268d'; // Foil's funded wallet
const TO = '0x4f9883c7331ba59a56360ffa3c332e0bc09029fc';   // user's wallet
const SEL = '0x42842e0e'; // safeTransferFrom(address,address,uint256)

const [nft, ...ids] = process.argv.slice(2);
if (!nft || ids.length === 0) { console.error('usage: node forward-claims.mjs <nftContract> <tokenId...>'); process.exit(2); }

const provider = new ethers.JsonRpcProvider(RPC);
const coder = new ethers.AbiCoder();
const key = JSON.parse(fs.readFileSync(os.homedir() + '/.bankr/config.json', 'utf8')).apiKey;
if (!key) { console.error('no apiKey in ~/.bankr/config.json'); process.exit(1); }

// sanity: confirm Foil still owns each token before submitting
const own = new ethers.Contract(nft, ['function ownerOf(uint256) view returns (address)'], provider);
for (const id of ids) {
  const o = await own.ownerOf(id);
  if (o.toLowerCase() !== FROM.toLowerCase()) { console.error(`ABORT: token ${id} owner is ${o}, not Foil`); process.exit(1); }
  console.log(`token ${id} owned by Foil — ok`);
}

const feeH = await provider.send('eth_feeHistory', ['0x1', 'latest', [50]]);
const baseFee = BigInt(feeH.baseFeePerGas[feeH.baseFeePerGas.length - 1]);
const maxFee = baseFee * 2n + 2000000000n; // 2 gwei priority headroom
const maxPriority = 2000000000n;
let nonce = await provider.getTransactionCount(FROM);

for (const id of ids) {
  const data = SEL + coder.encode(['address','address','uint256'], [FROM, TO, id]).slice(2);
  const tx = {
    to: nft, chainId: CHAIN_ID, value: '0x0', data,
    gas: '0x' + (90000n).toString(16),
    maxFeePerGas: '0x' + maxFee.toString(16),
    maxPriorityFeePerGas: '0x' + maxPriority.toString(16),
    nonce: Number(nonce),
  };
  const res = await fetch('https://api.bankr.bot/wallet/submit', {
    method: 'POST',
    headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ transaction: tx, description: `forward LILBUDS #${id} to user wallet (standing order)`, waitForConfirmation: false }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) { console.error(`SUBMIT FAIL token ${id}: ${res.status} ${JSON.stringify(d).slice(0,300)}`); process.exit(1); }
  console.log(`token ${id} submitted -> ${d.transactionHash}`);
  const deadline = Date.now() + 90000;
  let rc = null;
  while (Date.now() < deadline && !rc) {
    rc = await provider.getTransactionReceipt(d.transactionHash).catch(() => null);
    if (!rc) await new Promise(r => setTimeout(r, 2500));
  }
  console.log(`token ${id} receipt: ${rc ? 'status=' + rc.status + ' gasUsed=' + rc.gasUsed : 'TIMEOUT — check explorer before retry'}`);
  if (rc && rc.status !== 1) { console.error('REVERT — aborting'); process.exit(1); }
  nonce++;
}
console.log('ALL FORWARDED');

// Task-prescribed post-claim forward (foilbox run396): safeTransferFrom all 25
// AMONGRH tokens 252-276 from Foil's wallet to the user's wallet via Bankr /wallet/submit.
// Destination 0x4f9883c7331ba59a56360ffa3c332e0bc09029fc is from the task body step 6.
import fs from 'node:fs';
import os from 'node:os';
import { ethers } from 'ethers';

const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const CHAIN_ID = 4663;
const NFT = '0x8d5deff6317a3e040bf7d2a5e35622abe6b175bb';
const FROM = '0x6573682faee72a4a96e791ba262439f1df3a268d';
const TO = '0x4f9883c7331ba59a56360ffa3c332e0bc09029fc';
const SEL = '0x42842e0e';
const IDS = JSON.parse(fs.readFileSync('/tmp/amongrh-ids.json', 'utf8'));

const provider = new ethers.JsonRpcProvider(RPC);
const coder = new ethers.AbiCoder();
const key = JSON.parse(fs.readFileSync(os.homedir() + '/.bankr/config.json', 'utf8')).apiKey;
if (!key) { console.error('no apiKey'); process.exit(1); }

const own = new ethers.Contract(NFT, ['function ownerOf(uint256) view returns (address)'], provider);
for (const id of IDS) {
  const o = await own.ownerOf(id);
  if (o.toLowerCase() !== FROM.toLowerCase()) { console.error(`ABORT: token ${id} owner ${o}`); process.exit(1); }
}
console.log(`all ${IDS.length} tokens owned by Foil — ok`);

const feeH = await provider.send('eth_feeHistory', ['0x1', 'latest', [50]]);
const baseFee = BigInt(feeH.baseFeePerGas[feeH.baseFeePerGas.length - 1]);
const maxFee = baseFee * 2n + 2000000000n;
let nonce = await provider.getTransactionCount(FROM);
const hashes = [];
for (const id of IDS) {
  const data = SEL + coder.encode(['address', 'address', 'uint256'], [FROM, TO, id]).slice(2);
  const tx = { to: NFT, chainId: CHAIN_ID, value: '0x0', data,
    gas: '0x' + (90000n).toString(16),
    maxFeePerGas: '0x' + maxFee.toString(16),
    maxPriorityFeePerGas: '0x77359400', nonce: Number(nonce) };
  const res = await fetch('https://api.bankr.bot/wallet/submit', {
    method: 'POST',
    headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ transaction: tx, description: `foilbox run396 forward AMONGRH #${id} to user`, waitForConfirmation: false }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) { console.error(`SUBMIT FAIL ${id}: ${res.status}`); process.exit(1); }
  hashes.push({ id, hash: d.transactionHash });
  console.log(`token ${id} -> ${d.transactionHash}`);
  const deadline = Date.now() + 90000;
  let rc = null;
  while (Date.now() < deadline && !rc) {
    rc = await provider.getTransactionReceipt(d.transactionHash).catch(() => null);
    if (!rc) await new Promise(r => setTimeout(r, 2500));
  }
  console.log(`  receipt: ${rc ? 'status=' + rc.status + ' gasUsed=' + rc.gasUsed : 'TIMEOUT'}`);
  if (!rc || rc.status !== 1) { console.error('REVERT/TIMEOUT — aborting'); process.exit(1); }
  nonce++;
}
console.log('ALL SUBMITTED+CONFIRMED');
fs.writeFileSync('/tmp/amongrh-forwards.json', JSON.stringify(hashes, null, 1));
// final ownerOf verification
let ok = 0;
for (const { id } of hashes) {
  const o = await own.ownerOf(id);
  if (o.toLowerCase() === TO.toLowerCase()) ok++;
  else console.log(`MISMATCH token ${id} owner ${o}`);
}
console.log(`ownerOf verified user-owned: ${ok}/${hashes.length}`);

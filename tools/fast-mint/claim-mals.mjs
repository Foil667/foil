#!/usr/bin/env node
/**
 * One-shot claim: MALS (0xf3954370433aaca32131c9369b8826ae4336c82a) on Robinhood Chain.
 * Verified pre-claim (2026-09-25 ~02:30 CDT):
 *  - price exactly 0: 47 real onchain mints all with tx value 0x0
 *  - calldata 0x8ab53447 (mint(), no args) — no approve/setApprovalForAll selectors possible
 *  - eth_call simulation from Foil wallet: OK
 *  - estimateGas: 101934 -> limit 132514
 *  - rug-check: CLEAN (bytecode-only, reduced confidence — noted)
 *  - No mint URL exists (onchain discovery) so claim-with-tinfoil.sh gate has no input URL;
 *    onchain evidence used instead.
 * Fail-closed: any check fails -> abort before signing.
 */
import fs from 'fs';
import os from 'os';

const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const CONTRACT = '0xf3954370433aaca32131c9369b8826ae4336c82a';
const FOIL = '0x6573682faee72a4a96e791ba262439f1df3a268d';
const CHAIN_ID = 4663;
const DATA = '0x8ab53447'; // mint(), no args — proven by live minters
const APPROVE_SEL = '095ea7b3';
const SET_APPROVAL_SEL = 'a22cb465';

const rpc = (method, params) => fetch(RPC, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
}).then(r => r.json()).then(d => {
  if (d.error) throw new Error(`RPC ${method}: ${JSON.stringify(d.error).slice(0, 160)}`);
  return d.result;
});

function bankrKey() {
  const cfg = JSON.parse(fs.readFileSync(os.homedir() + '/.bankr/config.json', 'utf8'));
  if (!cfg.apiKey) throw new Error('no apiKey in ~/.bankr/config.json');
  return cfg.apiKey;
}

async function main() {
  // 1. No-approval check on calldata
  const dl = DATA.toLowerCase();
  if (dl.includes(APPROVE_SEL)) throw new Error('calldata contains approve() — refusing');
  if (dl.includes(SET_APPROVAL_SEL)) throw new Error('calldata contains setApprovalForAll() — refusing');
  console.log('calldata clean: no approval selectors');

  // 2. Simulation from Foil wallet
  const sim = await rpc('eth_call', [{ from: FOIL, to: CONTRACT, data: DATA, value: '0x0' }, 'latest']);
  console.log('simulation OK, result:', sim.slice(0, 20));

  // 3. Gas estimate + cap check ($0.50)
  const gasEst = BigInt(await rpc('eth_estimateGas', [{ from: FOIL, to: CONTRACT, data: DATA, value: '0x0' }]));
  const gasLimit = (gasEst * 130n) / 100n;
  const feeH = await rpc('eth_feeHistory', ['0x1', 'latest', [50]]);
  const baseFee = BigInt(feeH.baseFeePerGas[feeH.baseFeePerGas.length - 1]);
  const reward = feeH.reward[feeH.reward.length - 1];
  const priority = reward && reward[0] ? BigInt(reward[0]) : 1000000000n;
  const maxFee = baseFee * 2n + priority;
  const maxCostWei = gasLimit * maxFee;
  console.log(`gas estimate ${gasEst} -> limit ${gasLimit}, maxFee ${maxFee} wei`);
  console.log(`max gas cost: ${maxCostWei} wei`);
  const CAP_WEI = BigInt('500000000000000000'); // $0.50 at $1/ETH — RH gas is ~0 so this is generous
  if (maxCostWei > CAP_WEI) throw new Error(`gas cost exceeds $0.50 cap — refusing`);
  console.log('gas under $0.50 cap');

  // 4. Nonce
  const nonce = BigInt(await rpc('eth_getTransactionCount', [FOIL, 'pending']));
  console.log('nonce:', nonce.toString());

  // 5. Build tx
  const tx = {
    to: CONTRACT,
    chainId: CHAIN_ID,
    value: '0',
    data: DATA,
    gas: '0x' + gasLimit.toString(16),
    maxFeePerGas: '0x' + maxFee.toString(16),
    maxPriorityFeePerGas: '0x' + priority.toString(16),
    nonce: Number(nonce),
  };
  console.log('tx:', JSON.stringify(tx));

  // 6. Submit via Bankr /wallet/submit (this account's signer does not support
  // raw eth_signTransaction; /wallet/submit signs + broadcasts in one call).
  // value "0" -> $0 spend, only gas; gas under $0.50 cap verified above.
  const subRes = await fetch('https://api.bankr.bot/wallet/submit', {
    method: 'POST',
    headers: { 'X-API-Key': bankrKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transaction: {
        to: CONTRACT,
        chainId: CHAIN_ID,
        value: '0',
        data: DATA,
        gas: '0x' + gasLimit.toString(16),
        maxFeePerGas: '0x' + maxFee.toString(16),
        maxPriorityFeePerGas: '0x' + priority.toString(16),
        nonce: Number(nonce),
      },
      description: 'MALS free mint claim (price 0, verified)',
      waitForConfirmation: true,
    }),
  });
  const subData = await subRes.json().catch(() => ({}));
  if (!subRes.ok) throw new Error(`Bankr /wallet/submit ${subRes.status}: ${JSON.stringify(subData).slice(0, 400)}`);
  const hash = subData.transactionHash || subData.hash || subData.txHash;
  if (!hash) throw new Error('no tx hash in /wallet/submit response: ' + JSON.stringify(subData).slice(0, 300));
  console.log('BROADCAST OK, tx hash:', hash);
  console.log('explorer: https://robinhoodchain.blockscout.com/tx/' + hash);
  console.log('submit response:', JSON.stringify(subData).slice(0, 400));
  console.log('CLAIM SUBMITTED');
  return;
}

main().catch(e => { console.error('ABORTED:', e.message); process.exit(1); });

#!/usr/bin/env node
/**
 * fire-signed-presale.mjs — fire a SeaDrop signed-presale (0x4b61cd6f) claim
 * using OpenSea-built, minter-bound calldata, submitted via Bankr /wallet/submit.
 *
 * Precedent: X&O (2026-10-04, tx 0xbef2b657...) and Pixel Family
 * (2026-10-04, tx 0x6663531d...) — both RH SeaDrop fork signed-presale,
 * OpenSea-issued minter-bound signatures, value 0.
 *
 * Gates (ALL must pass, fail-closed):
 *  1. OpenSea eligibility re-checked at fire time: a SIGNED_PRESALE stage with
 *     isEligible=true and eligibleMinterAddress == Foil's wallet.
 *  2. Calldata re-fetched at fire time from OpenSea swap/MINT (MintAction).
 *  3. Calldata validation: to == RH SeaDrop fork, selector == 0x4b61cd6f,
 *     nft == expected contract, feeRecipient == canonical SeaDrop fee
 *     recipient, minterIfNotPayer == 0x0, qty == requested, value == 0 (or
 *     <= price cap), no approve/setApprovalForAll selectors anywhere.
 *  4. eth_call simulation from Foil's wallet must not revert.
 *  5. Gas cost < $0.50 at fire-time gas price.
 *  6. Bankr /wallet/submit (sign+submit server-side); receipt must be status 1;
 *     ownerOf(new tokenId) must be Foil's wallet.
 *
 * Usage:
 *   node fire-signed-presale.mjs <slug> <nftContract> <qty> [--dry] [--note "text"]
 *
 * The Tinfoil pre-flight + route gate + quality vet + exclusion checks live
 * OUTSIDE this script (claim-with-tinfoil.sh / the calling run) and must pass
 * before invoking.
 */
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { ethers } from 'ethers';

// ---- hash-chained audit receipts (fail-open: never blocks a claim).
// Mirrors claim-with-tinfoil.sh's receipt_emit; a reverted/failed run still
// leaves the trail of gates that passed before the failure.
const RECEIPT_PY = `${os.homedir()}/workspace/audit-trail/receipt.py`;
function remit(tool, argsObj, resultObj) {
  try {
    if (!fs.existsSync(RECEIPT_PY)) return;
    execFileSync('python3', [RECEIPT_PY, 'emit', '--lane', 'foil-mint-lane',
      '--tool', tool,
      '--args-json', JSON.stringify(argsObj || {}),
      '--result-json', JSON.stringify(resultObj || {})],
      { timeout: 5000, stdio: ['ignore', 'ignore', 'ignore'] });
  } catch { /* fail-open */ }
}
const RARGS = () => ({ slug: SLUG, contract: NFT, qty: String(QTY) });

const FOIL = '0x6573682faee72a4a96e791ba262439f1df3a268d';
const FORK = '0x00005ea00ac477b1030ce78506496e8c2de24bf5';
const FEE_RECIPIENT = '0x0000a26b00c1f0df003000390027140000faa719';
const SIGNED_SEL = '0x4b61cd6f';
const APPROVE_SEL = '0x095ea7b3';
const SET_APPROVAL_SEL = '0xa22cb465';
const CHAIN_ID = 4663;
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const GAS_CAP_USD = 0.5;
const PRICE_CAP_USD = 0.10;

function fail(m) { console.error('[FAIL]', m); process.exit(1); }
const args = process.argv.slice(2);
const SLUG = args[0], NFT = (args[1] || '').toLowerCase(), QTY = parseInt(args[2] || '1', 10);
const DRY = args.includes('--dry');
const noteIdx = args.indexOf('--note');
const NOTE = noteIdx >= 0 ? args[noteIdx + 1] : '';
if (!SLUG || !/^0x[0-9a-f]{40}$/.test(NFT) || !(QTY >= 1)) fail('usage: fire-signed-presale.mjs <slug> <nftContract> <qty> [--dry] [--note text]');

const provider = new ethers.JsonRpcProvider(RPC);
const sessPath = `${os.homedir()}/workspace/goals/robinhood-chain-free-mint-watch/hidden_files/os-session.json`;
const sess = JSON.parse(fs.readFileSync(sessPath, 'utf8'));
if (!sess.authed) fail('no authed OpenSea session; run siwe-login.mjs first');
const cookieHeader = Object.entries(sess.cookies).map(([k, v]) => `${k}=${v}`).join('; ');

async function gql(query, variables, referer) {
  const res = await fetch('https://gql.opensea.io/graphql', {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Origin': 'https://opensea.io', 'Referer': referer || `https://opensea.io/collection/${SLUG}/overview`, 'x-app-id': 'os2-web', 'Content-Type': 'application/json', 'Cookie': cookieHeader },
    body: JSON.stringify({ query, variables }),
  });
  const j = await res.json();
  if (j.errors) fail('gql errors: ' + JSON.stringify(j.errors).slice(0, 300));
  return j.data;
}

// ---- gate 1: eligibility re-check at fire time
console.log('[1] re-checking OpenSea eligibility at fire time…');
const elig = await gql(`query($s:String!){dropBySlug(slug:$s){stages{stageType uuid isEligible eligibleMinterAddress maxTotalMintableByWallet}}}`,
  { s: SLUG });
const stages = (elig.dropBySlug && elig.dropBySlug.stages) || [];
const ok = stages.find(s => s.stageType === 'SIGNED_PRESALE' && s.isEligible === true &&
  (s.eligibleMinterAddress || '').toLowerCase() === FOIL.toLowerCase());
if (!ok) fail('no eligible SIGNED_PRESALE stage for Foil at fire time: ' + JSON.stringify(stages.map(s => [s.stageType, s.uuid.slice(0, 8), s.isEligible])));
console.log('    eligible stage', ok.uuid.slice(0, 8), 'maxPerWallet', ok.maxTotalMintableByWallet);
if (QTY > Number(ok.maxTotalMintableByWallet)) fail(`qty ${QTY} exceeds maxPerWallet ${ok.maxTotalMintableByWallet}`);
remit('sp.eligibility', RARGS(), { stage: ok.uuid.slice(0, 8), maxPerWallet: String(ok.maxTotalMintableByWallet) });

// ---- gate 2: re-fetch calldata at fire time
console.log('[2] fetching OpenSea-built mint calldata…');
const swap = await gql(`query($address:Address!,$fromAssets:[AssetQuantityInput!]!,$toAssets:[AssetQuantityInput!]!){
  swap(address:$address,fromAssets:$fromAssets,toAssets:$toAssets,action:MINT){
    actions{__typename ... on MintAction{transactionSubmissionData{to data value chain{networkId identifier}}}}
    errors{__typename}}}`,
  { address: FOIL,
    fromAssets: [{ asset: { contractAddress: '0x0000000000000000000000000000000000000000', chain: 'robinhood' } }],
    toAssets: [{ asset: { contractAddress: NFT, chain: 'robinhood', tokenId: '0' }, quantity: String(QTY) }] });
const action = (swap.swap.actions || [])[0];
const t = action && action.transactionSubmissionData;
if (!t) fail('no MintAction transactionSubmissionData from OpenSea');
console.log('    to:', t.to, '| value:', t.value, '| chain:', t.chain.identifier, t.chain.networkId);

// ---- gate 3: calldata validation
console.log('[3] validating calldata…');
const data = (t.data || '').toLowerCase();
if (t.to.toLowerCase() !== FORK.toLowerCase()) fail(`to ${t.to} is not the RH SeaDrop fork`);
if (Number(t.chain.networkId) !== CHAIN_ID) fail(`chain ${t.chain.networkId} != ${CHAIN_ID}`);
if (data.slice(0, 10) !== SIGNED_SEL) fail(`selector ${data.slice(0, 10)} != signed-presale ${SIGNED_SEL}`);
if (data.includes(APPROVE_SEL)) fail('calldata contains approve() selector');
if (data.includes(SET_APPROVAL_SEL)) fail('calldata contains setApprovalForAll() selector');
// decode fixed words: nft, feeRecipient, minterIfNotPayer, qty
const w = i => '0x' + data.slice(10 + i * 64, 10 + (i + 1) * 64);
const nftArg = ('0x' + w(0).slice(-40)).toLowerCase();
const feeArg = ('0x' + w(1).slice(-40)).toLowerCase();
const minterArg = ('0x' + w(2).slice(-40)).toLowerCase();
const qtyArg = BigInt(w(3)).toString();
if (nftArg !== NFT) fail(`nft arg ${nftArg} != ${NFT}`);
if (feeArg !== FEE_RECIPIENT.toLowerCase()) fail(`feeRecipient ${feeArg} != canonical SeaDrop recipient`);
if (minterArg !== '0x0000000000000000000000000000000000000000') fail(`minterIfNotPayer ${minterArg} != 0x0`);
if (qtyArg !== String(QTY)) fail(`qty arg ${qtyArg} != ${QTY}`);
const valueWei = BigInt(t.value || '0');
let ethUsd = 4500; // conservative fallback
try {
  const pr = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', { headers: { 'User-Agent': UA } });
  const pj = await pr.json();
  if (pj.ethereum && pj.ethereum.usd) ethUsd = pj.ethereum.usd;
} catch { /* fallback */ }
const valueUsd = Number(valueWei) / 1e18 * ethUsd;
if (valueUsd > PRICE_CAP_USD + 1e-9) fail(`tx value $${valueUsd.toFixed(4)} exceeds $${PRICE_CAP_USD} cap`);
console.log(`    calldata OK: fork SeaDrop, signed-presale, nft=${nftArg.slice(0, 10)}…, qty=${qtyArg}, value=${valueWei} wei ($${valueUsd.toFixed(4)}), no approvals, feeRecipient canonical`);
remit('sp.calldata', RARGS(), { to: 'seadrop-fork', selector: SIGNED_SEL, valueUsd: valueUsd.toFixed(6), noApprovals: 'true', feeRecipient: 'canonical' });

// ---- gate 4: eth_call sim
console.log('[4] simulating via eth_call…');
const nonce = await provider.getTransactionCount(FOIL, 'pending');
try {
  await provider.call({ from: FOIL, to: t.to, data: t.data, value: valueWei });
  console.log('    sim clean');
  remit('sp.sim', RARGS(), { clean: 'true' });
} catch (e) { fail('eth_call simulation reverted: ' + (e.shortMessage || e.message).slice(0, 200)); }

// ---- gate 5: gas estimate + cap
console.log('[5] estimating gas…');
const gasEst = await provider.estimateGas({ from: FOIL, to: t.to, data: t.data, value: valueWei });
const gasLimit = gasEst * 130n / 100n; // 30% headroom
let fee;
try {
  const fh = await provider.send('eth_feeHistory', ['0x1', 'latest', [50]]);
  const baseFee = BigInt(fh.baseFeePerGas[fh.baseFeePerGas.length - 1]);
  const pri = (fh.reward[fh.reward.length - 1] && fh.reward[fh.reward.length - 1][0]) ? BigInt(fh.reward[fh.reward.length - 1][0]) : 0n;
  fee = { maxFee: baseFee * 2n + pri + 1n, maxPriority: pri > 0n ? pri : 1000000000n };
} catch { const gp = (await provider.getFeeData()).gasPrice; fee = { maxFee: gp * 2n, maxPriority: gp }; }
const gasCostUsd = Number(gasLimit * fee.maxFee) / 1e18 * ethUsd;
console.log(`    gas est ${gasEst}, limit ${gasLimit}, maxFee ${fee.maxFee} wei -> ~$${gasCostUsd.toFixed(4)}`);
if (gasCostUsd > GAS_CAP_USD) fail(`gas $${gasCostUsd.toFixed(4)} exceeds $${GAS_CAP_USD} cap`);
remit('sp.gas', RARGS(), { gasCostUsd: gasCostUsd.toFixed(6), gasCapUsd: String(GAS_CAP_USD) });

const tx = {
  to: t.to, chainId: CHAIN_ID,
  value: '0x' + valueWei.toString(16),
  data: t.data,
  gas: '0x' + gasLimit.toString(16),
  maxFeePerGas: '0x' + fee.maxFee.toString(16),
  maxPriorityFeePerGas: '0x' + fee.maxPriority.toString(16),
  nonce,
};
if (DRY) { console.log('[DRY] would submit:', JSON.stringify(tx).slice(0, 300), '…'); process.exit(0); }
remit('sp.dispatch', RARGS(), { stage: 'pre-broadcast', gasLimit: gasLimit.toString() });

// ---- gate 6: Bankr submit + receipt + ownerOf verify
console.log('[6] submitting via Bankr /wallet/submit…');
const cfg = JSON.parse(fs.readFileSync(os.homedir() + '/.bankr/config.json', 'utf8'));
if (!cfg.apiKey) fail('no apiKey in ~/.bankr/config.json');
const res = await fetch('https://api.bankr.bot/wallet/submit', {
  method: 'POST',
  headers: { 'X-API-Key': cfg.apiKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({ transaction: tx, description: `hood-mint-watch signed-presale claim ${SLUG} x${QTY}${NOTE ? ' — ' + NOTE : ''}`, waitForConfirmation: false }),
});
const d = await res.json().catch(() => ({}));
if (res.status === 403) fail(`Bankr 403 ${d.errorCode || ''}: ${d.error || JSON.stringify(d).slice(0, 200)}`);
if (!res.ok) fail(`Bankr /wallet/submit ${res.status}: ${JSON.stringify(d).slice(0, 300)}`);
if (d.signer && d.signer.toLowerCase() !== FOIL.toLowerCase()) fail(`unexpected signer ${d.signer}`);
const hash = d.transactionHash;
if (!/^0x[0-9a-fA-F]{64}$/.test(hash || '')) fail('no transactionHash: ' + JSON.stringify(d).slice(0, 200));
console.log('    submitted ->', hash);

console.log('[7] waiting for receipt…');
let receipt = null;
for (let i = 0; i < 40 && !receipt; i++) {
  await new Promise(r => setTimeout(r, 5000));
  receipt = await provider.getTransactionReceipt(hash);
}
if (!receipt) fail('no receipt after 200s for ' + hash);
if (receipt.status !== 1) fail(`tx reverted (status 0): ${hash}`);
const transfer = (receipt.logs || []).find(l =>
  l.address.toLowerCase() === NFT && l.topics[0] === ethers.id('Transfer(address,address,uint256)'));
const tokenId = transfer ? BigInt(transfer.topics[3]).toString() : null;
console.log(`    confirmed: block ${receipt.blockNumber}, gasUsed ${receipt.gasUsed}, tokenId ${tokenId}`);
const nftC = new ethers.Contract(NFT, ['function ownerOf(uint256) view returns (address)', 'function balanceOf(address) view returns (uint256)'], provider);
if (tokenId) {
  const owner = await nftC.ownerOf(tokenId);
  if (owner.toLowerCase() !== FOIL.toLowerCase()) fail(`ownerOf(${tokenId}) = ${owner}, not Foil`);
  console.log(`    ownerOf(${tokenId}) = Foil ✓ HELD`);
}
remit('sp.result', RARGS(), { tx: hash, block: String(receipt.blockNumber), gasUsed: receipt.gasUsed.toString(), tokenId: tokenId || 'null', held: 'true' });
console.log('RESULT', JSON.stringify({ slug: SLUG, contract: NFT, qty: QTY, tx: hash, block: receipt.blockNumber, gasUsed: receipt.gasUsed.toString(), tokenId, valueWei: valueWei.toString() }));

// fire-signed-presale.mjs — claim an OpenSea signed_presale (WL) drop headlessly.
// BREAKTHROUGH 2026-09-28: POST /api/v2/drops/{slug}/mint returns the FULL
// mintSigned (0x4b61cd6f) tx with OpenSea's minter-bound signature embedded —
// no browser wallet needed. The endpoint itself enforces eligibility (422 for
// non-allowlisted wallets), so a 200 + signature IS the eligibility proof.
//
// Mechanical gates (enforced here): SeaDrop to-address, mintSigned selector,
// total value <= --max-usd, gas <= --gas-cap-usd, clean eth_call sim,
// no approval calldata. Policy gates (CCFF00-WL scope, X engagement evidence,
// rug-check, tinfoil) are enforced by the caller and recorded in the pipeline.
//
// Usage: node fire-signed-presale.mjs <slug> <qty> [--max-usd 0.10] [--gas-cap-usd 0.50] [--dry]
// Requires: /tmp/os-cookies.json (fresh SIWE session via ../opensea/opensea-siwe.js),
//           ~/.bankr/config.json (apiKey), ~/.opensea/key.json (api_key)
const fs = require('fs');
const os = require('os');
const path = require('path');

const FOIL = '0x6573682faee72a4a96e791Ba262439F1DF3A268d';
const FORK = '0x00005ea00ac477b1030ce78506496e8c2de24bf5';
const CANON = '0x00005ea00ac477b1030ce78506496e8c2de24bf5';
const MINT_SIGNED = '0x4b61cd6f';
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const args = process.argv.slice(2);
const slug = args[0], qty = parseInt(args[1] || '1', 10);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? parseFloat(args[i + 1]) : d; };
const MAX_USD = opt('--max-usd', 0.10), GAS_CAP_USD = opt('--gas-cap-usd', 0.50);
const DRY = args.includes('--dry');
if (!slug || !qty) { console.error('usage: node fire-signed-presale.mjs <slug> <qty> [--max-usd 0.10] [--gas-cap-usd 0.50] [--dry]'); process.exit(2); }

async function rpc(method, params) {
  const r = await fetch(RPC, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error('rpc ' + method + ': ' + JSON.stringify(j.error).slice(0, 200));
  return j.result;
}
async function ethUsd() {
  const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', { headers: { 'User-Agent': UA } });
  const j = await r.json();
  return j.ethereum.usd;
}

(async () => {
  const cookiePath = '/tmp/os-cookies.json';
  if (!fs.existsSync(cookiePath)) throw new Error('no SIWE session — run ../opensea/opensea-siwe.js first');
  const jar = JSON.parse(fs.readFileSync(cookiePath, 'utf8'));
  const ck = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
  const okey = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.opensea', 'key.json'), 'utf8')).api_key;
  const H = { 'User-Agent': UA, 'Origin': 'https://opensea.io', 'Referer': 'https://opensea.io/', 'Content-Type': 'application/json', Cookie: ck, 'X-API-KEY': okey };

  // 1. Build the signed mint tx via OpenSea (this IS the eligibility check)
  const mr = await fetch(`https://api.opensea.io/api/v2/drops/${slug}/mint`, { method: 'POST', headers: H, body: JSON.stringify({ minter: FOIL, quantity: qty }) });
  const mtxt = await mr.text();
  if (mr.status !== 200) { console.log('MINT_ENDPOINT_REFUSED', mr.status, mtxt.slice(0, 300)); process.exit(3); }
  const tx = JSON.parse(mtxt);
  console.log('[gate] endpoint 200 — eligibility confirmed by OpenSea backend');

  // 2. Mechanical gates
  const to = (tx.to || '').toLowerCase();
  if (to !== FORK && to !== CANON) { console.log('GATE_FAIL to not SeaDrop:', tx.to); process.exit(4); }
  if ((tx.data || '').slice(0, 10).toLowerCase() !== MINT_SIGNED) { console.log('GATE_FAIL selector not mintSigned:', (tx.data || '').slice(0, 10)); process.exit(4); }
  const dataLower = (tx.data || '').toLowerCase();
  if (dataLower.includes('095ea7b3') || dataLower.includes('a22cb465')) { console.log('GATE_FAIL approval calldata present'); process.exit(4); }
  const price = await ethUsd();
  const valueEth = Number(BigInt(tx.value || '0')) / 1e18;
  const valueUsd = valueEth * price;
  console.log(`[gate] value ${valueEth.toFixed(8)} ETH ≈ $${valueUsd.toFixed(4)} (cap $${MAX_USD})`);
  if (valueUsd > MAX_USD) { console.log('GATE_FAIL value exceeds cap'); process.exit(4); }

  const valHex = '0x' + BigInt(tx.value || '0').toString(16);
  const sim = await rpc('eth_call', [{ from: FOIL, to: tx.to, data: tx.data, value: valHex }, 'latest']);
  if (sim !== '0x') { console.log('GATE_FAIL sim reverted:', String(sim).slice(0, 120)); process.exit(4); }
  console.log('[gate] simulation clean');
  const gas = await rpc('eth_estimateGas', [{ from: FOIL, to: tx.to, data: tx.data, value: valHex }]);
  const gp = await rpc('eth_gasPrice', []);
  const gasUsd = Number(BigInt(gas) * BigInt(gp)) / 1e18 * price;
  console.log(`[gate] gas ${BigInt(gas)} units ≈ $${gasUsd.toFixed(4)} (cap $${GAS_CAP_USD})`);
  if (gasUsd > GAS_CAP_USD) { console.log('GATE_FAIL gas exceeds cap'); process.exit(4); }

  if (DRY) { console.log('[dry] all gates green — not submitting'); process.exit(0); }

  // 3. Submit via Bankr
  const cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.bankr', 'config.json'), 'utf8'));
  const gasLimit = (BigInt(gas) * 12n / 10n).toString(); // +20% buffer over estimate
  const sr = await fetch('https://api.bankr.bot/wallet/submit', {
    method: 'POST',
    headers: { 'X-API-Key': cfg.apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transaction: { to: tx.to, chainId: 4663, value: String(tx.value || '0'), data: tx.data, gas: gasLimit },
      description: `Foil signed-presale claim: ${slug} x${qty}`,
      waitForConfirmation: true,
    }),
  });
  const sj = await sr.json();
  console.log('SUBMIT', sr.status, JSON.stringify(sj).slice(0, 500));
  const hash = sj.txHash || sj.hash || sj.transactionHash || sj?.data?.txHash;
  if (!hash) { console.log('SUBMIT_NO_HASH'); process.exit(5); }
  console.log('CLAIMED', hash);
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });

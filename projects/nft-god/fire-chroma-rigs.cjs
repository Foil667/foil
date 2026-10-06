// fire-chroma-rigs.cjs — one-off FCFS free claim for Chroma Rigs (chroma-rigs).
// Mint endpoint via curl (node fetch gets bot-walled); mechanical gates replicated
// from fire-signed-presale.cjs; Bankr /wallet/submit on green.
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');

const FOIL = '0x6573682faee72a4a96e791ba262439f1df3a268d';
const FORK = '0x00005ea00ac477b1030ce78506496e8c2de24bf5';
const CANON = '0x00005ea00ac477b1030ce78506496e8c2de24bf5';
const MINT_SIGNED = '0x4b61cd6f';
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const SLUG = 'chroma-rigs', QTY = 1, CHAIN_ID = 4663;
const MAX_USD = 0.10, GAS_CAP_USD = 0.50;

function okey() {
  const raw = fs.readFileSync(os.homedir() + '/.opensea/key.json', 'utf8').trim();
  try { return JSON.parse(raw).api_key; } catch { return raw; }
}
function curlJson(method, url, headers, body) {
  const args = ['-sS', '-m', '25', '-X', method, '-A', UA, url];
  for (const [k, v] of Object.entries(headers)) args.push('-H', `${k}: ${v}`);
  if (body) args.push('-d', JSON.stringify(body));
  const out = execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 1 << 20 });
  return out;
}
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
  // 0. Wait for FCFS open: 16:50:00 UTC 2026-09-30
  const openMs = Date.UTC(2026, 8, 30, 16, 50, 8);
  const wait = openMs - Date.now();
  if (wait > 0) { console.log(`waiting ${Math.round(wait / 1000)}s for FCFS open`); await new Promise(r => setTimeout(r, wait)); }

  // 1. Mint endpoint (eligibility enforced server-side)
  const jar = JSON.parse(fs.readFileSync('/tmp/os-cookies.json', 'utf8'));
  const ck = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
  const body = curlJson('POST', `https://api.opensea.io/api/v2/drops/${SLUG}/mint`,
    { Origin: 'https://opensea.io', Referer: 'https://opensea.io/', 'Content-Type': 'application/json', Cookie: ck, 'X-API-KEY': okey() },
    { minter: FOIL, quantity: QTY });
  let tx;
  try { tx = JSON.parse(body); }
  catch { console.log('MINT_ENDPOINT_NON_JSON', body.slice(0, 300)); process.exit(3); }
  if (tx.error || !tx.data) { console.log('MINT_ENDPOINT_REFUSED', body.slice(0, 300)); process.exit(3); }
  console.log('[gate] endpoint 200 — eligibility confirmed by OpenSea backend');

  // 2. Mechanical gates
  const to = (tx.to || '').toLowerCase();
  if (to !== FORK && to !== CANON) { console.log('GATE_FAIL to not SeaDrop:', tx.to); process.exit(4); }
  if ((tx.data || '').slice(0, 10).toLowerCase() !== MINT_SIGNED) { console.log('GATE_FAIL selector not mintSigned:', (tx.data || '').slice(0, 10)); process.exit(4); }
  const dataLower = (tx.data || '').toLowerCase();
  if (dataLower.includes('095ea7b3') || dataLower.includes('a22cb465')) { console.log('GATE_FAIL approval calldata present'); process.exit(4); }
  if (!dataLower.includes(FOIL.slice(2).toLowerCase())) { console.log('GATE_FAIL minter not Foil wallet in calldata'); process.exit(4); }
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
  console.log(`[gate] gas ${BigInt(gas)} units @ ${BigInt(gp)} wei ≈ $${gasUsd.toFixed(4)} (cap $${GAS_CAP_USD})`);
  if (gasUsd > GAS_CAP_USD) { console.log('GATE_FAIL gas exceeds cap'); process.exit(4); }

  // 3. Submit via Bankr
  const cfg = JSON.parse(fs.readFileSync(os.homedir() + '/.bankr/config.json', 'utf8'));
  const gasLimit = (BigInt(gas) * 12n / 10n).toString();
  const sr = await fetch('https://api.bankr.bot/wallet/submit', {
    method: 'POST',
    headers: { 'X-API-Key': cfg.apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transaction: { to: tx.to, chainId: CHAIN_ID, value: String(tx.value || '0'), data: tx.data, gas: gasLimit },
      description: `Foil signed-presale claim: ${SLUG} x${QTY}`,
      waitForConfirmation: true,
    }),
  });
  const sj = await sr.json().catch(() => ({}));
  console.log('SUBMIT', sr.status, JSON.stringify(sj).slice(0, 600));
  const hash = sj.txHash || sj.hash || sj.transactionHash || sj?.data?.txHash;
  if (!hash) { console.log('SUBMIT_NO_HASH'); process.exit(5); }
  console.log('CLAIMED', hash);
  fs.writeFileSync('/tmp/chroma-rigs-claim.json', JSON.stringify({ hash, to: tx.to, gas: gasLimit, ts: Date.now() }));
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });

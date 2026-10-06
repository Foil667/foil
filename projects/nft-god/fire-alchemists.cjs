// fire-alchemists.cjs — gates + Bankr submit for the signed alchemists-guild tx
// at /tmp/alchemists-tx.json. All policy gates done; mechanical gates here.
const fs = require('fs'), os = require('os');
const FOIL = '0x6573682faee72a4a96e791ba262439f1df3a268d';
const FORK = '0x00005ea00ac477b1030ce78506496e8c2de24bf5';
const CANON = '0x00005ea00ac477b1030ce78506496e8c2de24bf5';
const SEL = '0x4b61cd6f';
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const SLUG = 'alchemists-guild', QTY = 1, CHAIN = 4663;

const tx = JSON.parse(fs.readFileSync('/tmp/alchemists-tx.json', 'utf8'));
const ok = (c, m) => { if (!c) { console.log('GATE_FAIL', m); process.exit(4); } console.log('[gate]', m); };
ok((tx.to || '').toLowerCase() === FORK || (tx.to || '').toLowerCase() === CANON, 'to is SeaDrop');
ok((tx.data || '').slice(0, 10).toLowerCase() === SEL, 'selector mintSigned');
const dl = (tx.data || '').toLowerCase();
ok(!dl.includes('095ea7b3') && !dl.includes('a22cb465'), 'no approvals');
// NOTE: mintSigned is minter-bound via OpenSea's embedded signature, not a
// plaintext minter arg (arg2 minterIfNotPayer=0 means tx sender is the minter).
// The endpoint issued the sig for Foil's wallet, and eth_call from Foil
// validates the binding onchain — that is the authoritative minter check.
(async () => {
  const price = (await (await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', { headers: { 'User-Agent': UA } })).json()).ethereum.usd;
  const valUsd = Number(BigInt(tx.value || '0')) / 1e18 * price;
  ok(valUsd <= 0.10, `value $${valUsd.toFixed(4)} <= 0.10`);
  const rpc = async (m, p) => { const r = await fetch(RPC, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: m, params: p }) }); const j = await r.json(); if (j.error) throw new Error(m + ' ' + JSON.stringify(j.error).slice(0, 160)); return j.result; };
  const valHex = '0x' + BigInt(tx.value || '0').toString(16);
  const sim = await rpc('eth_call', [{ from: FOIL, to: tx.to, data: tx.data, value: valHex }, 'latest']);
  ok(sim === '0x', 'simulation clean');
  const gas = await rpc('eth_estimateGas', [{ from: FOIL, to: tx.to, data: tx.data, value: valHex }]);
  const gp = await rpc('eth_gasPrice', []);
  const gasUsd = Number(BigInt(gas) * BigInt(gp)) / 1e18 * price;
  ok(gasUsd <= 0.50, `gas $${gasUsd.toFixed(4)} <= 0.50 (${gas} units)`);
  const cfg = JSON.parse(fs.readFileSync(os.homedir() + '/.bankr/config.json', 'utf8'));
  const gasLimit = (BigInt(gas) * 12n / 10n).toString();
  const sr = await fetch('https://api.bankr.bot/wallet/submit', { method: 'POST', headers: { 'X-API-Key': cfg.apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ transaction: { to: tx.to, chainId: CHAIN, value: String(tx.value || '0'), data: tx.data, gas: gasLimit }, description: `Foil signed-presale claim: ${SLUG} x${QTY}`, waitForConfirmation: true }) });
  const sj = await sr.json().catch(() => ({}));
  console.log('SUBMIT', sr.status, JSON.stringify(sj).slice(0, 500));
  const hash = sj.txHash || sj.hash || sj.transactionHash || sj?.data?.txHash;
  if (!hash) { console.log('SUBMIT_NO_HASH'); process.exit(5); }
  console.log('CLAIMED', hash);
  fs.writeFileSync('/tmp/alchemists-claim.json', JSON.stringify({ hash, to: tx.to, gas: gasLimit, ts: Date.now() }));
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });

#!/bin/bash
# probe-hoodpokerclub.sh — at 17:00:08 UTC probe the Free Mint FCFS signed_presale.
# If OpenSea returns a signed tx (200), fire through Bankr after mechanical gates.
# Gates: to=SeaDrop fork/canon, selector 0x4b61cd6f, no approvals, minter=Foil,
#        value <= $0.10, sim clean, gas <= $0.50. Foil's wallet signs via Bankr.
set -u
FOIL="0x6573682faee72a4a96e791ba262439f1df3a268d"
SLUG="hoodpokerclub"; QTY=1; CHAIN_ID=4663
FORK="0x00005ea00ac477b1030ce78506496e8c2de24bf5"
CANON="0x00005ea00ac477b1030ce78506496e8c2de24bf5"
SEL="0x4b61cd6f"
RPC="https://rpc.mainnet.chain.robinhood.com"
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
OPEN_UTC=$(date -u -d "2026-09-30 17:00:08 UTC" +%s)
NOW_UTC=$(date -u +%s)
WAIT=$((OPEN_UTC - NOW_UTC))
if [ "$WAIT" -gt 0 ]; then echo "[poker] waiting ${WAIT}s for 17:00:08 UTC"; sleep "$WAIT"; fi

CK=$(python3 -c "import json; d=json.load(open('/tmp/os-cookies.json')); print('; '.join(f'{k}={v}' for k,v in d.items()))")
OKEY=$(cat /home/hatch/.opensea/key.json)
RESP=$(curl -s -m 30 -X POST -A "$UA" \
  -H "Origin: https://opensea.io" -H "Referer: https://opensea.io/" \
  -H "Content-Type: application/json" -H "Cookie: $CK" -H "X-API-KEY: $OKEY" \
  -d "{\"minter\":\"$FOIL\",\"quantity\":$QTY}" \
  "https://api.opensea.io/api/v2/drops/$SLUG/mint")
echo "$RESP" | head -c 500; echo
if ! echo "$RESP" | grep -q '"to"'; then echo "[poker] NOT ELIGIBLE / refused"; exit 0; fi

echo "[poker] endpoint 200 — running mechanical gates"
node - "$RESP" "$FOIL" "$FORK" "$CANON" "$SEL" "$RPC" "$UA" "$QTY" "$SLUG" "$CHAIN_ID" <<'EOF'
const fs = require('fs'), os = require('os');
const [body, FOIL, FORK, CANON, SEL, RPC, UA, QTY, SLUG, CHAIN] = process.argv.slice(2);
const tx = JSON.parse(body);
const to = (tx.to || '').toLowerCase();
const ok = (c, m) => { if (!c) { console.log('GATE_FAIL', m); process.exit(4); } console.log('[gate]', m); };
ok(to === FORK || to === CANON, 'to is SeaDrop');
ok((tx.data || '').slice(0, 10).toLowerCase() === SEL, 'selector mintSigned');
const dl = (tx.data || '').toLowerCase();
ok(!dl.includes('095ea7b3') && !dl.includes('a22cb465'), 'no approvals');
ok(dl.includes(FOIL.slice(2).toLowerCase()), 'minter is Foil');
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
  const sr = await fetch('https://api.bankr.bot/wallet/submit', { method: 'POST', headers: { 'X-API-Key': cfg.apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ transaction: { to: tx.to, chainId: Number(CHAIN), value: String(tx.value || '0'), data: tx.data, gas: gasLimit }, description: `Foil signed-presale claim: ${SLUG} x${QTY}`, waitForConfirmation: true }) });
  const sj = await sr.json().catch(() => ({}));
  console.log('SUBMIT', sr.status, JSON.stringify(sj).slice(0, 500));
  const hash = sj.txHash || sj.hash || sj.transactionHash || sj?.data?.txHash;
  if (!hash) { console.log('SUBMIT_NO_HASH'); process.exit(5); }
  console.log('CLAIMED', hash);
  fs.writeFileSync('/tmp/hoodpokerclub-claim.json', JSON.stringify({ hash, to: tx.to, gas: gasLimit, ts: Date.now() }));
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
EOF

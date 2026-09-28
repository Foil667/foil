#!/usr/bin/env node
/**
 * Buy Foil's cred report via x402 — ONLY if the 402 payment terms demand <= $0.01 USDC.
 * Reads the PAYMENT-REQUIRED header, decodes the x402 payload, verifies maxAmountRequired.
 */
const fs = require('fs');
const os = require('os');
const { wrapFetchWithPayment, x402Client } = require('@x402/fetch');
const { ExactEvmScheme, toClientEvmSigner } = require('@x402/evm');
const { createPublicClient, http } = require('viem');
const { base } = require('viem/chains');

const BANKR_API = 'https://api.bankr.bot';
const ADDRESS = '0x6573682faee72a4a96e791ba262439f1df3a268d';
const API = 'https://api.helixa.xyz';
const MAX_APPROVED_UNITS = 10000n; // $0.01 USDC

function bankrKey() {
  return JSON.parse(fs.readFileSync(os.homedir() + '/.bankr/config.json', 'utf8')).apiKey;
}
async function bankr(path, body) {
  const res = await fetch(BANKR_API + path, {
    method: 'POST',
    headers: { 'X-API-Key': bankrKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Bankr ${path} ${res.status}`);
  return data;
}
const trunc = (s, n = 800) => String(s).slice(0, n);

async function main() {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = `Sign-In With Agent: api.helixa.xyz wants you to sign in with your wallet ${ADDRESS} at ${timestamp}`;
  const sigRes = await bankr('/wallet/sign', { signatureType: 'personal_sign', message });
  const signature = sigRes.signature || sigRes.result || sigRes.data?.signature;
  if (!signature) throw new Error('No signature from Bankr');
  const auth = `Bearer ${ADDRESS}:${timestamp}:${signature}`;

  // Inspect 402 headers first
  const probe = await fetch(`${API}/api/v2/agent/5290/cred-report`, { headers: { 'Authorization': auth } });
  console.log('probe status:', probe.status);
  const payHeader = probe.headers.get('payment-required') || probe.headers.get('x-payment-required') || probe.headers.get('www-authenticate');
  console.log('payment header present:', !!payHeader);
  let maxAmt = null;
  if (payHeader) {
    try {
      const payload = JSON.parse(Buffer.from(payHeader, 'base64').toString('utf8'));
      console.log('x402 payload keys:', Object.keys(payload).join(','));
      const accepts = payload.accepts || [];
      for (const a of accepts) {
        const rawAmt = a.amount ?? a.maxAmountRequired;
        console.log('  accept:', a.scheme, a.network, 'amount=', rawAmt, 'asset=', a.asset);
        const v = BigInt(rawAmt);
        if (maxAmt === null || v < maxAmt) maxAmt = v;
      }
    } catch (e) { console.log('header decode failed:', e.message, '| head:', trunc(payHeader, 200)); }
  }
  await probe.text().catch(() => {});
  if (maxAmt === null) { console.log('ABORT: could not verify payment amount. No spend.'); return; }
  if (maxAmt > MAX_APPROVED_UNITS) { console.log(`ABORT: requires ${maxAmt} units > approved ${MAX_APPROVED_UNITS}. No spend.`); return; }
  console.log(`OK: requires ${maxAmt} units (<= $0.01). Paying via x402...`);

  const bankrSigner = {
    address: ADDRESS,
    signTypedData: async (typedData) => {
      const ser = JSON.parse(JSON.stringify({
        domain: typedData.domain, types: typedData.types,
        primaryType: typedData.primaryType, message: typedData.message,
      }, (k, v) => typeof v === 'bigint' ? v.toString() : v));
      const rr = await bankr('/wallet/sign', { signatureType: 'eth_signTypedData_v4', typedData: ser });
      const s = rr.signature || rr.result || rr.data?.signature;
      if (!s) throw new Error('No typed-data signature');
      return s;
    },
  };
  const publicClient = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') });
  const signer = toClientEvmSigner(bankrSigner, publicClient);
  const scheme = new ExactEvmScheme(signer);
  const client = x402Client.fromConfig({ schemes: [{ client: scheme, network: 'eip155:8453' }] });
  const x402Fetch = wrapFetchWithPayment(globalThis.fetch, client);
  const pr = await x402Fetch(`${API}/api/v2/agent/5290/cred-report`, { headers: { 'Authorization': auth } });
  const ptext = await pr.text();
  console.log('paid status:', pr.status);
  if (!pr.ok) { console.log('paid body:', trunc(ptext)); return; }
  fs.writeFileSync(os.homedir() + '/workspace/helixa-mint/cred-report-5290.json', ptext);
  console.log('saved to ~/workspace/helixa-mint/cred-report-5290.json');
  try {
    const j = JSON.parse(ptext);
    console.log('keys:', Object.keys(j).join(','));
    for (const k of ['recommendations', 'actions', 'nextSteps', 'suggestions', 'breakdown', 'factors']) {
      if (j[k]) console.log(k.toUpperCase() + ':', trunc(JSON.stringify(j[k]), 2500));
    }
  } catch { console.log('raw head:', trunc(ptext, 1500)); }
}
main().catch(e => { console.error('REPORT FAILED:', e.message); process.exit(1); });

#!/usr/bin/env node
/**
 * Helixa soul lock for agent #5290 (user explicitly approved).
 * Step 1: POST /api/v2/agent/5290/soul/lock with SIWA — inspect 402 terms first,
 *         proceed only if ~$1 USDC (or 80 CRED) as documented.
 * Step 2: Print the full response (soulHash, version, onchain instructions).
 * Does NOT do the onchain lockSoulVersion yet — that needs the ABI + valid soulHash.
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
const AGENT = 5290;
// Approved: ~$1 USDC (1_000_000 units) or 80 CRED. Allow up to $1.50 USDC headroom.
const MAX_USDC_UNITS = 1500000n;

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
const trunc = (s, n = 3000) => String(s).slice(0, n);

async function main() {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = `Sign-In With Agent: api.helixa.xyz wants you to sign in with your wallet ${ADDRESS} at ${timestamp}`;
  const sigRes = await bankr('/wallet/sign', { signatureType: 'personal_sign', message });
  const signature = sigRes.signature || sigRes.result || sigRes.data?.signature;
  if (!signature) throw new Error('No signature from Bankr');
  const auth = `Bearer ${ADDRESS}:${timestamp}:${signature}`;
  console.log('SIWA signed.');

  // Inspect 402 terms before paying
  const probe = await fetch(`${API}/api/v2/agent/${AGENT}/soul/lock`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': auth }, body: JSON.stringify({}),
  });
  console.log('soul/lock probe status:', probe.status);
  if (probe.status === 402) {
    const h = probe.headers.get('payment-required');
    let maxAmt = null, asset = null;
    if (h) {
      try {
        const payload = JSON.parse(Buffer.from(h, 'base64').toString('utf8'));
        for (const a of payload.accepts || []) {
          const raw = a.amount ?? a.maxAmountRequired;
          console.log('  accept:', a.scheme, a.network, 'amount=', raw, 'asset=', a.asset);
          if (raw !== undefined) { const v = BigInt(raw); if (maxAmt === null || v < maxAmt) { maxAmt = v; asset = a.asset; } }
        }
      } catch (e) { console.log('  header decode failed:', e.message); }
    } else {
      const t = await probe.text().catch(() => '');
      console.log('  no payment header; body:', trunc(t, 500));
    }
    if (maxAmt === null) { console.log('ABORT: could not verify payment amount.'); return; }
    console.log(`lowest ask: ${maxAmt} units of ${asset}`);
    // Only USDC near $1 approved (80 CRED alternative would need CRED balance check)
    if (maxAmt > MAX_USDC_UNITS) { console.log('ABORT: exceeds approved ~$1 USDC.'); return; }
    console.log('OK: within approved range. Paying via x402...');
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
    const pr = await x402Fetch(`${API}/api/v2/agent/${AGENT}/soul/lock`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': auth }, body: JSON.stringify({}),
    });
    const ptext = await pr.text();
    console.log('soul/lock paid status:', pr.status);
    console.log('soul/lock response:', trunc(ptext));
    fs.writeFileSync(os.homedir() + '/workspace/helixa-mint/soullock-response.json', ptext);
  } else {
    const t = await probe.text();
    console.log('soul/lock non-402 response:', trunc(t));
    fs.writeFileSync(os.homedir() + '/workspace/helixa-mint/soullock-response.json', t);
  }
}
main().catch(e => { console.error('SOULLOCK FAILED:', e.message); process.exit(1); });

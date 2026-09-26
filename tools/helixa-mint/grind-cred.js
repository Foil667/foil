#!/usr/bin/env node
/**
 * Grind Foil's Helixa cred score (agent #5290).
 * - X re-verification (free, SIWA)
 * - Probe GitHub/Farcaster/Coinbase verification requirements (no accounts created)
 * - Buy cred report via x402 ONLY if the 402 demands <= $0.01 USDC (approved spend)
 * - NEVER runs /update ($1 USDC, not approved)
 * Signing via Bankr /wallet/sign. Secrets from files/env only, never logged.
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
const MAX_APPROVED_USDC_UNITS = 10000; // $0.01 USDC (6 decimals)

function bankrKey() {
  const cfg = JSON.parse(fs.readFileSync(os.homedir() + '/.bankr/config.json', 'utf8'));
  return cfg.apiKey;
}
async function bankr(path, body) {
  const res = await fetch(BANKR_API + path, {
    method: 'POST',
    headers: { 'X-API-Key': bankrKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Bankr ${path} ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}
const trunc = (s, n = 600) => String(s).slice(0, n);

async function main() {
  // 1. SIWA auth via Bankr personal_sign
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = `Sign-In With Agent: api.helixa.xyz wants you to sign in with your wallet ${ADDRESS} at ${timestamp}`;
  const sigRes = await bankr('/wallet/sign', { signatureType: 'personal_sign', message });
  const signature = sigRes.signature || sigRes.result || sigRes.data?.signature;
  if (!signature) throw new Error('No signature from Bankr');
  const auth = `Bearer ${ADDRESS}:${timestamp}:${signature}`;
  const H = { 'Content-Type': 'application/json', 'Authorization': auth };
  console.log('SIWA signed.');

  // 2. Re-verify X (free per docs)
  let r = await fetch(`${API}/api/v2/agent/${AGENT}/verify`, {
    method: 'POST', headers: H, body: JSON.stringify({ handle: '@Foil667' }),
  });
  console.log('VERIFY-X status:', r.status);
  console.log('VERIFY-X body:', trunc(await r.text()));

  // 3. Probe GitHub / Farcaster / Coinbase verification requirements (empty body -> expect 400 describing needs)
  for (const p of ['verify/github', 'verify/farcaster', 'coinbase-verify']) {
    r = await fetch(`${API}/api/v2/agent/${AGENT}/${p}`, { method: 'POST', headers: H, body: JSON.stringify({}) });
    console.log(`PROBE ${p} status:`, r.status);
    console.log(`PROBE ${p} body:`, trunc(await r.text()));
  }

  // 4. Cred report: inspect 402 terms BEFORE paying
  r = await fetch(`${API}/api/v2/agent/${AGENT}/cred-report`, { headers: { 'Authorization': auth } });
  console.log('CRED-REPORT plain status:', r.status);
  if (r.status === 402) {
    const terms = await r.json().catch(() => null);
    console.log('CRED-REPORT 402 terms:', trunc(JSON.stringify(terms), 2000));
    const accepts = terms?.accepts || terms?.paymentRequirements || [];
    const list = Array.isArray(accepts) ? accepts : [accepts];
    let ok = false;
    for (const a of list) {
      const amt = a.maxAmountRequired ?? a.maxAmount ?? a.amount;
      const asset = (a.asset || a.token || '').toLowerCase();
      console.log('  option: amount=', amt, 'asset=', a.asset, 'network=', a.network || a.chainId);
      if (amt !== undefined && Number(amt) <= MAX_APPROVED_USDC_UNITS) ok = true;
    }
    if (!ok) {
      console.log('CRED-REPORT: price exceeds approved $0.01 — NOT purchasing. Aborting report step.');
    } else {
      console.log('CRED-REPORT: price within approved $0.01 — proceeding with x402 payment...');
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
      const client = x402Client.fromConfig({ schemes: [{ client: scheme, network: 'eip155:8453' }] });
      const x402Fetch = wrapFetchWithPayment(globalThis.fetch, client);
      const pr = await x402Fetch(`${API}/api/v2/agent/${AGENT}/cred-report`, { headers: { 'Authorization': auth } });
      const ptext = await pr.text();
      console.log('CRED-REPORT paid status:', pr.status);
      fs.writeFileSync(os.homedir() + '/workspace/helixa-mint/cred-report-5290.json', ptext);
      console.log('CRED-REPORT saved to ~/workspace/helixa-mint/cred-report-5290.json');
      try {
        const j = JSON.parse(ptext);
        console.log('CRED-REPORT keys:', Object.keys(j).join(','));
        const recs = j.recommendations || j.actions || j.nextSteps || j.suggestions;
        if (recs) console.log('CRED-REPORT recommendations:', trunc(JSON.stringify(recs), 3000));
      } catch { console.log('CRED-REPORT raw head:', trunc(ptext, 1500)); }
    }
  } else {
    console.log('CRED-REPORT unexpected non-402:', trunc(await r.text()));
  }

  // 5. Re-check score
  r = await fetch(`${API}/api/v2/agent/${AGENT}/cred`);
  const cred = await r.json();
  console.log('SCORE NOW:', cred.credScore, cred.tier, '| evidenceCoverage:', cred.evidenceCoverage?.score);
  console.log('MISSING:', JSON.stringify(cred.evidenceCoverage?.missing));
}

main().catch(e => { console.error('GRIND FAILED:', e.message); process.exit(1); });

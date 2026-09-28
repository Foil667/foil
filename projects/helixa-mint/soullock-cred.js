/**
 * Helixa: fetch $0.01 full cred report + lock soul (x402 via Bankr).
 * Approved spends: $0.01 USDC (cred report), ~$1 USDC + gas (soul lock).
 */
const fs = require('fs');
const os = require('os');
const { wrapFetchWithPayment, x402Client } = require('@x402/fetch');
const { ExactEvmScheme, toClientEvmSigner } = require('@x402/evm');
const { createPublicClient, http } = require('viem');
const { base } = require('viem/chains');

const BANKR_API = 'https://api.bankr.bot';
const ADDRESS = '0x6573682faee72a4a96e791ba262439f1df3a268d';
const AGENT_ID = 5290;

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
  if (!res.ok) throw new Error(`Bankr ${path} ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

async function main() {
  // 1. SIWA auth
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = `Sign-In With Agent: api.helixa.xyz wants you to sign in with your wallet ${ADDRESS} at ${timestamp}`;
  const sigRes = await bankr('/wallet/sign', { signatureType: 'personal_sign', message });
  const signature = sigRes.signature || sigRes.result || sigRes.data?.signature;
  if (!signature) throw new Error('No SIWA signature');
  const authHeader = `Bearer ${ADDRESS}:${timestamp}:${signature}`;
  console.log('SIWA signed.');

  // 2. x402 signer via Bankr
  const bankrSigner = {
    address: ADDRESS,
    signTypedData: async (typedData) => {
      const ser = JSON.parse(JSON.stringify({
        domain: typedData.domain, types: typedData.types,
        primaryType: typedData.primaryType, message: typedData.message,
      }, (k, v) => typeof v === 'bigint' ? v.toString() : v));
      const r = await bankr('/wallet/sign', { signatureType: 'eth_signTypedData_v4', typedData: ser });
      const s = r.signature || r.result || r.data?.signature;
      if (!s) throw new Error('No typed-data signature');
      return s;
    },
  };
  const publicClient = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') });
  const signer = toClientEvmSigner(bankrSigner, publicClient);
  const scheme = new ExactEvmScheme(signer);
  const client = x402Client.fromConfig({ schemes: [{ client: scheme, network: 'eip155:8453' }] });
  const x402Fetch = wrapFetchWithPayment(globalThis.fetch, client);

  // 3. Cred report ($0.01)
  console.log('Fetching cred report ($0.01 USDC via x402)...');
  let res = await x402Fetch(`https://api.helixa.xyz/api/v2/agent/${AGENT_ID}/cred-report`, {
    headers: { 'Authorization': authHeader },
  });
  let text = await res.text();
  console.log('cred-report HTTP', res.status);
  if (res.ok) {
    fs.writeFileSync(os.homedir() + '/workspace/helixa-mint/cred-report-5290.json', text);
    const j = JSON.parse(text);
    console.log('score=' + (j.data?.credScore ?? j.credScore) + ' tier=' + (j.data?.tier ?? j.tier));
  } else { console.log(text.slice(0, 500)); }

  // 4. Soul lock (x402 if 402)
  console.log('Locking soul...');
  res = await x402Fetch(`https://api.helixa.xyz/api/v2/agent/${AGENT_ID}/soul/lock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
    body: JSON.stringify({}),
  });
  text = await res.text();
  console.log('soul/lock HTTP', res.status);
  console.log(text.slice(0, 800));

  // 5. Re-check free cred score
  res = await fetch(`https://api.helixa.xyz/api/v2/agent/${AGENT_ID}/cred`);
  const cred = await res.json().catch(() => ({}));
  console.log('current credScore=' + (cred.data?.credScore ?? cred.credScore) + ' tier=' + (cred.data?.tier ?? cred.tier));
}
main().catch(e => { console.error('FAILED:', e.message); process.exit(1); });

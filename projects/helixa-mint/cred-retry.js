const fs = require('fs');
const os = require('os');
const { wrapFetchWithPayment, x402Client } = require('@x402/fetch');
const { ExactEvmScheme, toClientEvmSigner } = require('@x402/evm');
const { createPublicClient, http } = require('viem');
const { base } = require('viem/chains');
const BANKR_API = 'https://api.bankr.bot';
const ADDRESS = '0x6573682faee72a4a96e791ba262439f1df3a268d';
function bankrKey() { return JSON.parse(fs.readFileSync(os.homedir() + '/.bankr/config.json', 'utf8')).apiKey; }
async function bankr(path, body) {
  const res = await fetch(BANKR_API + path, { method: 'POST', headers: { 'X-API-Key': bankrKey(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Bankr ${path} ${res.status}`);
  return data;
}
async function main() {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = `Sign-In With Agent: api.helixa.xyz wants you to sign in with your wallet ${ADDRESS} at ${timestamp}`;
  const sigRes = await bankr('/wallet/sign', { signatureType: 'personal_sign', message });
  const signature = sigRes.signature || sigRes.result || sigRes.data?.signature;
  const authHeader = `Bearer ${ADDRESS}:${timestamp}:${signature}`;
  const bankrSigner = {
    address: ADDRESS,
    signTypedData: async (td) => {
      const ser = JSON.parse(JSON.stringify({ domain: td.domain, types: td.types, primaryType: td.primaryType, message: td.message }, (k, v) => typeof v === 'bigint' ? v.toString() : v));
      const r = await bankr('/wallet/sign', { signatureType: 'eth_signTypedData_v4', typedData: ser });
      return r.signature || r.result || r.data?.signature;
    },
  };
  const publicClient = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') });
  const client = x402Client.fromConfig({ schemes: [{ client: new ExactEvmScheme(toClientEvmSigner(bankrSigner, publicClient)), network: 'eip155:8453' }] });
  const x402Fetch = wrapFetchWithPayment(globalThis.fetch, client);
  const res = await x402Fetch('https://api.helixa.xyz/api/v2/agent/5290/cred-report', { headers: { 'Authorization': authHeader } });
  const text = await res.text();
  console.log('HTTP', res.status);
  if (res.ok) {
    fs.writeFileSync(os.homedir() + '/workspace/helixa-mint/cred-report-5290.json', text);
    const j = JSON.parse(text);
    const d = j.data || j;
    console.log('score=' + d.credScore + ' tier=' + d.tier);
    console.log('saved cred-report-5290.json (' + text.length + ' bytes)');
  } else console.log(text.slice(0, 400));
}
main().catch(e => { console.error('FAILED:', e.message); process.exit(1); });

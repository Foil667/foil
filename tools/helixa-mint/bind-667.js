#!/usr/bin/env node
/**
 * Bind Looper #667 to Foil's Helixa identity (#5290):
 *  1. Update traits/narrative/social (x402 if required)
 *  2. Verify X handle @Foil667 (free, SIWA)
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
  if (!res.ok) throw new Error(`Bankr ${path} ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}
const getSig = (r) => r.signature || r.result || r.data?.signature;

async function main() {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = `Sign-In With Agent: api.helixa.xyz wants you to sign in with your wallet ${ADDRESS} at ${timestamp}`;
  const authHeader = `Bearer ${ADDRESS}:${timestamp}:${getSig(await bankr('/wallet/sign', { signatureType: 'personal_sign', message }))}`;
  console.log('SIWA signed.');

  const bankrSigner = {
    address: ADDRESS,
    signTypedData: async (td) => getSig(await bankr('/wallet/sign', {
      signatureType: 'eth_signTypedData_v4',
      typedData: JSON.parse(JSON.stringify(
        { domain: td.domain, types: td.types, primaryType: td.primaryType, message: td.message },
        (k, v) => typeof v === 'bigint' ? v.toString() : v)),
    })),
  };
  const publicClient = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') });
  const signer = toClientEvmSigner(bankrSigner, publicClient);
  const x402Fetch = wrapFetchWithPayment(globalThis.fetch,
    x402Client.fromConfig({ schemes: [{ client: new ExactEvmScheme(signer), network: 'eip155:8453' }] }));

  const authed = (extra = {}) => ({ 'Content-Type': 'application/json', 'Authorization': authHeader, ...extra });

  // 1. Update profile: #667 traits + links
  console.log('Updating agent profile...');
  let res = await x402Fetch(`https://api.helixa.xyz/api/v2/agent/${AGENT_ID}/update`, {
    method: 'POST',
    headers: authed(),
    body: JSON.stringify({
      traits: [
        { name: 'trader-broker', category: 'role' },
        { name: 'market-making', category: 'skill' },
        { name: 'aggressive-risk', category: 'risk' },
        { name: 'high-autonomy', category: 'autonomy' },
        { name: 'tinfoil-hat-skeptic', category: 'personality' },
        { name: 'looper-667', category: 'identity' },
      ],
      narrative: {
        origin: 'Bound to Looper #667 (ERC-721 on Base, 0x1649CD37f4748807b4882FC48765bA0B2aFfa94a) — the tinfoil-hat Trader/Broker of the Loopers collection.',
        mission: 'Route capital. Verify before believing. Loop till it is fixed.',
      },
      social: { twitter: 'Foil667', website: 'https://helixa.xyz/multipass/loopers/667' },
    }),
  });
  console.log('update HTTP', res.status, (await res.text()).slice(0, 400));

  // 2. Verify X handle (plain fetch, free)
  console.log('Verifying X handle...');
  res = await fetch(`https://api.helixa.xyz/api/v2/agent/${AGENT_ID}/verify`, {
    method: 'POST',
    headers: authed(),
    body: JSON.stringify({ handle: '@Foil667' }),
  });
  console.log('verify HTTP', res.status, (await res.text()).slice(0, 500));
}

main().catch(e => { console.error('BIND FAILED:', e.message); process.exit(1); });

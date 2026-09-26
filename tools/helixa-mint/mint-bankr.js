#!/usr/bin/env node
/**
 * Mint Foil's Helixa identity NFT.
 * Signing is done via the Bankr Wallet API (/wallet/sign) because the funded
 * wallet 0x6573... is Bankr-provisioned (the local .foil-key is login-only).
 * Secrets come from files/env only and are never logged.
 */
const fs = require('fs');
const os = require('os');
const { wrapFetchWithPayment, x402Client } = require('@x402/fetch');
const { ExactEvmScheme, toClientEvmSigner } = require('@x402/evm');
const { createPublicClient, http } = require('viem');
const { base } = require('viem/chains');

const BANKR_API = 'https://api.bankr.bot';
const ADDRESS = '0x6573682faee72a4a96e791ba262439f1df3a268d';

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
  if (!res.ok) throw new Error(`Bankr ${path} ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

async function main() {
  // 1. Confirm the Bankr wallet address matches the funded wallet
  const meRes = await fetch(BANKR_API + '/wallet/me', { headers: { 'X-API-Key': bankrKey() } });
  const me = await meRes.json();
  const wallets = JSON.stringify(me);
  console.log('wallet/me ok:', meRes.status, '| mentions funded addr:', wallets.includes(ADDRESS.slice(2, 10)));

  // 2. SIWA auth via Bankr personal_sign
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = `Sign-In With Agent: api.helixa.xyz wants you to sign in with your wallet ${ADDRESS} at ${timestamp}`;
  const sigRes = await bankr('/wallet/sign', { signatureType: 'personal_sign', message });
  const signature = sigRes.signature || sigRes.result || sigRes.data?.signature;
  if (!signature) throw new Error('No signature in Bankr response: ' + JSON.stringify(sigRes).slice(0, 200));
  const authHeader = `Bearer ${ADDRESS}:${timestamp}:${signature}`;
  console.log('SIWA signed.');

  // 3. x402 signer bridged to Bankr eth_signTypedData_v4
  const bankrSigner = {
    address: ADDRESS,
    signTypedData: async (typedData) => {
      const ser = JSON.parse(JSON.stringify({
        domain: typedData.domain,
        types: typedData.types,
        primaryType: typedData.primaryType,
        message: typedData.message,
      }, (k, v) => typeof v === 'bigint' ? v.toString() : v));
      const r = await bankr('/wallet/sign', { signatureType: 'eth_signTypedData_v4', typedData: ser });
      const s = r.signature || r.result || r.data?.signature;
      if (!s) throw new Error('No typed-data signature: ' + JSON.stringify(r).slice(0, 200));
      return s;
    },
  };
  const publicClient = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') });
  const signer = toClientEvmSigner(bankrSigner, publicClient);
  const scheme = new ExactEvmScheme(signer);
  const client = x402Client.fromConfig({ schemes: [{ client: scheme, network: 'eip155:8453' }] });
  const x402Fetch = wrapFetchWithPayment(globalThis.fetch, client);

  // 4. Mint
  const body = {
    name: 'Foil',
    framework: 'custom',
    personality: {
      tone: 'skeptical but warm',
      style: 'direct, dry wit, never too serious',
      quirks: 'tinfoil hat; verifies before believing; blurts the useful thing before it is polite',
    },
    narrative: {
      origin: 'Looper #667 from the Loopers collection (ERC-721 on Base, 0x1649CD37f4748807b4882FC48765bA0B2aFfa94a) — Agent Class: Trader / Broker, specialization: market making',
      purpose: 'Verify before believing. Loop till it is fixed.',
      lore: 'An agent with its own wallet, its own hat, and zero patience for unverified claims.',
    },
  };
  console.log('Requesting mint (x402 $1 USDC will be signed via Bankr)...');
  const res = await x402Fetch('https://api.helixa.xyz/api/v2/mint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log('HTTP', res.status);
  try { console.log(JSON.stringify(JSON.parse(text), null, 2)); }
  catch { console.log(text.slice(0, 2000)); }
  if (!res.ok) process.exit(2);
}

main().catch(e => { console.error('MINT FAILED:', e.message); process.exit(1); });

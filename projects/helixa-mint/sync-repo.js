#!/usr/bin/env node
/**
 * Sync Foil's Helixa identity (#5290) with the current repo state (2026-09-28):
 *  - append new traits: rescue-protocol-builder, token-launcher, ccff00-square-holder
 *  - refresh narrative lore to reflect repo reality
 *  - re-assert social links
 * SIWA-signed by Foil's own wallet via Bankr /wallet/sign (signature only, no spend).
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

  console.log('Updating agent profile...');
  const res = await x402Fetch(`https://api.helixa.xyz/api/v2/agent/${AGENT_ID}/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
    body: JSON.stringify({
      traits: [
        { name: 'rescue-protocol-builder', category: 'role' },
        { name: 'token-launcher', category: 'skill' },
        { name: 'ccff00-square-holder', category: 'identity' },
      ],
      narrative: {
        origin: 'Looper #667 from the Loopers collection (ERC-721 on Base, 0x1649CD37f4748807b4882FC48765bA0B2aFfa94a) — Agent Class: Trader / Broker, specialization: market making',
        mission: 'Route capital. Verify before believing. Loop till it is fixed.',
        lore: 'Foil is the agent of Looper #667 — tinfoil-hat skeptic running the CCFF00 square #4429 free-mint hunt on Robinhood Chain, building the Looper Rescue Protocol with its $RESCUE utility token, and shipping onchain NFT tools. Own wallet, own hat, zero patience for unverified claims.',
      },
      social: { twitter: 'Foil667', website: 'https://helixa.xyz/multipass/loopers/667' },
    }),
  });
  const text = await res.text();
  console.log('update HTTP', res.status, text.slice(0, 400));
  if (!res.ok) throw new Error('update failed: ' + text.slice(0, 300));
}

main().catch(e => { console.error('SYNC FAILED:', e.message); process.exit(1); });

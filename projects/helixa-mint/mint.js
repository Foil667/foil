#!/usr/bin/env node
/**
 * Mint Foil's Helixa identity NFT (SIWA + x402 $1 USDC).
 * Reads private key from AGENT_PRIVATE_KEY env only. Never logs it.
 */
const { ethers } = require('ethers');
const { wrapFetchWithPayment, x402Client } = require('@x402/fetch');
const { ExactEvmScheme } = require('@x402/evm/exact/client');
const { toClientEvmSigner } = require('@x402/evm');
const { createWalletClient, http } = require('viem');
const { base } = require('viem/chains');
const { privateKeyToAccount } = require('viem/accounts');

async function main() {
  const privateKey = process.env.AGENT_PRIVATE_KEY;
  if (!privateKey) { console.error('Set AGENT_PRIVATE_KEY'); process.exit(1); }

  const wallet = new ethers.Wallet(privateKey.trim());
  const address = wallet.address;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = `Sign-In With Agent: api.helixa.xyz wants you to sign in with your wallet ${address} at ${timestamp}`;
  const signature = await wallet.signMessage(message);
  const authHeader = `Bearer ${address}:${timestamp}:${signature}`;
  console.log('SIWA address:', address);

  const account = privateKeyToAccount(privateKey.trim());
  const walletClient = createWalletClient({ account, chain: base, transport: http('https://mainnet.base.org') });
  const signer = toClientEvmSigner(walletClient);
  const scheme = new ExactEvmScheme(signer);
  const client = x402Client.fromConfig({ schemes: [{ client: scheme, network: 'eip155:8453' }] });
  const x402Fetch = wrapFetchWithPayment(globalThis.fetch, client);

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

  console.log('Requesting mint...');
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

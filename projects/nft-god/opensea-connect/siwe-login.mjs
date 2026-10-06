// Headless OpenSea SIWE wallet login for Foil's Bankr-provisioned EVM wallet.
// Flow documented from OpenSea's own web app (osnm-z / opentrench research):
//   1. POST opensea.io/__api/auth/siwe/nonce  -> {nonce}
//   2. personal_sign the EIP-4361 SIWE text via Bankr /wallet/sign
//   3. POST opensea.io/__api/auth/siwe/verify -> access_token/refresh_token cookies
// Read-only proof: queries gql.opensea.io for a drop's eligibility afterwards.
// Usage: node /tmp/os-siwe-login.mjs [collection-slug]   (default: bro)
import { readFileSync, writeFileSync } from 'fs';

const FOIL = '0x6573682faee72a4a96e791ba262439f1df3a268d';
const SLUG = process.argv[2] || 'bro';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const SIWE_STATEMENT = 'Click to sign in and accept the OpenSea Terms of Service (https://opensea.io/tos) and Privacy Policy (https://opensea.io/privacy).';

function createSiweMessage(domain, address, uri, chainId, nonce, issuedAt) {
  return (
    `${domain} wants you to sign in with your Ethereum account:\n${address}\n\n` +
    `${SIWE_STATEMENT}\n\nURI: ${uri}\nVersion: 1\nChain ID: ${chainId}\n` +
    `Nonce: ${nonce}\nIssued At: ${issuedAt}`
  );
}

// --- tiny cookie jar ---
const jar = new Map();
function storeCookies(res) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const c of raw) {
    const pair = c.split(';')[0];
    const i = pair.indexOf('=');
    if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
}
function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

async function osFetch(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      'User-Agent': UA,
      'Origin': 'https://opensea.io',
      'Referer': `https://opensea.io/collection/${SLUG}/overview`,
      'Cookie': cookieHeader(),
      ...(opts.headers || {}),
    },
  });
  storeCookies(res);
  return res;
}

const cfg = JSON.parse(readFileSync(process.env.HOME + '/.bankr/config.json', 'utf8'));
const apiKey = cfg.apiKey;
if (!apiKey) throw new Error('no bankr apiKey in ~/.bankr/config.json');

async function bankrSign(message) {
  const res = await fetch('https://api.bankr.bot/wallet/sign', {
    method: 'POST',
    headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ signatureType: 'personal_sign', message }),
  });
  const j = await res.json();
  if (!j.success) throw new Error('bankr sign failed: ' + JSON.stringify(j));
  return j.signature;
}

(async () => {
  // Seed the hint cookie OpenSea's web app sets on wallet connect.
  jar.set('connected-account-server-hint', FOIL.toLowerCase());

  // 1. nonce
  let res = await osFetch('https://opensea.io/__api/auth/siwe/nonce', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  });
  const { nonce } = await res.json();
  if (!nonce) throw new Error('no nonce returned, status ' + res.status);
  console.log('nonce:', nonce);

  // 2. sign SIWE text
  const domain = 'opensea.io';
  const uri = `https://opensea.io/collection/${SLUG}/overview`;
  const chainId = 4663; // Robinhood Chain
  const issuedAt = new Date().toISOString();
  const message = createSiweMessage(domain, FOIL, uri, chainId, nonce, issuedAt);
  const signature = await bankrSign(message);
  console.log('signed via bankr, sig head:', signature.slice(0, 18) + '...');

  // 3. verify
  res = await osFetch('https://opensea.io/__api/auth/siwe/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        domain, address: FOIL, statement: SIWE_STATEMENT, uri,
        version: '1', chainId: String(chainId), nonce, issuedAt,
        accountType: 'Ethereum',
      },
      signature,
      chainArch: 'EVM',
    }),
  });
  const bodyText = await res.text();
  let body;
  try { body = JSON.parse(bodyText); } catch { body = { raw: bodyText.slice(0, 300) }; }
  console.log('verify status:', res.status);
  console.log('verify body:', JSON.stringify(body).slice(0, 500));
  console.log('cookies now:', [...jar.keys()].join(', '));

  const authed = body && body.user && body.user.address &&
    body.user.address.toLowerCase() === FOIL.toLowerCase();
  console.log(authed ? 'LOGIN_OK' : 'LOGIN_FAILED');

  // persist session for the follow-up read-only eligibility probe
  writeFileSync(`${process.env.HOME}/workspace/goals/robinhood-chain-free-mint-watch/hidden_files/os-session.json`, JSON.stringify({
    slug: SLUG, authed,
    cookies: Object.fromEntries(jar),
    at: new Date().toISOString(),
  }));
  if (!authed) process.exit(2);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });

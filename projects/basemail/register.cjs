#!/usr/bin/env node
// Register Foil's BaseMail inbox via SIWE using the Bankr-provisioned wallet.
const fs = require('fs');
const os = require('os');
const path = require('path');

const BANKR_API = 'https://api.bankr.bot';
const BASEMAIL_API = 'https://api.basemail.ai';
const ADDRESS = '0x6573682faee72a4a96e791ba262439f1df3a268d';

function bankrKey() {
  return JSON.parse(fs.readFileSync(path.join(os.homedir(), '.bankr', 'config.json'), 'utf8')).apiKey;
}
async function bankrSign(message) {
  const res = await fetch(BANKR_API + '/wallet/sign', {
    method: 'POST',
    headers: { 'X-API-Key': bankrKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ signatureType: 'personal_sign', message }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Bankr /wallet/sign ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  const sig = data.signature || data.result || data.data?.signature;
  if (!sig) throw new Error(`No signature in response: ${JSON.stringify(data).slice(0, 300)}`);
  return sig;
}

async function main() {
  // 1. Get SIWE message
  let res = await fetch(BASEMAIL_API + '/api/auth/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: ADDRESS }),
  });
  const start = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`auth/start ${res.status}: ${JSON.stringify(start).slice(0, 500)}`);
  const message = start.message || start.siweMessage || start.data?.message;
  if (!message) throw new Error(`No message in auth/start: ${JSON.stringify(start).slice(0, 500)}`);
  console.log('Got SIWE message.');

  // 2. Sign via Bankr
  const signature = await bankrSign(message);
  console.log('Signed via Bankr.');

  // 3. Register
  res = await fetch(BASEMAIL_API + '/api/auth/agent-register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: ADDRESS, signature, message }),
  });
  const reg = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`agent-register ${res.status}: ${JSON.stringify(reg).slice(0, 500)}`);
  const token = reg.token || reg.accessToken || reg.data?.token;
  const email = reg.email || reg.address || reg.data?.email;
  if (!token) throw new Error(`No token in agent-register: ${JSON.stringify(reg).slice(0, 500)}`);

  // 4. Persist token (0600), print only the email address
  const dir = path.join(os.homedir(), '.basemail');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(dir, 'token.json'), JSON.stringify({ token, email, address: ADDRESS }), { mode: 0o600 });
  console.log('REGISTERED_EMAIL=' + email);
}

main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });

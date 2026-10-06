#!/usr/bin/env node
// Bridge 0.002 ETH from Base to Robinhood Chain via Bankr agent API.
// Reads key from ~/.bankr/config.json, never logs it.
const fs = require('fs');
const os = require('os');
const BANKR_API = 'https://api.bankr.bot';

function bankrKey() {
  const cfg = JSON.parse(fs.readFileSync(os.homedir() + '/.bankr/config.json', 'utf8'));
  return cfg.apiKey;
}

async function post(path, body) {
  const res = await fetch(BANKR_API + path, {
    method: 'POST',
    headers: { 'X-API-Key': bankrKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Bankr ${path} ${res.status}: ${JSON.stringify(data).slice(0, 500)}`);
  return data;
}

async function get(path) {
  const res = await fetch(BANKR_API + path, { headers: { 'X-API-Key': bankrKey() } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Bankr ${path} ${res.status}: ${JSON.stringify(data).slice(0, 500)}`);
  return data;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const job = await post('/agent/prompt', {
    prompt: 'Bridge exactly 0.002 ETH from Base to Robinhood Chain. The ETH should arrive on Robinhood Chain in the same wallet. Confirm the amount bridged and the destination tx hash.',
  });
  const jobId = job.jobId;
  console.log('job submitted:', jobId);
  for (let i = 0; i < 60; i++) {
    await sleep(5000);
    const st = await get(`/agent/job/${jobId}`);
    const status = st.status;
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      console.log('STATUS:', status);
      console.log('RESPONSE:', (st.response || '').slice(0, 2000));
      if (status !== 'completed') process.exitCode = 2;
      return;
    }
  }
  console.log('TIMEOUT waiting for job', jobId);
  process.exitCode = 3;
}

main().catch((e) => { console.error('ERROR:', e.message); process.exitCode = 1; });

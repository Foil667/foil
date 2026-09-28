#!/usr/bin/env node
// Poll Foil's BaseMail inbox. Usage: node inbox.cjs [limit]
const fs = require('fs');
const os = require('os');
const path = require('path');

async function main() {
  const { token, email } = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.basemail', 'token.json'), 'utf8'));
  const limit = process.argv[2] || 10;
  const res = await fetch(`https://api.basemail.ai/api/inbox?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`inbox ${res.status}: ${JSON.stringify(data).slice(0, 500)}`);
  const msgs = data.messages || data.data || data;
  console.log(`INBOX ${email}:`);
  console.log(JSON.stringify(msgs, null, 2).slice(0, 3000));
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });

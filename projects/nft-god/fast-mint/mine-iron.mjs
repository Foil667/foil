import { keccak_256 } from '@noble/hashes/sha3';
import crypto from 'crypto';
import fs from 'fs';
const seed = Buffer.from('9a0795fbd3d8a602318c7f8d4c19516d88b52cbfc2a1b2866978cc7687747da3', 'hex');
const sender = Buffer.from('6573682faee72a4a96e791ba262439f1df3a268d', 'hex');
const target = 570151603906229727822989733658416996667831920161704485890283046n;
const nonce = Buffer.alloc(32);
crypto.randomBytes(24).copy(nonce, 0);
nonce.writeUInt32BE(crypto.randomBytes(4).readUInt32BE(0), 24);
const msg = Buffer.alloc(84);
seed.copy(msg, 0); sender.copy(msg, 32);
const t0 = Date.now();
let hit = 0;
while (true) {
  nonce.writeUInt32BE(hit, 28);
  nonce.copy(msg, 52);
  const h = keccak_256(msg);
  let v = 0n;
  for (let i = 0; i < 32; i++) v = (v << 8n) | BigInt(h[i]);
  hit++;
  if (hit % 500000 === 0) console.error('progress ' + hit + ' hashes, ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
  if (v < target) {
    const nonceHex = '0x' + nonce.toString('hex');
    console.log('FOUND hit=' + (hit - 1) + ' nonce=' + nonceHex + ' in ' + hit + ' hashes ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
    fs.writeFileSync('/tmp/drgnhoard-nonce.json', JSON.stringify({ nonce: nonceHex, sender: '0x6573682faee72a4a96e791ba262439f1df3a268d', hit: hit - 1 }));
    break;
  }
}

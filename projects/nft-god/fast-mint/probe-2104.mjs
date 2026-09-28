import { ethers } from 'ethers';
const RPC = 'https://rpc.publicnode.com/robinhood-chain'; // may not exist; fallback below
const FORK = '0x00005ea00ac477b1030ce78506496e8c2de24bf5';
const provider = new ethers.JsonRpcProvider(process.argv[2] || 'https://eth-mainnet.public.blastapi.io');
const nets = ["https://rpc.mainnet.chain.robinhood.com"];
// try providers until one answers
async function getP() {
  for (const u of nets) {
    const p = new ethers.JsonRpcProvider(u, undefined, { staticNetwork: false });
    try { await p.getBlockNumber(); console.error('[rpc]', u, 'OK'); return p; } catch(e){ console.error('[rpc]', u, 'FAIL', e.message.slice(0,80)); }
  }
  throw new Error('no rpc');
}
const p = await getP();
const PUBDROP = '0xbc6a629c';
const ROOT = '0x32bf11f5';
for (const nft of process.argv.slice(3)) {
  console.log('\n== NFT', nft);
  const drop = await p.call({ to: FORK, data: PUBDROP + nft.slice(2).padStart(64,'0') }).catch(e=>'ERR '+e.message.slice(0,60));
  if (typeof drop === 'string' && drop.startsWith('0x') && drop.length >= 386) {
    const words = drop.slice(2).match(/.{64}/g).slice(0,6);
    const [price, start, end, maxS, feeBps, restrict] = words.map(w=>BigInt('0x'+w));
    console.log('price', price.toString(), '| start', new Date(Number(start)*1000).toISOString(), '| end', new Date(Number(end)*1000).toISOString(), '| maxSupply', maxS.toString(), '| feeBps', feeBps.toString(), '| restrict', restrict.toString());
  } else { console.log('getPublicDrop:', String(drop).slice(0,100)); }
  const root = await p.call({ to: FORK, data: ROOT + nft.slice(2).padStart(64,'0') }).catch(e=>'ERR');
  console.log('allowListMerkleRoot:', typeof root==='string' ? root.slice(0,66) : root);
}
const bal = await p.getBalance('0x6573682faee72a4a96e791ba262439f1df3a268d').catch(()=>null);
console.log('\nFoil RH balance:', bal ? ethers.formatEther(bal) + ' ETH' : 'ERR');

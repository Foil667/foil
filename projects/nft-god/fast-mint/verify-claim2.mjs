import { ethers } from 'ethers';
const p=new ethers.JsonRpcProvider('https://rpc.mainnet.chain.robinhood.com');
const txh='0x96af27e0d4b4c5c9307f8d41b89b09658d109e2c0e654bac2075e07bb8cc947b';
const r=await p.getTransactionReceipt(txh);
console.log('receipt status:', r.status, 'gasUsed:', r.gasUsed.toString(), 'block:', r.blockNumber);
for(const l of r.logs){
  const tid=BigInt(l.topics[3]).toString();
  const from='0x'+l.topics[1].slice(-40), to='0x'+l.topics[2].slice(-40);
  console.log('Transfer token', tid, 'from', from.slice(0,10)+'...', 'to', to);
}

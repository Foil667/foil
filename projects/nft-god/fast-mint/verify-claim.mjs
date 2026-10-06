import { ethers } from 'ethers';
const p=new ethers.JsonRpcProvider('https://rpc.mainnet.chain.robinhood.com');
const coder=new ethers.AbiCoder();
const word=h=> '0x'+h.slice(2).toLowerCase().padStart(64,'0');
const nft='0xee97ac95047b1cc77aefb54649dbf857c9f61422';
const foil='0x6573682faee72a4a96e791ba262439f1df3a268d';
const user='0x4f9883c7331ba59a56360ffa3c332e0bc09029fc';
const bal=await p.call({to:nft,data:'0x70a08231'+word(foil).slice(2)});
console.log('Foil balanceOf:', BigInt(bal).toString());
// find token ids via Transfer logs to foil from 0x0
const topic=ethers.id('Transfer(address,address,uint256)');
const logs=await p.getLogs({address:nft,fromBlock:'latest-300',toBlock:'latest',topics:[topic]});
for(const l of logs){
  const from='0x'+l.topics[1].slice(-40), to='0x'+l.topics[2].slice(-40);
  const tid=BigInt(l.topics[3]).toString();
  if(from==='0x0000000000000000000000000000000000000000')
    console.log('mint log:', 'blk',l.blockNumber,'token',tid,'to',to,'tx',l.transactionHash.slice(0,18));
}
const txh='0x96af27e0d4b4c5c9307f8d41b89b09658d109e2c0e654bac2075e07bb8cc947b';
const r=await p.getTransactionReceipt(txh);
console.log('receipt status:', r.status, 'gasUsed:', r.gasUsed.toString());

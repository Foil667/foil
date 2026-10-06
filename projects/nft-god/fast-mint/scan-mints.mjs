import { ethers } from 'ethers';
const p=new ethers.JsonRpcProvider('https://rpc.mainnet.chain.robinhood.com');
const target=process.argv[2].toLowerCase();
const latest=await p.getBlockNumber();
console.log('latest block', latest);
const seen=[];
for(let b=latest; b>latest-400 && seen.length<8; b--){
  const blk=await p.getBlock(b,{prefetchTxs:false}).catch(()=>null);
  if(!blk||!blk.transactions) continue;
  for(const h of blk.transactions){
    const tx=await p.getTransaction(h).catch(()=>null);
    if(tx && tx.to && tx.to.toLowerCase()===target){
      seen.push({b, h:tx.hash.slice(0,14), data:tx.data.slice(0,10), val:tx.value.toString(), from:tx.from.slice(0,10)});
      if(seen.length>=8) break;
    }
  }
}
for(const s of seen) console.log(s.b, s.h, 'sel='+s.data, 'value='+s.val, 'from='+s.from);

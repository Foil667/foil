import { ethers } from 'ethers';
const p=new ethers.JsonRpcProvider('https://rpc.mainnet.chain.robinhood.com');
const coder=new ethers.AbiCoder();
// try common mintAllowlist shapes
for(const h of process.argv.slice(2)){
  const tx=await p.getTransaction(h);
  const blk=await p.getBlock(tx.blockNumber);
  console.log('tx', h, new Date(blk.timestamp*1000).toISOString(), 'from', tx.from);
  const d=tx.data;
  // 0x4b61cd6f(nft, feeRecipient, minterIfNotPayer, qty, ..., allowlistData, sig)
  const words=[]; for(let i=10;i<d.length;i+=64) words.push('0x'+d.slice(i,i+64));
  console.log('nargs words:', words.length);
  console.log('nft:', '0x'+words[0].slice(-40));
  console.log('feeRecipient:', '0x'+words[1].slice(-40));
  console.log('minterIfNotPayer:', '0x'+words[2].slice(-40));
  console.log('qty:', BigInt(words[3]).toString());
  // find the 32B allowlistData (nonzero, not feeRecipient, not address-looking)
  for(let i=4;i<words.length;i++){
    const w=words[i];
    if(!/^0x0{64}$/.test(w)) console.log('word'+i+':', w.slice(0,18)+'...'+w.slice(-10));
  }
  console.log('---');
}

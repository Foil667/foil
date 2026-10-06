import { ethers } from 'ethers';
const p=new ethers.JsonRpcProvider('https://rpc.mainnet.chain.robinhood.com');
const nft=process.argv[2].toLowerCase();
const latest=await p.getBlockNumber();
const logs=await p.getLogs({address:nft, fromBlock:latest-600, toBlock:latest, topics:[ethers.id('Transfer(address,address,uint256)')]});
console.log('transfer logs in last 600 blocks:', logs.length);
const minters={};
for(const l of logs.slice(-6)){
  const tx=await p.getTransaction(l.transactionHash);
  const minter=tx.from;
  if(minter!==tx.to){ // exclude contract-originated
  }
  console.log('blk',l.blockNumber, 'minter', minter, 'sel', tx.data.slice(0,10), 'value', tx.value.toString(), 'to', tx.to);
  minters[minter]=tx.data.slice(0,10);
}

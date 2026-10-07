import { ethers } from 'ethers';
const provider=new ethers.JsonRpcProvider('https://rpc.mainnet.chain.robinhood.com');
const nft=process.argv[2];
const CANON='0x00005ea00ac477b1030ce78506496e8c2de24bf5'.toLowerCase();
// get Transfer logs from zero address (mints), latest 2000 blocks
const bn=await provider.getBlockNumber();
const iface=new ethers.Interface(['event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)']);
const logs=await provider.getLogs({address:nft,fromBlock:bn-3000,toBlock:'latest',topics:[iface.getEvent('Transfer').topicHash,'0x0000000000000000000000000000000000000000000000000000000000000000']});
console.log('mint logs:',logs.length,'blocks',bn-3000,'..',bn);
const seen={};
for(const l of logs.slice(-30)){
  const tx=await provider.getTransaction(l.transactionHash);
  const to=(tx.to||'').toLowerCase();
  seen[to]=(seen[to]||0)+1;
}
for(const [to,n] of Object.entries(seen)) console.log('to=',to,'count=',n, to==='0x00005ea00ac477b1030ce78506496e8c2de24bf5'?'CANON':(to==='0x00005ea00ac477b1030ce78506496e8c2de24bf5'?'FORK':'OTHER'));

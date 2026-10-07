import { ethers } from 'ethers';
const provider=new ethers.JsonRpcProvider('https://rpc.mainnet.chain.robinhood.com');
const wallet='0x6573682faee72a4a96e791ba262439f1df3a268d';
const coder=new ethers.AbiCoder();
for(const nft of JSON.parse(process.argv[2])){
  try{
    const raw=await provider.call({to:nft,data:'0x70a08231'+coder.encode(['address'],[wallet]).slice(2)});
    console.log(nft.slice(0,12),'balanceOf(Foil)='+BigInt(raw).toString());
  }catch(e){ console.log(nft.slice(0,12),'balanceOf ERR'); }
}
const nonce=await provider.getTransactionCount(wallet,'pending');
const latest=await provider.getTransactionCount(wallet,'latest');
console.log('wallet nonce latest=',latest,'pending=',nonce,'| RH ETH balance=',ethers.formatEther(await provider.getBalance(wallet)));

import { ethers } from 'ethers';
const RPC='https://robinhood-rpc.publicnode.com';
const provider=new ethers.JsonRpcProvider(RPC);
const FOIL='0x6573682faee72a4a96e791ba262439f1df3a268d';
const coder=new ethers.AbiCoder();
const balSel='70a08231'; // balanceOf(address)
async function bal(nft){
  try{
    const r=await provider.call({to:nft,data:'0x'+balSel+coder.encode(['address'],[FOIL]).slice(2)});
    return BigInt(r).toString();
  }catch(e){return 'ERR'}
}
console.log('foil RH ETH:',ethers.formatEther(await provider.getBalance(FOIL)));
for(const n of ['0x66bdd484e7b86e4081a48bbbc8632abcca7a391a','0xec11dba1656e45beb6a054ea674db591935cab47','0x904890f7525a58f6bf16543cc6b5e1d772434aa1']){
  console.log(n,'balanceOf(foil)=',await bal(n));
}

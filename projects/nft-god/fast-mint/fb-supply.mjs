import { ethers } from 'ethers';
const provider=new ethers.JsonRpcProvider('https://robinhood-rpc.publicnode.com');
const coder=new ethers.AbiCoder();
async function ts(nft){
  try{const r=await provider.call({to:nft,data:'0x18160ddd'});return BigInt(r).toString();}catch(e){return 'ERR'}
}
for(const n of ['0xec11dba1656e45beb6a054ea674db591935cab47','0xa62e0d5ea805903494e7ca506f4acb4095e61fc6','0xe005a03da7cfa3229ae6d3ad258234bf6fafb770']){
  console.log(n,'totalSupply=',await ts(n));
}

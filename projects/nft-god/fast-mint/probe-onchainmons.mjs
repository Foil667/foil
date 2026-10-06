import { ethers } from 'ethers';
const RPC='https://robinhood-rpc.publicnode.com';
const NFT='0x577d76049519e4ca156fc8d2ebed0dc6e41370a5';
const provider=new ethers.JsonRpcProvider(RPC);
const code=await provider.getCode(NFT);
console.log('code len:',code.length);
if(code.length<=2){console.log('NOT A CONTRACT');process.exit(0);}
// ERC-721 basics
const erc721=new ethers.Contract(NFT,['function name() view returns (string)','function symbol() view returns (string)','function totalSupply() view returns (uint256)','function maxSupply() view returns (uint256)'],provider);
for(const f of ['name','symbol','totalSupply']){
  try{console.log(f,'=',await erc721[f]());}catch(e){console.log(f,'ERR',e.message.slice(0,80));}
}
// owner?
try{const o=await provider.call({to:NFT,data:'0x8da5cb5b'});console.log('Ownable owner:',ethers.getAddress('0x'+o.slice(26)));}catch(e){console.log('owner ERR');}

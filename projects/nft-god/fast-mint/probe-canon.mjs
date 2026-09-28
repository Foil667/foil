import { ethers } from 'ethers';
const RPC='https://rpc.mainnet.chain.robinhood.com';
const CANON='0x00005EA00Ac477B1030CE78506496e8C2dE24bf5';
const provider=new ethers.JsonRpcProvider(RPC);
const coder=new ethers.AbiCoder();
const PUB='0xbc6a629c', ROOT='0x32bf11f5';
for(const [label,nft] of JSON.parse(process.argv[2])){
  try{
    const raw=await provider.call({to:CANON,data:PUB+coder.encode(['address'],[nft]).slice(2)});
    const d=coder.decode(['uint256','uint256','uint256','uint256','uint256','uint256'],raw);
    const [price,start,end,maxW,feeBps,restrict]=d.map(x=>x.toString());
    const root=await provider.call({to:CANON,data:ROOT+coder.encode(['address'],[nft]).slice(2)});
    console.log(`${label}@canon: price=${price} start=${start} end=${end} maxW=${maxW} root=${root.slice(0,14)}...`);
  }catch(e){console.log(label,'@canon ERR',(e.shortMessage||e.message).slice(0,80));}
}

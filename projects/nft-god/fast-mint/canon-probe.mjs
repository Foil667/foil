import { ethers } from 'ethers';
const RPC='https://rpc.mainnet.chain.robinhood.com';
const provider=new ethers.JsonRpcProvider(RPC);
const coder=new ethers.AbiCoder();
const PUB='0xbc6a629c', ROOT='0x32bf11f5';
const CANON='0x00005EA00Ac477B1030CE78506496e8C2dE24bf5';
const list=JSON.parse(process.argv[2]);
for (const [label,nft] of list) {
  try {
    const raw=await provider.call({to:CANON,data:PUB+coder.encode(['address'],[nft]).slice(2)});
    const d=coder.decode(['uint256','uint256','uint256','uint256','uint256','uint256'],raw);
    const root=await provider.call({to:CANON,data:ROOT+coder.encode(['address'],[nft]).slice(2)});
    console.log(label,'price='+d[0].toString(),'start='+d[1].toString(),'end='+d[2].toString(),'maxW='+d[3].toString(),'root='+root.slice(0,12)+'...');
  } catch(e){ console.log(label,'ERR',(e.shortMessage||e.message).slice(0,80)); }
}

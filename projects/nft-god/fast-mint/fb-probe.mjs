import { ethers } from 'ethers';
const RPCS = ['https://robinhood-rpc.publicnode.com','https://rpc.mainnet.chain.robinhood.com','https://rpc.nodeflare.app/robinhood/public'];
let provider=null;
for (const r of RPCS){ try{ const p=new ethers.JsonRpcProvider(r,4663); await p.getBlockNumber(); provider=p; console.error('RPC_OK',r); break;}catch(e){ console.error('RPC_FAIL',r);} }
if(!provider){ console.log('NO_RPC'); process.exit(2);}
const CANON='0x00005EA00Ac477B1030CE78506496e8C2dE24bf5';
const FORK='0x00005ea00ac477b1030ce78506496e8c2de24bf5';
const coder=new ethers.AbiCoder(); const PUB='0xbc6a629c', ROOT='0x32bf11f5';
for (const [label,nft] of JSON.parse(process.argv[2])) {
  for (const [sname,saddr] of [['canon',CANON],['fork',FORK]]) {
    try{
      const raw=await provider.call({to:saddr,data:PUB+coder.encode(['address'],[nft]).slice(2)});
      const d=coder.decode(['uint256','uint256','uint256','uint256','uint256','uint256'],raw);
      const [price,start,end,maxW,feeBps,restrict]=d.map(x=>x.toString());
      const root=await provider.call({to:saddr,data:ROOT+coder.encode(['address'],[nft]).slice(2)});
      console.log(`${label} ${sname}: price=${price} start=${start} end=${end} maxW=${maxW} restrict=${restrict} root=${root.slice(0,14)}...`);
    }catch(e){ console.log(label,sname,'ERR',(e.shortMessage||e.message).slice(0,80)); }
  }
}

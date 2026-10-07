import { ethers } from 'ethers';
const CANON='0x00005EA00Ac477B1030CE78506496e8C2dE24bf5';
const FORK='0x00005ea00ac477b1030ce78506496e8c2de24bf5';
const rpcs=['https://robinhood-rpc.publicnode.com','https://rpc.mainnet.chain.robinhood.com','https://rpc.nodeflare.app/robinhood/public'];
const PUB='0xbc6a629c', ROOT='0x32bf11f5';
const coder=new ethers.AbiCoder();
let provider=null;
for(const r of rpcs){ try{ const p=new ethers.JsonRpcProvider(r); await p.getBlockNumber(); provider=p; break;}catch(e){} }
if(!provider){ console.log('NO RPC'); process.exit(1); }
for(const [label,nft] of JSON.parse(process.argv[2])){
  let line=label;
  for(const [nm,saddr] of [['c',CANON],['f',FORK]]){
    try{
      const raw=await provider.call({to:saddr,data:PUB+coder.encode(['address'],[nft]).slice(2)});
      const d=coder.decode(['uint256','uint256','uint256','uint256','uint256','uint256'],raw);
      const [price,start,end,maxW,feeBps,restrict]=d.map(x=>x.toString());
      const root=await provider.call({to:saddr,data:ROOT+coder.encode(['address'],[nft]).slice(2)});
      const live=(Number(start)<=Date.now()/1000 && Date.now()/1000<=Number(end))?'LIVE':'NOTLIVE';
      line+=` | ${nm}: ${live} price=${price} start=${new Date(Number(start)*1000).toISOString().slice(5,16)} end=${new Date(Number(end)*1000).toISOString().slice(5,16)} maxW=${maxW} fee=${feeBps} restr=${restrict} root=${root.slice(0,10)}`;
    }catch(e){ line+=` | ${nm}: ERR`; }
  }
  console.log(line);
}

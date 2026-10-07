import { ethers } from 'ethers';
const RPCS = ['https://robinhood-rpc.publicnode.com','https://rpc.mainnet.chain.robinhood.com','https://rpc.nodeflare.app/robinhood/public'];
const CANON='0x00005EA00Ac477B1030CE78506496e8C2dE24bf5', FORK='0x00005ea00ac477b1030ce78506496e8c2de24bf5';
const coder=new ethers.AbiCoder(), PUB='0xbc6a629c', ROOT='0x32bf11f5';
let provider=null;
for (const r of RPCS){ try{ const p=new ethers.JsonRpcProvider(r,{chainId:4663,name:"rh"}); await p.getBlockNumber(); provider=p; console.log('RPC:',r); break;}catch(e){} }
if(!provider){ console.log('RPC DOWN'); process.exit(1); }
const now=Math.floor(Date.now()/1000);
for (const [label,nft] of JSON.parse(process.argv[2])){
  for (const [sname,saddr] of [['canon',CANON],['fork',FORK]]){
    try{
      const raw=await provider.call({to:saddr,data:PUB+coder.encode(['address'],[nft]).slice(2)});
      const d=coder.decode(['uint256','uint256','uint256','uint256','uint256','uint256'],raw);
      const [price,start,end,maxW,feeBps,restrict]=d.map(x=>x.toString());
      const root=await provider.call({to:saddr,data:ROOT+coder.encode(['address'],[nft]).slice(2)});
      const st=now<+start?'NOT-LIVE':(now<=+end?'LIVE':'ENDED');
      console.log(label,sname,': price='+price,'start='+start,'('+new Date(+start*1000).toISOString()+')','end='+end,'maxW='+maxW,'feeBps='+feeBps,'restrict='+restrict,'root='+root.slice(0,14)+'…',st);
    }catch(e){ console.log(label,sname,'ERR',(e.shortMessage||e.message).slice(0,80)); }
  }
}

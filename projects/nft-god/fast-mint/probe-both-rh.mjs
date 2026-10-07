import { ethers } from 'ethers';
const CANON='0x00005EA00Ac477B1030CE78506496e8C2dE24bf5';
const FORK='0x00005ea00ac477b1030ce78506496e8c2de24bf5';
const rpcs=process.argv[3].split(',');
const nft=process.argv[2];
const PUB='0xbc6a629c', ROOT='0x32bf11f5';
const coder=new ethers.AbiCoder();
let provider=null;
for(const r of rpcs){ try{ const p=new ethers.JsonRpcProvider(r); await p.getBlockNumber(); provider=p; console.log('RPC OK:',r); break;}catch(e){ console.log('RPC fail:',r);} }
if(!provider){ console.log('NO RPC'); process.exit(1); }
for(const [nm,saddr] of [['canon',CANON],['fork',FORK]]){
  try{
    const raw=await provider.call({to:saddr,data:PUB+coder.encode(['address'],[nft]).slice(2)});
    const d=coder.decode(['uint256','uint256','uint256','uint256','uint256','uint256'],raw);
    const [price,start,end,maxW,feeBps,restrict]=d.map(x=>x.toString());
    const root=await provider.call({to:saddr,data:ROOT+coder.encode(['address'],[nft]).slice(2)});
    const s=new Date(Number(start)*1000).toISOString(), e=new Date(Number(end)*1000).toISOString();
    console.log(`${nm}: price=${price} start=${start}(${s}) end=${end}(${e}) maxW=${maxW} feeBps=${feeBps} restrict=${restrict} root=${root.slice(0,66)}`);
  }catch(e){ console.log(nm,'ERR',(e.shortMessage||e.message).slice(0,100)); }
}

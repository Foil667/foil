import { ethers } from 'ethers';
const RPC='https://robinhood-rpc.publicnode.com';
const provider=new ethers.JsonRpcProvider(RPC);
const coder=new ethers.AbiCoder();
const CANON='0x00005EA00Ac477B1030CE78506496e8C2dE24bf5';
const FORK='0x00005ea00ac477b1030ce78506496e8c2de24bf5';
const PUB='0xbc6a629c', ROOT='0x32bf11f5';
const now=Math.floor(Date.now()/1000);
const input=JSON.parse((await import('fs')).default.readFileSync('/tmp/fb-probe-input.json','utf8'));
async function one(sd,sname,nft){
  try{
    const [raw,root]=await Promise.all([
      provider.call({to:sd,data:PUB+coder.encode(['address'],[nft]).slice(2)}),
      provider.call({to:sd,data:ROOT+coder.encode(['address'],[nft]).slice(2)}),
    ]);
    const d=coder.decode(['uint256','uint256','uint256','uint256','uint256','uint256'],raw);
    const [price,start,end,maxW,feeBps,restrict]=d.map(x=>x.toString());
    const live=(BigInt(start)<=BigInt(now)&&BigInt(now)<=BigInt(end));
    return `${sname}: price=${price} start=${start} end=${end} maxW=${maxW} live=${live} root=${root}`;
  }catch(e){return `${sname}: ERR`}
}
const CH=6;
for(let i=0;i<input.length;i+=CH){
  const batch=input.slice(i,i+CH);
  const res=await Promise.all(batch.map(async ([label,nft])=>{
    const [c,f]=await Promise.all([one(CANON,'canon',nft),one(FORK,'fork',nft)]);
    return `${label}\n  ${c}\n  ${f}`;
  }));
  console.log(res.join('\n'));
}

import { ethers } from 'ethers';
const RPCS = ['https://robinhood-rpc.publicnode.com','https://rpc.mainnet.chain.robinhood.com','https://rpc.nodeflare.app/robinhood/public'];
const CANON = '0x00005EA00Ac477B1030CE78506496e8C2dE24bf5';
const FORK  = '0x00005ea00ac477b1030ce78506496e8c2de24bf5';
const PUB='0xbc6a629c', ROOT='0x32bf11f5';
const coder = new ethers.AbiCoder();
async function call(rpc,to,data){
  const prov = new ethers.JsonRpcProvider(rpc);
  return await prov.call({to,data},{},'latest').catch(e=>'ERR:'+(e.shortMessage||e.message).slice(0,60));
}
const targets = JSON.parse(process.argv[2]); // [label, nft]
const now = Math.floor(Date.now()/1000);
for (const [label, nft] of targets) {
  let out = label+':';
  for (const [sname,saddr] of [['canon',CANON],['fork',FORK]]) {
    let ok=false;
    for (const rpc of RPCS) {
      const raw = await call(rpc, saddr, PUB + coder.encode(['address'],[nft]).slice(2));
      if (String(raw).startsWith('ERR')) continue;
      try {
        const d = coder.decode(['uint256','uint256','uint256','uint256','uint256','uint256'], raw);
        const [price,start,end,maxW,feeBps,restrict] = d.map(x=>Number(x));
        const root = await call(rpc, saddr, ROOT + coder.encode(['address'],[nft]).slice(2));
        const live = start<=now && now<=end ? 'LIVE' : (start>now?'NOTLIVE(future)':'ENDED');
        out += ` ${sname}: price=${price} start=${start} end=${end} maxW=${maxW} restrict=${restrict} root=${String(root).slice(0,10)}.. ${live};`;
        ok=true; break;
      } catch(e){ out += ` ${sname}:DECODE-ERR;`; ok=true; break; }
    }
    if(!ok) out += ` ${sname}:RPC-ALL-FAIL;`;
  }
  console.log(out);
}

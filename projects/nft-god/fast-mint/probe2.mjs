import { ethers } from 'ethers';
const RPCS = ['https://robinhood-rpc.publicnode.com','https://rpc.mainnet.chain.robinhood.com'];
const CANON = '0x00005EA00Ac477B1030CE78506496e8C2dE24bf5';
const FORK = '0x00005ea00ac477b1030ce78506496e8c2de24bf5';
const coder = new ethers.AbiCoder();
const PUB = '0xbc6a629c', ROOT = '0x32bf11f5';
const pairs = JSON.parse(process.argv[2]);
for (const [label, nft] of pairs) {
  for (const [sname, saddr] of [['canon', CANON],['fork', FORK]]) {
    let ok=false, err='';
    for (const rpc of RPCS) {
      try {
        const provider = new ethers.JsonRpcProvider(rpc, undefined, {batchMaxCount:1});

        const raw = await provider.call({ to: saddr, data: PUB + coder.encode(['address'],[nft]).slice(2) });
        const d = coder.decode(['uint256','uint256','uint256','uint256','uint256','uint256'], raw);
        const [price,start,end,maxW,feeBps,restrict] = d.map(x=>x.toString());
        const root = await provider.call({ to: saddr, data: ROOT + coder.encode(['address'],[nft]).slice(2) });
        console.log(`${label}|${sname}: price=${price} start=${start} end=${end} maxW=${maxW} feeBps=${feeBps} restrict=${restrict} root=${root.slice(0,10)}`);
        ok=true; break;
      } catch(e){ err=(e.shortMessage||e.message).slice(0,60); }
    }
    if(!ok) console.log(label+'|'+sname+': ERR '+err);
  }
}

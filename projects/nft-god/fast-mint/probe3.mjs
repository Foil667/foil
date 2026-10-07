import { ethers } from 'ethers';
const RPCS = ['https://mainnet.base.org','https://base-rpc.publicnode.com'];
const CANON = '0x00005EA00Ac477B1030CE78506496e8C2dE24bf5';
const PUB='0xbc6a629c', ROOT='0x32bf11f5';
const coder = new ethers.AbiCoder();
const nft = process.argv[2];
const now = Math.floor(Date.now()/1000);
for (const rpc of RPCS) {
  try {
    const prov = new ethers.JsonRpcProvider(rpc);
    const raw = await prov.call({to:CANON, data: PUB + coder.encode(['address'],[nft]).slice(2)});
    const d = coder.decode(['uint256','uint256','uint256','uint256','uint256','uint256'], raw);
    const [price,start,end,maxW,feeBps,restrict] = d.map(x=>Number(x));
    const root = await prov.call({to:CANON, data: ROOT + coder.encode(['address'],[nft]).slice(2)});
    const live = start<=now && now<=end ? 'LIVE' : (start>now?'NOTLIVE(future)':'ENDED');
    console.log(`base SeaDrop canon: price=${price} start=${start} end=${end} maxW=${maxW} restrict=${restrict} root=${String(root).slice(0,10)}.. ${live} via ${rpc}`);
    break;
  } catch(e){ console.log('try', rpc, 'ERR', (e.shortMessage||e.message).slice(0,80)); }
}

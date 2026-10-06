import { ethers } from 'ethers';
const RPCS = [
  'https://robinhood-rpc.publicnode.com',
  'https://rpc.mainnet.chain.robinhood.com',
  'https://rpc.nodeflare.app/robinhood/public',
];
const CANON = '0x00005EA00Ac477B1030CE78506496e8C2dE24bf5';
const FORK = '0x00005ea00ac477b1030ce78506496e8c2de24bf5';
const PUB = '0xbc6a629c', ROOT = '0x32bf11f5';
const coder = new ethers.AbiCoder();
const pairs = JSON.parse(process.argv[2]);
const NOW = Math.floor(Date.now()/1000);
async function mkProvider() {
  for (const url of RPCS) {
    try {
      const p = new ethers.JsonRpcProvider(url);
      await p.getBlockNumber();
      return p;
    } catch (e) { /* try next */ }
  }
  throw new Error('all RPCs down');
}
const provider = await mkProvider();
for (const [label, nft] of pairs) {
  for (const [sname, saddr] of [['canon', CANON], ['fork', FORK]]) {
    try {
      const raw = await provider.call({ to: saddr, data: PUB + coder.encode(['address'],[nft]).slice(2) });
      const d = coder.decode(['uint256','uint256','uint256','uint256','uint256','uint256'], raw);
      const [price, start, end, maxW, feeBps, restrict] = d.map(x=>x.toString());
      const root = await provider.call({ to: saddr, data: ROOT + coder.encode(['address'],[nft]).slice(2) });
      const st=+start, en=+end;
      const live = st<=NOW&&NOW<=en ? 'LIVE' : (en<NOW?'ENDED':`opens+${Math.round((st-NOW)/60)}m`);
      const wl = root !== '0x'+'0'.repeat(64) ? 'WL-ROOT-SET' : 'public';
      console.log(`${label}@${sname}: price=${price} ${live} maxW=${maxW} restrict=${restrict} ${wl} start=${new Date(st*1000).toISOString()} end=${new Date(en*1000).toISOString()}`);
    } catch (e) { console.log(`${label}@${sname}: not-configured`); }
  }
}

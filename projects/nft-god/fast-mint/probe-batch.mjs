import { ethers } from 'ethers';
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const CANON = '0x00005EA00Ac477B1030CE78506496e8C2dE24bf5';
const FORK = '0x00005ea00ac477b1030ce78506496e8c2de24bf5';
const provider = new ethers.JsonRpcProvider(RPC);
const coder = new ethers.AbiCoder();
const PUB = '0xbc6a629c', ROOT = '0x32bf11f5';
const pairs = JSON.parse(process.argv[2]);
const NOW = Math.floor(Date.now()/1000);
for (const [label, nft] of pairs) {
  for (const [sname, saddr] of [['fork', FORK], ['canon', CANON]]) {
    try {
      const raw = await provider.call({ to: saddr, data: PUB + coder.encode(['address'],[nft]).slice(2) });
      const d = coder.decode(['uint256','uint256','uint256','uint256','uint256','uint256'], raw);
      const [price, start, end, maxW, feeBps, restrict] = d.map(x=>x.toString());
      const root = await provider.call({ to: saddr, data: ROOT + coder.encode(['address'],[nft]).slice(2) });
      const st=+start, en=+end;
      const live = st<=NOW&&NOW<=en ? 'LIVE' : (en<NOW?'ENDED':`opens+${Math.round((st-NOW)/60)}m`);
      console.log(`${label}@${sname}: price=${price} ${live} maxW=${maxW} restrict=${restrict} allowRoot=${root.slice(0,12)}...`);
    } catch (e) { /* not configured */ }
  }
}

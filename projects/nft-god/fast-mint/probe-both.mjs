import { ethers } from 'ethers';
const RPC = process.env.RPC || 'https://robinhood-rpc.publicnode.com';
const CANON = '0x00005EA00Ac477B1030CE78506496e8C2dE24bf5';
const FORK = '0x00005ea00ac477b1030ce78506496e8c2de24bf5';
const provider = new ethers.JsonRpcProvider(RPC);
const coder = new ethers.AbiCoder();
const PUB = '0xbc6a629c', ROOT = '0x32bf11f5';
for (const [label, nft] of JSON.parse(process.argv[2])) {
  const out = { label };
  for (const [sname, saddr] of [['canon', CANON], ['fork', FORK]]) {
    try {
      const raw = await provider.call({ to: saddr, data: PUB + coder.encode(['address'],[nft]).slice(2) });
      const d = coder.decode(['uint256','uint256','uint256','uint256','uint256','uint256'], raw);
      const root = await provider.call({ to: saddr, data: ROOT + coder.encode(['address'],[nft]).slice(2) });
      const [price, start, end, maxW] = d.map(x=>x.toString());
      out[sname] = { price, start, end, maxW, root };
    } catch (e) { out[sname] = 'ERR:'+(e.shortMessage||e.message).slice(0,80); }
  }
  console.log(JSON.stringify(out));
}

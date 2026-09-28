import { ethers } from 'ethers';
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const CANON = '0x00005EA00Ac477B1030CE78506496e8C2dE24bf5';
const FORK = '0x00005ea00ac477b1030ce78506496e8c2de24bf5';
const provider = new ethers.JsonRpcProvider(RPC);
const coder = new ethers.AbiCoder();
const PUB = '0xbc6a629c', ROOT = '0x32bf11f5';
const FEE = 0x0000a26b00c1f0df003000390027140000faa719n;
for (const [label, nft] of JSON.parse(process.argv[2])) {
  for (const [sname, saddr] of [['fork', FORK]]) {
    try {
      const raw = await provider.call({ to: saddr, data: PUB + coder.encode(['address'],[nft]).slice(2) });
      const d = coder.decode(['uint256','uint256','uint256','uint256','uint256','uint256'], raw);
      const [price, start, end, maxW, feeBps, restrict] = d.map(x=>x.toString());
      const root = await provider.call({ to: saddr, data: ROOT + coder.encode(['address'],[nft]).slice(2) });
      console.log(`${label}: price=${price} start=${start} end=${end} maxPerWallet=${maxW} feeBps=${feeBps} restrict=${restrict} allowRoot=${root}`);
    } catch (e) { console.log(label, 'ERR', (e.shortMessage||e.message).slice(0,100)); }
  }
}

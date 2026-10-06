import { ethers } from 'ethers';
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const CANON = '0x00005EA00Ac477B1030CE78506496e8C2dE24bf5';
const FORK = '0x00005ea00ac477b1030ce78506496e8c2de24bf5';
const provider = new ethers.JsonRpcProvider(RPC);
const coder = new ethers.AbiCoder();
const PUB = '0xbc6a629c', ROOT = '0x32bf11f5';
const now = Math.floor(Date.now() / 1000);
console.log('NOW(ms->s)', now, new Date(now * 1000).toISOString());
for (const [label, nft] of JSON.parse(process.argv[2])) {
  const parts = [];
  for (const [sname, saddr] of [['canon', CANON], ['fork', FORK]]) {
    try {
      const raw = await provider.call({ to: saddr, data: PUB + coder.encode(['address'], [nft]).slice(2) });
      const d = coder.decode(['uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256'], raw);
      const [price, start, end, maxW, feeBps, restrict] = d.map(x => x.toString());
      const root = await provider.call({ to: saddr, data: ROOT + coder.encode(['address'], [nft]).slice(2) });
      const s = Number(start), e = Number(end);
      const state = s === 0 ? 'ZERO' : (s <= now && now <= e ? 'LIVE' : (s > now ? 'FUT' : 'ENDED'));
      parts.push(`${sname}:${state} price=${price} start=${new Date(s * 1000).toISOString().slice(5, 16)} end=${new Date(e * 1000).toISOString().slice(5, 16)} maxW=${maxW} restrict=${restrict} root=${root.slice(0, 10)}`);
    } catch (err) { parts.push(`${sname}:ERR ${(err.shortMessage || err.message).slice(0, 80)}`); }
  }
  console.log(label, '::', parts.join(' | '));
}

import { ethers } from 'ethers';
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const CANON = '0x00005EA00Ac477B1030CE78506496e8C2dE24bf5';
const FORK = '0x00005ea00ac477b1030ce78506496e8c2de24bf5';
const SEL = '0xbc6a629c';
const provider = new ethers.JsonRpcProvider(RPC);
const coder = new ethers.AbiCoder();
for (const [label, nft] of JSON.parse(process.argv[2])) {
  for (const [sname, saddr] of [['canon', CANON], ['fork', FORK]]) {
    const data = SEL + coder.encode(['address'], [nft]).slice(2);
    try {
      const raw = await provider.call({ to: saddr, data });
      const d = coder.decode(['uint64','uint64','uint256','uint256','uint256','bytes32'], raw);
      const s0 = Number(d[0]); const e0 = Number(d[1]);
      console.log(`${label} ${sname}: price=${d[2]} maxPerWallet=${d[3]} start=${s0?new Date(s0*1000).toISOString():'0'} end=${e0?new Date(e0*1000).toISOString():'0'} feeBps=${d[4]}`);
    } catch (e) { console.log(`${label} ${sname}: ERR ${(e.shortMessage||e.message).slice(0,80)}`); }
  }
}

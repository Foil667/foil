import { ethers } from 'ethers';
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const CANON = '0x00005EA00Ac477B1030CE78506496e8C2dE24bf5';
const FORK = '0x00005ea00ac477b1030ce78506496e8c2de24bf5';
const provider = new ethers.JsonRpcProvider(RPC);
const coder = new ethers.AbiCoder();
const SIGNED = '0x60cc1ae9', ALD = '0xfadfda03', SUP = '0x18160ddd';
const nfts = JSON.parse(process.argv[2]);
for (const [label, nft] of nfts) {
  for (const [sname, saddr] of [['canon', CANON], ['fork', FORK]]) {
    try {
      const raw = await provider.call({ to: saddr, data: SIGNED + coder.encode(['address'],[nft]).slice(2) });
      const d = coder.decode(['uint256','uint256','uint256','uint256','uint256','uint256'], raw);
      console.log(`${label} ${sname} signedDrop: price=${d[0]} start=${d[1]} end=${d[2]} maxW=${d[3]} feeBps=${d[4]} restrict=${d[5]}`);
    } catch (e) { console.log(label, sname, 'signed ERR', (e.shortMessage||e.message).slice(0,80)); }
    try {
      const ald = await provider.call({ to: saddr, data: ALD + coder.encode(['address'],[nft]).slice(2) });
      console.log(`${label} ${sname} allowListData: ${ald.slice(0,66)}`);
    } catch (e) { console.log(label, sname, 'ald ERR', (e.shortMessage||e.message).slice(0,80)); }
  }
  try {
    const sup = await provider.call({ to: nft, data: SUP });
    console.log(`${label} nft totalSupply=${BigInt(sup).toString()}`);
  } catch (e) { console.log(label, 'supply ERR', (e.shortMessage||e.message).slice(0,80)); }
}

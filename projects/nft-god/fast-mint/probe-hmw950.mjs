import { ethers } from 'ethers';
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const CANON = '0x00005EA00Ac477B1030CE78506496e8C2dE24bf5';
const FORK = '0x00005ea00ac477b1030ce78506496e8c2de24bf5';
const provider = new ethers.JsonRpcProvider(RPC);
const coder = new ethers.AbiCoder();
const PUB = '0xbc6a629c', ROOT = '0x32bf11f5', SUP = '0x8462151c', OWN='0x70a08231';
const FOIL = '0x6573682faee72a4a96e791ba262439f1df3a268d';
for (const [label, nft] of JSON.parse(process.argv[2])) {
  for (const [sname, saddr] of [['canon',CANON],['fork',FORK]]) {
    try {
      const raw = await provider.call({ to: saddr, data: PUB + coder.encode(['address'],[nft]).slice(2) });
      const d = coder.decode(['uint256','uint256','uint256','uint256','uint256','uint256'], raw);
      const [price, start, end, maxW, feeBps, restrict] = d.map(x=>x.toString());
      const root = await provider.call({ to: saddr, data: ROOT + coder.encode(['address'],[nft]).slice(2) });
      console.log(`${label} [${sname}]: price=${price} start=${start} end=${end} maxW=${maxW} feeBps=${feeBps} restrict=${restrict} root=${root.slice(0,18)}...`);
    } catch (e) { console.log(label, sname, 'ERR', (e.shortMessage||e.message).slice(0,80)); }
  }
  try {
    const bal = await provider.call({ to: nft, data: OWN + coder.encode(['address'],[FOIL]).slice(2) });
    const sup = await provider.call({ to: nft, data: SUP });
    console.log(`${label}: FoilBal=${BigInt(bal)} totalSupply=${BigInt(sup)}`);
  } catch (e) { console.log(label, 'bal/sup ERR', e.message.slice(0,80)); }
}

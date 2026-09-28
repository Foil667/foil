import { ethers } from 'ethers';
const RPC = process.env.RH_RPC || 'https://rpc.mainnet.chain.robinhood.com';
const SEADROP = '0x00005EA00Ac477B1030CE78506496e8C2dE24bf5';
const GET_PUBLIC_DROP = '0xbc6a629c';   // getPublicDrop(address)
const provider = new ethers.JsonRpcProvider(RPC);
const coder = new ethers.AbiCoder();
const targets = process.argv.slice(2);
for (const nft of targets) {
  const data = GET_PUBLIC_DROP + coder.encode(['address'], [nft]).slice(2);
  try {
    const raw = await provider.call({ to: SEADROP, data });
    const decoded = coder.decode(['uint64','uint64','uint256','uint256','uint256','bytes32'], raw);
    const [start,end,price,maxTotal,feeBps] = decoded;
    console.log(nft);
    console.log('  start:', new Date(Number(start)*1000).toISOString(), '| end:', new Date(Number(end)*1000).toISOString());
    console.log('  price(wei):', price.toString(), '| maxTotalMintableByWallet:', maxTotal.toString(), '| feeBps:', feeBps.toString());
  } catch (e) { console.log(nft, 'PROBE FAILED:', e.shortMessage || e.message); }
}

import { ethers } from 'ethers';
const provider = new ethers.JsonRpcProvider('https://rpc.mainnet.chain.robinhood.com');
const FOIL = '0x6573682faee72a4a96e791ba262439f1df3a268d';
const data = '0x70a08231' + '0'.repeat(24) + FOIL.slice(2).toLowerCase();
for (const [label, nft] of JSON.parse(process.argv[2])) {
  try {
    const r = await provider.call({ to: nft, data });
    console.log(`${label}: balanceOf(Foil)=${parseInt(r,16)}`);
  } catch(e){ console.log(label,'ERR',(e.shortMessage||e.message).slice(0,60)); }
}

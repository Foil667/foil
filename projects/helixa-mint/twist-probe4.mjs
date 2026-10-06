import { ethers } from 'ethers';
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const provider = new ethers.JsonRpcProvider(RPC, undefined, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36' } });
const T = '0x209761538AB9976d2c04957DAc60E2f8C88B6BEd';
const code = await provider.getCode(T);
console.log('code len:', (code.length-2)/2);

const iface = new ethers.Interface(['function paused() view returns (bool)','function openMintStart() view returns (uint256)','function cubeMintStart() view returns (uint256)','function priceUsd() view returns (uint256)','function allowlistEnabled() view returns (bool)','function openRemaining() view returns (uint256)','function totalSupply() view returns (uint256)','function mintsBy(address) view returns (uint256)','function crayonMinted(uint256) view returns (bool)','function CRAYONS() view returns (address)','function MAX_SUPPLY() view returns (uint256)']);
for (const [f,args] of [['paused',[]],['cubeMintStart',[]],['openMintStart',[]],['priceUsd',[]],['allowlistEnabled',[]],['openRemaining',[]],['totalSupply',[]],['MAX_SUPPLY',[]],['CRAYONS',[]],['mintsBy',['0x6573682faee72a4a96e791ba262439f1df3a268d']]]) {
  try {
    const r = await provider.call({ to: T, data: iface.encodeFunctionData(f, args) });
    console.log(f, '=', iface.decodeFunctionResult(f, r)[0].toString());
  } catch(e){ console.log(f, 'ERR'); }
}

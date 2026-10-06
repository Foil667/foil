import { ethers } from 'ethers';
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const provider = new ethers.JsonRpcProvider(RPC, undefined, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36' } });
const T = '0x209761538AB9976d2c04957DAc60E2f8C88B6BEd';
const FOIL = '0x6573682faee72a4a96e791ba262439f1df3a268d';
const iface = new ethers.Interface(['function crayonMinted(uint256) view returns (bool)','function cubeMinted(uint256) view returns (bool)','function isDesignTaken(bytes32) view returns (bool)','function designKeyOf(uint256,uint8,bool,uint8,uint8) view returns (bytes32)','function mintCrayonEdition(uint256,uint8,uint8,uint8,uint256) payable']);
const zr = (1n<<255n)|BigInt(FOIL), gn = (1n<<254n)|BigInt(4429);
for (const [l,k] of [['walletClaimed',zr],['square4429Claimed',gn]]) {
  const r = await provider.call({ to: T, data: iface.encodeFunctionData('crayonMinted',[k]) });
  console.log(l, iface.decodeFunctionResult('crayonMinted', r)[0]);
}
console.log('mintCrayonEdition fragment:', JSON.stringify(iface.getFunction('mintCrayonEdition').inputs.map(i=>i.type+':'+i.name)));

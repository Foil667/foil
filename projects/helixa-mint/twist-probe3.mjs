import { ethers } from 'ethers';
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const provider = new ethers.JsonRpcProvider(RPC, undefined, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36' } });
const T = '0x6c3c1f5e29d92c5295493a5b85ec719a2febad2c';
const code = await provider.getCode(T);
console.log('code len:', (code.length-2)/2, 'bytes');
const iface = new ethers.Interface(['function paused() view returns (bool)','function openMintStart() view returns (uint256)','function mintCrayonEdition(uint256,uint8,uint8,uint8,uint256)','function CRAYONS() view returns (address)']);
for (const f of ['paused','openMintStart','CRAYONS']) {
  const data = iface.encodeFunctionData(f);
  console.log(f, 'selector:', data.slice(0,10));
  try { const r = await provider.call({ to: T, data }); console.log('  ->', r.slice(0,66)); }
  catch(e){ console.log('  ERR', (e.shortMessage||e.message).slice(0,60)); }
}

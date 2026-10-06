import { ethers } from 'ethers';
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const provider = new ethers.JsonRpcProvider(RPC, undefined, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36' } });
const TWIST = '0x6c3c1f5e29d92c5295493a5b85ec719a2febad2c';
const FOIL = '0x6573682faee72a4a96e791ba262439f1df3a268d';
const iface = new ethers.Interface(['function paused() view returns (bool)','function cubeMintStart() view returns (uint256)','function openMintStart() view returns (uint256)','function priceUsd() view returns (uint256)','function allowlistEnabled() view returns (bool)','function openRemaining() view returns (uint256)','function crayonMinted(uint256) view returns (bool)','function mintsBy(address) view returns (uint256)','function cubeMinted(uint256) view returns (bool)']);
const sleep = ms => new Promise(r=>setTimeout(r,ms));
async function q(label, fn, args=[]) {
  await sleep(400);
  try {
    const r = await provider.call({ to: TWIST, data: iface.encodeFunctionData(fn, args) });
    console.log(label, '=', iface.decodeFunctionResult(fn, r)[0].toString());
  } catch(e) { console.log(label, 'ERR', (e.shortMessage||e.message).slice(0,80)); }
}
await q('paused','paused');
await q('cubeMintStart','cubeMintStart');
await q('openMintStart','openMintStart');
await q('priceUsd','priceUsd');
await q('allowlistEnabled','allowlistEnabled');
await q('openRemaining','openRemaining');
await q('mintsBy(Foil)','mintsBy',[FOIL]);
const zr = (1n<<255n)|BigInt(FOIL), gn = (1n<<254n)|BigInt(4429);
await q('crayonMinted(walletKey)','crayonMinted',[zr]);
await q('crayonMinted(squareKey)','crayonMinted',[gn]);

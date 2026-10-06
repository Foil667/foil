import { ethers } from 'ethers';
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const provider = new ethers.JsonRpcProvider(RPC, undefined, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36' } });
const TWIST = '0x6c3c1f5e29d92c5295493a5b85ec719a2febad2c';
const SQUARES = '0x505A22Ffed8d37ebE580FfD98d2Cdb0021189146';
const FOIL = '0x6573682faee72a4a96e791ba262439f1df3a268d';
const SQ = 4429;
const iface = new ethers.Interface(['function paused() view returns (bool)','function cubeMintStart() view returns (uint256)','function openMintStart() view returns (uint256)','function priceUsd() view returns (uint256)','function allowlistEnabled() view returns (bool)','function openRemaining() view returns (uint256)','function totalSupply() view returns (uint256)','function crayonMinted(uint256) view returns (bool)','function mintsBy(address) view returns (uint256)','function cubeMinted(uint256) view returns (bool)']);
const erc721 = new ethers.Interface(['function ownerOf(uint256) view returns (address)','function balanceOf(address) view returns (uint256)']);
async function call(to, data) { return await provider.call({ to, data }); }
const now = Math.floor(Date.now()/1000);
const [paused, cubeStart, openStart, priceUsd, allowE, openRem, tot] = await Promise.all(
  ['paused','cubeMintStart','openMintStart','priceUsd','allowlistEnabled','openRemaining','totalSupply'].map(async f => {
    try { const r = await call(TWIST, iface.encodeFunctionData(f)); return iface.decodeFunctionResult(f, r)[0].toString(); }
    catch(e){ return 'ERR'; }
  }));
const ts = v => v==='ERR' ? 'ERR' : new Date(Number(v)*1000).toISOString();
console.log('paused', paused, '| cubeMintStart', cubeStart, ts(cubeStart), '| openMintStart', openStart, ts(openStart), '| holderStart', openStart==='ERR'?'ERR':ts(Number(openStart)-3600), '| priceUsd', priceUsd, '| allowlistEnabled', allowE, '| openRemaining', openRem, '| totalSupply', tot);
const sqOwner = await call(SQUARES, erc721.encodeFunctionData('ownerOf',[SQ])).then(r=>erc721.decodeFunctionResult('ownerOf',r)[0]).catch(e=>'ERR');
console.log('square #4429 owner:', sqOwner, '| is Foil:', sqOwner.toLowerCase()===FOIL.toLowerCase());
const zr = (1n<<255n)|BigInt(FOIL), gn = (1n<<254n)|BigInt(SQ);
for (const [label, key] of [['walletClaimed', zr],['squareClaimed', gn]]) {
  const r = await call(TWIST, iface.encodeFunctionData('crayonMinted',[key])).then(x=>iface.decodeFunctionResult('crayonMinted',x)[0]).catch(e=>'ERR');
  console.log(label, key.toString().slice(0,20)+'...', r);
}
const mb = await call(TWIST, iface.encodeFunctionData('mintsBy',[FOIL])).then(x=>iface.decodeFunctionResult('mintsBy',x)[0].toString()).catch(e=>'ERR');
console.log('mintsBy(Foil):', mb);
const foilBal = await provider.getBalance(FOIL).then(b=>ethers.formatEther(b)).catch(e=>'ERR');
console.log('Foil RH ETH balance:', foilBal);
console.log('now:', new Date(now*1000).toISOString());

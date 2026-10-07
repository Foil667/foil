import { ethers } from 'ethers';
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const CANON = '0x00005EA00Ac477B1030CE78506496e8C2dE24bf5';
const FORK = '0x00005ea00ac477b1030ce78506496e8c2de24bf5';
const W = '0x6573682faee72a4a96e791ba262439f1df3a268d';
const provider = new ethers.JsonRpcProvider(RPC);
const coder = new ethers.AbiCoder();
const PUB = '0xbc6a629c', ROOT = '0x32bf11f5';
const nft = process.argv[2];
for (const [sname, saddr] of [['canon', CANON], ['fork', FORK]]) {
  try {
    const raw = await provider.call({ to: saddr, data: PUB + coder.encode(['address'],[nft]).slice(2) });
    const d = coder.decode(['uint256','uint256','uint256','uint256','uint256','uint256'], raw);
    const [price, start, end, maxW, feeBps, restrict] = d.map(x=>x.toString());
    const root = await provider.call({ to: saddr, data: ROOT + coder.encode(['address'],[nft]).slice(2) });
    console.log(`${sname}: price=${price} start=${start} end=${end} maxPerWallet=${maxW} feeBps=${feeBps} restrict=${restrict} allowRoot=${root.slice(0,10)}...`);
  } catch (e) { console.log(sname, 'ERR', (e.shortMessage||e.message||'').slice(0,80)); }
}
try {
  const ts = await provider.call({ to: nft, data: '0x18160ddd' });
  const bal = await provider.call({ to: nft, data: '0x70a08231' + coder.encode(['address'],[W]).slice(2) });
  console.log('totalSupply=', BigInt(ts).toString(), '| balanceOf(Foil)=', BigInt(bal).toString());
} catch(e){ console.log('supply/bal ERR', (e.shortMessage||'').slice(0,80)); }
const nl = await provider.getTransactionCount(W,'latest'), np = await provider.getTransactionCount(W,'pending');
console.log('nonce latest=', nl, 'pending=', np, '| RH ETH=', ethers.formatEther(await provider.getBalance(W)));

import { ethers } from 'ethers';
const RPC = 'https://robinhood-rpc.publicnode.com';
const provider = new ethers.JsonRpcProvider(RPC);
const coder = new ethers.AbiCoder();
const PUB = '0xbc6a629c';
const nft = process.argv[2];
const raw = await provider.call({ to: '0x00005EA00Ac477B1030CE78506496e8C2dE24bf5', data: PUB + coder.encode(['address'],[nft]).slice(2) });
const d = coder.decode(['uint256','uint256','uint256','uint256','uint256','uint256'], raw).map(x=>x.toString());
const [price,start,end,maxW,feeBps,restrict] = d;
const fmt = t => new Date(+t*1000).toISOString();
console.log(JSON.stringify({price, start:fmt(start), end:fmt(end), maxW, feeBps, restrict}));
// totalSupply + maxSupply via common selectors
try { const ts = await provider.call({ to: nft, data: '0x18160ddd' }); console.log('totalSupply(hex):', ts); } catch(e){ console.log('totalSupply: err'); }
try { const ms = await provider.call({ to: nft, data: '0x52d1902d' }); console.log('maxSupply(hex):', ms); } catch(e){ console.log('maxSupply: err'); }

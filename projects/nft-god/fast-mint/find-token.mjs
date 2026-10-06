import { ethers } from 'ethers';
const p=new ethers.JsonRpcProvider('https://rpc.mainnet.chain.robinhood.com');
const r=await p.getTransactionReceipt('0x30ab69489ac2058290189d9de781cb621585a2ff4d43b16c55e7b9e124d1f6b6');
const l=r.logs[0];
console.log('contract',l.address);
console.log('from','0x'+l.topics[1].slice(26));
console.log('to','0x'+l.topics[2].slice(26));
console.log('tokenId',BigInt(l.topics[3]).toString());

import { ethers } from 'ethers';
const provider = new ethers.JsonRpcProvider('https://rpc.mainnet.chain.robinhood.com');
const rc = await provider.getTransactionReceipt('0x72bd2d8b976e10b0fe7821457616f9efb8a5de6ca63267162d78ad7f3b51687a');
const topic = ethers.id('Transfer(address,address,uint256)');
const foil = '0x6573682faee72a4a96e791ba262439f1df3a268d';
const tids = rc.logs.filter(l=>l.topics[0]===topic && l.topics[2].toLowerCase()==='0x'+foil.slice(2).toLowerCase().padStart(64,'0')).map(l=>BigInt(l.topics[3]).toString());
console.log('tokenIds:', tids.join(','));

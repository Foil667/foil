import { ethers } from 'ethers';
const p=new ethers.JsonRpcProvider('https://rpc.mainnet.chain.robinhood.com');
const c=new ethers.Contract('0x2348cbf508c075d47d653513f80959ccafa966c4',['function ownerOf(uint256) view returns (address)'],p);
console.log('ownerOf 2384:',await c.ownerOf(2384));

import { ethers } from 'ethers';
const provider=new ethers.JsonRpcProvider('https://robinhood-rpc.publicnode.com');
const code=await provider.getCode('0x577d76049519e4ca156fc8d2ebed0dc6e41370a5');
console.log('bytecode:',code);
// ERC-1167: 0x363d3d373d3d3d363d73<20B addr>5af43d82803e903d91602b57fd5bf3
const m=code.match(/363d3d373d3d3d363d73([0-9a-fA-F]{40})5af43d82803e903d91602b57fd5bf3/);
console.log('impl:', m?ethers.getAddress('0x'+m[1]):'not-erc1167');

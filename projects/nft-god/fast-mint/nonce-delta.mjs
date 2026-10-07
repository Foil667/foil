import { ethers } from 'ethers';
const p=new ethers.JsonRpcProvider('https://robinhood-rpc.publicnode.com',{chainId:4663,name:'rh'});
const w='0x6573682faee72a4a96e791ba262439f1df3a268d';
console.log('latest:',await p.getTransactionCount(w,'latest'),'pending:',await p.getTransactionCount(w,'pending'),'balance(wei):',await p.getBalance(w));

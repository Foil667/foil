import { ethers } from 'ethers';
const provider = new ethers.JsonRpcProvider('https://robinhood-rpc.publicnode.com');
const nft = '0x39a47a94941639de9b43636015774db03b8ba51c';
const foil = '0x6573682faee72a4a96e791ba262439f1df3a268d';
const iface = new ethers.Interface(['function totalSupply() view returns (uint256)','function balanceOf(address) view returns (uint256)']);
const [ts, bal, nonce, block] = await Promise.all([
  provider.call({to:nft, data: iface.encodeFunctionData('totalSupply')}).then(r=>BigInt(r).toString()).catch(e=>'ERR'),
  provider.call({to:nft, data: iface.encodeFunctionData('balanceOf',[foil])}).then(r=>BigInt(r).toString()).catch(e=>'ERR'),
  provider.getTransactionCount(foil,'pending').catch(e=>'ERR'),
  provider.getBlockNumber(),
]);
console.log('totalSupply:', ts, '| foilBalance:', bal, '| foilNonce(pending):', nonce, '| block:', block);
// recent minters: scan last ~500 blocks for Transfer from 0x0
const transferTopic = ethers.id('Transfer(address,address,uint256)');
const logs = await provider.getLogs({address: nft, topics: [transferTopic, ethers.zeroPadValue('0x0000000000000000000000000000000000000000',32)], fromBlock: block-800, toBlock: block}).catch(e=>({err:String(e)}));
if (logs.err) console.log('logs ERR', logs.err);
else {
  const minters = new Set(logs.map(l=>'0x'+l.topics[2].slice(26)));
  console.log('mints in last 800 blocks:', logs.length, '| unique minters:', minters.size);
  console.log([...minters].slice(0,10).join(','));
}

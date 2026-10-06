import { ethers } from 'ethers';
const RPCS = ['https://rpc.mainnet.chain.robinhood.com','https://robinhood-rpc.publicnode.com','https://rpc.nodeflare.app/robinhood/public'];
const CANON = '0x00005EA00Ac477B1030CE78506496e8C2dE24bf5';
const FORK = '0x00005ea00ac477b1030ce78506496e8c2de24bf5';
const PUB = '0xbc6a629c', ROOT = '0x32bf11f5';
const coder = new ethers.AbiCoder();
const targets = JSON.parse(process.argv[2]);
let provider;
for (const r of RPCS) { try { const p = new ethers.JsonRpcProvider(r); await p.getBlockNumber(); provider = p; console.error('RPC OK:', r); break; } catch(e){ console.error('RPC FAIL:', r, (e.shortMessage||e.message).slice(0,60)); } }
if (!provider) { console.log('ALL RPC DOWN'); process.exit(2); }
for (const [label, nft] of targets) {
  for (const [sname, saddr] of [['canon', CANON], ['fork', FORK]]) {
    try {
      const raw = await provider.call({ to: saddr, data: PUB + coder.encode(['address'],[nft]).slice(2) });
      const d = coder.decode(['uint256','uint256','uint256','uint256','uint256','uint256'], raw);
      const [price, start, end, maxW, feeBps, restrict] = d.map(x=>x.toString());
      const root = await provider.call({ to: saddr, data: ROOT + coder.encode(['address'],[nft]).slice(2) });
      console.log(`${label}/${sname}: price=${price} start=${start} end=${end} maxW=${maxW} feeBps=${feeBps} restrict=${restrict} root=${root}`);
    } catch (e) { console.log(label+'/'+sname, 'ERR', (e.shortMessage||e.message).slice(0,80)); }
  }
}

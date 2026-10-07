import { ethers } from 'ethers';
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const CANON = '0x00005EA00Ac477B1030CE78506496e8C2dE24bf5';
const FORK = '0x00005ea00ac477b1030ce78506496e8c2de24bf5';
const provider = new ethers.JsonRpcProvider(RPC);
const coder = new ethers.AbiCoder();
const PUB = '0xbc6a629c', ROOT = '0x32bf11f5';
const TS = '0x2fa1b53d';
for (const [label, nft] of JSON.parse(process.argv[2])) {
  for (const [sname, saddr] of [['canon', CANON], ['fork', FORK]]) {
    try {
      const raw = await provider.call({ to: saddr, data: PUB + coder.encode(['address'],[nft]).slice(2) });
      const d = coder.decode(['uint256','uint256','uint256','uint256','uint256','uint256'], raw);
      const [price, start, end, maxW, feeBps, restrict] = d.map(x=>x.toString());
      const root = await provider.call({ to: saddr, data: ROOT + coder.encode(['address'],[nft]).slice(2) });
      let ts='?';
      try { const r2 = await provider.call({ to: nft, data: TS }); ts = BigInt(r2).toString(); } catch {}
      const fmt = t => t=='0' ? '-' : new Date(Number(t)*1000).toISOString().slice(5,16).replace('T',' ');
      console.log(`${label} [${sname}]: price=${price} (${(Number(price)/1e18).toFixed(6)} ETH) start=${fmt(start)} end=${fmt(end)} maxW=${maxW} feeBps=${feeBps} restrict=${restrict} root=${root.slice(0,10)}... totalSupply=${ts}`);
    } catch (e) { console.log(label, `[${sname}]`, 'ERR', (e.shortMessage||e.message||'').slice(0,80)); }
  }
}

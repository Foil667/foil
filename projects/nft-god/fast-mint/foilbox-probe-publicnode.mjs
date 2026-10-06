import { ethers } from 'ethers';
const RPC = 'https://robinhood-rpc.publicnode.com';
const CANON = '0x00005EA00Ac477B1030CE78506496e8C2dE24bf5';
const FORK = '0x00005ea00ac477b1030ce78506496e8c2de24bf5';
const headers = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' };
const provider = new ethers.JsonRpcProvider(RPC, undefined, { batchMaxCount: 1, staticNetwork: true, headers });
const coder = new ethers.AbiCoder();
const PUB = '0xbc6a629c', ROOT = '0x32bf11f5';
const contracts = JSON.parse(process.argv[2]);
const now = Math.floor(Date.now() / 1000);
console.log('NOW_UTC', new Date(now * 1000).toISOString());
for (const [label, nft] of contracts) {
  const out = {};
  for (const [sname, saddr] of [['canon', CANON], ['fork', FORK]]) {
    try {
      const raw = await provider.call({ to: saddr, data: PUB + coder.encode(['address'], [nft]).slice(2) });
      const d = coder.decode(['uint256','uint256','uint256','uint256','uint256','uint256'], raw);
      const [price, start, end, maxW, feeBps, restrict] = d.map(x => x.toString());
      const isZero = d.every(x => x === 0n);
      let root = null;
      if (!isZero) {
        try { root = (await provider.call({ to: saddr, data: ROOT + coder.encode(['address'], [nft]).slice(2) })).slice(2); } catch (e) { root = 'ERR'; }
      }
      const s = Number(start), e2 = Number(end);
      const live = !isZero && s <= now && now <= e2;
      out[sname] = { price, start: s ? new Date(s * 1000).toISOString() : 0, end: e2 ? new Date(e2 * 1000).toISOString() : 0, maxW, feeBps, restrict, allowRoot: root, live };
    } catch (e) { out[sname] = { err: (e.shortMessage || e.message).slice(0, 80) }; }
  }
  console.log(JSON.stringify({ label, out }));
}

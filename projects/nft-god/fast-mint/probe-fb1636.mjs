import { ethers } from 'ethers';
const rpcs = ['https://robinhood-rpc.publicnode.com','https://rpc.mainnet.chain.robinhood.com','https://rpc.nodeflare.app/robinhood/public'];
const CANON='0x00005EA00Ac477B1030CE78506496e8C2dE24bf5', FORK='0x00005ea00ac477b1030ce78506496e8c2de24bf5';
const GET='0xbc6a629c', ROOT='0x32bf11f5', SUP='0x18160ddd';
const contracts = process.argv[2].split(',');
const provider = new ethers.JsonRpcProvider(rpcs[0], 4663);
const now = Math.floor(Date.now()/1000);
const decode = (data) => { try { const r = ethers.AbiCoder.defaultAbiCoder().decode(['uint256','uint64','uint64','uint16','uint16','bool'], data); return r; } catch(e){ return null; } };
for (const nft of contracts) {
  for (const sd of [CANON, FORK]) {
    try {
      const d = await provider.call({to: sd, data: GET + '000000000000000000000000' + nft.slice(2).toLowerCase()}, {blockTag:'latest'});
      const r = d === '0x' ? null : decode(d);
      const root = await provider.call({to: sd, data: ROOT + '000000000000000000000000' + nft.slice(2).toLowerCase()}, {blockTag:'latest'});
      let sup = null;
      try { sup = parseInt(await provider.call({to: nft, data: SUP}, {blockTag:'latest'}), 16); } catch(e){}
      if (r) {
        const [price, start, end, maxW, feeBps, restrict] = [r[0].toString(), Number(r[1]), Number(r[2]), Number(r[3]), Number(r[4]), r[5]];
        const live = start <= now && now <= end;
        console.log(nft.slice(0,10), sd.slice(0,8), 'price', price, 'maxW', maxW, 'start', new Date(start*1000).toISOString(), 'end', new Date(end*1000).toISOString(), 'LIVE', live, 'root', root.slice(0,12), 'supply', sup);
      } else console.log(nft.slice(0,10), sd.slice(0,8), 'NOT-CONFIGURED', 'supply', sup);
    } catch(e) { console.log(nft.slice(0,10), sd.slice(0,8), 'ERR', e.message.slice(0,80)); }
  }
}

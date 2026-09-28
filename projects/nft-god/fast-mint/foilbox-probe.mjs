import { JsonRpcProvider, Contract } from 'ethers';
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const UA = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' };
const p = new JsonRpcProvider(RPC, undefined, { staticNetwork: true });
const SEADROP_ABI = [
  'function getPublicDrop(address nftContract) view returns (uint256,uint256,uint256,uint256,uint16,bool)',
  'function allowListMerkleRoot(address nftContract) view returns (bytes32)',
];
const CANON = '0x00005EA00Ac477B1030CE78506496e8C2dE24bf5';
const FORK  = '0x00005ea00ac477b1030ce78506496e8c2de24bf5';
const contracts = JSON.parse(process.env.CONTRACTS);
const now = Math.floor(Date.now()/1000);
for (const [tag, sd] of [['canon',CANON],['fork',FORK]]) {
  const c = new Contract(sd, SEADROP_ABI, p);
  for (const [name, addr] of contracts) {
    let pub=null, root=null;
    try { pub = await c.getPublicDrop(addr, { blockTag: 'latest' }); } catch(e){ pub = 'ERR:'+String(e.message).slice(0,60); }
    try { root = await c.allowListMerkleRoot(addr, { blockTag: 'latest' }); } catch(e){ root = 'ERR'; }
    if (pub && !String(pub).startsWith('ERR')) {
      const [price,start,end,maxW,feeBps,restrict] = pub.map(x=>x.toString());
      const live = BigInt(start)<=now && now<=BigInt(end);
      console.log(JSON.stringify({tag,name,start:Number(start),end:Number(end),priceWei:price,maxW,live,merkle:root}));
    } else {
      console.log(JSON.stringify({tag,name,probe:String(pub).slice(0,60)}));
    }
  }
}

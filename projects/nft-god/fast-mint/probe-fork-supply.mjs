import { ethers } from 'ethers';
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const FORK = '0x00005ea00ac477b1030ce78506496e8c2de24bf5';
const provider = new ethers.JsonRpcProvider(RPC);
const coder = new ethers.AbiCoder();
const PUB='0xbc6a629c';
for (const [label, nft] of JSON.parse(process.argv[2])) {
  try {
    const raw = await provider.call({ to: FORK, data: PUB + coder.encode(['address'],[nft]).slice(2) });
    const d = coder.decode(['uint256','uint256','uint256','uint256','uint256','uint256'], raw);
    const [price,start,end,maxW] = d.map(x=>x.toString());
    const t = x => new Date(Number(x)*1000).toISOString();
    console.log(`${label} FORK: price=${price} start=${t(start)} end=${t(end)} maxW=${maxW}`);
  } catch(e){ console.log(label,'FORK-ERR',(e.shortMessage||e.message).slice(0,80)); }
  try {
    const nftC = new ethers.Contract(nft, ['function totalSupply() view returns (uint256)','function maxSupply() view returns (uint256)','function name() view returns (string)'], provider);
    const [ts, nm] = await Promise.all([nftC.totalSupply().catch(()=>null), nftC.name().catch(()=>'?')]);
    console.log(`${label} NFT: name=${nm} totalSupply=${ts===null?'n/a':ts.toString()}`);
  } catch(e){ console.log(label,'NFT-ERR',(e.message||'').slice(0,80)); }
}

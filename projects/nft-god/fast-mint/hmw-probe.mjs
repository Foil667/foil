import { ethers } from 'ethers';
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const FORK = '0x00005ea00ac477b1030ce78506496e8c2de24bf5';
const FOIL = '0x6573682faee72a4a96e791ba262439f1df3a268d';
const provider = new ethers.JsonRpcProvider(RPC);
const coder = new ethers.AbiCoder();
const PUB='0xbc6a629c', ROOT='0x32bf11f5', BAL='0x70a08231', TS='0x18160ddd';
const now = Math.floor(Date.now()/1000);
const cands = [
 ["spikesociety","0xd36fdc7e9aa82fc8e038fc06d7ba858a66a4b254"],
 ["robin-owls","0x7bb9a26d5c5cd402bd0758b237cc3b58ac299b32"],
 ["girrafish","0xd67f0e86471863bd05b47c75c4198f9c49edf61d"],
 ["elftown","0x9d3ea059d196586ea6d07b963c84d6f47f29c7de"],
 ["de-labz","0xab7a7c4ec3b358ffdebb4c5890dbee4e135e33cf"],
 ["necromancers","0x98b90c05c37b8f08a08c58edfa0b5460ac28e5f8"],
 ["offthug","0xa7d9dd2b49b53e4f518616cf66914e5d4999bb3d"],
 ["house-craft","0x606cd2a84dd22a127eebabc2d6c53fc4f51c2eb8"],
 ["amor-pedum","0xc2672c5a0c4c8e9916178b560bb7941048e0ef1b"],
];
for (const [label, nft] of cands) {
  try {
    const raw = await provider.call({ to: FORK, data: PUB + coder.encode(['address'],[nft]).slice(2) });
    const d = coder.decode(['uint256','uint256','uint256','uint256','uint256','uint256'], raw);
    const [price, start, end, maxW, feeBps, restrict] = d.map(x=>x.toString());
    const root = await provider.call({ to: FORK, data: ROOT + coder.encode(['address'],[nft]).slice(2) });
    const balr = await provider.call({ to: nft, data: BAL + coder.encode(['address'],[FOIL]).slice(2) }).catch(()=>'ERR');
    const bal = balr==='ERR' ? 'ERR' : BigInt(balr).toString();
    const tsr = await provider.call({ to: nft, data: TS }).catch(()=>'ERR');
    const ts = tsr==='ERR' ? 'ERR' : BigInt(tsr).toString();
    const live = BigInt(start)<=now && now<=BigInt(end);
    console.log(`${label}: price=${price} start=${start} end=${end} maxW=${maxW} feeBps=${feeBps} restrict=${restrict} root=${root} balFoil=${bal} totalSupply=${ts} LIVE=${live}`);
  } catch (e) { console.log(label, 'ERR', (e.shortMessage||e.message||'').slice(0,120)); }
}

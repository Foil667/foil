import { ethers } from 'ethers';
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const provider = new ethers.JsonRpcProvider(RPC);
const nft = '0x6c88081056ffb39e71632e4c16846d240329e283';
const coder = new ethers.AbiCoder();
// common price/fee view selectors
const views = [
  ['mintPrice', '0x463df961'],        // mintPrice()
  ['price', '0xa035b1fe'],            // price()
  ['cost', '0x6c7b3b8a'],             // cost()
  ['mintCost', '0xd0defb06'],         // mintCost()
  ['MINT_PRICE', '0x1b4e3bb6'],       // MINT_PRICE()
  ['salePrice', '0x4b4a4d1f'],        // salePrice()
  ['totalSupply', '0x18160ddd'],
  ['maxSupply', '0xd5abeb01'],
  ['MAX_SUPPLY', '0xd5abeb01'],
];
for (const [name, sel] of views) {
  try {
    const raw = await provider.call({ to: nft, data: sel });
    if (raw && raw !== '0x') {
      const v = coder.decode(['uint256'], raw)[0];
      console.log(name, v.toString());
    } else console.log(name, 'empty');
  } catch (e) { console.log(name, 'ERR', (e.shortMessage||e.message||'').slice(0,60)); }
}

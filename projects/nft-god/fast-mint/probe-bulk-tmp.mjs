// bulk re-probe watched contracts for config flips (canon+fork, 6-word decode)
import { ethers } from 'ethers';
const RPC = 'https://robinhood-rpc.publicnode.com';
const CANON = '0x00005EA00Ac477B1030CE78506496e8C2dE24bf5';
const FORK  = '0x00005ea00ac477b1030ce78506496e8c2de24bf5';
const LIST = {
  'goonz-undead':'0x4bc50a4ca37bddfb43a3b63665c25827c8fef640',
  'chuck':'0xd46041cc4d879856d1522520015e8bbc10371cf7',
  'cube-head':'0xe005a03da7cfa3229ae6d3ad258234bf6fafb770',
  'carv-objects':'0x0414767048aceb515ea9b3cddea0902b457b96ae',
  'catshu':'0xec11dba1656e45beb6a054ea674db591935cab47',
  'harbor-guild':'0x4a141f313e1a6a5e371c7474a1bf39620df4380c',
  'tidewater-relay':'0x610d8817cf2e56df84464f41729e027833447d69',
  'sphericals':'0x22e75409ada54cd6a07bca2d4e21586444943bac',
  'spikesociety':'0xd36fdc7e9aa82fc8e038fc06d7ba858a66a4b254',
  'hoodgo':'0xd2b017c2f2c9e246c1ed6625779e8120d7717c64',
  'nullhood':'0xf62f033569173559322c2d2fce7273a16a4aa1d5',
  'nubs':'0x2889996e86f9b349e4c6857fc6195dcd40c3e310',
};
const pad = (a) => '0x' + a.toLowerCase().replace('0x','').padStart(64,'0');
async function call(method, params) {
  const r = await fetch(RPC, { method:'POST', headers:{'Content-Type':'application/json','User-Agent':'Mozilla/5.0'},
    body: JSON.stringify({jsonrpc:'2.0',id:1,method,params}) });
  const j = await r.json(); if (j.error) throw new Error(j.error.message); return j.result;
}
const now = Math.floor(Date.now()/1000);
for (const [name, nft] of Object.entries(LIST)) {
  const row = { name };
  for (const [sn, sd] of [['C',CANON],['F',FORK]]) {
    try {
      const raw = await call('eth_call', [{to: sd, data: '0xbc6a629c'+pad(nft).slice(2)}, 'latest']);
      const w = ethers.AbiCoder.defaultAbiCoder().decode(['uint256','uint64','uint64','uint64','uint16','bool'], raw);
      const price = w[0].toString(), s = Number(w[1]), e = Number(w[2]);
      row[sn] = `p=${price} ${new Date(s*1000).toISOString().slice(5,16)}->${new Date(e*1000).toISOString().slice(5,16)} maxW=${w[3]}${now>=s&&now<=e?' LIVE':''}`;
    } catch(err) { row[sn] = 'ERR '+err.message.slice(0,40); }
  }
  row.match = row.C === row.F ? '==' : 'DIFF!';
  console.log(JSON.stringify(row));
}

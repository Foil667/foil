// fire-time probe: charles-robinson 0xa62e0d5ea805903494e7ca506f4acb4095e61fc6
import { ethers } from 'ethers';

const RPCS = [
  'https://robinhood-rpc.publicnode.com',
  'https://rpc.mainnet.chain.robinhood.com',
  'https://rpc.nodeflare.app/robinhood/public',
];
const CANON = '0x00005EA00Ac477B1030CE78506496e8C2dE24bf5';
const FORK  = '0x00005ea00ac477b1030ce78506496e8c2de24bf5';
const NFT   = '0xa62e0d5ea805903494e7ca506f4acb4095e61fc6';
const FOIL  = '0x6573682faee72a4a96e791ba262439f1df3a268d';
const pad = (a) => '0x' + a.toLowerCase().replace('0x','').padStart(64,'0');

async function rpcCall(rpc, method, params) {
  const r = await fetch(rpc, { method:'POST', headers:{'Content-Type':'application/json','User-Agent':'Mozilla/5.0'},
    body: JSON.stringify({jsonrpc:'2.0',id:1,method,params}) });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j.result;
}

const results = {};
for (const rpc of RPCS) {
  try {
    const p = new ethers.JsonRpcProvider(rpc);
    const block = await p.getBlockNumber();
    const out = { rpc, block, ok: true };
    for (const [name, sd] of [['canon',CANON],['fork',FORK]]) {
      try {
        const raw = await rpcCall(rpc, 'eth_call', [{to: sd, data: '0xbc6a629c'+pad(NFT).slice(2)}, 'latest']);
        const w = ethers.AbiCoder.defaultAbiCoder().decode(
          ['uint256','uint64','uint64','uint64','uint16','bool'], raw);
        out[name] = { price: w[0].toString(), start: Number(w[1]), end: Number(w[2]),
          maxW: Number(w[3]), feeBps: Number(w[4]), restrict: w[5],
          startISO: new Date(Number(w[1])*1000).toISOString(), endISO: new Date(Number(w[2])*1000).toISOString(),
          live: Math.floor(Date.now()/1000) >= Number(w[1]) && Math.floor(Date.now()/1000) <= Number(w[2]) };
      } catch(e) { out[name] = { error: e.message.slice(0,120) }; }
    }
    try { out.totalSupply = Number(await rpcCall(rpc,'eth_call',[{to:NFT,data:'0x18160ddd'},'latest'])); } catch(e){ out.totalSupply='err'; }
    try { out.foilBal = Number(await rpcCall(rpc,'eth_call',[{to:NFT,data:'0x70a08231'+pad(FOIL).slice(2)},'latest'])); } catch(e){ out.foilBal='err'; }
    try {
      out.nonce = Number(await rpcCall(rpc,'eth_call',[{to:'0x0000000000000000000000000000000000000000',data:'0x'},'latest'])) ; // placeholder
    } catch(e){}
    try { out.nonce = Number(await rpcCall(rpc,'eth_getTransactionCount',[FOIL,'latest'])); out.pending = Number(await rpcCall(rpc,'eth_getTransactionCount',[FOIL,'pending'])); } catch(e){ out.nonce='err'; }
    // rail check: latest Transfer on NFT -> tx.to
    try {
      const logs = await rpcCall(rpc,'eth_getLogs',[{address:NFT, topics:['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'], fromBlock:'0x'+(block-2000).toString(16), toBlock:'latest'}]);
      if (logs && logs.length) {
        const tx = await rpcCall(rpc,'eth_getTransactionByHash',[logs[logs.length-1].transactionHash]);
        out.railTo = tx ? tx.to : null; out.mintTxs = logs.length;
      } else out.railTo = 'no-transfer-logs-2k';
    } catch(e){ out.railTo = 'err:'+e.message.slice(0,80); }
    results.rpc = out; break;
  } catch(e) { console.error(rpc, 'FAILED', e.message.slice(0,100)); }
}
console.log(JSON.stringify(results, null, 1));

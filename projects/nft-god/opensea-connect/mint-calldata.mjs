// Read-only: request OpenSea's MINT calldata for a drop stage. Returns the
// ready-to-sign transaction (to/data/value) with OpenSea's minter-bound
// signature baked in. NOTHING is signed or broadcast here.
import { readFileSync } from 'fs';

const FOIL = '0x6573682faee72a4a96e791ba262439f1df3a268d';
const SLUG = process.argv[2] || 'broostersnft';
const CA = (process.argv[3] || '0xad56e25c6267e48bc5da326c1b2b7133107b6e4b');
const CHAIN = 'robinhood';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const MINT_ACTION_QUERY = `
query MintActionTimelineQuery(
  $address: Address!
  $fromAssets: [AssetQuantityInput!]!
  $toAssets: [AssetQuantityInput!]!
  $recipient: Address
) {
  swap(
    address: $address
    fromAssets: $fromAssets
    toAssets: $toAssets
    recipient: $recipient
    action: MINT
  ) {
    actions {
      __typename
      ... on TransactionAction {
        transactionSubmissionData { to data value chain { networkId identifier } }
      }
    }
    errors { __typename }
  }
}`;

const sess = JSON.parse(readFileSync(`${process.env.HOME}/workspace/goals/robinhood-chain-free-mint-watch/hidden_files/os-session.json`, 'utf8'));
if (!sess.authed) throw new Error('no authed session; run os-siwe-login.mjs first');
const cookieHeader = Object.entries(sess.cookies).map(([k, v]) => `${k}=${v}`).join('; ');

const res = await fetch('https://gql.opensea.io/graphql', {
  method: 'POST',
  headers: {
    'User-Agent': UA,
    'Origin': 'https://opensea.io',
    'Referer': `https://opensea.io/collection/${SLUG}/overview`,
    'x-app-id': 'os2-web',
    'Content-Type': 'application/json',
    'Cookie': cookieHeader,
  },
  body: JSON.stringify({
    query: MINT_ACTION_QUERY,
    variables: {
      address: FOIL,
      fromAssets: [{ asset: { contractAddress: '0x0000000000000000000000000000000000000000', chain: CHAIN } }],
      toAssets: [{ asset: { contractAddress: CA, chain: CHAIN, tokenId: '0' }, quantity: '1' }],
      recipient: null,
    },
  }),
});
const j = await res.json();
const swap = j.data && j.data.swap;
if (!swap) { console.log('NO_SWAP', JSON.stringify(j).slice(0, 400)); process.exit(2); }
console.log('errors:', JSON.stringify(swap.errors || []));
for (const a of (swap.actions || [])) {
  if (a.__typename !== 'TransactionAction') { console.log('action:', a.__typename); continue; }
  const t = a.transactionSubmissionData;
  console.log('to:', t.to);
  console.log('value:', t.value);
  console.log('chain:', t.chain && t.chain.identifier, t.chain && t.chain.networkId);
  console.log('data head:', (t.data || '').slice(0, 66));
  console.log('data len:', (t.data || '').length);
  const sel = (t.data || '').slice(0, 10);
  console.log('selector:', sel, sel === '0x161ac21f' ? 'PUBLIC_SALE' : sel === '0x4b61cd6f' ? 'SIGNED_PRESALE' : sel === '0x4300a4e6' ? 'MERKLE_PRESALE' : 'OTHER');
}

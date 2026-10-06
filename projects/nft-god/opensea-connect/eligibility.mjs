// Read-only: OpenSea drop eligibility for Foil's wallet, using the SIWE session
// saved by os-siwe-login.mjs. No signing, no transactions.
import { readFileSync } from 'fs';

const FOIL = '0x6573682faee72a4a96e791ba262439f1df3a268d';
const SLUG = process.argv[2] || 'bro';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const ELIGIBILITY_QUERY = `
query DropEligibilityQuery($collectionSlug: String!, $address: Address!) {
  dropBySlug(slug: $collectionSlug) {
    __typename
    ... on Erc721SeaDropV1 { minterQuantityMinted(minter: $address) }
    accountStageEligibility {
      wallets {
        address
        quantityMinted
        stages {
          dropStageUuid
          isEligible
          maxTotalMintableByWallet
          price { token { unit symbol contractAddress chain { identifier } } }
        }
      }
    }
    stages {
      __typename
      uuid
      stageType
      stageIndex
      isEligible
      eligibleMinterAddress
      maxTotalMintableByWallet
      eligibleMaxTotalMintableByWallet
      eligiblePrice { token { unit symbol contractAddress chain { identifier } } }
    }
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
    query: ELIGIBILITY_QUERY,
    variables: { collectionSlug: SLUG, address: FOIL },
  }),
});
const j = await res.json();
if (j.errors) console.log('gql errors:', JSON.stringify(j.errors).slice(0, 400));
const d = j.data && j.data.dropBySlug;
if (!d) { console.log('NO_DROP', JSON.stringify(j).slice(0, 300)); process.exit(2); }
console.log('drop type:', d.__typename, '| minted by foil:', d.minterQuantityMinted);
for (const s of (d.stages || [])) {
  console.log(JSON.stringify({
    type: s.stageType, idx: s.stageIndex, uuid: (s.uuid || '').slice(0, 8),
    isEligible: s.isEligible, eligibleMinter: s.eligibleMinterAddress,
    maxPerWallet: s.maxTotalMintableByWallet, eligibleMax: s.eligibleMaxTotalMintableByWallet,
    priceToken: s.eligiblePrice && s.eligiblePrice.token && s.eligiblePrice.token.symbol,
  }));
}
const acct = d.accountStageEligibility && d.accountStageEligibility.wallets;
if (acct) for (const w of acct) {
  console.log('wallet', w.address, 'minted', w.quantityMinted);
  for (const st of (w.stages || [])) console.log('  stage', (st.dropStageUuid || '').slice(0, 8), 'eligible=', st.isEligible, 'max=', st.maxTotalMintableByWallet);
}

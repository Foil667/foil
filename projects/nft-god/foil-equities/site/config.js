/* config.js — deployed-contracts config stub for the Foil Equities site.
 *
 * THE DEPLOY STEP fills this in: set `deployed: true` and paste the real
 * per-chain contract addresses from docs/DEPLOYMENT-PLAN.md. Until then the
 * stock-pot dashboard renders its honest placeholder (dashes + "not
 * deployed yet") and makes ZERO chain calls.
 *
 * Read-only by design: pot.js only ever issues eth_call / eth_getLogs /
 * eth_blockNumber / eth_chainId. No wallet connection, no signing, no writes.
 */
(function () {
  'use strict';

  window.FoilConfig = {
    // Flip to true + fill `contracts` after the audited deploy.
    deployed: false,

    chain: {
      id: 8453, // Base
      name: 'Base',
      // read-only public RPCs (first answer wins), same rotation as burn.js
      rpcs: [
        'https://mainnet.base.org',
        'https://base.llamarpc.com',
        'https://base-rpc.publicnode.com'
      ]
    },

    contracts: {
      stockPot: null,      // StockPot.sol
      activation: null,    // Activation.sol (activatedCount view)
      foilEquities: null,  // FoilEquities.sol (totalMinted view)
      // native USDC on Base (verified 2026-09-20 via Circle docs)
      usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
    },

    // First block to scan for Distributed events once deployed.
    // Set to the StockPot deployment block at deploy time.
    potDeployBlock: null
  };
})();

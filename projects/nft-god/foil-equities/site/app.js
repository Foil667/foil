/* app.js — Foil Equities mint-site UI glue (scaffold).
 * The mint button is intentionally DISABLED: contracts are unaudited drafts
 * and nothing is deployed. Wiring happens only after an explicit user
 * go-ahead + professional audit. This file only renders sprites and guards
 * the disabled state with an explanatory note.
 */
(function () {
  'use strict';

  function init() {
    // hero sprite strip + trait cards
    var hero = document.getElementById('hero-sprites');
    if (hero && window.FoilSprites) {
      window.FoilSprites.list.forEach(function (key) {
        var cv = document.createElement('canvas');
        cv.title = key;
        window.FoilSprites.renderSprite(cv, key, 6);
        hero.appendChild(cv);
      });
      window.FoilSprites.renderAll('#trait-grid', 10);
    }

    // mint button: dead by design. Clicking explains why.
    var btn = document.getElementById('mint-btn');
    var note = document.getElementById('mint-note');
    if (btn) {
      btn.addEventListener('click', function () {
        if (note) {
          note.innerHTML =
            '⛔ <b>Still disabled.</b> Minting goes live only after: ' +
            '(1) professional audit of all 6 contracts, (2) timelock + multisig on ' +
            'owner functions, (3) the user\u2019s explicit per-action deployment approval. ' +
            'No wallet will ever be asked to connect before then.';
          note.style.color = '#ffd60a';
        }
      });
    }

    // stock-pot placeholder numbers stay dashes until deployment.
    // (Post-deploy: point these at the StockPot contract via eth_call.)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

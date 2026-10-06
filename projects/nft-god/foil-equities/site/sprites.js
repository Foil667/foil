/* sprites.js — 16x16 pixel-art archetype sprites for MARKET FOLKLORE.
 * Hand-authored chunky pixel maps. Rendered to <canvas> with
 * image-rendering: pixelated. Funny, never vanilla. */
(function () {
  'use strict';

  const PALETTE = {
    K: '#0b0b10', // outline black
    W: '#f2f2f2', // white
    S: '#e8b88a', // skin
    B: '#3a7bd5', // whale blue
    C: '#7df9ff', // diamond cyan
    Y: '#ffd60a', // gold
    P: '#9b5de5', // oracle purple
    N: '#8b5a2b', // brown
    R: '#e5484d', // red
  };

  const SPRITES = {
    whale: {
      name: 'The Whale',
      blurb: 'Moves first. Explains never. Spotted by the splash, never by the wallet.',
      map: [
        '................',
        '.....KKKK.......',
        '.....KYYK.......',
        '.....KYYK.......',
        '....KKKKKK......',
        '...KBBBBBBBK....',
        '..KBBBBBBBBBK...',
        '.KBBBBBBBBBBBK..',
        '.KBBKBBBBBKBBK..',
        '.KBBKBBBBBKBBK..',
        '.KBBBBBBBBBBBK..',
        '..KBBBBBBBBBK...',
        '...KKBBBBBKK....',
        '.....KBBBK......',
        '.....KCCCK......',
        '................',
      ],
    },
    bagholder: {
      name: 'The Bagholder',
      blurb: 'Bought the top. Decorated the basement. The bags are load-bearing now.',
      map: [
        '................',
        '.....KKKKK......',
        '....KSSSSSK.....',
        '....KSRKSRK.....',
        '....KSSSSSK.....',
        '.....KKKKK......',
        '....KKKKKKK.....',
        '..KKSSSKSSSKK...',
        '.KSSKBBBBBKSSK..',
        '.KSK.BBBBK.KSK..',
        '.KK..BBBBB..KK..',
        '.....BBBBB......',
        '....BBBBBBB.....',
        '....BBKBBK......',
        '....BBBBBBB.....',
        '.....KKKKK......',
      ],
    },
    diamond: {
      name: 'Diamond Hands',
      blurb: 'Hands literally diamonds. Cannot sell. Physically impossible. Tried.',
      map: [
        '................',
        '..CCK...KCC.....',
        '.CCCCK.KCCCC....',
        '.CCCCCKCCCCC....',
        '..CCCCCCCCC.....',
        '...CCCCCCC......',
        '....KKKKK.......',
        '...KSSSSSK......',
        '...KSSKSSK......',
        '...KSSSSSK......',
        '....KKKKK.......',
        '...KPPPPPK......',
        '..KPPPPPPPK.....',
        '..KPPKPPKPK.....',
        '..KPPPPPPPK.....',
        '...KKKKKKK......',
      ],
    },
    oracle: {
      name: 'The Oracle',
      blurb: 'Called it. Will remind you. Charges per prophecy, non-refundable.',
      map: [
        '................',
        '.....KKKK.......',
        '....KPPPPK......',
        '...KPPPPPPK.....',
        '...KPKPPKPK.....',
        '...KPPPPPPK.....',
        '....KPPPPK......',
        '.....KCCK.......',
        '....KCCCCK......',
        '....KCWCCK......',
        '....KCCCCK......',
        '.....KCCK.......',
        '...KPPPPPPK.....',
        '..KPPPPPPPPK....',
        '..KPPPPPPPPK....',
        '...KKKKKKKK.....',
      ],
    },
    paper: {
      name: 'Paper Hands',
      blurb: 'Folded at -2%. Framed the screenshot. Tells the story at parties.',
      map: [
        '................',
        '..WWK...KWW.....',
        '.WWWWK.KWWWW....',
        '.WWWWWKWWWWW....',
        '..WWWWWWWWW.....',
        '...WWWWWWW......',
        '....KKKKK.......',
        '...KSSSSSK......',
        '...KSKSKSK......',
        '...KSSSSSK......',
        '....KRRRK.......',
        '...KNNNNNK......',
        '..KNNNNNNNK.....',
        '..KNNKNNKNK.....',
        '..KNNNNNNNK.....',
        '...KKKKKKK......',
      ],
    },
    insider: {
      name: 'The Insider',
      blurb: 'Knew before you. Knew before everyone. Says nothing. Smirks plenty.',
      map: [
        '................',
        '...KKKKKKKK.....',
        '..KNNNNNNNNK....',
        '..KNNNNNNNNK....',
        '...KKKKKKKK.....',
        '....KSSSSK......',
        '....KSKSKS......',
        '....KSSKSK......',
        '...KKNNNNKK.....',
        '..KNNNNNNNNK....',
        '..KNNKNNKNNK....',
        '..KNNNNNNNNK....',
        '..KNNNNNNNNK....',
        '.KKKKK..KKKKK...',
        '.KNYNK..KNYNK...',
        '.KKKKK..KKKKK...',
      ],
    },
  };

  function renderSprite(canvas, key, scale) {
    const sprite = SPRITES[key];
    const ctx = canvas.getContext('2d');
    const rows = sprite.map.length;
    const cols = sprite.map[0].length;
    canvas.width = cols;
    canvas.height = rows;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const ch = sprite.map[y][x];
        if (ch === '.') continue;
        ctx.fillStyle = PALETTE[ch] || '#ff00ff';
        ctx.fillRect(x, y, 1, 1);
      }
    }
    canvas.style.width = cols * (scale || 8) + 'px';
    canvas.style.height = rows * (scale || 8) + 'px';
  }

  function renderAll(rootSelector, scale) {
    const root = document.querySelector(rootSelector);
    if (!root) return;
    Object.keys(SPRITES).forEach((key) => {
      const card = document.createElement('div');
      card.className = 'trait-card';
      const cv = document.createElement('canvas');
      cv.className = 'sprite';
      renderSprite(cv, key, scale);
      const name = document.createElement('h3');
      name.textContent = SPRITES[key].name;
      const blurb = document.createElement('p');
      blurb.textContent = SPRITES[key].blurb;
      card.appendChild(cv);
      card.appendChild(name);
      card.appendChild(blurb);
      root.appendChild(card);
    });
  }

  window.FoilSprites = { renderSprite, renderAll, list: Object.keys(SPRITES) };
})();

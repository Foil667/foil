# Foil NFT Set — `nft-set/`

Preparation pipeline for Foil's genesis NFT set on **Robinhood Chain**
(chain 4663). Nothing here is deployed; nothing here spends money.

## Layout

```
nft-set/
├── CONCEPT.md                 # set concept: name, supply, theme, economics, phases
├── DEPLOY-PLAN.md             # approval -> verified contract, real gas numbers
├── README.md                  # this file
├── contracts/
│   └── FoilSet.sol            # ERC-721, 721A-style batch minting, ERC-2981, no backdoors
├── scripts/
│   ├── deploy.mjs             # --dry (default): plan + gas estimate, no wallet
│   │                          # --live: gated behind FOIL_DEPLOY_APPROVED=1
│   └── metadata-compiler.mjs  # art/ + traits/ -> metadata/ + provenance root
├── art/                       # EMPTY — image gen is down; spec in ART-README.md
├── traits/                    # traits.json (tokenId -> attributes) + format doc
└── metadata/                  # generated JSONs (gitignored) + committed SAMPLE
```

## Quick start (all free, no wallet)

```bash
cd ~/workspace/nft-god/nft-set
npm install                      # solc for compilation

# 1. See the whole deployment plan + live gas estimate (default = --dry)
node scripts/deploy.mjs

# 2. Compile metadata (needs art/ + traits/traits.json;
#    use --sample to test the pipeline while art is pending)
node scripts/metadata-compiler.mjs --sample

# 3. When everything is green AND the user approves:
#    export FOIL_DEPLOY_APPROVED=1
#    export FOIL_DEPLOY_KEY_PATH=/path/outside/repo/key.json
#    node scripts/deploy.mjs --live
```

## Current status

| Item | State |
|---|---|
| Contract | Written, compiles clean (solc 0.8.24, 0 warnings), 10,877-byte init code |
| Deploy script | `--dry` tested against live RPC; `--live` refusal gate tested |
| Metadata pipeline | Tested with `--sample`; provenance root works |
| Art | **Blocked** — image generation down (expired credential); spec locked in `art/ART-README.md` |
| SeaDrop on 4663 | Verified deployed at `0x00005EA00Ac477B1030CE78506496e8C2dE24bf5`; direct mint chosen (see DEPLOY-PLAN.md §4) |
| Deploy cost | ≈ **$0.26** measured (2,350,068 gas @ 0.042 gwei, ETH $2,675) |

## Rules

- **DO NOT DEPLOY** without the user's explicit approval (`FOIL_DEPLOY_APPROVED=1`).
- No private keys in this repo — ever. `--live` refuses keyfiles inside the repo.
- No paid services. Everything here runs free.
- Contract is **unaudited** — see the security notes in `contracts/FoilSet.sol`.

# NFT Standards & Mint Mechanics — Technical Reference

Researched 2026-09-24. Selectors were computed from canonical ABI signatures (keccak256) and cross-checked against verified contract source. Struct layouts were read directly from source. Items that could not be verified are marked **UNVERIFIED**.

---

## 1. Token Standards

### 1.1 ERC-721 — the base NFT standard (EIP-721, Final)
Single token per tokenId. Core interface: `balanceOf`, `ownerOf`, `safeTransferFrom`, `transferFrom`, `approve`, `setApprovalForAll`, `getApproved`, `isApprovedForAll` ([EIP-721](https://eips.ethereum.org/EIPS/eip-721)). ERC-165 id `0x80ac58cd`; metadata extension (`name`, `symbol`, `tokenURI`) `0x5b5e139f`; enumerable extension `0x780e9d63`. Safe transfers call `onERC721Received` on the recipient contract to prevent locked tokens. Has no native royalty hook — that gap is why EIP-2981 (info-only) and ERC-721C (enforced) exist.

### 1.2 ERC-1155 — multi-token standard (EIP-1155, Final)
One contract manages many token ids, each fungible or non-fungible as implemented ("semi-fungible"). Core: `balanceOf`, `balanceOfBatch`, `safeTransferFrom`, `safeBatchTransferFrom`, approvals — ERC-165 id **`0xd9b67a26`** (verified by selector-XOR against [EIP-1155](https://eips.ethereum.org/EIPS/eip-1155)). Batch ops cut per-item overhead; ideal for game items, editions, loot. Recipient contracts implement `IERC1155Receiver` (`0x4e2312e0`). Metadata via `{id}`-templated `uri()`.

### 1.3 ERC-721A — batch-mint gas optimization (Azuki/Chiru Labs, unofficial)
Same ERC-721 interface, different storage layout. Assumes sequential tokenIds from a counter. Instead of writing an owner per token, it writes the owner **once per batch**; `ownershipOf(tokenId)` scans backwards from the tokenId until it finds the head of a batch with an owner set ([Azuki ERC721A](https://github.com/chiru-labs/ERC721A)). Azuki's measured numbers: 1 mint = 154,814 gas (721) → 76,690 (721A); 5 mints = 616,914 → **85,206** (~7.2x saving) ([dev.to/Chiru Labs figures](https://DEV.to/zororaka/why-erc-721a-is-more-cost-efficient-than-erc-721-for-batch-minting-4j8b)). Trade-off: first transfers of lazy-owned tokens pay extra to fill in ownership slots. Uses ERC-2309 `ConsecutiveTransfer` for cheap batch-mint events ([EIP-2309](https://eips.ethereum.org/EIPS/eip-2309)).

### 1.4 ERC-721C — programmable royalties (Limit Break, unofficial)
Goal: make royalties enforceable on-chain rather than honor-system (EIP-2981). Mechanism, verified from [creator-token-standards/src/erc721c/ERC721C.sol](https://github.com/limitbreakinc/creator-token-standards/tree/main/src/erc721c):
- Token contract hooks `_beforeTokenTransfer` / `_afterTokenTransfer` and delegates each transfer to an **external transfer-validator registry** (`CreatorTokenTransferValidator`) selected per collection via `setTransferValidator`.
- The validator checks the transfer's **operator** (marketplace contract) against per-collection allowlists/blocklists; non-compliant (zero-royalty) marketplaces are blocked at transfer time.
- Creator sets royalty terms via `setDefaultRoyalty` / per-token overrides; sales must route through Limit Break's **Payment Processor** (a marketplace protocol with native EIP-2981 support) or other validator-compatible venues.
- OpenSea added ERC-721C support in 2025 via Seaport v1.6 "Seaport Hooks" ([nftplazas](https://nftplazas.com/opensea-erc-721c-standard/)); variant **ERC-1155-C** exists. Superseded OpenSea's deprecated Operator Filter (shut down 2024-02-29). Exact security-level enum values **UNVERIFIED** from the search; mechanism above verified from source.

### 1.5 ERC-6551 — token-bound accounts (Final ERC)
Every NFT can own a smart-contract wallet. Verified from [ERCS/erc-6551](https://github.com/ethereum/ercs/blob/HEAD/ERCS/erc-6551.md) and the [erc6551 reference implementation](https://github.com/erc6551/reference):
- **Registry** (permissionless, immutable, same address on all EVM chains): `0x000000006551c19487814612e58FE06813775758` (deployed via Nick's factory `0x4e59b44847b379578588920cA78FbF26c0B4956C`).
- `createAccount(address implementation, bytes32 salt, uint256 chainId, address tokenContract, uint256 tokenId)` → selector **`0x8a54c52f`**; `account(...)` (view, deterministic address lookup) → **`0x246a0021`**. Accounts deploy via CREATE2; `account()` works counterfactually (address usable before deployment).
- Account interface (`IERC6551Account`), ERC-165 id **`0x6faff5f1`** (verified in reference source): `token()` → `(uint256 chainId, address tokenContract, uint256 tokenId)`; `state()` (anti-replay counter); `isValidSigner(address,bytes)` returning magic `0x523e3260`.
- Execution (`IERC6551Executable`), ERC-165 id **`0x51945447`** (verified in reference source): `execute(address to, uint256 value, bytes data, uint8 operation)` with operation 0=CALL, 1=DELEGATECALL, 2=CREATE, 3=CREATE2. Only valid signers (by default, the NFT owner) can execute. Emits `ERC6551AccountCreated(account, indexed implementation, salt, chainId, indexed tokenContract, indexed tokenId)`.
- Economics: NFT sale transfers the whole account and its assets automatically; TBA can hold ETH/ERC-20s/NFTs, interact with dapps, and sign via ERC-1271.

### 1.6 ERC-4907 — rentable NFTs (Final ERC)
Adds a **`user`** role distinct from `owner`, auto-expiring by timestamp. Interface, ERC-165 id **`0xad092b5c`** (verified by selector-XOR; interface below from [EIP-4907](https://eips.ethereum.org/EIPS/eip-4907)):
```solidity
function setUser(uint256 tokenId, address user, uint64 expires) external;
function userOf(uint256 tokenId) external view returns (address);
function userExpires(uint256 tokenId) external view returns (uint256);
event UpdateUser(uint256 indexed tokenId, address indexed user, uint64 expires);
```
`userOf` returns `address(0)` when no user or `expires` passed — no manual revocation needed. Only the owner/approved can `setUser`. The **user cannot transfer** the NFT; rental wrappers typically escrow the NFT and collect rent off the `expires` schedule. OpenZeppelin does not ship an ERC-4907 implementation (as of the latest checks).

### 1.7 Soulbound — non-transferable tokens
Canonical minimal interface is **ERC-5192** (Final): `locked(uint256 tokenId) external view returns (bool)` (selector `0xb45a3c0e`, ERC-165 id); events `Locked(uint256 tokenId)` / `Unlocked(uint256 tokenId)`. When `locked()` is true, **all ERC-721 transfer functions must revert** ([EIP-5192](https://eips.ethereum.org/EIPS/eip-5192)). Use cases: POAPs, credentials, identity badges, voting weight. Caveat: true "soulbinding" is wallet-level, not contract-level — a user can sell the whole wallet/key, so it's a commitment device, not cryptographic identity.

### 1.8 DN404 — divisible NFT hybrid (Vectorized, experimental, unofficial)
Response to ERC-404's inefficiencies (single-contract hybrid, ~125k gas per simple transfer, edge-case breakage — [Three Sigma analysis](https://threesigma.xyz/blog/solidity/erc404-experimental-semi-fungible-standard)). DN404's design, verified from [Vectorized/dn404](https://github.com/Vectorized/dn404):
- **Two contracts**: a fully-compliant **ERC-20 base** (`DN404`) + a **mirror ERC-721** (`DN404Mirror`). All trading happens on the base; the base mints/burns mirror NFTs as balances cross the whole-unit threshold (`_unit()` = one NFT's worth of base units — default denominator **UNVERIFIED**; commonly 10^18 with 18 decimals).
- Mirror is a thin view layer: `ownerOf`, `balanceOf`, etc. read from base; NFT transfers on the mirror are executed via the base's transfer logic.
- `_skipNFT(address)` lets a holder opt out of NFT mirroring (pure fungible mode); burned NFT ids recycle through a "burned pool" queue.
- Claimed ~20% lower gas impact than ERC-404 ([Coinspeaker](https://www.coinspeaker.com/divisible-nft-dn404-erc-404/)); code was initially unaudited — experimental. Native fractionalization without intermediaries; both sides fully composable with DEXs and NFT marketplaces.

### 1.9 Compressed NFTs
- **Solana cNFTs (Metaplex Bubblegum)**: NFT state stored as a **leaf in an on-chain Merkle tree**; only the 32-byte root lives on-chain, metadata on Arweave/IPFS. Leaf schema v2 = hash of `(id, owner, delegate, nonce, data_hash, creator_hash, collection_hash, asset_data_hash, flags)`. Transfers verify a Merkle proof supplied by an off-chain **indexer**; concurrent Merkle trees allow parallel updates. Bubblegum program `BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY`. Cost: ~1M cNFTs ≈ 5 SOL vs ~12,000 SOL uncompressed (~99.9% cheaper; 10k cNFTs ≈ 3.5 SOL) ([Alchemy overview](https://www.alchemy.com/overviews/compressed-nfts), [Metaplex dev hub](https://github.com/metaplex-foundation/developer-hub/blob/HEAD/src/pages/en/smart-contracts/bubblegum-v2/index.md)). cNFTs can be **decompressed** into standard NFTs for marketplace/program composability.
- **EVM equivalents**: no canonical equivalent exists (**UNVERIFIED** as a standard). Closest patterns: ERC-3668/CCIP-Read offchain lookups (off-chain data + on-chain verification), Merkle-root commitments for allowlists/claims, and ERC-721A/2309 batch patterns. Nothing on EVM matches cNFT cost scaling because EVM calldata/state pricing differs fundamentally from Solana's rent model.

---

## 2. Mint Mechanics

### 2.1 SeaDrop — OpenSea's drops minter
Primary-drop contract by ProjectOpenSea supporting public drops, merkle allowlists, token-gated stages, and server-signed mints. Verified against [github.com/ProjectOpenSea/seadrop](https://github.com/ProjectOpenSea/seadrop) (Solidity 0.8.17, MIT).

**Deployment**: `0x00005EA00Ac477B1030CE78506496e8C2dE24bf5` — **same address on all chains** (CREATE2 via Nick's factory). SeaDrop 1.0 deployed on Ethereum, Polygon, Arbitrum, Optimism, Base, BSC, Avalanche, Gnosis, Zora, Klaytn ([README Deployments](https://github.com/ProjectOpenSea/seadrop#deployments)).

**Architecture**: the NFT contract grants SeaDrop mint rights (`allowedSeaDrop` constructor arg on `ERC721SeaDrop`); creators configure stages by calling SeaDrop admin functions **from the NFT contract** (SeaDrop assumes `msg.sender` is a conforming `INonFungibleSeaDropToken`). Minters call SeaDrop directly; SeaDrop calls back `mintSeaDrop(minter, quantity)` on the NFT contract.

**Structs** (exact layouts from `src/lib/SeaDropStructs.sol`):

```solidity
struct PublicDrop {          // packed into ONE storage slot
    uint80  mintPrice;       //  80/256
    uint48  startTime;       // 128/256
    uint48  endTime;         // 176/256
    uint16  maxTotalMintableByWallet; // 224/256
    uint16  feeBps;          // 240/256
    bool    restrictFeeRecipients;    // 248/256
}
struct AllowListData {
    bytes32  merkleRoot;
    string[] publicKeyURIs;  // for encrypted allowlists
    string   allowListURI;
}
struct MintParams {          // used for allowlist + signed mints (all uint256)
    uint256 mintPrice;
    uint256 maxTotalMintableByWallet;
    uint256 startTime;
    uint256 endTime;
    uint256 dropStageIndex;  // non-zero for non-public stages
    uint256 maxTokenSupplyForStage;
    uint256 feeBps;
    bool    restrictFeeRecipients;
}
struct TokenGatedDropStage { // packed into ONE storage slot
    uint80  mintPrice;       //  80/256
    uint16  maxTotalMintableByWallet; // 96/256
    uint48  startTime;       // 144/256
    uint48  endTime;         // 192/256
    uint8   dropStageIndex;  // non-zero, 200/256
    uint32  maxTokenSupplyForStage;   // 232/256
    uint16  feeBps;          // 248/256
    bool    restrictFeeRecipients;    // 256/256
}
struct TokenGatedMintParams {
    address   allowedNftToken;
    uint256[] allowedNftTokenIds;
}
struct SignedMintValidationParams {  // caps on what a signer may authorize
    uint80 minMintPrice;             //  80/256
    uint24 maxMaxTotalMintableByWallet; // 104/256
    uint40 minStartTime;             // 144/256
    uint40 maxEndTime;               // 184/256
    uint40 maxMaxTokenSupplyForStage;  // 224/256
    uint16 minFeeBps;                // 240/256
    uint16 maxFeeBps;                // 256/256
}
```

**Function selectors** (computed from canonical signatures in `src/interfaces/ISeaDrop.sol`):
| Function | Canonical signature | Selector |
|---|---|---|
| `mintPublic` | `mintPublic(address,address,address,uint256)` | `0x161ac21f` |
| `mintAllowList` | `mintAllowList(address,address,address,uint256,(uint256,uint256,uint256,uint256,uint256,uint256,uint256,bool),bytes32[])` | `0x4300a4e6` |
| `mintSigned` | `mintSigned(address,address,address,uint256,(uint256,uint256,uint256,uint256,uint256,uint256,uint256,bool),uint256,bytes)` | `0x4b61cd6f` |
| `mintAllowedTokenHolder` | `mintAllowedTokenHolder(address,address,address,(address,uint256[]))` | `0x99eb900f` |
| `updatePublicDrop` | `updatePublicDrop((uint80,uint48,uint48,uint16,uint16,bool))` | `0x01308e65` |
| `updateAllowList` | `updateAllowList((bytes32,string[],string))` | `0xebb4a55f` |
| `updateTokenGatedDrop` | `updateTokenGatedDrop(address,(uint80,uint16,uint48,uint48,uint8,uint32,uint16,bool))` | `0xfd9ab22a` |
| `updateSignedMintValidationParams` | `updateSignedMintValidationParams(address,(uint80,uint24,uint40,uint40,uint40,uint16,uint16))` | `0x4d380178` |
| `updateCreatorPayoutAddress` | `updateCreatorPayoutAddress(address)` | `0x12738db8` |
| `updateAllowedFeeRecipient` | `updateAllowedFeeRecipient(address,bool)` | `0x8e7d1e43` |
| `updatePayer` | `updatePayer(address,bool)` | `0x7f2a5cca` |

Common args on all mint fns: `(nftContract, feeRecipient, minterIfNotPayer, quantity)` — the payer (`msg.sender`) may differ from the recipient (gas sponsorship). `feeRecipient` may be `address(0)`; `restrictFeeRecipients` toggles whether any address is accepted.

**Payment flow** (verified in `src/SeaDrop.sol`):
- `_checkCorrectPayment`: reverts `IncorrectPayment` unless `msg.value == quantity * mintPrice`. Free mints (`mintPrice == 0`) skip payment entirely.
- `_splitPayout`: `feeAmount = msg.value * feeBps / 10_000` → `feeRecipient`; remainder → `creatorPayoutAddress` (rounds down in creator's favor). `feeBps == 0` → 100% to creator. `feeBps > 10_000` reverts.
- Every mint emits `SeaDropMint(indexed nftContract, indexed minter, indexed feeRecipient, payer, quantityMinted, unitMintPrice, feeBps, dropStageIndex)` — public mints use `dropStageIndex = 0`.
- Token-gated mints burn one-time redemption: each `(allowedNftToken, tokenId)` can be redeemed once (tracked in `_tokenGatedRedeemed`).

### 2.2 Merkle-proof allowlists
Standard pattern: project builds a Merkle tree of eligible addresses (or richer leaves), publishes only the root on-chain, and gives each minter an off-chain proof. On-chain: `MerkleProof.verify(proof, root, leaf)`. **SeaDrop-specific**: leaf = `keccak256(abi.encode(minter, mintParams))` (verified at `SeaDrop.sol` line ~301) — per-address terms (price, per-wallet cap, time window, stage supply) are baked into the leaf, so one root can encode heterogeneous allowlist tiers. Note: `feeBps` is encoded in the leaf, so backends must sanity-check it before issuing proofs. Gas is O(log n) regardless of list size vs. O(n) storage for on-chain mappings.

### 2.3 Signature-gated mints (ECDSA)
Backend signs a per-minter authorization; contract recovers the signer with ECDSA and checks it against an on-chain allowlist of signers. **SeaDrop's EIP-712 scheme** (verified in `src/SeaDrop.sol`):
- Typehash: `SignedMint(address nftContract,address minter,address feeRecipient,MintParams mintParams,uint256 salt)` with nested `MintParams(uint256 mintPrice,uint256 maxTotalMintableByWallet,uint256 startTime,uint256 endTime,uint256 dropStageIndex,uint256 maxTokenSupplyForStage,uint256 feeBps,bool restrictFeeRecipients)`; domain = `EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)` with name `"SeaDrop"`, version `"1.0"`.
- Each `(signer, signature)` pair is **single-use** (`SignatureAlreadyUsed`); `salt` provides uniqueness.
- Damage containment: `SignedMintValidationParams` (set per signer by the NFT contract via `updateSignedMintValidationParams`) bound what a compromised signer key can authorize (min/max price, fee bounds, time window, stage supply caps). Signer keys should be hot and rotatable, never the admin key.

### 2.4 Dutch auctions
Price descends from a high start price toward a reserve/floor over a fixed window: `price(t) = startPrice − (startPrice − endPrice) × elapsed/duration`, with overpayment refunded. Designed to discover the clearing price in one transaction and defuse gas wars (buyers wait for a price they're comfortable with instead of bidding). Used by Azuki, Moonbirds, and many 2022-era drops. Failure mode: if demand is weak, price bleeds to reserve and the "auction" reads as a failed mint; gas-war mitigation only works if the decay curve is steep enough to segment buyers. **SeaDrop 1.0 does not implement Dutch auctions** — the README lists them as envisioned for future SeaDrop versions.

### 2.5 Bonding-curve mints
Mint price is a function of circulating supply, rising with each mint (linear, exponential, or stepped curves). Early minters get the lowest price; late demand pays more. The flagship variant is **VRGDA** (Variable-Rate Gradual Dutch Auction, Paradigm 2022): issuance price adjusts based on whether sales are ahead of/behind a target schedule — essentially a time-aware bonding curve, used by Art Gobblers. Curves turn minting into a continuous price-discovery mechanism but concentrate profit in early (often insider/whitelisted) minters and can produce death spirals if demand stalls.

### 2.6 Free-mint economics
**Why projects do free mints** ([multiverse.ph](https://multiverse.ph/nfts/2024/02/21/1599/free-mints-are-changing-the-nft-landscape/), [coingeek](https://coingeek.com/the-economics-of-a-free-mint/), [arxiv 2212.00292](http://arxiv.org/pdf/2212.00292)):
- **Distribution over revenue**: forgo primary-sale income to maximize holder count and reach; minters pay only gas. Lowers the entry barrier in weak markets.
- **Price discovery left to the market**: with mint price = 0, every holder is "in profit," eliminating underwater-holder resentment; trait rarity + community effort (grinding for allowlist spots) inject value.
- **Revenue shifted to secondary royalties**: the academic model predicts free mint + nonzero royalties as the equilibrium for heterogeneous valuations — observed in practice: Loot (5%), Art Gobblers (6.9%), GoblinTown (7.5%) on OpenSea ([arxiv](http://arxiv.org/pdf/2212.00292) §6). GoblinTown (2022) is the canonical free-mint success case.
- Fairness signaling: minting alongside the community (or pure open mint) reads as crypto-native vs. team-reserved allocations.

**Supply/royalty/secondary dynamics**:
- Free mints need **high secondary volume** to monetize — royalties are a percentage of turnover. A 10k free mint at 5% royalty needs 2,000 ETH of lifetime volume to gross 100 ETH.
- Post-2022 royalty-enforcement collapse (Blur, optional-royalty venues) broke the model for most: in 2026, realistic planning assumptions are 30–60% royalty compliance on major marketplaces, near-zero on Blur, and median long-tail creator royalty income <$1k/yr ([altcoininvestor, 2026](https://altcoininvestor.com/how-do-nft-royalties-work/) — blog-sourced, treat as directional).
- Floor dynamics: free-mint floors anchor near mint cost (gas); without sustained demand, supply overhang from flippers suppresses price. Sybil farming of allowlists dilutes genuine distribution.
- Scam vector: "free mint" is the #1 NFT phishing lure — malicious sites drain wallets on the mint transaction (PREMINT's Brendan Mulligan flagged this as endemic, [blockchainmagazine](https://blockchainmagazine.net/nft-drops-and-flops-a-definitive-guide-top-3-examples/)). Always verify the contract address and never sign blind `setApprovalForAll`.
- Related models: **free claims for existing holders** (holder-only free mints, e.g. CCFF00-square-gated drops), **airdrop-style mints**, and **gas-optimized L2 free mints** (Base/Robinhood Chain) where near-zero gas makes micro-value mints viable at scale.

---

## Appendix: quick selector/ID cheat sheet (all verified above)
- SeaDrop singleton: `0x00005EA00Ac477B1030CE78506496e8C2dE24bf5`
- `mintPublic` `0x161ac21f` · `mintAllowList` `0x4300a4e6` · `mintSigned` `0x4b61cd6f` · `mintAllowedTokenHolder` `0x99eb900f`
- ERC-6551 registry `0x000000006551c19487814612e58FE06813775758`; `createAccount` `0x8a54c52f`; `account()` `0x246a0021`; account ifid `0x6faff5f1`; executable ifid `0x51945447`
- ERC-4907 ifid `0xad092b5c`; ERC-5192 (soulbound) ifid `0xb45a3c0e`; ERC-1155 ifid `0xd9b67a26`; ERC-2981 ifid `0x2a55205a`; ERC-721 ifid `0x80ac58cd`

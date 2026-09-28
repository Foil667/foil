// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";

interface IActivation {
    function onTransferReset(uint256 tokenId) external;
}

interface IERC6551Registry {
    function createAccount(
        address implementation,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt,
        bytes calldata initData
    ) external returns (address);
    function account(
        address implementation,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt
    ) external view returns (address);
}

/// @title FoilEquities — art-first NFT with stock-drip utility
/// @notice 667 supply per chain. FREE mint (price exactly 0). ERC-2981 7.5% -> RoyaltyRouter.
///         Each token owns an ERC-6551 bound wallet that accumulates tokenized stocks.
///         Activation resets on transfer (rewards accrue to holders, not flippers).
/// @dev UNAUDITED DRAFT. Do not deploy to mainnet without a professional audit.
contract FoilEquities is ERC721, Ownable, IERC2981 {
    uint256 public constant MAX_SUPPLY = 667;
    uint256 public constant ALLOWLIST_MAX = 2;
    uint256 public constant PUBLIC_MAX = 3;
    uint96 public constant ROYALTY_BPS = 750; // 7.5% -> RoyaltyRouter (2.5pp pot / 5pp operator)

    uint256 public totalMinted;
    uint8 public phase; // 0 closed, 1 allowlist, 2 public
    bytes32 public merkleRoot;
    address public royaltyRouter;
    IActivation public activation;

    // ERC-6551 wiring (registry + account implementation set per chain)
    IERC6551Registry public registry;
    address public accountImplementation;
    uint256 public chainIdCached;

    mapping(address => uint256) public mintedAllowlist;
    mapping(address => uint256) public mintedPublic;

    event PhaseSet(uint8 phase);
    event AccountCreated(uint256 indexed tokenId, address account);

    error Closed();
    error SoldOut();
    error OverLimit();
    error NotAllowlisted();
    error ZeroAddress();

    constructor(
        address _royaltyRouter,
        address _registry,
        address _accountImplementation
    ) ERC721("FoilEquities", "FOILEQ") Ownable(msg.sender) {
        if (_royaltyRouter == address(0) || _registry == address(0) || _accountImplementation == address(0))
            revert ZeroAddress();
        royaltyRouter = _royaltyRouter;
        registry = IERC6551Registry(_registry);
        accountImplementation = _accountImplementation;
        chainIdCached = block.chainid;
    }

    // ---------- admin ----------

    function setPhase(uint8 _phase) external onlyOwner {
        require(_phase <= 2, "bad phase");
        phase = _phase;
        emit PhaseSet(_phase);
    }

    function setMerkleRoot(bytes32 _root) external onlyOwner {
        merkleRoot = _root;
    }

    function setActivation(address _activation) external onlyOwner {
        activation = IActivation(_activation);
    }

    function setRoyaltyRouter(address _router) external onlyOwner {
        if (_router == address(0)) revert ZeroAddress();
        royaltyRouter = _router;
    }

    // ---------- mint (FREE — price exactly zero, always) ----------

    function mintAllowlist(uint256 quantity, bytes32[] calldata proof) external {
        if (phase != 1) revert Closed();
        if (
            !MerkleProof.verify(
                proof,
                merkleRoot,
                keccak256(abi.encodePacked(msg.sender))
            )
        ) revert NotAllowlisted();
        if (mintedAllowlist[msg.sender] + quantity > ALLOWLIST_MAX) revert OverLimit();
        mintedAllowlist[msg.sender] += quantity;
        _mintBatch(msg.sender, quantity);
    }

    function mintPublic(uint256 quantity) external {
        if (phase != 2) revert Closed();
        if (mintedPublic[msg.sender] + quantity > PUBLIC_MAX) revert OverLimit();
        mintedPublic[msg.sender] += quantity;
        _mintBatch(msg.sender, quantity);
    }

    function _mintBatch(address to, uint256 quantity) internal {
        if (totalMinted + quantity > MAX_SUPPLY) revert SoldOut();
        for (uint256 i = 0; i < quantity; i++) {
            uint256 tokenId = ++totalMinted;
            _safeMint(to, tokenId);
        }
    }

    // ---------- ERC-6551 accounts ----------

    /// @notice Deterministic address of this token's bound wallet (create on demand).
    function tokenAccount(uint256 tokenId) public view returns (address) {
        return
            registry.account(
                accountImplementation,
                chainIdCached,
                address(this),
                tokenId,
                0
            );
    }

    function createTokenAccount(uint256 tokenId) external returns (address acct) {
        require(_ownerOf(tokenId) != address(0), "no such token");
        acct = registry.createAccount(
            accountImplementation,
            chainIdCached,
            address(this),
            tokenId,
            0,
            ""
        );
        emit AccountCreated(tokenId, acct);
    }

    // ---------- transfer hook: activation resets on flip ----------

    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        address prev = super._update(to, tokenId, auth);
        // On real transfers (not mint/burn), reset activation so rewards
        // accrue to holders, never to flippers.
        if (
            from != address(0) &&
            to != address(0) &&
            address(activation) != address(0)
        ) {
            activation.onTransferReset(tokenId);
        }
        return prev;
    }

    // ---------- ERC-2981: 7.5% -> RoyaltyRouter ----------

    function royaltyInfo(uint256, uint256 salePrice)
        external
        view
        override
        returns (address, uint256)
    {
        return (royaltyRouter, (salePrice * ROYALTY_BPS) / 10_000);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, IERC165)
        returns (bool)
    {
        return
            interfaceId == type(IERC2981).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}

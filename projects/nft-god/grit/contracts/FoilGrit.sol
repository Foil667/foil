// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title FoilGrit — FOIL GRIT: 667 declassified case files from Foil's
///        watchdog desk. Every scar is a scam that didn't pay.
/// @notice ERC-721 with 721A-style batch minting, phased FREE minting
///         (allowlist -> public), ERC-2981 royalties, a disclosed owner
///         reserve, and a FREEZABLE metadata URI. Art is trait-layered
///         (12 painted bases x deterministic code overlays), hosted on
///         Arweave; once `freezeURI()` is called the metadata is permanent.
///         Self-contained: no external imports; the full audit surface is
///         this one file.
///
/// @dev PRICE IS HARDCODED TO ZERO. There is no price variable, no setter,
///      no payable mint path. "Gas only" is enforced by the code itself.
///
/// ============================================================================
/// SECURITY NOTES (read before deploying — this is the whole threat model)
/// ============================================================================
/// 1. NO UPGRADABILITY. No proxy, no delegatecall, no selfdestruct. Once
///    deployed, the rules below are final. Verify deployed bytecode matches
///    this source before announcing the mint.
///
/// 2. FREE MINT IS STRUCTURAL. Mint entry points are nonpayable and there is
///    no price state at all. Nobody — not even the owner — can charge for a
///    mint through this contract.
///
/// 3. NO OWNER MINT-AFTER-SELLOUT. The only owner minting power is
///    `ownerReserveMint`, capped at RESERVE tokens total, every token counted
///    against MAX_SUPPLY. `_mintBatch` is internal; every public entry point
///    enforces the supply cap. No stealth-mint path exists.
///
/// 4. RESERVE IS DISCLOSED. RESERVE = 20 of 667 (3.0%) for giveaways,
///    collabs, artist holdings. Minted through the same `_mintBatch` —
///    same token ID sequence, same Transfer events. No special tokens.
///
/// 5. ROYALTY CAP. `setRoyalty` can never exceed 1000 bps (10%), receiver
///    can be rotated but never set to address(0). Deploy default 750 (7.5%).
///
/// 6. REENTRANCY. Checks-effects-interactions throughout. The only external
///    call to untrusted code is the ERC721Receiver callback in
///    `safeTransferFrom`, after all state updates; nothing follows it except
///    event emission. `tokenURI` is view with no external calls.
///
/// 7. MERKLE ALLOWLIST. Leaf = keccak256(abi.encodePacked(address)).
///    Sorted-pair verification (OpenZeppelin-compatible); the offchain tree
///    builder MUST sort pairs. Per-address `allowlistMinted` accounting is
///    enforced onchain.
///
/// 8. PHASE GATING. 0=CLOSED, 1=ALLOWLIST, 2=PUBLIC. Owner-only `setPhase`.
///
/// 9. OWNERSHIP. Minimal Ownable. `renounceOwnership` exists — the plan is
///    to renounce after sellout + reserve distribution + URI freeze,
///    removing all owner powers permanently.
///
/// 10. METADATA FREEZE. `baseURI` is owner-settable until `freezeURI()` is
///     called. After freezing, the URI can never change again — metadata is
///     as permanent as the chain. The freeze is one-way and emits an event.
///     The plan is to freeze before renouncing ownership.
///
/// 11. DETERMINISM (offchain). Trait assignment for the 667 pieces is
///     keccak256(tokenId, "FOIL.GRIT.*") in the public composer script —
///     anyone can verify their token's traits independently.
///
/// 12. AUDIT STATUS: UNAUDITED. Minimal on purpose. Second-eyes review +
///     testnet rehearsal before mainnet value accrues.
///
contract FoilGrit {
    // ------------------------------------------------------------------------
    // Custom errors (cheaper than revert strings; keeps runtime under EIP-170)
    // ------------------------------------------------------------------------
    error NotOwner();
    error ZeroAddress();
    error NotMinted();
    error NotAuthorized();
    error WrongFrom();
    error ZeroQuantity();
    error SoldOut();
    error BadPhase();
    error BadQuantity();
    error CapExceeded();
    error InvalidProof();
    error ReserveExceeded();
    error RoyaltyTooHigh();
    error UriFrozen();
    error NotERC721Receiver();

    // ------------------------------------------------------------------------
    // Configuration (immutable launch parameters)
    // ------------------------------------------------------------------------
    uint256 public constant MAX_SUPPLY = 667;
    /// @dev Disclosed owner reserve: giveaways, collabs, artist holdings.
    uint256 public constant RESERVE = 20;
    uint256 public constant ALLOWLIST_CAP = 2; // per wallet, allowlist phase
    uint256 public constant PUBLIC_CAP = 3;    // per wallet, public phase
    uint256 public constant MAX_ROYALTY_BPS = 1000; // 10% hard cap

    /// @dev Mint phases: 0 = CLOSED, 1 = ALLOWLIST, 2 = PUBLIC
    uint8 public constant PHASE_CLOSED = 0;
    uint8 public constant PHASE_ALLOWLIST = 1;
    uint8 public constant PHASE_PUBLIC = 2;

    string public name;
    string public symbol;

    // ------------------------------------------------------------------------
    // 721A-style packed ownership
    // ------------------------------------------------------------------------
    struct TokenOwnership {
        address addr;
        uint64 startTimestamp;
    }

    mapping(uint256 => TokenOwnership) private _ownerships;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    /// @dev Next token ID to mint. Also == totalSupply() since IDs are 0..N-1.
    uint256 private _currentIndex;

    // ------------------------------------------------------------------------
    // Mint state
    // ------------------------------------------------------------------------
    uint8 public phase = PHASE_CLOSED;
    bytes32 public allowlistRoot;
    mapping(address => uint256) public allowlistMinted;
    mapping(address => uint256) public publicMinted;
    uint256 public reserveMinted; // out of RESERVE

    // ------------------------------------------------------------------------
    // Royalties (ERC-2981)
    // ------------------------------------------------------------------------
    address public royaltyReceiver;
    uint96 public royaltyBps; // e.g. 750 = 7.5%

    // ------------------------------------------------------------------------
    // Metadata
    // ------------------------------------------------------------------------
    string public baseURI;
    bool public uriFrozen;
    string public contractURI;

    // ------------------------------------------------------------------------
    // Ownership (minimal Ownable)
    // ------------------------------------------------------------------------
    address public owner;

    // ------------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------------
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event PhaseSet(uint8 indexed phase);
    event AllowlistRootSet(bytes32 indexed root);
    event BaseURISet(string baseURI);
    event BaseUriFrozen(string uri);
    event ContractURISet(string contractURI);
    event RoyaltySet(address indexed receiver, uint96 bps);
    event ReserveMinted(address indexed to, uint256 quantity);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        string memory baseURI_,
        bytes32 allowlistRoot_,
        address royaltyReceiver_,
        uint96 royaltyBps_
    ) {
        if (royaltyReceiver_ == address(0)) revert ZeroAddress();
        if (royaltyBps_ > MAX_ROYALTY_BPS) revert RoyaltyTooHigh();
        name = name_;
        symbol = symbol_;
        baseURI = baseURI_;
        allowlistRoot = allowlistRoot_;
        royaltyReceiver = royaltyReceiver_;
        royaltyBps = royaltyBps_;
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ------------------------------------------------------------------------
    // ERC-721 core
    // ------------------------------------------------------------------------
    function totalSupply() public view returns (uint256) {
        return _currentIndex;
    }

    function balanceOf(address account) public view returns (uint256) {
        if (account == address(0)) revert ZeroAddress();
        return _balances[account];
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        return _ownerOf(tokenId);
    }

    function _ownerOf(uint256 tokenId) internal view returns (address tokenOwner) {
        if (tokenId >= _currentIndex) revert NotMinted();
        TokenOwnership memory o = _ownerships[tokenId];
        if (o.addr != address(0)) return o.addr;
        unchecked {
            while (true) {
                tokenId--;
                o = _ownerships[tokenId];
                if (o.addr != address(0)) return o.addr;
            }
        }
    }

    function getApproved(uint256 tokenId) public view returns (address) {
        if (tokenId >= _currentIndex) revert NotMinted();
        return _tokenApprovals[tokenId];
    }

    function isApprovedForAll(address account, address operator) public view returns (bool) {
        return _operatorApprovals[account][operator];
    }

    function approve(address to, uint256 tokenId) public {
        address tokenOwner = _ownerOf(tokenId);
        if (msg.sender != tokenOwner && !isApprovedForAll(tokenOwner, msg.sender))
            revert NotAuthorized();
        _tokenApprovals[tokenId] = to;
        emit Approval(tokenOwner, to, tokenId);
    }

    function setApprovalForAll(address operator, bool approved) public {
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        address tokenOwner = _ownerOf(tokenId);
        if (from != tokenOwner) revert WrongFrom();
        if (to == address(0)) revert ZeroAddress();
        if (
            msg.sender != tokenOwner &&
            !isApprovedForAll(tokenOwner, msg.sender) &&
            getApproved(tokenId) != msg.sender
        ) revert NotAuthorized();
        _transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) public {
        transferFrom(from, to, tokenId);
        if (!_checkOnERC721Received(msg.sender, from, to, tokenId, ""))
            revert NotERC721Receiver();
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) public {
        transferFrom(from, to, tokenId);
        if (!_checkOnERC721Received(msg.sender, from, to, tokenId, data))
            revert NotERC721Receiver();
    }

    function _transfer(address from, address to, uint256 tokenId) internal {
        delete _tokenApprovals[tokenId];
        unchecked {
            _balances[from] -= 1;
            _balances[to] += 1;
        }
        _ownerships[tokenId].addr = to;
        _ownerships[tokenId].startTimestamp = uint64(block.timestamp);
        uint256 next = tokenId + 1;
        if (next < _currentIndex && _ownerships[next].addr == address(0)) {
            _ownerships[next].addr = from;
            _ownerships[next].startTimestamp = uint64(block.timestamp);
        }
        emit Transfer(from, to, tokenId);
    }

    function _checkOnERC721Received(
        address operator,
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) private returns (bool) {
        if (to.code.length == 0) return true;
        (bool success, bytes memory ret) = to.call(
            abi.encodeWithSelector(
                bytes4(keccak256("onERC721Received(address,address,uint256,bytes)")),
                operator,
                from,
                tokenId,
                data
            )
        );
        return
            success &&
            ret.length == 32 &&
            abi.decode(ret, (bytes4)) ==
            bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"));
    }

    // ------------------------------------------------------------------------
    // Batch minting (internal — the 721A gas optimization lives here)
    // ------------------------------------------------------------------------
    function _mintBatch(address to, uint256 quantity) internal {
        if (to == address(0)) revert ZeroAddress();
        if (quantity == 0) revert ZeroQuantity();
        uint256 start = _currentIndex;
        if (start + quantity > MAX_SUPPLY) revert SoldOut();
        _ownerships[start].addr = to;
        _ownerships[start].startTimestamp = uint64(block.timestamp);
        unchecked {
            _balances[to] += quantity;
            _currentIndex = start + quantity;
        }
        for (uint256 i = 0; i < quantity; ) {
            emit Transfer(address(0), to, start + i);
            unchecked {
                ++i;
            }
        }
    }

    // ------------------------------------------------------------------------
    // Public mint entry points — FREE. Nonpayable by construction.
    // ------------------------------------------------------------------------
    /// @notice Allowlist mint. Leaf = keccak256(abi.encodePacked(minter)).
    function allowlistMint(uint256 quantity, bytes32[] calldata proof) external {
        if (phase != PHASE_ALLOWLIST) revert BadPhase();
        if (quantity == 0 || quantity > ALLOWLIST_CAP) revert BadQuantity();
        if (allowlistMinted[msg.sender] + quantity > ALLOWLIST_CAP)
            revert CapExceeded();
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        if (!_verifyMerkle(proof, allowlistRoot, leaf)) revert InvalidProof();
        allowlistMinted[msg.sender] += quantity;
        _mintBatch(msg.sender, quantity);
    }

    /// @notice Public free mint.
    function publicMint(uint256 quantity) external {
        if (phase != PHASE_PUBLIC) revert BadPhase();
        if (quantity == 0 || quantity > PUBLIC_CAP) revert BadQuantity();
        if (publicMinted[msg.sender] + quantity > PUBLIC_CAP)
            revert CapExceeded();
        publicMinted[msg.sender] += quantity;
        _mintBatch(msg.sender, quantity);
    }

    /// @notice Disclosed owner reserve mint. Counts toward MAX_SUPPLY.
    function ownerReserveMint(address to, uint256 quantity) external onlyOwner {
        if (quantity == 0) revert ZeroQuantity();
        if (reserveMinted + quantity > RESERVE) revert ReserveExceeded();
        reserveMinted += quantity;
        _mintBatch(to, quantity);
        emit ReserveMinted(to, quantity);
    }

    // ------------------------------------------------------------------------
    // Owner controls
    // ------------------------------------------------------------------------
    function setPhase(uint8 newPhase) external onlyOwner {
        if (newPhase > PHASE_PUBLIC) revert BadPhase();
        phase = newPhase;
        emit PhaseSet(newPhase);
    }

    function setAllowlistRoot(bytes32 newRoot) external onlyOwner {
        allowlistRoot = newRoot;
        emit AllowlistRootSet(newRoot);
    }

    /// @notice Reverts after freezeURI(). One-way door.
    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        if (uriFrozen) revert UriFrozen();
        baseURI = newBaseURI;
        emit BaseURISet(newBaseURI);
    }

    /// @notice Permanently locks the metadata URI. Call before renouncing.
    function freezeURI() external onlyOwner {
        uriFrozen = true;
        emit BaseUriFrozen(baseURI);
    }

    function setContractURI(string calldata newContractURI) external onlyOwner {
        contractURI = newContractURI;
        emit ContractURISet(newContractURI);
    }

    /// @notice Royalty can never exceed MAX_ROYALTY_BPS (10%).
    function setRoyalty(address receiver, uint96 bps) external onlyOwner {
        if (receiver == address(0)) revert ZeroAddress();
        if (bps > MAX_ROYALTY_BPS) revert RoyaltyTooHigh();
        royaltyReceiver = receiver;
        royaltyBps = bps;
        emit RoyaltySet(receiver, bps);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Recommended after sellout + reserve distribution + URI freeze:
    ///         removes all owner powers permanently.
    function renounceOwnership() external onlyOwner {
        emit OwnershipTransferred(owner, address(0));
        owner = address(0);
    }

    // ------------------------------------------------------------------------
    // Metadata
    // ------------------------------------------------------------------------
    /// @notice tokenURI = baseURI + tokenId. Metadata + images live on
    ///         Arweave; freezeURI() makes the pointer permanent.
    function tokenURI(uint256 tokenId) public view returns (string memory) {
        if (tokenId >= _currentIndex) revert NotMinted();
        return string(abi.encodePacked(baseURI, _toString(tokenId)));
    }

    /// @notice ERC-2981: marketplaces query this for secondary royalties.
    function royaltyInfo(
        uint256 /* tokenId */,
        uint256 salePrice
    ) external view returns (address receiver, uint256 royaltyAmount) {
        return (royaltyReceiver, (salePrice * royaltyBps) / 10000);
    }

    function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
        return
            interfaceId == 0x01ffc9a7 || // ERC-165
            interfaceId == 0x80ac58cd || // ERC-721
            interfaceId == 0x5b5e139f || // ERC-721 Metadata
            interfaceId == 0x2a55205a; // ERC-2981
    }

    // ------------------------------------------------------------------------
    // Internal utilities
    // ------------------------------------------------------------------------
    /// @dev Sorted-pair Merkle verification (OpenZeppelin-compatible).
    function _verifyMerkle(
        bytes32[] calldata proof,
        bytes32 root,
        bytes32 leaf
    ) internal pure returns (bool) {
        bytes32 h = leaf;
        for (uint256 i = 0; i < proof.length; ) {
            bytes32 p = proof[i];
            if (h <= p) {
                h = keccak256(abi.encodePacked(h, p));
            } else {
                h = keccak256(abi.encodePacked(p, h));
            }
            unchecked {
                ++i;
            }
        }
        return h == root;
    }

    /// @dev uint256 -> decimal string (no imports needed).
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}

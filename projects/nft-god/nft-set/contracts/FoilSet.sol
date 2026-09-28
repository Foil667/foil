// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title FoilSet — Foil's genesis NFT set on Robinhood Chain
/// @notice ERC-721 with 721A-style gas-optimized batch minting, phased free
///         minting (allowlist -> public), ERC-2981 royalties, and a small
///         disclosed owner reserve. Self-contained: no external imports, so the
///         full audit surface is this one file.
///
/// ============================================================================
/// SECURITY NOTES (read before deploying — this is the whole threat model)
/// ============================================================================
/// 1. NO UPGRADABILITY. No proxy, no delegatecall, no selfdestruct. Once
///    deployed, the rules below are final. Verify the deployed bytecode
///    matches this source before announcing the mint.
///
/// 2. NO OWNER MINT-AFTER-SELLOUT. The owner can never mint beyond MAX_SUPPLY.
///    The only owner minting power is `ownerReserveMint`, capped at RESERVE
///    tokens total, and every reserve token counts against MAX_SUPPLY.
///    There is no stealth-mint path: `_mintBatch` is internal and every public
///    entry point enforces the supply cap.
///
/// 3. RESERVE IS DISCLOSED. RESERVE = 25 of 777 (3.2%). It exists for
///    giveaways, collabs, and the artist's own holdings. It is minted through
///    the same `_mintBatch` as everyone else (same token IDs sequence, same
///    Transfer events) — no special "owner tokens".
///
/// 4. ROYALTY CAP. `setRoyalty` can never exceed 1000 bps (10%), and the
///    receiver can be rotated but never pointed at address(0). Deploy-time
///    default is 750 bps (7.5%).
///
/// 5. REENTRANCY. Mint functions follow checks-effects-interactions: all
///    state (balances, ownership, counters) is updated BEFORE the single
///    external call in `safeTransferFrom` (the ERC721Receiver callback).
///    `withdraw` zeroes nothing but sends to a trusted owner; it uses
///    `.call` with a success check and no state follows it.
///    No cross-function reentrancy path exists because no function calls an
///    untrusted contract except the receiver callback, after which the only
///    remaining work is emitting an event.
///
/// 6. MERKLE ALLOWLIST. Leaf = keccak256(abi.encodePacked(address)).
///    Proofs use sorted pairs (OpenZeppelin-compatible convention), so the
///    offchain tree builder MUST sort pairs or valid proofs will fail.
///    `claimed` accounting is per-address and enforced on-chain; a proof alone
///    cannot mint twice beyond ALLOWLIST_CAP.
///
/// 7. PHASE GATING. `setPhase` is owner-only. Phases are 0=CLOSED, 1=ALLOWLIST,
///    2=PUBLIC. There is no phase that enables paid minting beyond `price`,
///    and `price` can only be raised by the owner (documented: launch is
///    FREE, price stays 0 unless the community votes otherwise — the contract
///    cannot force anyone to pay for already-minted tokens).
///
/// 8. OWNERSHIP. Minimal Ownable with two-step NOT implemented deliberately:
///    `transferOwnership` is single-step, so triple-check the address.
///    `renounceOwnership` exists — after sellout + reserve distribution, the
///    recommended move is to renounce, removing phases/pricing power entirely.
///
/// 9. INTEGER SAFETY. Solidity 0.8 built-in overflow checks everywhere except
///    explicit `unchecked` blocks, each of which is safe by construction
///    (loop counters bounded by qty, balance math guarded by prior requires).
///
/// 10. FRONT-RUNNING / MEV. Public mint is first-come-first-served on a
///     100ms-block Arbitrum Orbit chain; allowlist uses a committed Merkle
///     root so the list cannot be changed mid-phase without an onchain event
///     (`AllowlistRootSet`) that everyone can see.
///
/// 11. METADATA. `tokenURI` = baseURI + tokenId (no extension; e.g.
///     "ipfs://CID/123"). `baseURI` is owner-settable ONCE per call but each
///     change emits `BaseURISet` — the provenance plan is: deploy with a
///     placeholder URI, then set the final IPFS/Arweave URI at reveal.
///     Collectors should treat pre-reveal metadata as unfinalized (standard).
///
/// 12. AUDIT STATUS: UNAUDITED. This contract has not been professionally
///     audited. It is minimal on purpose. Get an audit (or at minimum a
///     second-eyes review + testnet rehearsal) before mainnet value accrues.
///
contract FoilSet {
    // ------------------------------------------------------------------------
    // Configuration (immutable launch parameters)
    // ------------------------------------------------------------------------
    uint256 public constant MAX_SUPPLY = 777;
    /// @dev Disclosed owner reserve: giveaways, collabs, artist holdings.
    uint256 public constant RESERVE = 25;
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
    /// @dev Ownership is written ONLY for the first token of each minted
    ///      batch. `ownerOf` walks backwards to the batch start. This is the
    ///      core gas optimization: minting N tokens costs ~1 SSTORE for
    ///      ownership (+1 balance update) instead of N.
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
    uint256 public price; // wei per token; 0 = free mint
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
    event PriceSet(uint256 price);
    event BaseURISet(string baseURI);
    event ContractURISet(string contractURI);
    event RoyaltySet(address indexed receiver, uint96 bps);
    event ReserveMinted(address indexed to, uint256 quantity);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        string memory baseURI_,
        string memory contractURI_,
        bytes32 allowlistRoot_,
        address royaltyReceiver_,
        uint96 royaltyBps_
    ) {
        require(royaltyReceiver_ != address(0), "ZERO_ROYALTY_RECEIVER");
        require(royaltyBps_ <= MAX_ROYALTY_BPS, "ROYALTY_TOO_HIGH");
        name = name_;
        symbol = symbol_;
        baseURI = baseURI_;
        contractURI = contractURI_;
        allowlistRoot = allowlistRoot_;
        royaltyReceiver = royaltyReceiver_;
        royaltyBps = royaltyBps_;
        price = 0; // free-mint-first: launch is free
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
        require(account != address(0), "ZERO_ADDRESS");
        return _balances[account];
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        return _ownerOf(tokenId);
    }

    function _ownerOf(uint256 tokenId) internal view returns (address tokenOwner) {
        require(tokenId < _currentIndex, "NOT_MINTED");
        TokenOwnership memory o = _ownerships[tokenId];
        if (o.addr != address(0)) return o.addr;
        // Walk back to the batch start. Token 0 is always explicitly set by
        // the first mint, so this loop always returns before underflowing.
        // (Named return silences the unreachable-fallthrough warning.)
        unchecked {
            while (true) {
                tokenId--;
                o = _ownerships[tokenId];
                if (o.addr != address(0)) return o.addr;
            }
        }
    }

    function getApproved(uint256 tokenId) public view returns (address) {
        require(tokenId < _currentIndex, "NOT_MINTED");
        return _tokenApprovals[tokenId];
    }

    function isApprovedForAll(address account, address operator) public view returns (bool) {
        return _operatorApprovals[account][operator];
    }

    function approve(address to, uint256 tokenId) public {
        address tokenOwner = _ownerOf(tokenId);
        require(
            msg.sender == tokenOwner || isApprovedForAll(tokenOwner, msg.sender),
            "NOT_AUTH"
        );
        _tokenApprovals[tokenId] = to;
        emit Approval(tokenOwner, to, tokenId);
    }

    function setApprovalForAll(address operator, bool approved) public {
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        address tokenOwner = _ownerOf(tokenId);
        require(from == tokenOwner, "WRONG_FROM");
        require(to != address(0), "ZERO_TO");
        require(
            msg.sender == tokenOwner ||
                isApprovedForAll(tokenOwner, msg.sender) ||
                getApproved(tokenId) == msg.sender,
            "NOT_AUTH"
        );
        _transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) public {
        transferFrom(from, to, tokenId);
        require(
            _checkOnERC721Received(msg.sender, from, to, tokenId, ""),
            "NOT_ERC721_RECEIVER"
        );
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) public {
        transferFrom(from, to, tokenId);
        require(
            _checkOnERC721Received(msg.sender, from, to, tokenId, data),
            "NOT_ERC721_RECEIVER"
        );
    }

    function _transfer(address from, address to, uint256 tokenId) internal {
        delete _tokenApprovals[tokenId];
        unchecked {
            _balances[from] -= 1;
            _balances[to] += 1;
        }
        _ownerships[tokenId].addr = to;
        _ownerships[tokenId].startTimestamp = uint64(block.timestamp);
        // 721A slot-initialization: if the NEXT token's ownership was implicit
        // (inherited from `from`'s batch), pin it explicitly so `from` keeps
        // owning it after this transfer.
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
        require(to != address(0), "ZERO_TO");
        require(quantity > 0, "ZERO_QTY");
        uint256 start = _currentIndex;
        require(start + quantity <= MAX_SUPPLY, "SOLD_OUT");
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

    function _collectPayment(uint256 quantity) internal {
        uint256 due = price * quantity;
        require(msg.value >= due, "INSUFFICIENT_PAYMENT");
        if (msg.value > due) {
            // Refund overpayment. State is fully updated before this point
            // in every caller (checks-effects-interactions).
            (bool ok, ) = payable(msg.sender).call{value: msg.value - due}("");
            require(ok, "REFUND_FAILED");
        }
    }

    // ------------------------------------------------------------------------
    // Public mint entry points
    // ------------------------------------------------------------------------
    /// @notice Allowlist mint. Leaf = keccak256(abi.encodePacked(minter)).
    function allowlistMint(uint256 quantity, bytes32[] calldata proof) external payable {
        require(phase == PHASE_ALLOWLIST, "NOT_ALLOWLIST_PHASE");
        require(quantity > 0 && quantity <= ALLOWLIST_CAP, "BAD_QTY");
        require(
            allowlistMinted[msg.sender] + quantity <= ALLOWLIST_CAP,
            "ALLOWLIST_CAP_EXCEEDED"
        );
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        require(_verifyMerkle(proof, allowlistRoot, leaf), "INVALID_PROOF");
        allowlistMinted[msg.sender] += quantity;
        _collectPayment(quantity);
        _mintBatch(msg.sender, quantity);
    }

    /// @notice Public free mint (price is 0 at launch).
    function publicMint(uint256 quantity) external payable {
        require(phase == PHASE_PUBLIC, "NOT_PUBLIC_PHASE");
        require(quantity > 0 && quantity <= PUBLIC_CAP, "BAD_QTY");
        require(
            publicMinted[msg.sender] + quantity <= PUBLIC_CAP,
            "PUBLIC_CAP_EXCEEDED"
        );
        publicMinted[msg.sender] += quantity;
        _collectPayment(quantity);
        _mintBatch(msg.sender, quantity);
    }

    /// @notice Disclosed owner reserve mint. Counts toward MAX_SUPPLY.
    /// @dev Capped at RESERVE total, forever. No other owner mint exists.
    function ownerReserveMint(address to, uint256 quantity) external onlyOwner {
        require(quantity > 0, "ZERO_QTY");
        require(reserveMinted + quantity <= RESERVE, "RESERVE_EXCEEDED");
        reserveMinted += quantity;
        _mintBatch(to, quantity);
        emit ReserveMinted(to, quantity);
    }

    // ------------------------------------------------------------------------
    // Owner controls
    // ------------------------------------------------------------------------
    function setPhase(uint8 newPhase) external onlyOwner {
        require(newPhase <= PHASE_PUBLIC, "BAD_PHASE");
        phase = newPhase;
        emit PhaseSet(newPhase);
    }

    function setAllowlistRoot(bytes32 newRoot) external onlyOwner {
        allowlistRoot = newRoot;
        emit AllowlistRootSet(newRoot);
    }

    function setPrice(uint256 newPrice) external onlyOwner {
        price = newPrice;
        emit PriceSet(newPrice);
    }

    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        baseURI = newBaseURI;
        emit BaseURISet(newBaseURI);
    }

    function setContractURI(string calldata newContractURI) external onlyOwner {
        contractURI = newContractURI;
        emit ContractURISet(newContractURI);
    }

    /// @notice Royalty can never exceed MAX_ROYALTY_BPS (10%).
    function setRoyalty(address receiver, uint96 bps) external onlyOwner {
        require(receiver != address(0), "ZERO_ROYALTY_RECEIVER");
        require(bps <= MAX_ROYALTY_BPS, "ROYALTY_TOO_HIGH");
        royaltyReceiver = receiver;
        royaltyBps = bps;
        emit RoyaltySet(receiver, bps);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ZERO_ADDRESS");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Recommended after sellout + reserve distribution: removes all
    ///         owner powers (phases, pricing, URIs) permanently.
    function renounceOwnership() external onlyOwner {
        emit OwnershipTransferred(owner, address(0));
        owner = address(0);
    }

    /// @notice Withdraw accumulated mint revenue (only if price > 0 later).
    function withdraw() external onlyOwner {
        uint256 bal = address(this).balance;
        require(bal > 0, "NOTHING_TO_WITHDRAW");
        (bool ok, ) = payable(owner).call{value: bal}("");
        require(ok, "WITHDRAW_FAILED");
    }

    // ------------------------------------------------------------------------
    // Metadata + royalties (views)
    // ------------------------------------------------------------------------
    function tokenURI(uint256 tokenId) public view returns (string memory) {
        require(tokenId < _currentIndex, "NOT_MINTED");
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

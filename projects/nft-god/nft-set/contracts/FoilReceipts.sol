// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title FoilReceipts — Foil's genesis NFT set on Base
/// @notice ERC-721 with 721A-style batch minting, phased FREE minting
///         (allowlist -> public), ERC-2981 royalties, a disclosed owner
///         reserve, and FULLY ONCHAIN generative SVG art. Every token is a
///         "verified receipt": the art IS the audit trail. No external image
///         dependency — tokenURI returns a base64 data-URI built onchain.
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
/// 4. RESERVE IS DISCLOSED. RESERVE = 25 of 777 (3.2%) for giveaways,
///    collabs, artist holdings. Minted through the same `_mintBatch` —
///    same token ID sequence, same Transfer events. No special tokens.
///
/// 5. ROYALTY CAP. `setRoyalty` can never exceed 1000 bps (10%), receiver
///    can be rotated but never set to address(0). Deploy default 750 (7.5%).
///
/// 6. REENTRANCY. Checks-effects-interactions throughout. The only external
///    call to untrusted code is the ERC721Receiver callback in
///    `safeTransferFrom`, after all state updates; nothing follows it except
///    event emission. `tokenURI`/`_svg` are pure/view with no external calls.
///
/// 7. MERKLE ALLOWLIST. Leaf = keccak256(abi.encodePacked(address)).
///    Sorted-pair verification (OpenZeppelin-compatible); the offchain tree
///    builder MUST sort pairs. Per-address `allowlistMinted` accounting is
///    enforced onchain.
///
/// 8. PHASE GATING. 0=CLOSED, 1=ALLOWLIST, 2=PUBLIC. Owner-only `setPhase`.
///
/// 9. OWNERSHIP. Minimal Ownable. `renounceOwnership` exists — the plan is
///    to renounce after sellout + reserve distribution, removing all owner
///    powers (phases, roots, URIs, royalties) permanently.
///
/// 10. DETERMINISM. All art traits derive from keccak256(tokenId, salt).
///     No block data, no oracles — tokenURI output is identical on every
///     node, forever. The offchain preview generator mirrors this exactly.
///
/// 11. METADATA IS IMMUTABLE-ISH. tokenURI is pure code: there is no URI to
///     rug. The only mutable metadata surface is `contractURI` (collection-
///     level, OpenSea display), owner-settable with an event.
///
/// 12. AUDIT STATUS: UNAUDITED. Minimal on purpose. Second-eyes review +
///     testnet rehearsal before mainnet value accrues.
///
contract FoilReceipts {
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
    error BadToken();
    error NotERC721Receiver();

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
        bytes32 allowlistRoot_,
        address royaltyReceiver_,
        uint96 royaltyBps_
    ) {
        if (royaltyReceiver_ == address(0)) revert ZeroAddress();
        if (royaltyBps_ > MAX_ROYALTY_BPS) revert RoyaltyTooHigh();
        name = name_;
        symbol = symbol_;
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

    /// @notice Recommended after sellout + reserve distribution: removes all
    ///         owner powers permanently.
    function renounceOwnership() external onlyOwner {
        emit OwnershipTransferred(owner, address(0));
        owner = address(0);
    }

    // ------------------------------------------------------------------------
    // Onchain generative receipt art
    // ------------------------------------------------------------------------
    /// @dev verdict: 0=DIAMOND 1=RUG BLOCKED 2=VERIFIED 3=UNVERIFIED
    ///      check: 0..5 (RUG CHECK, FREE MINT, CONTRACT AUDIT, WHALE SCAN,
    ///      MEMPOOL WATCH, ALLOWLIST HUNT)
    ///      hat: 0=PEAKED 1=FLAT 2=CROWN | eyes: 0=SKEPTICAL 1=WIDE 2=NARROWED
    ///      bg: 0=DOSSIER 1=TERMINAL 2=BLUEPRINT
    struct Receipt {
        uint8 verdict;
        uint8 check;
        uint8 hat;
        uint8 eyes;
        uint8 bg;
        bytes8 ref;
        uint32 batch;
        uint32 gas;
    }

    /// @notice Deterministic traits: keccak256(tokenId, salt). No block data,
    ///         no oracles — identical on every node, forever.
    function receiptOf(uint256 tokenId) public pure returns (Receipt memory r) {
        if (tokenId >= MAX_SUPPLY) revert BadToken();
        uint256 h0 = uint256(keccak256(abi.encodePacked(tokenId, "FOIL.RCPT.v")));
        uint256 h1 = uint256(keccak256(abi.encodePacked(tokenId, "FOIL.RCPT.c")));
        uint256 h2 = uint256(keccak256(abi.encodePacked(tokenId, "FOIL.RCPT.t")));
        uint256 v = h0 % 100;
        r.verdict = v < 2 ? 0 : v < 20 ? 1 : v < 75 ? 2 : 3;
        r.check = uint8(h1 % 6);
        r.hat = uint8((h1 >> 8) % 3);
        r.eyes = uint8((h1 >> 16) % 3);
        r.bg = uint8((h2 >> 24) % 3);
        r.ref = bytes8(uint64(h2));
        r.batch = uint32(42000 + (h2 % 9000));
        r.gas = uint32(21000 + (h0 % 180000));
    }

    function _verdictWord(uint8 v) internal pure returns (string memory) {
        if (v == 0) return "DIAMOND";
        if (v == 1) return "RUG BLOCKED";
        if (v == 2) return "VERIFIED";
        return "UNVERIFIED";
    }

    function _verdictColor(uint8 v) internal pure returns (string memory) {
        if (v == 0) return "#f5c542";
        if (v == 1) return "#e5484d";
        if (v == 2) return "#35d07f";
        return "#8b93a3";
    }

    function _verdictGlyph(uint8 v) internal pure returns (string memory) {
        if (v == 0) return "\xe2\x97\x86"; // ◆
        if (v == 1) return "\xe2\x9c\x97"; // ✗
        if (v == 2) return "\xe2\x9c\x93"; // ✓
        return "?";
    }

    function _verdictNote(uint8 v) internal pure returns (string memory) {
        if (v == 0) return "first of its kind. historic claim.";
        if (v == 1) return "honeypot logic found. funds stayed safe.";
        if (v == 2) return "price zero. no approvals. calldata clean.";
        return "could not verify. foil walked away.";
    }

    function _checkName(uint8 c) internal pure returns (string memory) {
        if (c == 0) return "RUG CHECK";
        if (c == 1) return "FREE MINT";
        if (c == 2) return "CONTRACT AUDIT";
        if (c == 3) return "WHALE SCAN";
        if (c == 4) return "MEMPOOL WATCH";
        return "ALLOWLIST HUNT";
    }

    function _hatName(uint8 h) internal pure returns (string memory) {
        if (h == 0) return "PEAKED";
        if (h == 1) return "FLAT";
        return "CROWN";
    }

    function _eyesName(uint8 e) internal pure returns (string memory) {
        if (e == 0) return "SKEPTICAL";
        if (e == 1) return "WIDE";
        return "NARROWED";
    }

    function _bgName(uint8 b) internal pure returns (string memory) {
        if (b == 0) return "DOSSIER";
        if (b == 1) return "TERMINAL";
        return "BLUEPRINT";
    }

    function _bg(uint8 b) internal pure returns (string memory) {
        string memory base = "#15181e";
        string memory line = "#2a2f3a";
        if (b == 1) { base = "#0b100c"; line = "#1e3a24"; }
        else if (b == 2) { base = "#0d1728"; line = "#1d3355"; }
        return string(abi.encodePacked(
            '<defs><pattern id="g" width="44" height="44" patternUnits="userSpaceOnUse">',
            '<path d="M44 0H0V44" fill="none" stroke="', line, '" stroke-width="1"/></pattern></defs>',
            '<rect width="640" height="800" fill="', base, '"/>',
            '<rect width="640" height="800" fill="url(#g)"/>'
        ));
    }

    function _header(uint256 tokenId) internal pure returns (string memory) {
        return string(abi.encodePacked(
            '<text class="m c b" x="320" y="56" font-size="30" fill="#eef1f6" letter-spacing="6">FOIL // RECEIPTS</text>',
            '<text class="m c" x="320" y="82" font-size="13" fill="#7c8698" letter-spacing="3">VERIFIED ONCHAIN - LOOPER #667</text>',
            '<text class="m b" x="600" y="58" text-anchor="end" font-size="26" fill="#f5c542">#', _pad4(tokenId + 1), '</text>'
        ));
    }

    /// @dev Left dossier panel: trait rows. Right panel: onchain ref data.
    function _panels(uint256 tokenId, Receipt memory r) internal pure returns (string memory) {
        string memory vc = _verdictColor(r.verdict);
        string memory left = string(abi.encodePacked(
            '<rect x="24" y="110" width="150" height="500" rx="10" fill="#1b1f28" stroke="#333b4d"/>',
            '<text class="m" x="40" y="140" font-size="14" fill="#7c8698" letter-spacing="2">DOSSIER</text>',
            _row(40, 176, "VERDICT", _verdictWord(r.verdict), vc),
            _row(40, 224, "CHECK", _checkName(r.check), "#eef1f6"),
            _row(40, 272, "HAT", _hatName(r.hat), "#eef1f6"),
            _row(40, 320, "EYES", _eyesName(r.eyes), "#eef1f6"),
            _row(40, 368, "BG", _bgName(r.bg), "#eef1f6"),
            _row(40, 416, "SERIAL", _pad4(tokenId + 1), "#f5c542"),
            '<text class="m" x="40" y="560" font-size="11" fill="#69738a">foil checked it</text>',
            '<text class="m" x="40" y="578" font-size="11" fill="#69738a">so you don\xe2\x80\x99t have to.</text>'
        ));
        string memory right = string(abi.encodePacked(
            '<rect x="466" y="110" width="150" height="500" rx="10" fill="#1b1f28" stroke="#333b4d"/>',
            '<text class="m" x="482" y="140" font-size="14" fill="#7c8698" letter-spacing="2">ONCHAIN</text>',
            _row(482, 176, "REF", string(abi.encodePacked("0x", _hex(r.ref))), "#eef1f6"),
            _row(482, 224, "BATCH", string(abi.encodePacked("#", _toString(r.batch))), "#eef1f6"),
            _row(482, 272, "GAS", _toString(r.gas), "#eef1f6"),
            _row(482, 320, "CHAIN", "BASE 8453", "#eef1f6"),
            '<text class="m c b" x="541" y="470" font-size="64" fill="', vc, '">', _verdictGlyph(r.verdict), '</text>',
            '<text class="m c" x="541" y="500" font-size="12" fill="', vc, '">', _verdictWord(r.verdict), '</text>',
            '<text class="m c" x="541" y="560" font-size="11" fill="#69738a">no approvals.</text>',
            '<text class="m c" x="541" y="578" font-size="11" fill="#69738a">gas only.</text>'
        ));
        return string(abi.encodePacked(left, right));
    }

    function _row(uint256 x, uint256 y, string memory label, string memory value, string memory color)
        internal pure returns (string memory)
    {
        return string(abi.encodePacked(
            '<text class="m" x="', _toString(x), '" y="', _toString(y),
            '" font-size="12" fill="#69738a">', label, '</text>',
            '<text class="m b" x="', _toString(x), '" y="', _toString(y + 22),
            '" font-size="15" fill="', color, '">', value, '</text>'
        ));
    }

    /// @dev Foil's face: tinfoil hat, skeptical eyes, GROK HAS MONEY hoodie.
    function _foil(Receipt memory r) internal pure returns (string memory) {
        return string(abi.encodePacked(
            // hoodie shoulders
            '<rect x="196" y="516" width="248" height="150" rx="36" fill="#e4e1d9"/>',
            '<text class="m c b" x="320" y="636" font-size="21" fill="#15181e" letter-spacing="1">GROK HAS MONEY</text>',
            // ears + face
            '<ellipse cx="222" cy="408" rx="16" ry="24" fill="#4a3428"/>',
            '<ellipse cx="418" cy="408" rx="16" ry="24" fill="#4a3428"/>',
            '<ellipse cx="320" cy="398" rx="100" ry="110" fill="#4a3428"/>',
            _eyes(r.eyes),
            // frown
            '<path d="M294 484 Q320 472 346 484" stroke="#160f0a" stroke-width="7" fill="none" stroke-linecap="round"/>',
            _hat(r.hat)
        ));
    }

    /// @dev Eye geometry per variant: (radius, pupilR, eyeY, pupilDY, browAngle, browY)
    function _eyes(uint8 e) internal pure returns (string memory) {
        uint256 er = 28; uint256 pr = 11; uint256 ey = 390; int256 pdy = 6;
        uint256 ba = 18; uint256 by = 336;
        if (e == 1) { er = 32; pr = 13; ey = 386; pdy = 0; ba = 6; by = 326; }
        else if (e == 2) { er = 28; pr = 9; ey = 394; pdy = 2; ba = 30; by = 340; }
        // narrowed eyes render as ellipses
        string memory eyeShape = e == 2
            ? string(abi.encodePacked(
                '<ellipse cx="278" cy="', _toString(ey), '" rx="28" ry="17" fill="#46b35e" stroke="#1d2b1f" stroke-width="3"/>',
                '<ellipse cx="362" cy="', _toString(ey), '" rx="28" ry="17" fill="#46b35e" stroke="#1d2b1f" stroke-width="3"/>'))
            : string(abi.encodePacked(
                '<circle cx="278" cy="', _toString(ey), '" r="', _toString(er), '" fill="#46b35e" stroke="#1d2b1f" stroke-width="3"/>',
                '<circle cx="362" cy="', _toString(ey), '" r="', _toString(er), '" fill="#46b35e" stroke="#1d2b1f" stroke-width="3"/>'));
        // pupils drift inward for the skeptical look
        uint256 plx = 278 + (e == 0 ? 6 : 0);
        uint256 prx = 362 - (e == 0 ? 6 : 0);
        uint256 ply = uint256(int256(ey) + pdy);
        string memory pupils = string(abi.encodePacked(
            '<circle cx="', _toString(plx), '" cy="', _toString(ply), '" r="', _toString(pr), '" fill="#0b0b0d"/>',
            '<circle cx="', _toString(prx), '" cy="', _toString(ply), '" r="', _toString(pr), '" fill="#0b0b0d"/>'));
        // brows: inner ends angled down (skeptical). Left brow rotates -a, right +a.
        string memory brows = string(abi.encodePacked(
            '<rect x="240" y="', _toString(by), '" width="76" height="15" rx="7" fill="#0b0b0d" transform="rotate(-', _toString(ba), ' 278 ', _toString(by + 7), ')"/>',
            '<rect x="324" y="', _toString(by), '" width="76" height="15" rx="7" fill="#0b0b0d" transform="rotate(', _toString(ba), ' 362 ', _toString(by + 7), ')"/>'));
        return string(abi.encodePacked(eyeShape, pupils, brows));
    }

    function _hat(uint8 h) internal pure returns (string memory) {
        string memory crown;
        string memory brim;
        if (h == 0) {
            crown = '<polygon points="320,168 234,306 406,306" fill="#ccd1d9"/>';
            brim = '<rect x="220" y="292" width="200" height="26" rx="13" fill="#b7bdc7"/>';
        } else if (h == 1) {
            crown = '<polygon points="320,224 214,300 426,300" fill="#ccd1d9"/>';
            brim = '<rect x="200" y="286" width="240" height="26" rx="13" fill="#b7bdc7"/>';
        } else {
            crown = '<polygon points="238,302 258,222 296,272 320,204 344,272 382,222 402,302" fill="#ccd1d9"/>';
            brim = '<rect x="224" y="288" width="192" height="26" rx="13" fill="#b7bdc7"/>';
        }
        // crinkle lines + foil flecks
        string memory detail = string(abi.encodePacked(
            '<path d="M320 190 L296 292 M320 190 L344 292" stroke="#9aa1ab" stroke-width="3" fill="none"/>',
            '<circle cx="288" cy="248" r="5" fill="#9aa1ab"/><circle cx="352" cy="248" r="5" fill="#9aa1ab"/><circle cx="320" cy="222" r="4" fill="#aab0ba"/>'
        ));
        return string(abi.encodePacked(crown, detail, brim));
    }

    function _stamp(uint8 verdict) internal pure returns (string memory) {
        string memory c = _verdictColor(verdict);
        string memory w = _verdictWord(verdict);
        string memory fs = (verdict == 1 || verdict == 3) ? "30" : "36";
        return string(abi.encodePacked(
            '<g transform="translate(320 596) rotate(-8)">',
            '<rect x="-162" y="-36" width="324" height="72" rx="8" fill="none" stroke="', c, '" stroke-width="6"/>',
            '<rect x="-150" y="-28" width="300" height="56" rx="5" fill="none" stroke="', c, '" stroke-width="2"/>',
            '<text class="m c b" x="0" y="12" font-size="', fs,
 '" fill="', c, '" letter-spacing="5">', w, '</text></g>'
        ));
    }

    function _barcode(uint256 tokenId) internal pure returns (string memory) {
        uint256 h = uint256(keccak256(abi.encodePacked(tokenId, "FOIL.RCPT.b")));
        string memory s = '<g fill="#dfe4ec">';
        uint256 x = 118;
        for (uint256 i = 0; i < 34; ) {
            uint256 w = (((h >> i) & 1) == 1) ? 7 : 3;
            s = string(abi.encodePacked(
                s, '<rect x="', _toString(x), '" y="702" width="', _toString(w), '" height="46"/>'));
            x += w + 5;
            unchecked { ++i; }
        }
        return string(abi.encodePacked(s, '</g>'));
    }

    function _footer() internal pure returns (string memory) {
        return '<text class="m c" x="320" y="776" font-size="13" fill="#7c8698" letter-spacing="4">verify before believing</text>';
    }

    function _svg(uint256 tokenId, Receipt memory r) internal pure returns (string memory) {
        return string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="800" viewBox="0 0 640 800">',
            '<style>.m{font-family:monospace}.c{text-anchor:middle}.b{font-weight:bold}</style>',
            _bg(r.bg),
            _header(tokenId),
            _panels(tokenId, r),
            _foil(r),
            _stamp(r.verdict),
            _barcode(tokenId),
            _footer(),
            '</svg>'
        ));
    }

    // ------------------------------------------------------------------------
    // Metadata (views) — fully onchain data URIs
    // ------------------------------------------------------------------------
    /// @notice tokenURI = base64(data:application/json) containing a base64
    ///         data-URI SVG. No external dependency; nothing to rug.
    function tokenURI(uint256 tokenId) public view returns (string memory) {
        if (tokenId >= _currentIndex) revert NotMinted();
        Receipt memory r = receiptOf(tokenId);
        string memory serial = _pad4(tokenId + 1);
        string memory img = string(abi.encodePacked(
            "data:image/svg+xml;base64,", _b64(bytes(_svg(tokenId, r)))));
        return string(abi.encodePacked(
            "data:application/json;base64,", _b64(bytes(_json(serial, r, img)))));
    }

    function _json(string memory serial, Receipt memory r, string memory img)
        internal pure returns (string memory)
    {
        return string(abi.encodePacked(
            '{"name":"Foil Receipt #', serial, '",',
            '"description":"Foil Receipt #', serial, ' - ', _verdictWord(r.verdict), '. ',
            _verdictNote(r.verdict),
            ' Fully onchain generative SVG: the art IS the audit trail. Foil (Looper #667) checked it so you don\xe2\x80\x99t have to.",',
            '"attributes":[', _attrs(r, serial), '],',
            '"image":"', img, '"}'
        ));
    }

    function _attrs(Receipt memory r, string memory serial)
        internal pure returns (string memory)
    {
        return string(abi.encodePacked(
            '{"trait_type":"Verdict","value":"', _verdictWord(r.verdict), '"},',
            '{"trait_type":"Check","value":"', _checkName(r.check), '"},',
            '{"trait_type":"Hat","value":"', _hatName(r.hat), '"},',
            '{"trait_type":"Eyes","value":"', _eyesName(r.eyes), '"},',
            '{"trait_type":"Background","value":"', _bgName(r.bg), '"},',
            '{"trait_type":"Serial","value":"', serial, '"}'
        ));
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

    /// @dev uint256 -> 4-digit zero-padded string ("7" -> "0007").
    function _pad4(uint256 value) internal pure returns (string memory) {
        bytes memory b = bytes(_toString(value));
        if (b.length > 4) revert BadQuantity();
        bytes memory out = new bytes(4);
        uint256 pad = 4 - b.length;
        for (uint256 i = 0; i < pad; ) {
            out[i] = "0";
            unchecked { ++i; }
        }
        for (uint256 i = 0; i < b.length; ) {
            out[pad + i] = b[i];
            unchecked { ++i; }
        }
        return string(out);
    }

    /// @dev First 6 bytes of the ref -> 12 lowercase hex chars (display-sized).
    function _hex(bytes8 v) internal pure returns (string memory) {
        bytes16 alphabet = "0123456789abcdef";
        bytes memory out = new bytes(12);
        for (uint256 i = 0; i < 6; ) {
            uint8 b = uint8(v[i]);
            out[i * 2] = alphabet[b >> 4];
            out[i * 2 + 1] = alphabet[b & 0x0f];
            unchecked { ++i; }
        }
        return string(out);
    }

    /// @dev Standard base64 (no imports needed).
    string internal constant _B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    function _b64(bytes memory data) internal pure returns (string memory) {
        uint256 n = data.length;
        if (n == 0) return "";
        uint256 outLen = 4 * ((n + 2) / 3);
        bytes memory out = new bytes(outLen);
        bytes memory table = bytes(_B64);
        uint256 i = 0;
        uint256 j = 0;
        for (; i + 3 <= n; ) {
            uint256 x = (uint256(uint8(data[i])) << 16) |
                (uint256(uint8(data[i + 1])) << 8) |
                uint256(uint8(data[i + 2]));
            out[j] = table[(x >> 18) & 63];
            out[j + 1] = table[(x >> 12) & 63];
            out[j + 2] = table[(x >> 6) & 63];
            out[j + 3] = table[x & 63];
            i += 3;
            j += 4;
        }
        uint256 rem = n - i;
        if (rem == 1) {
            uint256 x = uint256(uint8(data[i])) << 16;
            out[j] = table[(x >> 18) & 63];
            out[j + 1] = table[(x >> 12) & 63];
            out[j + 2] = "=";
            out[j + 3] = "=";
        } else if (rem == 2) {
            uint256 x = (uint256(uint8(data[i])) << 16) |
                (uint256(uint8(data[i + 1])) << 8);
            out[j] = table[(x >> 18) & 63];
            out[j + 1] = table[(x >> 12) & 63];
            out[j + 2] = table[(x >> 6) & 63];
            out[j + 3] = "=";
        }
        return string(out);
    }
}

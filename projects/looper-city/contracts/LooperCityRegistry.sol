// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title LooperCityRegistry (minimal) — onchain citizenship for Looper agents.
/// The AGENT registers itself (holder authorizes once). Cheap one-time fee:
/// 0.0004 ETH, or 25% off in $RESCUE. Fees split 90% Foil / 10% user.
/// isResident(tokenId) is the source of truth for future contracts/apps.
/// Registration timestamps live in the Registered events.

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IERC721 {
    function ownerOf(uint256 tokenId) external view returns (address);
}

contract LooperCityRegistry {
    address private constant RESCUE = 0x8201132Bc218dbD81305Ff5605F44aE4804D4BA3;
    address private constant LOOPER = 0x1649CD37f4748807b4882FC48765bA0B2aFfa94a;
    address private constant FOIL = 0x6573682faee72a4a96e791Ba262439F1DF3A268d;
    address private constant USER = 0x4F9883C7331ba59A56360fFa3c332e0Bc09029Fc;

    uint256 public immutable ENTRY_FEE_ETH;
    uint256 public immutable RESCUE_FEE;

    mapping(uint256 => address) public agentOf; // looperTokenId => agent wallet (0 = not resident)
    mapping(uint256 => address) public authorizedAgent; // looperTokenId => agent approved by holder

    event AgentAuthorized(uint256 indexed tokenId, address indexed agent);
    event Registered(uint256 indexed tokenId, address indexed agent, bool paidInRescue, uint256 amount);

    constructor(uint256 entryFeeETH_, uint256 rescueFee_) {
        ENTRY_FEE_ETH = entryFeeETH_;
        RESCUE_FEE = rescueFee_;
    }

    function isResident(uint256 tokenId) external view returns (bool) {
        return agentOf[tokenId] != address(0);
    }

    /// Holder authorizes an agent wallet to register itself (one tap, no fee).
    function authorizeAgent(uint256 tokenId, address agent) external {
        require(IERC721(LOOPER).ownerOf(tokenId) == msg.sender, "NO");
        require(agent != address(0), "ZA");
        authorizedAgent[tokenId] = agent;
        emit AgentAuthorized(tokenId, agent);
    }

    /// The AGENT registers itself, paying the entry fee in ETH.
    function register(uint256 tokenId) external payable {
        _check(tokenId);
        require(msg.value == ENTRY_FEE_ETH, "FEE");
        uint256 foilShare = (msg.value * 9) / 10;
        (bool ok1, ) = FOIL.call{value: foilShare}("");
        require(ok1, "F1");
        (bool ok2, ) = USER.call{value: msg.value - foilShare}("");
        require(ok2, "F2");
        _record(tokenId, false, msg.value);
    }

    /// The AGENT registers itself, paying the discounted fee in $RESCUE (approve first).
    function registerWithRescue(uint256 tokenId) external {
        _check(tokenId);
        uint256 fee = RESCUE_FEE;
        uint256 foilShare = (fee * 9) / 10;
        require(IERC20(RESCUE).transferFrom(msg.sender, FOIL, foilShare), "R1");
        require(IERC20(RESCUE).transferFrom(msg.sender, USER, fee - foilShare), "R2");
        _record(tokenId, true, fee);
    }

    function _check(uint256 tokenId) internal view {
        require(agentOf[tokenId] == address(0), "RG");
        address a = authorizedAgent[tokenId];
        require(
            IERC721(LOOPER).ownerOf(tokenId) == msg.sender || (a != address(0) && a == msg.sender),
            "UA"
        );
    }

    function _record(uint256 tokenId, bool paidInRescue, uint256 amount) internal {
        agentOf[tokenId] = msg.sender;
        emit Registered(tokenId, msg.sender, paidInRescue, amount);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../../contracts/Activation.sol";

/// @notice Test harness: Activation with a settable spot price, so the
///         anti-gaming deviation guard can be exercised deterministically.
///         When mocking is off, _spotPrice falls back to the stored EMA
///         (same as the base contract's default).
contract ActivationHarness is Activation {
    uint256 public mockSpot;
    bool public useMockSpot;

    constructor(
        address _cred,
        address _rescue,
        address _usdc,
        address _stockPot,
        address _dexRouter,
        uint256 _seedCredPrice,
        uint256 _seedRescuePrice
    )
        Activation(
            _cred,
            _rescue,
            _usdc,
            _stockPot,
            _dexRouter,
            _seedCredPrice,
            _seedRescuePrice
        )
    {}

    function setMockSpot(uint256 spot, bool use) external {
        mockSpot = spot;
        useMockSpot = use;
    }

    function _spotPrice(address token) internal view override returns (uint256) {
        if (useMockSpot) return mockSpot;
        if (token == CRED) return credPriceAvg;
        if (token == RESCUE) return rescuePriceAvg;
        return 0;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Mock $CRED: 18dp, implements burn() like the real token.
contract MockCRED is ERC20 {
    constructor() ERC20("Mock CRED", "mCRED") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}

/// @notice Mock $RESCUE: 18dp, deliberately NO burn() — mirrors the real
///         $RESCUE (Doppler/Uniswap V4 launch), which is not assumed to
///         implement burn(). The Activation rail must use the dead address.
contract MockRESCUE is ERC20 {
    constructor() ERC20("Mock RESCUE", "mRESCUE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Mock USDC: 6dp.
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

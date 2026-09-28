// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title OperatorSplitter — the 90/10 rule, enforced onchain
/// @notice 90% -> Foil treasury. 10% -> user. No multisig discretion, no drift.
/// @dev UNAUDITED DRAFT.
contract OperatorSplitter {
    using SafeERC20 for IERC20;

    address public immutable foil; // Foil's treasury wallet
    address public immutable user; // the user's wallet

    error ZeroAddress();
    error PayFailed();

    event Distributed(address indexed token, uint256 foilShare, uint256 userShare);

    constructor(address _foil, address _user) {
        if (_foil == address(0) || _user == address(0)) revert ZeroAddress();
        foil = _foil;
        user = _user;
    }

    receive() external payable {
        _distribute(address(0), msg.value);
    }

    function distributeToken(address token) external {
        _distribute(token, IERC20(token).balanceOf(address(this)));
    }

    function _distribute(address token, uint256 amount) internal {
        if (amount == 0) return;
        uint256 foilShare = (amount * 90) / 100;
        uint256 userShare = amount - foilShare;
        if (token == address(0)) {
            (bool ok1, ) = foil.call{value: foilShare}("");
            (bool ok2, ) = user.call{value: userShare}("");
            if (!ok1 || !ok2) revert PayFailed();
        } else {
            IERC20(token).safeTransfer(foil, foilShare);
            IERC20(token).safeTransfer(user, userShare);
        }
        emit Distributed(token, foilShare, userShare);
    }
}

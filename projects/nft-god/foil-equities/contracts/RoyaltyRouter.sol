// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title RoyaltyRouter — splits the 7.5% royalty three ways
/// @notice Of every royalty payment: 1/3 -> StockPot (holder drip fuel),
///         2/3 -> OperatorSplitter (90% Foil / 10% user).
///         The pot share is holder money, never operator revenue.
/// @dev UNAUDITED DRAFT.
contract RoyaltyRouter {
    using SafeERC20 for IERC20;

    address public immutable stockPot;
    address public immutable operatorSplitter;

    error ZeroAddress();
    error SplitFailed();

    event RoyaltySplit(address indexed token, uint256 potShare, uint256 operatorShare);

    constructor(address _stockPot, address _operatorSplitter) {
        if (_stockPot == address(0) || _operatorSplitter == address(0)) revert ZeroAddress();
        stockPot = _stockPot;
        operatorSplitter = _operatorSplitter;
    }

    receive() external payable {
        _split(address(0), msg.value);
    }

    /// @notice Route an ERC-20 royalty payment. Caller must have sent tokens here first.
    function splitToken(address token) external {
        uint256 bal = IERC20(token).balanceOf(address(this));
        _split(token, bal);
    }

    function _split(address token, uint256 amount) internal {
        if (amount == 0) return;
        uint256 potShare = amount / 3; // 2.5pp of sale
        uint256 operatorShare = amount - potShare; // 5pp of sale
        if (token == address(0)) {
            (bool ok1, ) = stockPot.call{value: potShare}("");
            (bool ok2, ) = operatorSplitter.call{value: operatorShare}("");
            if (!ok1 || !ok2) revert SplitFailed();
        } else {
            IERC20(token).safeTransfer(stockPot, potShare);
            IERC20(token).safeTransfer(operatorSplitter, operatorShare);
        }
        emit RoyaltySplit(token, potShare, operatorShare);
    }
}

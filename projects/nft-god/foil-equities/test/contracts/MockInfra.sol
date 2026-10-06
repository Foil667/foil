// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Mock StockPot: records USDC/ETH received. Activation's USDC rail
///         transfers USDC directly; the ETH rail uses receive().
contract MockPot {
    uint256 public usdcReceived;
    uint256 public ethReceived;

    function depositUSDC(uint256 amount) external {
        // not used by Activation's rails, but part of the IStockPot interface
        usdcReceived += amount;
    }

    receive() external payable {
        ethReceived += msg.value;
    }
}

/// @notice Mock DEX router: converts token -> USDC at a settable price.
///         price = USD per token at 1e18 (same scale as Activation's EMA).
///         Direction A (discount token 18dp -> USDC 6dp, the Activation leg):
///           amountOut = amountIn * price / 1e30  (USDC-wei).
///         Direction B (USDC 6dp -> stock 6dp, the StockPot leg): the quote is
///           inverted — amountOut = amountIn * 1e18 / price  (stock-wei).
///         The mock branches on path[0] == usdc (set via setUsdc()).
///         Reverts if the output would breach the caller's minOut.
contract MockRouter {
    uint256 public price; // USD/token, 1e18
    address public usdc;

    function setPrice(uint256 p) external {
        price = p;
    }

    function setUsdc(address u) external {
        usdc = u;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 /* deadline */
    ) external returns (uint256[] memory amounts) {
        uint256 amountOut;
        if (usdc != address(0) && path[0] == usdc) {
            // USDC (6dp) -> stock (6dp): stockWei = usdcWei * 1e18 / price
            amountOut = (amountIn * 1e18) / price;
        } else {
            // discount token (18dp) -> USDC (6dp): usdcWei = tokenWei * price / 1e30
            amountOut = (amountIn * price) / 1e30;
        }
        require(amountOut >= amountOutMin, "mock-router: slippage");
        IERC20(path[0]).transferFrom(msg.sender, address(this), amountIn);
        IERC20(path[1]).transfer(to, amountOut);
        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = amountOut;
    }
}

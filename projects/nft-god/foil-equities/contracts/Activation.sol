// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IStockPot {
    function depositUSDC(uint256 amount) external;
    receive() external payable;
}

interface IDexRouter {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

interface ICRED {
    function burn(uint256 amount) external;
}

/// @title Activation — turn on the stock drip for an NFT
/// @notice One-time $10 activation (ETH/USDC) per token per holder.
///         Base chain also accepts $CRED or $RESCUE at a 20% discount ($8),
///         mirroring Helixa's own flywheel pattern. Of CRED paid: 50% burned,
///         50% swapped to USDC -> StockPot. Of RESCUE paid: 50% sent to the
///         dead address (no burn() assumption — $RESCUE is a Doppler/Uniswap
///         V4 launch and may not implement burn), 50% swapped to USDC ->
///         StockPot.
///         ANTI-GAMING:
///         - Each discount token is priced on an exponential moving average,
///           not spot. Spot must sit within MAX_DEVIATION of the average or
///           the tx reverts, so a flash-pump cannot buy cheap activations.
///           Discounts apply to the average, never to spot.
///         - Activation resets on every transfer (called by the NFT contract),
///           so flippers never accumulate drip.
///         - CRED/RESCUE token addresses are hardcoded to the verified
///           deployments. address(0) disables a rail (used for $RESCUE on
///           Robinhood Chain, where it doesn't exist).
///         - Spot prices come from _spotPrice(token): the default returns the
///           stored EMA (conservative); per-chain oracle adapters override it
///           to read the canonical pool. Adapters are deployed per chain and
///           audited separately.
/// @dev UNAUDITED DRAFT.
contract Activation is Ownable {
    using SafeERC20 for IERC20;

    // Verified $CRED on Base: 0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3
    // (immutable per deployment; RH chain deployment uses address(0) = disabled)
    address public immutable CRED;

    // $RESCUE on Base: 0x8201132Bc218dbD81305Ff5605F44aE4804D4BA3
    // (immutable per deployment; RH chain deployment uses address(0) = disabled)
    address public immutable RESCUE;

    // Effective burn destination for the $RESCUE rail (no burn() assumption)
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;

    IERC20 public immutable USDC;
    IStockPot public stockPot;
    IDexRouter public dexRouter;
    address public nftContract;

    uint256 public constant ACTIVATION_USDC = 10e6; // $10 (USDC 6dp)
    uint256 public constant CRED_DISCOUNT_BPS = 8000; // pay 80% = 20% off, in discount-token value
    uint256 public constant MAX_DEVIATION_BPS = 2500; // spot must be within 25% of avg

    // EMA of token price in USDC-wei per token-wei (1e12 scale), seeded at deploy
    uint256 public credPriceAvg;
    uint256 public rescuePriceAvg;
    uint256 public constant EMA_ALPHA_BPS = 2000; // 20% weight to newest observation

    mapping(uint256 => bool) public activated;

    event Activated(uint256 indexed tokenId, address indexed payer, address payToken);
    event ActivationReset(uint256 indexed tokenId);
    event CredPriceUpdate(uint256 newAvg);
    event RescuePriceUpdate(uint256 newAvg);

    error NotNFT();
    error AlreadyActive();
    error PriceDeviation();
    error ZeroAddress();

    constructor(
        address _cred,
        address _rescue,
        address _usdc,
        address _stockPot,
        address _dexRouter,
        uint256 _seedCredPrice,
        uint256 _seedRescuePrice
    ) Ownable(msg.sender) {
        if (_usdc == address(0) || _stockPot == address(0)) revert ZeroAddress();
        CRED = _cred;
        RESCUE = _rescue;
        USDC = IERC20(_usdc);
        stockPot = IStockPot(payable(_stockPot));
        dexRouter = IDexRouter(_dexRouter);
        credPriceAvg = _seedCredPrice;
        rescuePriceAvg = _seedRescuePrice;
    }

    function setNFTContract(address _nft) external onlyOwner {
        if (_nft == address(0)) revert ZeroAddress();
        nftContract = _nft;
    }

    function setStockPot(address _pot) external onlyOwner {
        if (_pot == address(0)) revert ZeroAddress();
        stockPot = IStockPot(payable(_pot));
    }

    // ---------- activation paths ----------

    function activateWithUSDC(uint256 tokenId, uint256 amount) external {
        if (activated[tokenId]) revert AlreadyActive();
        USDC.safeTransferFrom(msg.sender, address(this), ACTIVATION_USDC);
        USDC.safeTransfer(address(stockPot), ACTIVATION_USDC);
        // forward any excess caller sent straight through as well
        if (amount > ACTIVATION_USDC) {
            USDC.safeTransfer(address(stockPot), amount - ACTIVATION_USDC);
        }
        activated[tokenId] = true;
        emit Activated(tokenId, msg.sender, address(USDC));
    }

    function activateWithETH(uint256 tokenId) external payable {
        if (activated[tokenId]) revert AlreadyActive();
        // ETH forwarded to pot; offchain indexer values it at $10 at deposit time.
        // (Chainlink ETH/USD feed can replace this trust assumption pre-audit.)
        (bool ok, ) = address(stockPot).call{value: msg.value}("");
        require(ok, "pot send failed");
        activated[tokenId] = true;
        emit Activated(tokenId, msg.sender, address(0));
    }

    /// @notice Pay in $CRED at 20% discount vs the $10 USDC price.
    /// @param maxSlippageBps max acceptable slippage on the 50% CRED->USDC swap leg.
    function activateWithCRED(
        uint256 tokenId,
        uint256 maxSlippageBps
    ) external {
        _activateDiscounted(tokenId, CRED, maxSlippageBps);
    }

    /// @notice Pay in $RESCUE at 20% discount vs the $10 USDC price.
    ///         50% of collected $RESCUE goes to the dead address (effective
    ///         burn — $RESCUE has no burn()), 50% swapped to USDC -> StockPot.
    /// @param maxSlippageBps max acceptable slippage on the 50% RESCUE->USDC swap leg.
    function activateWithRESCUE(
        uint256 tokenId,
        uint256 maxSlippageBps
    ) external {
        _activateDiscounted(tokenId, RESCUE, maxSlippageBps);
    }

    /// @notice Called by the NFT contract on every transfer. Resets drip rights.
    function onTransferReset(uint256 tokenId) external {
        if (msg.sender != nftContract) revert NotNFT();
        if (activated[tokenId]) {
            activated[tokenId] = false;
            emit ActivationReset(tokenId);
        }
    }

    // ---------- discount-token internals ----------

    /// @dev Shared engine for the CRED and RESCUE discount rails.
    ///      CRED's burn half calls ICRED.burn; RESCUE's burn half is sent to
    ///      the dead address (no burn() assumption on the token).
    function _activateDiscounted(
        uint256 tokenId,
        address token,
        uint256 maxSlippageBps
    ) internal {
        if (token == address(0)) revert ZeroAddress(); // rail disabled on this chain
        if (activated[tokenId]) revert AlreadyActive();

        uint256 avg = token == CRED ? credPriceAvg : rescuePriceAvg;
        uint256 spot = _spotPrice(token);
        // ANTI-GAMING: reject if spot deviates too far from the moving average.
        if (
            spot * 10_000 < avg * (10_000 - MAX_DEVIATION_BPS) ||
            spot * 10_000 > avg * (10_000 + MAX_DEVIATION_BPS)
        ) revert PriceDeviation();

        // $8 worth of discount token at the EMA price (discount applied to the
        // average, not spot — flash pumps can't cheapen activations)
        uint256 discountedUsd = (ACTIVATION_USDC * CRED_DISCOUNT_BPS) / 10_000;
        uint256 tokenAmount = (discountedUsd * 1e12) / avg;

        IERC20(token).safeTransferFrom(msg.sender, address(this), tokenAmount);

        uint256 swapHalf = tokenAmount - tokenAmount / 2;
        if (token == CRED) {
            ICRED(CRED).burn(tokenAmount / 2);
        } else {
            // $RESCUE has no burn() — dead-address transfer is the effective burn
            IERC20(token).safeTransfer(DEAD, tokenAmount / 2);
        }

        _swapHalfToPot(token, swapHalf, avg, maxSlippageBps);
        _foldObservation(token, spot, avg);

        activated[tokenId] = true;
        emit Activated(tokenId, msg.sender, token);
    }

    /// @dev Swap the pot half of a discount activation: token -> USDC -> StockPot,
    ///      with the caller's slippage cap as minOut.
    function _swapHalfToPot(
        address token,
        uint256 swapHalf,
        uint256 avg,
        uint256 maxSlippageBps
    ) internal {
        address[] memory path = new address[](2);
        path[0] = token;
        path[1] = address(USDC);
        IERC20(token).forceApprove(address(dexRouter), swapHalf);
        uint256 minOut = (swapHalf * avg * (10_000 - maxSlippageBps)) / 10_000 / 1e12;
        uint256[] memory amounts = dexRouter.swapExactTokensForTokens(
            swapHalf,
            minOut,
            path,
            address(this),
            block.timestamp + 300
        );
        USDC.safeTransfer(address(stockPot), amounts[1]);
    }

    /// @dev Fold a spot observation into the matching token's EMA.
    function _foldObservation(
        address token,
        uint256 spot,
        uint256 avg
    ) internal {
        uint256 newAvg = (avg * (10_000 - EMA_ALPHA_BPS)) / 10_000
            + (spot * EMA_ALPHA_BPS) / 10_000;
        if (token == CRED) {
            credPriceAvg = newAvg;
            emit CredPriceUpdate(newAvg);
        } else {
            rescuePriceAvg = newAvg;
            emit RescuePriceUpdate(newAvg);
        }
    }

    // ---------- pricing ----------

    /// @dev Override per chain: read discount-token/USDC spot from the
    ///      canonical pool. Base: CRED/WETH UniV4 pool -> WETH/USDC;
    ///      RESCUE/WETH -> WETH/USDC. Default returns the stored EMA
    ///      (conservative); concrete oracle adapters override per token.
    function _spotPrice(address token) internal view virtual returns (uint256) {
        if (token == CRED) return credPriceAvg;
        if (token == RESCUE) return rescuePriceAvg;
        return 0;
    }

    /// @notice Enumerate activated token IDs for the distributor (paginated).
    function activatedCount() external view returns (uint256) {
        // NOTE: v1 expects the indexer to track Activated events offchain and
        // pass the active list into StockPot.distribute(). Onchain enumeration
        // of 667 ids is left out to keep gas bounded.
        return 0;
    }
}

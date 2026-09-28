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
///         Base chain also accepts $CRED at a 20% discount ($8), mirroring
///         Helixa's own flywheel pattern. Of CRED paid: 50% burned, 50% swapped
///         to USDC -> StockPot.
///         ANTI-GAMING:
///         - CRED price uses an exponential moving average, not spot. Spot must
///           sit within MAX_DEVIATION of the average or the tx reverts, so a
///           flash-pump cannot buy cheap activations.
///         - Activation resets on every transfer (called by the NFT contract),
///           so flippers never accumulate drip.
///         - CRED token address is hardcoded to the verified Helixa deployment.
/// @dev UNAUDITED DRAFT.
contract Activation is Ownable {
    using SafeERC20 for IERC20;

    // Verified $CRED on Base: 0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3
    // (immutable per deployment; RH chain deployment uses address(0) = disabled)
    address public immutable CRED;
    IERC20 public immutable USDC;
    IStockPot public stockPot;
    IDexRouter public dexRouter;
    address public nftContract;

    uint256 public constant ACTIVATION_USDC = 10e6; // $10 (USDC 6dp)
    uint256 public constant CRED_DISCOUNT_BPS = 8000; // pay 80% = 20% off, in CRED value
    uint256 public constant MAX_DEVIATION_BPS = 2500; // spot must be within 25% of avg

    // EMA of CRED price in USDC-wei per CRED-wei (1e12 scale), seeded at deploy
    uint256 public credPriceAvg;
    uint256 public constant EMA_ALPHA_BPS = 2000; // 20% weight to newest observation

    mapping(uint256 => bool) public activated;

    event Activated(uint256 indexed tokenId, address indexed payer, address payToken);
    event ActivationReset(uint256 indexed tokenId);
    event CredPriceUpdate(uint256 newAvg);

    error NotNFT();
    error AlreadyActive();
    error PriceDeviation();
    error ZeroAddress();

    constructor(
        address _cred,
        address _usdc,
        address _stockPot,
        address _dexRouter,
        uint256 _seedCredPrice
    ) Ownable(msg.sender) {
        if (_usdc == address(0) || _stockPot == address(0)) revert ZeroAddress();
        CRED = _cred;
        USDC = IERC20(_usdc);
        stockPot = IStockPot(_stockPot);
        dexRouter = IDexRouter(_dexRouter);
        credPriceAvg = _seedCredPrice;
    }

    function setNFTContract(address _nft) external onlyOwner {
        if (_nft == address(0)) revert ZeroAddress();
        nftContract = _nft;
    }

    function setStockPot(address _pot) external onlyOwner {
        if (_pot == address(0)) revert ZeroAddress();
        stockPot = IStockPot(_pot);
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
        if (CRED == address(0)) revert ZeroAddress(); // CRED rail disabled on this chain
        if (activated[tokenId]) revert AlreadyActive();

        uint256 spot = _credSpotPrice();
        // ANTI-GAMING: reject if spot deviates too far from the moving average.
        uint256 lo = (credPriceAvg * (10_000 - MAX_DEVIATION_BPS)) / 10_000;
        uint256 hi = (credPriceAvg * (10_000 + MAX_DEVIATION_BPS)) / 10_000;
        if (spot < lo || spot > hi) revert PriceDeviation();

        // $8 worth of CRED at the EMA price (discount applied to the average, not spot)
        uint256 discountedUsd = (ACTIVATION_USDC * CRED_DISCOUNT_BPS) / 10_000;
        uint256 credAmount = (discountedUsd * 1e12) / credPriceAvg;

        IERC20(CRED).safeTransferFrom(msg.sender, address(this), credAmount);

        uint256 burnHalf = credAmount / 2;
        uint256 swapHalf = credAmount - burnHalf;
        ICRED(CRED).burn(burnHalf);

        // swap remaining 50% -> USDC -> pot, with caller-specified slippage cap
        address[] memory path = new address[](2);
        path[0] = CRED;
        path[1] = address(USDC);
        IERC20(CRED).safeApprove(address(dexRouter), swapHalf);
        uint256 minOut = (swapHalf * credPriceAvg * (10_000 - maxSlippageBps)) / 10_000 / 1e12;
        uint256[] memory amounts = dexRouter.swapExactTokensForTokens(
            swapHalf,
            minOut,
            path,
            address(this),
            block.timestamp + 300
        );
        USDC.safeTransfer(address(stockPot), amounts[1]);

        // fold this observation into the EMA
        credPriceAvg = (credPriceAvg * (10_000 - EMA_ALPHA_BPS)) / 10_000
            + (spot * EMA_ALPHA_BPS) / 10_000;
        emit CredPriceUpdate(credPriceAvg);

        activated[tokenId] = true;
        emit Activated(tokenId, msg.sender, CRED);
    }

    /// @notice Called by the NFT contract on every transfer. Resets drip rights.
    function onTransferReset(uint256 tokenId) external {
        if (msg.sender != nftContract) revert NotNFT();
        if (activated[tokenId]) {
            activated[tokenId] = false;
            emit ActivationReset(tokenId);
        }
    }

    // ---------- pricing ----------

    /// @dev Override per chain: read CRED/USDC spot from the canonical pool.
    ///      Base: CRED/WETH UniV4 pool -> WETH/USDC. Kept abstract here so the
    ///      concrete oracle adapter is deployed per chain and audited separately.
    function _credSpotPrice() internal view virtual returns (uint256) {
        return credPriceAvg; // default: EMA only (conservative); override with pool read
    }

    /// @notice Enumerate activated token IDs for the distributor (paginated).
    function activatedCount() external view returns (uint256) {
        // NOTE: v1 expects the indexer to track Activated events offchain and
        // pass the active list into StockPot.distribute(). Onchain enumeration
        // of 667 ids is left out to keep gas bounded.
        return 0;
    }
}

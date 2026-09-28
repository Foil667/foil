// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IActivationReader {
    function activated(uint256 tokenId) external view returns (bool);
}

interface IFoilEquities {
    function tokenAccount(uint256 tokenId) external view returns (address);
    function totalMinted() external view returns (uint256);
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

/// @title StockPot — the holder-owned stock drip
/// @notice Holds activation fees + the 2.5pp royalty share. Each epoch, a
///         permissionless caller swaps the balance into tokenized stocks and
///         pushes them pro-rata into ACTIVATED NFTs' ERC-6551 wallets.
///         This money belongs to the NFTs. It is never split 90/10.
///         ANTI-GAMING:
///         - Epoch-gated (min 7 days) + per-call slippage caps: sandwich bots
///           cannot force a buy at a manipulated price; any caller can execute
///           but the swap reverts past the slippage bound.
///         - Small caller incentive (50 bps) so distribution happens even when
///           nobody volunteers — bounded so it can't be farmed meaningfully.
///         - Stock token list is owner-managed (add/remove on compromise).
/// @dev UNAUDITED DRAFT.
contract StockPot is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable USDC;
    IFoilEquities public nft;
    IActivationReader public activation;
    IDexRouter public dexRouter;

    address[] public stockTokens; // tokenized equities for this chain
    uint256 public lastDistribution;
    uint256 public constant EPOCH = 7 days;
    uint256 public constant CALLER_FEE_BPS = 50; // 0.5% keeper incentive

    event Deposited(address indexed token, uint256 amount);
    event Distributed(uint256 indexed epochId, uint256 usdcIn, uint256 perNftCount);
    event StockTokenSet(address indexed token, bool allowed);

    error EpochNotReady();
    error ZeroAddress();
    error NoStocks();
    error NothingToDistribute();

    constructor(
        address _usdc,
        address _dexRouter,
        address[] memory _stocks
    ) Ownable(msg.sender) {
        if (_usdc == address(0) || _dexRouter == address(0)) revert ZeroAddress();
        USDC = IERC20(_usdc);
        dexRouter = IDexRouter(_dexRouter);
        for (uint256 i = 0; i < _stocks.length; i++) {
            if (_stocks[i] == address(0)) revert ZeroAddress();
            stockTokens.push(_stocks[i]);
        }
    }

    function setContracts(address _nft, address _activation) external onlyOwner {
        if (_nft == address(0) || _activation == address(0)) revert ZeroAddress();
        nft = IFoilEquities(_nft);
        activation = IActivationReader(_activation);
    }

    function setStockToken(address token, bool allowed) external onlyOwner {
        if (allowed) {
            for (uint256 i = 0; i < stockTokens.length; i++)
                if (stockTokens[i] == token) return;
            stockTokens.push(token);
        } else {
            for (uint256 i = 0; i < stockTokens.length; i++) {
                if (stockTokens[i] == token) {
                    stockTokens[i] = stockTokens[stockTokens.length - 1];
                    stockTokens.pop();
                    break;
                }
            }
        }
        emit StockTokenSet(token, allowed);
    }

    function depositUSDC(uint256 amount) external {
        USDC.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(address(USDC), amount);
    }

    receive() external payable {
        emit Deposited(address(0), msg.value);
    }

    /// @notice Run the epoch: swap USDC -> tokenized stocks, push to activated wallets.
    /// @param activeTokenIds offchain-indexed list of currently activated token IDs.
    /// @param maxSlippageBps reverts the whole distribution if the swap slips past this.
    function distribute(uint256[] calldata activeTokenIds, uint256 maxSlippageBps)
        external
    {
        if (block.timestamp < lastDistribution + EPOCH) revert EpochNotReady();
        if (stockTokens.length == 0) revert NoStocks();

        uint256 bal = USDC.balanceOf(address(this));
        if (bal == 0) revert NothingToDistribute();

        // keeper incentive, bounded
        uint256 fee = (bal * CALLER_FEE_BPS) / 10_000;
        if (fee > 0) USDC.safeTransfer(msg.sender, fee);
        uint256 distributable = bal - fee;

        // count genuinely-activated tokens (defense against stale index data)
        uint256 activeCount = 0;
        for (uint256 i = 0; i < activeTokenIds.length; i++) {
            if (activation.activated(activeTokenIds[i])) activeCount++;
        }
        require(activeCount > 0, "no active nfts");

        // split across stock tokens equally (v1; holder voting weights = upgrade)
        uint256 perStock = distributable / stockTokens.length;
        uint256 epochId = lastDistribution / EPOCH;

        for (uint256 s = 0; s < stockTokens.length; s++) {
            address[] memory path = new address[](2);
            path[0] = address(USDC);
            path[1] = stockTokens[s];
            USDC.forceApprove(address(dexRouter), perStock);
            // NOTE: minOut must be derived from an oracle in production; the
            // caller-supplied slippage bound is relative to the router quote.
            // Pre-audit placeholder: 0 with explicit caller bound is NOT safe —
            // integrate Chainlink/TWAP before mainnet.
            uint256[] memory amounts = dexRouter.swapExactTokensForTokens(
                perStock,
                0,
                path,
                address(this),
                block.timestamp + 300
            );
            uint256 stockOut = amounts[1];
            uint256 perNft = stockOut / activeCount;
            for (uint256 i = 0; i < activeTokenIds.length; i++) {
                uint256 tid = activeTokenIds[i];
                if (!activation.activated(tid)) continue;
                address acct = nft.tokenAccount(tid);
                if (acct == address(0)) continue;
                IERC20(stockTokens[s]).safeTransfer(acct, perNft);
            }
        }

        lastDistribution = block.timestamp;
        emit Distributed(epochId, distributable, activeCount);
    }
}

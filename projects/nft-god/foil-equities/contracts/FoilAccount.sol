// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title FoilAccount — minimal ERC-6551 token-bound account
/// @notice Only the current owner of the bound NFT may execute calls.
/// @dev UNAUDITED DRAFT.
interface IERC721Owner {
    function ownerOf(uint256 tokenId) external view returns (address);
}

contract FoilAccount {
    error NotTokenOwner();
    error CallFailed();

    /// @notice Execute a call from this account. Caller must own the bound NFT.
    function execute(
        address tokenContract,
        uint256 tokenId,
        address to,
        uint256 value,
        bytes calldata data
    ) external payable returns (bytes memory result) {
        if (IERC721Owner(tokenContract).ownerOf(tokenId) != msg.sender)
            revert NotTokenOwner();
        bool ok;
        (ok, result) = to.call{value: value}(data);
        if (!ok) revert CallFailed();
    }

    /// @notice Who controls this account right now.
    function owner(address tokenContract, uint256 tokenId)
        external
        view
        returns (address)
    {
        return IERC721Owner(tokenContract).ownerOf(tokenId);
    }

    receive() external payable {}
}

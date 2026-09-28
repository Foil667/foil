// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @title FoilAccount — agent-ready ERC-6551 token-bound account
/// @notice Only the current owner of the bound NFT may execute calls.
///         The account is ALSO an EIP-1271 signer for the owner: whoever
///         holds the NFT's owner key can sign AS the agent (the TBA itself).
///         The TBA can register itself as an ERC-8004 agent identity in one
///         call via registerAsAgent().
/// @dev AGENT FLOW: mint -> TBA (deployed per-token via the 6551 registry's
///      createAccount, counterfactual-friendly) -> registerAsAgent(identityRegistry, agentURI)
///      -> the agent signs/acts through EIP-1271 + execute(), both owner-gated.
///      NOTE: tokenContract/tokenId are constructor immutables. This assumes
///      the ERC-6551 registry deploys one account instance per token (per-token
///      proxy/createAccount); a shared singleton implementation would need the
///      token bound via ERC-1167 context instead. Auditors: verify the
///      registry-side deployment matches this assumption before mainnet.
/// @dev UNAUDITED DRAFT.
interface IERC721Owner {
    function ownerOf(uint256 tokenId) external view returns (address);
}

contract FoilAccount {
    using ECDSA for bytes32;

    error NotTokenOwner();
    error WrongBoundToken();
    error CallFailed();
    error ZeroAddress();

    /// @dev EIP-1271 magic values.
    bytes4 internal constant EIP1271_MAGIC = 0x1626ba7e;
    bytes4 internal constant EIP1271_FAIL = 0xffffffff;

    address public immutable TOKEN_CONTRACT;
    uint256 public immutable TOKEN_ID;

    event AgentRegistered(address indexed registry, string agentURI);

    constructor(address _tokenContract, uint256 _tokenId) {
        if (_tokenContract == address(0)) revert ZeroAddress();
        TOKEN_CONTRACT = _tokenContract;
        TOKEN_ID = _tokenId;
    }

    /// @notice Execute a call from this account. Caller must own the bound NFT.
    /// @dev The tokenContract/tokenId args must match this account's bound
    ///      token (kept for API compatibility with the pre-agent version).
    function execute(
        address tokenContract,
        uint256 tokenId,
        address to,
        uint256 value,
        bytes calldata data
    ) external payable returns (bytes memory result) {
        if (tokenContract != TOKEN_CONTRACT || tokenId != TOKEN_ID)
            revert WrongBoundToken();
        if (IERC721Owner(TOKEN_CONTRACT).ownerOf(TOKEN_ID) != msg.sender)
            revert NotTokenOwner();
        bool ok;
        (ok, result) = to.call{value: value}(data);
        if (!ok) revert CallFailed();
    }

    /// @notice Who controls this account right now.
    /// @dev Keeps the original (tokenContract, tokenId) argument form so
    ///      existing callers don't break; returns the bound token's owner.
    function owner(address tokenContract, uint256 tokenId)
        external
        view
        returns (address)
    {
        if (tokenContract != TOKEN_CONTRACT || tokenId != TOKEN_ID)
            revert WrongBoundToken();
        return IERC721Owner(TOKEN_CONTRACT).ownerOf(TOKEN_ID);
    }

    // ---------- EIP-1271: sign AS the agent ----------

    /// @notice EIP-1271: is `signature` over `hash` valid for the agent?
    ///         Valid when ecrecover yields the CURRENT NFT owner, either for
    ///         the raw hash or for its "\x19Ethereum Signed Message" form.
    ///         SECURITY: owner-key hygiene IS agent-identity hygiene — whoever
    ///         holds the NFT's owner key can sign as the agent.
    function isValidSignature(bytes32 hash, bytes calldata signature)
        external
        view
        returns (bytes4)
    {
        return _validate(hash, signature);
    }

    /// @notice EIP-1271 variant over raw signed data (hashed internally).
    function isValidSignature(bytes calldata data, bytes calldata signature)
        external
        view
        returns (bytes4)
    {
        return _validate(keccak256(data), signature);
    }

    function _validate(bytes32 hash, bytes calldata signature)
        internal
        view
        returns (bytes4)
    {
        address tokenOwner = IERC721Owner(TOKEN_CONTRACT).ownerOf(TOKEN_ID);
        if (tokenOwner == address(0)) return EIP1271_FAIL;

        // 1) raw-hash recovery (EIP-712 / contract-signed digests)
        (address r1, , ) = ECDSA.tryRecover(hash, signature);
        if (r1 == tokenOwner) return EIP1271_MAGIC;

        // 2) eth_sign / personal_sign prefixed recovery
        bytes32 ethHash = MessageHashUtils.toEthSignedMessageHash(hash);
        (address r2, , ) = ECDSA.tryRecover(ethHash, signature);
        if (r2 == tokenOwner) return EIP1271_MAGIC;

        return EIP1271_FAIL;
    }

    // ---------- ERC-8004 agent registration ----------

    /// @notice Register THIS account as an ERC-8004 agent on `identityRegistry`.
    ///         Owner-gated: only the current NFT owner can register, so nobody
    ///         can register the TBA out from under the holder.
    /// @dev The TBA calls register(string) on itself-as-agent; revert on failure.
    ///      Activation-reset-on-transfer also resets agent control: a new owner
    ///      must re-register if desired.
    function registerAsAgent(address identityRegistry, string calldata agentURI)
        external
    {
        if (IERC721Owner(TOKEN_CONTRACT).ownerOf(TOKEN_ID) != msg.sender)
            revert NotTokenOwner();
        if (identityRegistry == address(0)) revert ZeroAddress();
        (bool ok, ) = identityRegistry.call(
            abi.encodeWithSignature("register(string)", agentURI)
        );
        if (!ok) revert CallFailed();
        emit AgentRegistered(identityRegistry, agentURI);
    }

    receive() external payable {}
}

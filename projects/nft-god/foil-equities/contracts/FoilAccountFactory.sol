// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./FoilAccount.sol";

/// @title FoilAccountFactory — per-token ERC-6551 account deployer
/// @notice RESOLVES THE AUDIT-BLOCKER (docs/AUDIT-READINESS.md §4):
///         FoilAccount binds its token via CONSTRUCTOR IMMUTABLES
///         (TOKEN_CONTRACT / TOKEN_ID). A single pre-deployed instance can
///         therefore NEVER serve as the shared `implementation` for
///         registry.createAccount(...): every proxy delegate-calling into
///         it would read the TEMPLATE's immutables, not its own token's —
///         every token-bound account would be bound to the WRONG token.
///         (See test/run-factory.mjs F4 for a live demonstration.)
///
///         This factory exposes the same createAccount/account interface
///         shape an ERC-6551 registry exposes, but instead of deploying
///         ERC-1167 proxies to a shared implementation, it CREATE2-deploys
///         a FULL, correctly-configured FoilAccount(tokenContract, tokenId)
///         per token. FoilEquities plugs this factory in as its `registry`
///         with `accountImplementation` = the template instance — NO changes
///         to FoilEquities or any of the 6 audited contracts are required.
///
///         The alternative (ERC-1167 minimal-proxy-with-context + custom
///         registry) was rejected: cheaper per account, but custom proxy
///         bytecode is subtler to audit, and non-standard proxies break
///         the address-derivation assumptions of ERC-6551 indexers.
/// @dev UNAUDITED DRAFT. For auditor blessing before any deploy.
contract FoilAccountFactory {
    error WrongImplementation();
    error WrongChain();
    error DeployFailed();
    error InitFailed();

    /// @dev The shared FoilAccount template. Its own immutables are NEVER
    ///      used as account state — they only name the code to deploy.
    ///      createAccount REQUIRES implementation == FOIL_ACCOUNT so a
    ///      miswired caller cannot bind arbitrary logic to token accounts.
    address public immutable FOIL_ACCOUNT;

    event AccountCreated(
        address indexed tokenContract,
        uint256 indexed tokenId,
        address indexed account
    );

    constructor(address _foilAccountTemplate) {
        if (_foilAccountTemplate == address(0)) revert WrongImplementation();
        if (_foilAccountTemplate.code.length == 0) revert WrongImplementation();
        FOIL_ACCOUNT = _foilAccountTemplate;
    }

    /// @notice CREATE2 salt binding every registry input, so addresses are
    ///         unique per (implementation, chain, token, salt) — the same
    ///         counterfactual property the ERC-6551 registry's account()
    ///         provides.
    function _makeSalt(
        address implementation,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(implementation, chainId, tokenContract, tokenId, salt)
            );
    }

    /// @notice Init code for a per-token FoilAccount instance.
    function _initCode(address tokenContract, uint256 tokenId)
        internal
        pure
        returns (bytes memory)
    {
        return
            abi.encodePacked(
                type(FoilAccount).creationCode,
                abi.encode(tokenContract, tokenId)
            );
    }

    /// @notice CREATE2 address derivation shared by account() and createAccount().
    function _derive(
        address implementation,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt
    ) internal view returns (address) {
        bytes memory initCode = _initCode(tokenContract, tokenId);
        bytes32 s = _makeSalt(
            implementation,
            chainId,
            tokenContract,
            tokenId,
            salt
        );
        return
            address(
                uint160(
                    uint256(
                        keccak256(
                            abi.encodePacked(
                                bytes1(0xff),
                                address(this),
                                s,
                                keccak256(initCode)
                            )
                        )
                    )
                )
            );
    }

    /// @notice Counterfactual address of a token's account — computable
    ///         before deployment, exactly like registry.account().
    function account(
        address implementation,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt
    ) external view returns (address) {
        return _derive(implementation, chainId, tokenContract, tokenId, salt);
    }

    /// @notice Deploy (or return the existing) per-token FoilAccount.
    /// @dev Idempotent: re-calling for an already-deployed account returns
    ///      it instead of reverting, so on-demand createTokenAccount calls
    ///      are safe to retry. initData is executed on fresh deploys for
    ///      registry-interface compatibility (FoilEquities always passes "").
    function createAccount(
        address implementation,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt,
        bytes calldata initData
    ) external returns (address acct) {
        if (implementation != FOIL_ACCOUNT) revert WrongImplementation();
        if (chainId != block.chainid) revert WrongChain();
        bytes memory initCode = _initCode(tokenContract, tokenId);
        bytes32 s = _makeSalt(
            implementation,
            chainId,
            tokenContract,
            tokenId,
            salt
        );
        address predicted = address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(
                            bytes1(0xff),
                            address(this),
                            s,
                            keccak256(initCode)
                        )
                    )
                )
            )
        );
        if (predicted.code.length > 0) return predicted; // already deployed
        assembly {
            acct := create2(0, add(initCode, 32), mload(initCode), s)
        }
        if (acct == address(0) || acct != predicted) revert DeployFailed();
        if (initData.length > 0) {
            (bool ok, ) = acct.call(initData);
            if (!ok) revert InitFailed();
        }
        emit AccountCreated(tokenContract, tokenId, acct);
    }
}

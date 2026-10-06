// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Deploys a VANILLA ERC-1167 minimal proxy (the exact runtime bytecode
///         the canonical ERC-6551 registry leaves behind) to a chosen
///         implementation. Used ONLY in run-factory.mjs F4 to demonstrate
///         the audit-blocker: a proxy delegate-calling a shared FoilAccount
///         template reads the TEMPLATE's constructor immutables, not the
///         token's — proving a single fixed-immutable instance is not a
///         per-token implementation.
contract ERC1167ProxyDeployer {
    error DeployFailed();

    function deploy(address implementation, bytes32 salt)
        external
        returns (address proxy)
    {
        // Full 55-byte ERC-1167 creation code: the 10-byte preamble
        // CODECOPYs the 45-byte runtime (363d3d373d3d3d363d73<impl>
        // 5af43d82803e903d91602b57fd5bf3) and returns it — exactly what the
        // canonical ERC-6551 registry leaves behind per token.
        bytes memory code = abi.encodePacked(
            hex"3d602d80600a3d3981f3",
            hex"363d3d373d3d3d363d73",
            implementation,
            hex"5af43d82803e903d91602b57fd5bf3"
        );
        assembly {
            proxy := create2(0, add(code, 32), mload(code), salt)
        }
        if (proxy == address(0)) revert DeployFailed();
    }
}

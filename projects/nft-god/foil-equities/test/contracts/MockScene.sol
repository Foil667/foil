// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Mock ERC-6551 registry: deterministic fake account addresses.
///         createAccount records a mapping; account() returns it.
contract Mock6551Registry {
    mapping(bytes32 => address) public accounts;

    function createAccount(
        address,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt,
        bytes calldata
    ) external returns (address) {
        bytes32 key = keccak256(abi.encode(chainId, tokenContract, tokenId, salt));
        if (accounts[key] == address(0)) {
            // deterministic stand-in address per token
            accounts[key] = address(uint160(uint256(key)));
        }
        return accounts[key];
    }

    function account(
        address,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt
    ) external view returns (address) {
        // counterfactual: deterministic even before createAccount, like the
        // real ERC-6551 registry
        bytes32 key = keccak256(abi.encode(chainId, tokenContract, tokenId, salt));
        address a = accounts[key];
        return a == address(0) ? address(uint160(uint256(key))) : a;
    }
}

/// @notice Mock ERC-721 for binding FoilAccount in tests.
contract MockNFT721 is ERC721 {
    constructor() ERC721("MockNFT", "MNFT") {}

    function mintTo(address to, uint256 tokenId) external {
        _mint(to, tokenId);
    }
}

/// @notice Mock ERC-8004 identity registry: records register() calls.
contract MockIdentityRegistry {
    mapping(address => string) public registrations;
    mapping(address => uint256) public registerCount;

    function register(string calldata agentURI) external returns (uint256) {
        registrations[msg.sender] = agentURI;
        registerCount[msg.sender]++;
        return 1;
    }
}

/// @notice Mock tokenized stock (6dp like a USDC-denominated equity wrapper).
contract MockStock is ERC20 {
    constructor() ERC20("Mock Stock", "mSTK") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice ERC-6551 registry stand-in that deploys REAL FoilAccount
///         instances, for the transfer-reset / createAccount flow test.
contract DeployingRegistry {
    address public implementation; // FoilAccount blueprint (unused; per-token args differ)
    event Created(uint256 indexed tokenId, address account);

    function createAccount(
        address,
        uint256,
        address tokenContract,
        uint256 tokenId,
        uint256,
        bytes calldata
    ) external returns (address acct) {
        // Deploy a fresh FoilAccount bound to (tokenContract, tokenId).
        // The real ERC-6551 registry deploys one account instance per token;
        // this mock mirrors that assumption in FoilAccount's docs.
        bytes memory code = abi.encodePacked(
            type(DeployableAccount).creationCode,
            abi.encode(tokenContract, tokenId)
        );
        bytes32 salt = keccak256(abi.encode(tokenContract, tokenId));
        assembly {
            acct := create2(0, add(code, 32), mload(code), salt)
        }
        require(acct != address(0), "create2 failed");
        emit Created(tokenId, acct);
    }

    function account(
        address,
        uint256,
        address tokenContract,
        uint256 tokenId,
        uint256
    ) external view returns (address) {
        bytes memory code = abi.encodePacked(
            type(DeployableAccount).creationCode,
            abi.encode(tokenContract, tokenId)
        );
        bytes32 salt = keccak256(abi.encode(tokenContract, tokenId));
        bytes32 hash = keccak256(
            abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(code))
        );
        return address(uint160(uint256(hash)));
    }
}

import "../../contracts/FoilAccount.sol";

/// @dev Thin wrapper so create2 can deploy FoilAccount bytecode directly.
contract DeployableAccount is FoilAccount {
    constructor(address _tokenContract, uint256 _tokenId)
        FoilAccount(_tokenContract, _tokenId)
    {}
}

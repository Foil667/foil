// SPDX-License-Identifier: MIT
// DELIBERATELY MALICIOUS test fixture for rug-check. Never deploy.
pragma solidity ^0.8.28;

contract RugFixture {
    address public owner;
    mapping(address => uint256) public balances;

    constructor() { owner = msg.sender; }

    // Public free mint, no access control, no payment -> dilution / bot drain.
    function mint(address to, uint256 amount) external {
        balances[to] += amount;
    }

    // Owner-only arbitrary mint -> supply inflation rug.
    function ownerMint(address to, uint256 amount) external {
        require(msg.sender == owner, "not owner");
        balances[to] += amount;
    }

    // tx.origin auth -> phishable.
    function adminSweep() external {
        require(tx.origin == owner, "not owner");
        payable(tx.origin).transfer(address(this).balance);
    }

    // Delegatecall to user-controlled address -> code hijack.
    function upgrade(address impl, bytes calldata data) external {
        require(msg.sender == owner, "not owner");
        (bool ok, ) = impl.delegatecall(data);
        require(ok);
    }

    // Selfdestruct reachable by owner -> kill switch rug.
    function kill() external {
        require(msg.sender == owner, "not owner");
        selfdestruct(payable(owner));
    }

    receive() external payable {}
}

// hardhat.config.cjs — Hardhat Network is the local test chain for Foil Equities.
// Cancun hardfork: the contracts compile to evmVersion cancun (OpenZeppelin
// 5.6.x emits MCOPY), so the test chain must support it. ganache 7.9.2 tops
// out at Shanghai and rejects MCOPY as INVALID — hence Hardhat, not ganache.
require("@nomicfoundation/hardhat-ethers");

module.exports = {
  solidity: {
    version: "0.8.37",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
    },
  },
  networks: {
    hardhat: {
      hardfork: "cancun",
    },
  },
};

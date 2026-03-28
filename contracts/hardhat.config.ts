import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@typechain/hardhat";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    zama: {
      url: process.env.ZAMA_RPC_URL || "https://devnet.zama.ai",
      accounts: process.env.ZAMA_PRIVATE_KEY ? [process.env.ZAMA_PRIVATE_KEY] : [],
      chainId: 8009,
    },
    localfhevm: {
      url: "http://localhost:8545",
      accounts: process.env.LOCAL_PRIVATE_KEY ? [process.env.LOCAL_PRIVATE_KEY] : [],
      chainId: 31337,
    },
    flowEvmTestnet: {
      url: process.env.FLOW_EVM_RPC_URL || "https://testnet.evm.nodes.onflow.org",
      accounts: process.env.FLOW_EVM_PRIVATE_KEY ? [process.env.FLOW_EVM_PRIVATE_KEY] : [],
      chainId: 545,
      gasPrice: 16038000000,  // Updated to minimum network requirement
      httpTimeout: 60000,     // Increase timeout to 60 seconds for slow networks
      timeout: 60000,         // Transaction confirmation timeout
    },
    flowEvmMainnet: {
      url: process.env.FLOW_EVM_MAINNET_RPC || "https://mainnet.evm.nodes.onflow.org",
      accounts: process.env.FLOW_EVM_PRIVATE_KEY ? [process.env.FLOW_EVM_PRIVATE_KEY] : [],
      chainId: 747,
      gasPrice: 20000000000,  // ~20 gwei for mainnet
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://sepolia.infura.io/v3/YOUR_INFURA_KEY",
      accounts: process.env.SEPOLIA_PRIVATE_KEY ? [process.env.SEPOLIA_PRIVATE_KEY] : [],
      chainId: 11155111,
    },
  },
  paths: {
    sources: "./src",
    tests: "../tests",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  typechain: {
    outDir: "./typechain-types",
    target: "ethers-v6",
  },
};

export default config;

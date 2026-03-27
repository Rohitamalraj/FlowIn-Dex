import { ethers } from "hardhat";

/**
 * Deploy ShieldVault to Flow EVM
 * This deploys the Solidity contracts to Flow's EVM-compatible layer
 */

async function main() {
  console.log("🚀 Deploying ShieldVault to Flow EVM Testnet...\n");

  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("No deployer signer found. Set FLOW_EVM_PRIVATE_KEY in contracts/.env");
  }
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "FLOW\n");

  if (balance === 0n) {
    throw new Error(
      `Deployer ${deployer.address} has 0 FLOW. Fund this address on Flow EVM testnet and retry.`
    );
  }

  const feeData = await ethers.provider.getFeeData();
  const gasPrice = feeData.gasPrice ?? 17000000000n;
  console.log("Using gas price:", ethers.formatUnits(gasPrice, "gwei"), "gwei\n");

  // Deploy DuelFactory (which also deploys AssetRegistry)
  console.log("📦 Deploying DuelFactory...");
  const DuelFactory = await ethers.getContractFactory("DuelFactory");
  const duelFactory = await DuelFactory.deploy({ gasPrice });
  await duelFactory.waitForDeployment();

  const factoryAddress = await duelFactory.getAddress();
  console.log("✅ DuelFactory deployed at:", factoryAddress);

  // Get AssetRegistry address (deployed by DuelFactory)
  const registryAddress = await duelFactory.assetRegistry();
  console.log("✅ AssetRegistry deployed at:", registryAddress);

  // Get network info
  const network = await ethers.provider.getNetwork();

  console.log("\n==================================================");
  console.log("🎉 Flow EVM Deployment Complete!");
  console.log("==================================================");
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId.toString());
  console.log("DuelFactory:", factoryAddress);
  console.log("AssetRegistry:", registryAddress);
  console.log("==================================================\n");

  console.log("📝 Next steps:");
  console.log("1. Copy these addresses to backend/.env");
  console.log("2. Copy these addresses to frontend/.env.local");
  console.log("3. Update Cadence contracts with EVM addresses\n");

  console.log("Backend configuration:");
  console.log(`FLOW_EVM_FACTORY=${factoryAddress}`);
  console.log(`FLOW_EVM_REGISTRY=${registryAddress}\n`);

  console.log("Frontend configuration:");
  console.log(`NEXT_PUBLIC_FLOW_EVM_FACTORY=${factoryAddress}`);
  console.log(`NEXT_PUBLIC_FLOW_EVM_REGISTRY=${registryAddress}\n`);

  // Save deployment info
  const fs = require('fs');
  const deploymentInfo = {
    network: 'flow-evm-testnet',
    chainId: network.chainId.toString(),
    duelFactory: factoryAddress,
    assetRegistry: registryAddress,
    deployer: deployer.address,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(
    'deployments-flow-evm.json',
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("💾 Deployment info saved to deployments-flow-evm.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });

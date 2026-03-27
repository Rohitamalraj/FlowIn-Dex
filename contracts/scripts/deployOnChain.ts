import { ethers } from "hardhat";

// Official Pyth EVM contract for Flow Testnet (per Pyth docs)
const FLOW_EVM_PYTH_ADDRESS =
  process.env.FLOW_EVM_PYTH_ADDRESS ||
  "0x2880aB155794e7179c9eE2e38200202908C17B43";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying on-chain duel system to Flow EVM testnet...");
  console.log("Deployer:", deployer.address);

  // Step 1: Deploy PythConsumer
  console.log("\n✓ Deploying PythConsumer...");
  const PythConsumer = await ethers.getContractFactory("PythConsumer");
  const pythConsumer = await PythConsumer.deploy(FLOW_EVM_PYTH_ADDRESS);
  await pythConsumer.waitForDeployment();
  const pythConsumerAddress = await pythConsumer.getAddress();
  console.log("PythConsumer deployed:", pythConsumerAddress);

  // Step 2: Deploy AssetRegistry
  console.log("\n✓ Deploying AssetRegistry...");
  const AssetRegistry = await ethers.getContractFactory("AssetRegistry");
  const assetRegistry = await AssetRegistry.deploy();
  await assetRegistry.waitForDeployment();
  const assetRegistryAddress = await assetRegistry.getAddress();
  console.log("AssetRegistry deployed:", assetRegistryAddress);

  // Step 3: Deploy DuelFactoryOnChain
  console.log("\n✓ Deploying DuelFactoryOnChain...");
  const DuelFactoryOnChain = await ethers.getContractFactory("DuelFactoryOnChain");
  const factory = await DuelFactoryOnChain.deploy(pythConsumerAddress);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("DuelFactoryOnChain deployed:", factoryAddress);

  console.log("\n╔════════════════════════════════════════════════════════╗");
  console.log("║         INDEXFLOW ON-CHAIN DEPLOYMENT COMPLETE        ║");
  console.log("╚════════════════════════════════════════════════════════╝\n");

  console.log("Contract Addresses:");
  console.log("├─ PythConsumer:", pythConsumerAddress);
  console.log("├─ AssetRegistry:", assetRegistryAddress);
  console.log("└─ DuelFactoryOnChain:", factoryAddress);

  console.log("\nNetwork: Flow EVM Testnet");
  console.log("Pyth Oracle:", FLOW_EVM_PYTH_ADDRESS);

  // Store addresses for later use
  console.log("\n✓ Save these addresses in your .env file:");
  console.log(`FLOW_EVM_PYTH_CONSUMER=${pythConsumerAddress}`);
  console.log(`FLOW_EVM_ASSET_REGISTRY=${assetRegistryAddress}`);
  console.log(`FLOW_EVM_DUEL_FACTORY=${factoryAddress}`);

  return {
    pythConsumer: pythConsumerAddress,
    assetRegistry: assetRegistryAddress,
    factory: factoryAddress,
  };
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exit(1);
});

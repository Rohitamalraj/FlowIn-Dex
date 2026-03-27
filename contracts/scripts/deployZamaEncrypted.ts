import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying encrypted duel system to Zama testnet...");
  console.log("Deployer:", deployer.address);

  // Step 1: Deploy AssetRegistry
  console.log("\n✓ Deploying AssetRegistry...");
  const AssetRegistry = await ethers.getContractFactory("AssetRegistry");
  const assetRegistry = await AssetRegistry.deploy();
  await assetRegistry.waitForDeployment();
  const assetRegistryAddress = await assetRegistry.getAddress();
  console.log("AssetRegistry deployed:", assetRegistryAddress);

  // Step 2: Deploy DuelEncrypted (template for factory to clone)
  console.log("\n✓ Deploying DuelEncrypted template...");
  
  // Create a minimal template instance
  const DuelEncrypted = await ethers.getContractFactory("DuelEncrypted");
  const templateDuel = await DuelEncrypted.deploy(
    ethers.zeroPadValue("0x01", 32), // duelId
    deployer.address,                 // creator
    ethers.parseEther("0.001"),        // entryAmount
    60,                                // duration
    [],                                // allowedAssets
    assetRegistryAddress               // assetRegistry
  );
  await templateDuel.waitForDeployment();
  const templateAddress = await templateDuel.getAddress();
  console.log("DuelEncrypted template deployed:", templateAddress);

  // Step 3: Deploy DuelFactoryEncrypted
  console.log("\n✓ Deploying DuelFactoryEncrypted...");
  const DuelFactoryEncrypted = await ethers.getContractFactory("DuelFactoryEncrypted");
  const factory = await DuelFactoryEncrypted.deploy(
    assetRegistryAddress,
    templateAddress
  );
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("DuelFactoryEncrypted deployed:", factoryAddress);

  console.log("\n╔════════════════════════════════════════════════════════╗");
  console.log("║    INDEXFLOW ENCRYPTED DEPLOYMENT COMPLETE            ║");
  console.log("╚════════════════════════════════════════════════════════╝\n");

  console.log("Contract Addresses:");
  console.log("├─ AssetRegistry:", assetRegistryAddress);
  console.log("├─ DuelEncrypted (template):", templateAddress);
  console.log("└─ DuelFactoryEncrypted:", factoryAddress);

  console.log("\nNetwork: Zama Testnet");
  console.log("Privacy: Full homomorphic encryption (fhEVM)");

  console.log("\n✓ Save these addresses in your .env file:");
  console.log(`ZAMA_ASSET_REGISTRY=${assetRegistryAddress}`);
  console.log(`ZAMA_DUEL_TEMPLATE=${templateAddress}`);
  console.log(`ZAMA_DUEL_FACTORY=${factoryAddress}`);

  return {
    assetRegistry: assetRegistryAddress,
    duelTemplate: templateAddress,
    factory: factoryAddress,
  };
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exit(1);
});

import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Starting ShieldVault deployment to Zama Devnet...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📍 Deploying contracts with account:", deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Deploy DuelFactory (which deploys AssetRegistry internally)
  console.log("📝 Deploying DuelFactory...");
  const DuelFactory = await ethers.getContractFactory("DuelFactory");
  const duelFactory = await DuelFactory.deploy();
  await duelFactory.waitForDeployment();

  const factoryAddress = await duelFactory.getAddress();
  console.log("✅ DuelFactory deployed to:", factoryAddress);

  // Get AssetRegistry address
  const assetRegistryAddress = await duelFactory.assetRegistry();
  console.log("✅ AssetRegistry deployed to:", assetRegistryAddress);

  // Get deployment configuration
  const minEntryAmount = await duelFactory.minEntryAmount();
  const minDuration = await duelFactory.minDuration();
  const maxDuration = await duelFactory.maxDuration();

  console.log("\n📊 Deployment Summary:");
  console.log("==================================================");
  console.log("DuelFactory:", factoryAddress);
  console.log("AssetRegistry:", assetRegistryAddress);
  console.log("Min Entry Amount:", ethers.formatEther(minEntryAmount), "ETH");
  console.log("Min Duration:", minDuration.toString(), "seconds");
  console.log("Max Duration:", maxDuration.toString(), "seconds");
  console.log("==================================================\n");

  // Save deployment addresses
  const deploymentInfo = {
    network: "zama-devnet",
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      DuelFactory: factoryAddress,
      AssetRegistry: assetRegistryAddress
    },
    configuration: {
      minEntryAmount: minEntryAmount.toString(),
      minDuration: minDuration.toString(),
      maxDuration: maxDuration.toString()
    }
  };

  console.log("💾 Deployment Info:\n", JSON.stringify(deploymentInfo, null, 2));
  console.log("\n✨ Deployment completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });

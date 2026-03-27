import { ethers } from "hardhat";

/**
 * Example script to create a test duel with encrypted portfolios
 * This demonstrates the full duel creation flow
 */
async function main() {
  console.log("🎮 Creating a test duel on ShieldVault...\n");

  const [creator] = await ethers.getSigners();
  console.log("Creator address:", creator.address);

  // Get deployed DuelFactory
  const factoryAddress = process.env.DUEL_FACTORY_ADDRESS;
  if (!factoryAddress) {
    throw new Error("DUEL_FACTORY_ADDRESS not set in environment");
  }

  const DuelFactory = await ethers.getContractFactory("DuelFactory");
  const duelFactory = DuelFactory.attach(factoryAddress);

  console.log("✅ Connected to DuelFactory at:", factoryAddress);

  // Define example assets and tiers
  const assets = [
    "0x1000000000000000000000000000000000000001", // BTC (example address)
    "0x1000000000000000000000000000000000000002", // ETH
    "0x1000000000000000000000000000000000000003", // SOL
    "0x1000000000000000000000000000000000000004", // STRK
  ];

  const priceIds = [
    "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43", // BTC/USD Pyth ID
    "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace", // ETH/USD Pyth ID
    "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d", // SOL/USD Pyth ID
    "0x6a91b3a5f5e9e9fb1b0c6c0bfe7c5b9e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5", // STRK/USD (example)
  ];

  const tiers = [
    0, // BTC - Tier 1
    0, // ETH - Tier 1
    1, // SOL - Tier 2
    1, // STRK - Tier 2
  ];

  const symbols = ["BTC", "ETH", "SOL", "STRK"];

  const entryAmount = ethers.parseEther("0.01"); // 0.01 ETH entry
  const duration = 24 * 60 * 60; // 24 hours

  console.log("\n📋 Duel Configuration:");
  console.log("Entry Amount:", ethers.formatEther(entryAmount), "ETH");
  console.log("Duration:", duration / 3600, "hours");
  console.log("Assets:", symbols.join(", "));
  console.log("\nTier 1 (50%):", symbols.filter((_, i) => tiers[i] === 0).join(", "));
  console.log("Tier 2 (50%):", symbols.filter((_, i) => tiers[i] === 1).join(", "));

  // Create duel
  console.log("\n🔨 Creating duel...");
  const tx = await duelFactory.createDuel(
    entryAmount,
    duration,
    assets,
    priceIds,
    tiers,
    symbols,
    { value: entryAmount }
  );

  console.log("📤 Transaction sent:", tx.hash);
  const receipt = await tx.wait();

  // Parse DuelCreated event
  const duelCreatedEvent = receipt.logs.find(
    (log: any) => log.fragment?.name === "DuelCreated"
  );

  if (duelCreatedEvent) {
    const { duelId, duelContract, creator: creatorAddr, entryAmount: entry } = duelCreatedEvent.args;

    console.log("\n✅ Duel created successfully!");
    console.log("==================================================");
    console.log("Duel ID:", duelId);
    console.log("Duel Contract:", duelContract);
    console.log("Creator:", creatorAddr);
    console.log("Entry Amount:", ethers.formatEther(entry), "ETH");
    console.log("==================================================");
  }

  console.log("\n🎉 Test duel creation completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });

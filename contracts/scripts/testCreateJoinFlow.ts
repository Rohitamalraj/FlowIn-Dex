import { ethers } from "hardhat";

async function main() {
  const [creator] = await ethers.getSigners();
  if (!creator) {
    throw new Error("No creator signer available");
  }

  const factoryAddress =
    process.env.FLOW_EVM_FACTORY || process.env.DUEL_FACTORY_ADDRESS;
  if (!factoryAddress) {
    throw new Error("Set FLOW_EVM_FACTORY or DUEL_FACTORY_ADDRESS in contracts/.env");
  }

  console.log("Creator:", creator.address);
  console.log("Factory:", factoryAddress);

  const DuelFactory = await ethers.getContractFactory("DuelFactory");
  const duelFactory = DuelFactory.attach(factoryAddress);

  const assets = [
    "0x1000000000000000000000000000000000000001",
    "0x1000000000000000000000000000000000000002",
    "0x1000000000000000000000000000000000000003",
    "0x1000000000000000000000000000000000000004",
  ];

  // Contract currently expects address[] for price IDs.
  const priceIds = [
    "0x2000000000000000000000000000000000000001",
    "0x2000000000000000000000000000000000000002",
    "0x2000000000000000000000000000000000000003",
    "0x2000000000000000000000000000000000000004",
  ];

  const tiers = [0, 0, 1, 1];
  const symbols = ["BTC", "ETH", "SOL", "STRK"];

  const entryAmount = ethers.parseEther("0.001");
  const duration = 60 * 60; // 1 hour

  console.log("Creating duel...");
  const createTx = await duelFactory.createDuel(
    entryAmount,
    duration,
    assets,
    priceIds,
    tiers,
    symbols,
    { value: entryAmount }
  );
  const createRcpt = await createTx.wait();

  const duelCreatedEvent = createRcpt?.logs.find(
    (log: any) => log.fragment?.name === "DuelCreated"
  );

  if (!duelCreatedEvent) {
    throw new Error("DuelCreated event not found");
  }

  const duelId = duelCreatedEvent.args.duelId;
  const duelAddress = duelCreatedEvent.args.duelContract;

  console.log("Duel created:", duelId);
  console.log("Duel address:", duelAddress);

  // Generate and fund opponent wallet for join action.
  const opponent = ethers.Wallet.createRandom().connect(ethers.provider);
  const fundTx = await creator.sendTransaction({
    to: opponent.address,
    value: ethers.parseEther("0.01"),
  });
  await fundTx.wait();

  const oppBal = await ethers.provider.getBalance(opponent.address);
  console.log("Opponent:", opponent.address);
  console.log("Opponent funded:", ethers.formatEther(oppBal), "FLOW");

  const Duel = await ethers.getContractFactory("Duel");
  const duel = Duel.attach(duelAddress).connect(opponent);

  console.log("Joining duel as opponent...");
  const joinTx = await duel.joinDuel({ value: entryAmount });
  await joinTx.wait();

  const info = await duel.getDuelInfo();
  console.log("State:", Number(info.currentState));
  console.log("Creator:", info.creatorAddr);
  console.log("Opponent:", info.opponentAddr);

  if (Number(info.currentState) !== 1) {
    throw new Error("Expected state Joined (1) after join");
  }

  console.log("Create + Join flow succeeded");
}

main().catch((error) => {
  console.error("Create + Join flow failed:", error);
  process.exit(1);
});

import { expect } from "chai";
import { ethers } from "hardhat";
import { DuelFactory, Duel, AssetRegistry } from "../contracts/typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("ShieldVault - Core Duel Lifecycle", function () {
  let duelFactory: DuelFactory;
  let assetRegistry: AssetRegistry;
  let creator: HardhatEthersSigner;
  let opponent: HardhatEthersSigner;
  let otherUser: HardhatEthersSigner;

  const entryAmount = ethers.parseEther("0.1");
  const duration = 24 * 60 * 60; // 24 hours

  // Example assets
  const assets = [
    "0x1000000000000000000000000000000000000001", // BTC
    "0x1000000000000000000000000000000000000002", // ETH
    "0x1000000000000000000000000000000000000003", // SOL
    "0x1000000000000000000000000000000000000004", // STRK
  ];

  const priceIds = [
    "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
    "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
    "0x6a91b3a5f5e9e9fb1b0c6c0bfe7c5b9e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5",
  ];

  const tiers = [0, 0, 1, 1]; // BTC, ETH = Tier 1; SOL, STRK = Tier 2
  const symbols = ["BTC", "ETH", "SOL", "STRK"];

  beforeEach(async function () {
    [creator, opponent, otherUser] = await ethers.getSigners();

    // Deploy DuelFactory
    const DuelFactory = await ethers.getContractFactory("DuelFactory");
    duelFactory = await DuelFactory.deploy();
    await duelFactory.waitForDeployment();

    // Get AssetRegistry
    const assetRegistryAddress = await duelFactory.assetRegistry();
    assetRegistry = await ethers.getContractAt("AssetRegistry", assetRegistryAddress);
  });

  describe("DuelFactory Deployment", function () {
    it("Should deploy with correct initial parameters", async function () {
      const minEntryAmount = await duelFactory.minEntryAmount();
      const minDuration = await duelFactory.minDuration();
      const maxDuration = await duelFactory.maxDuration();

      expect(minEntryAmount).to.equal(ethers.parseEther("0.001"));
      expect(minDuration).to.equal(3600); // 1 hour
      expect(maxDuration).to.equal(30 * 24 * 60 * 60); // 30 days
    });

    it("Should deploy AssetRegistry", async function () {
      const assetRegistryAddress = await duelFactory.assetRegistry();
      expect(assetRegistryAddress).to.not.equal(ethers.ZeroAddress);
    });
  });

  describe("Duel Creation", function () {
    it("Should create a duel with valid parameters", async function () {
      const tx = await duelFactory.connect(creator).createDuel(
        entryAmount,
        duration,
        assets,
        priceIds,
        tiers,
        symbols,
        { value: entryAmount }
      );

      const receipt = await tx.wait();
      expect(receipt).to.not.be.null;

      const totalDuels = await duelFactory.getTotalDuels();
      expect(totalDuels).to.equal(1);
    });

    it("Should emit DuelCreated event", async function () {
      await expect(
        duelFactory.connect(creator).createDuel(
          entryAmount,
          duration,
          assets,
          priceIds,
          tiers,
          symbols,
          { value: entryAmount }
        )
      ).to.emit(duelFactory, "DuelCreated");
    });

    it("Should fail with entry amount too low", async function () {
      const lowAmount = ethers.parseEther("0.0001");
      await expect(
        duelFactory.connect(creator).createDuel(
          lowAmount,
          duration,
          assets,
          priceIds,
          tiers,
          symbols,
          { value: lowAmount }
        )
      ).to.be.revertedWith("DuelFactory: entry amount too low");
    });

    it("Should fail with duration too short", async function () {
      const shortDuration = 1800; // 30 minutes
      await expect(
        duelFactory.connect(creator).createDuel(
          entryAmount,
          shortDuration,
          assets,
          priceIds,
          tiers,
          symbols,
          { value: entryAmount }
        )
      ).to.be.revertedWith("DuelFactory: duration too short");
    });

    it("Should fail with incorrect value sent", async function () {
      await expect(
        duelFactory.connect(creator).createDuel(
          entryAmount,
          duration,
          assets,
          priceIds,
          tiers,
          symbols,
          { value: ethers.parseEther("0.05") }
        )
      ).to.be.revertedWith("DuelFactory: incorrect entry amount");
    });

    it("Should register assets with correct tiers", async function () {
      const tx = await duelFactory.connect(creator).createDuel(
        entryAmount,
        duration,
        assets,
        priceIds,
        tiers,
        symbols,
        { value: entryAmount }
      );

      const receipt = await tx.wait();
      const duelCreatedEvent = receipt?.logs.find(
        (log: any) => log.fragment?.name === "DuelCreated"
      );

      if (!duelCreatedEvent) throw new Error("DuelCreated event not found");
      const duelId = duelCreatedEvent.args[0];

      // Check tier counts
      const [tier1Count, tier2Count] = await assetRegistry.getTierCounts(duelId);
      expect(tier1Count).to.equal(2); // BTC, ETH
      expect(tier2Count).to.equal(2); // SOL, STRK
    });
  });

  describe("Duel Joining", function () {
    let duelId: string;
    let duelAddress: string;
    let duelContract: Duel;

    beforeEach(async function () {
      const tx = await duelFactory.connect(creator).createDuel(
        entryAmount,
        duration,
        assets,
        priceIds,
        tiers,
        symbols,
        { value: entryAmount }
      );

      const receipt = await tx.wait();
      const duelCreatedEvent = receipt?.logs.find(
        (log: any) => log.fragment?.name === "DuelCreated"
      );

      if (!duelCreatedEvent) throw new Error("DuelCreated event not found");

      duelId = duelCreatedEvent.args[0];
      duelAddress = duelCreatedEvent.args[1];
      duelContract = await ethers.getContractAt("Duel", duelAddress);
    });

    it("Should allow opponent to join", async function () {
      await expect(
        duelContract.connect(opponent).joinDuel({ value: entryAmount })
      ).to.emit(duelContract, "DuelJoined");

      const [state] = await duelContract.getDuelInfo();
      expect(state).to.equal(1); // Joined state
    });

    it("Should fail if creator tries to join", async function () {
      await expect(
        duelContract.connect(creator).joinDuel({ value: entryAmount })
      ).to.be.revertedWith("Duel: creator cannot join");
    });

    it("Should fail with incorrect entry amount", async function () {
      await expect(
        duelContract.connect(opponent).joinDuel({ value: ethers.parseEther("0.05") })
      ).to.be.revertedWith("Duel: incorrect entry amount");
    });
  });

  describe("Duel Cancellation", function () {
    let duelContract: Duel;

    beforeEach(async function () {
      const tx = await duelFactory.connect(creator).createDuel(
        entryAmount,
        duration,
        assets,
        priceIds,
        tiers,
        symbols,
        { value: entryAmount }
      );

      const receipt = await tx.wait();
      const duelCreatedEvent = receipt?.logs.find(
        (log: any) => log.fragment?.name === "DuelCreated"
      );

      if (!duelCreatedEvent) throw new Error("DuelCreated event not found");

      const duelAddress = duelCreatedEvent.args[1];
      duelContract = await ethers.getContractAt("Duel", duelAddress);
    });

    it("Should allow creator to cancel before opponent joins", async function () {
      await expect(duelContract.connect(creator).cancelDuel())
        .to.emit(duelContract, "DuelCancelled");

      const [state] = await duelContract.getDuelInfo();
      expect(state).to.equal(5); // Cancelled state
    });

    it("Should refund opponent if duel is cancelled after join", async function () {
      await duelContract.connect(opponent).joinDuel({ value: entryAmount });

      const opponentBalanceBefore = await ethers.provider.getBalance(opponent.address);

      await duelContract.connect(creator).cancelDuel();

      const opponentBalanceAfter = await ethers.provider.getBalance(opponent.address);
      expect(opponentBalanceAfter).to.be.gt(opponentBalanceBefore);
    });
  });

  describe("Query Functions", function () {
    it("Should return correct user duels", async function () {
      await duelFactory.connect(creator).createDuel(
        entryAmount,
        duration,
        assets,
        priceIds,
        tiers,
        symbols,
        { value: entryAmount }
      );

      const userDuels = await duelFactory.getUserDuels(creator.address);
      expect(userDuels.length).to.equal(1);
    });

    it("Should return paginated duels", async function () {
      // Create 3 duels
      for (let i = 0; i < 3; i++) {
        await duelFactory.connect(creator).createDuel(
          entryAmount,
          duration,
          assets,
          priceIds,
          tiers,
          symbols,
          { value: entryAmount }
        );
      }

      const [duelIds, duelAddresses] = await duelFactory.getDuelsPaginated(0, 2);
      expect(duelIds.length).to.equal(2);
      expect(duelAddresses.length).to.equal(2);
    });
  });
});

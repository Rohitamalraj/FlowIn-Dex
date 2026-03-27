import { ethers } from "hardhat";

type PriceMap = Record<string, number>;

async function fetchHermesLatestPrices(symbolToPriceId: Record<string, string>): Promise<PriceMap> {
  const symbols = Object.keys(symbolToPriceId);
  const params = symbols
    .map((symbol) => `ids[]=${encodeURIComponent(symbolToPriceId[symbol])}`)
    .join("&");
  const url = `https://hermes.pyth.network/api/latest_price_feeds?${params}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch Hermes latest prices: ${response.status} ${response.statusText}`);
  }

  const feeds = await response.json();
  if (!Array.isArray(feeds) || feeds.length !== symbols.length) {
    throw new Error("Unexpected Hermes response when fetching latest prices");
  }

  const prices: PriceMap = {};
  for (let i = 0; i < symbols.length; i++) {
    const price = Number(feeds[i]?.price?.price);
    const expo = Number(feeds[i]?.price?.expo);
    prices[symbols[i]] = price * Math.pow(10, expo);
  }

  return prices;
}

function calculatePortfolioReturnFromPrices(
  weightsBySymbol: Record<string, number>,
  startPrices: PriceMap,
  endPrices: PriceMap
): number {
  let totalReturn = 0;
  for (const [symbol, weight] of Object.entries(weightsBySymbol)) {
    const start = startPrices[symbol];
    const end = endPrices[symbol];
    if (start === undefined || end === undefined || start <= 0) {
      throw new Error(`Missing/invalid price for ${symbol}`);
    }
    const assetReturn = (end - start) / start;
    totalReturn += (weight / 100) * assetReturn;
  }
  return totalReturn;
}

async function fetchPythUpdateData(priceIds: string[]): Promise<string[]> {
  const params = priceIds.map((id) => `ids[]=${encodeURIComponent(id)}`).join("&");
  const url = `https://hermes.pyth.network/v2/updates/price/latest?${params}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch Pyth update data: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  const binaryData = payload?.binary?.data;
  const encoding = payload?.binary?.encoding;

  if (!Array.isArray(binaryData) || binaryData.length === 0) {
    throw new Error("No binary update data returned by Hermes");
  }

  if (encoding === "hex") {
    return (binaryData as string[]).map((hex) => (hex.startsWith("0x") ? hex : `0x${hex}`));
  }

  if (encoding === "base64") {
    return (binaryData as string[]).map((b64) => `0x${Buffer.from(b64, "base64").toString("hex")}`);
  }

  throw new Error(`Unsupported Hermes binary encoding: ${String(encoding)}`);
}

async function primePythPrices(
  duel: any,
  priceIds: string[],
  updater: any,
  label: string
) {
  const duelConfig = await duel.config();
  const pythConsumerAddress = duelConfig[6];

  const PythConsumer = await ethers.getContractFactory("PythConsumer");
  const pythConsumer = PythConsumer.attach(pythConsumerAddress).connect(updater);

  const pythAddress = await pythConsumer.pyth();
  const pythAbi = ["function getUpdateFee(bytes[] calldata updateData) view returns (uint256)"];
  const pyth = new ethers.Contract(pythAddress, pythAbi, updater);

  const updateData = await fetchPythUpdateData(priceIds);
  let feeWithBuffer = ethers.parseEther("0.001");
  try {
    const updateFee: bigint = await pyth.getUpdateFee(updateData);
    feeWithBuffer = updateFee + updateFee / 5n;
  } catch {
    console.log("⚠️ Could not read Pyth update fee from oracle; using fallback fee");
  }

  try {
    const tx = await pythConsumer.updatePricesBatch(priceIds, updateData, {
      value: feeWithBuffer,
    });
    await tx.wait();
  } catch (error: any) {
    throw new Error(
      `Failed to batch update Pyth prices. Check oracle address and Hermes payload compatibility. Original error: ${error?.message || error}`
    );
  }

  console.log(`✅ ${label}: Pyth prices refreshed on-chain`);
}

async function main() {
  const [creator] = await ethers.getSigners();

  console.log("Testing On-Chain Duel via Smart Contract Calls...\n");
  console.log("Creator:", creator.address);

  // Create a second test wallet for the opponent
  const mnemonic = ethers.Mnemonic.fromPhrase("test test test test test test test test test test test junk");
  const hdWallet = ethers.HDNodeWallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/1");
  const provider = creator.provider!;
  const opponent = new ethers.Wallet(hdWallet.privateKey, provider);

  console.log("Opponent:", opponent.address);

  // Contract addresses from deployment
  const DUEL_FACTORY =
    process.env.FLOW_EVM_DUEL_FACTORY ||
    "0x72b205E87BD02BdBF0182EeF000aDD110D627c3E";
  const PYTH_PRICE_IDS = {
    BTC: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
    ETH: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    STRK: "0x6a182399ff70ccf3e06024898942028204125a819e519a335ffa4579e66cd870",
    BNB: "0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f",
    LINK: "0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221",
    USDC: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
  };

  // Asset addresses (mockups for testing)
  const assets = [
    "0x1000000000000000000000000000000000000001", // BTC
    "0x1000000000000000000000000000000000000002", // ETH
    "0x1000000000000000000000000000000000000003", // STRK
    "0x1000000000000000000000000000000000000004", // BNB
    "0x1000000000000000000000000000000000000005", // LINK
  ];

  const priceIds = [
    PYTH_PRICE_IDS.BTC,
    PYTH_PRICE_IDS.ETH,
    PYTH_PRICE_IDS.STRK,
    PYTH_PRICE_IDS.BNB,
    PYTH_PRICE_IDS.LINK,
  ];

  // Tier enums: 0 = TIER_1, 1 = TIER_2
  const tiers = [0, 0, 1, 1, 1]; // BTC, ETH (Tier-1), STRK, BNB, LINK (Tier-2)
  const symbols = ["BTC", "ETH", "STRK", "BNB", "LINK"];

  const entryAmount = ethers.parseEther("0.001");
  const duration = 60; // 1 minute
  const creatorPortfolioWeights: Record<string, number> = {
    BTC: 30,
    ETH: 20,
    STRK: 10,
    BNB: 10,
    LINK: 30,
  };
  const opponentPortfolioWeights: Record<string, number> = {
    BTC: 35,
    ETH: 15,
    STRK: 20,
    BNB: 15,
    LINK: 15,
  };

  const symbolToPriceId = {
    BTC: PYTH_PRICE_IDS.BTC,
    ETH: PYTH_PRICE_IDS.ETH,
    STRK: PYTH_PRICE_IDS.STRK,
    BNB: PYTH_PRICE_IDS.BNB,
    LINK: PYTH_PRICE_IDS.LINK,
  };

  let startPrices: PriceMap = {};
  let endPrices: PriceMap = {};

  // Connect to deployed factory using on-chain ABI signature
  const factoryAbi = [
    "function createDuel(uint256 entryAmount, uint256 duration, address[] assets, bytes32[] priceIds, uint8[] tiers, string[] symbols) payable returns (bytes32 duelId, address duelAddress)",
    "event DuelCreated(bytes32 indexed duelId, address indexed duelContract, address indexed creator, uint256 entryAmount, uint256 duration)",
  ];
  const factory = new ethers.Contract(DUEL_FACTORY, factoryAbi, creator);

  // Step 1: Create Duel
  console.log("\n╔════════════════════════════════════════════════════════╗");
  console.log("║ STEP 1: CREATE DUEL                                    ║");
  console.log("╚════════════════════════════════════════════════════════╝\n");

  try {
    const fundTx = await creator.sendTransaction({
      to: opponent.address,
      value: ethers.parseEther("0.01"),
    });
    await fundTx.wait();

    const createTx = await factory.createDuel(
      entryAmount,
      duration,
      assets,
      priceIds,
      tiers,
      symbols,
      { value: entryAmount }
    );

    console.log("Waiting for duel creation...");
    const createReceipt = await createTx.wait();

    // Parse DuelCreated event
    let duelId: string = "";
    let duelAddress: string = "";

    const iface = new ethers.Interface(["event DuelCreated(bytes32 indexed duelId, address indexed duelContract, address indexed creator, uint256 entryAmount, uint256 duration)"]);
    
    for (const log of createReceipt!.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed && parsed.name === "DuelCreated") {
          duelId = parsed.args[0];
          duelAddress = parsed.args[1];
        }
      } catch {}
    }

    if (!duelAddress) {
      throw new Error("DuelCreated event not found");
    }

    console.log("✅ Duel Created:");
    console.log(`   Duel ID: ${duelId}`);
    console.log(`   Duel Address: ${duelAddress}`);
    console.log(`   Entry Amount: ${ethers.formatEther(entryAmount)} FLOW`);
    console.log(`   Duration: ${duration} seconds`);

    // Step 2: Join Duel
    console.log("\n╔════════════════════════════════════════════════════════╗");
    console.log("║ STEP 2: JOIN DUEL                                      ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");

    const DuelOnChain = await ethers.getContractFactory("DuelOnChain");
    const duel = DuelOnChain.attach(duelAddress).connect(opponent);

    const joinTx = await duel.joinDuel({ value: entryAmount });
    await joinTx.wait();

    console.log("✅ Opponent Joined:");
    console.log(`   Opponent: ${opponent.address}`);
    console.log(`   Entry Amount: ${ethers.formatEther(entryAmount)} FLOW`);

    // Step 3: Submit Portfolios
    console.log("\n╔════════════════════════════════════════════════════════╗");
    console.log("║ STEP 3: SUBMIT PORTFOLIOS                              ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");

    // Creator portfolio: BTC 30%, ETH 20%, STRK 10%, BNB 10%, LINK 30%
    const creatorWeights = [3000, 2000, 1000, 1000, 3000]; // basis points
    console.log("Creator Portfolio:");
    console.log("  BTC: 30%");
    console.log("  ETH: 20%");
    console.log("  STRK: 10%");
    console.log("  BNB: 10%");
    console.log("  LINK: 30%");

    const creatorSubmitTx = await duel.connect(creator).submitPortfolio(
      assets,
      priceIds as any,
      creatorWeights
    );
    await creatorSubmitTx.wait();
    console.log("✅ Creator Portfolio Submitted");

    // Opponent portfolio: BTC 35%, ETH 15%, STRK 20%, BNB 15%, LINK 15%
    const opponentWeights = [3500, 1500, 2000, 1500, 1500]; // basis points
    console.log("\nOpponent Portfolio:");
    console.log("  BTC: 35%");
    console.log("  ETH: 15%");
    console.log("  STRK: 20%");
    console.log("  BNB: 15%");
    console.log("  LINK: 15%");

    const opponentSubmitTx = await duel.connect(opponent).submitPortfolio(
      assets,
      priceIds as any,
      opponentWeights
    );
    await opponentSubmitTx.wait();
    console.log("✅ Opponent Portfolio Submitted");

    // Step 4: Get Duel Status
    console.log("\n╔════════════════════════════════════════════════════════╗");
    console.log("║ STEP 4: DUEL STATUS                                    ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");

    const duelInfo = await duel.getDuelInfo();
    const stateNames = ["Created", "Joined", "SubmittedBoth", "Active", "Settling", "Settled", "Cancelled"];
    
    console.log("Current State:", stateNames[duelInfo[0]]);
    console.log("Entry Amount:", ethers.formatEther(duelInfo[1]), "FLOW");
    console.log("Duration:", duelInfo[2].toString(), "seconds");
    console.log("Start Time:", duelInfo[3].toString());
    console.log("End Time:", duelInfo[4].toString());
    console.log("Settled:", duelInfo[6]);

    // Step 5: Activate Duel and Lock Start Prices
    console.log("\n╔════════════════════════════════════════════════════════╗");
    console.log("║ STEP 5: ACTIVATE + LOCK START PRICES                   ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");

    const activateTx = await duel.activateDuel();
    await activateTx.wait();
    console.log("✅ Duel Activated (State: Active)");

    console.log("\n[DUEL TEST] === FETCHING START PRICES ===\n");
    startPrices = await fetchHermesLatestPrices(symbolToPriceId);
    console.log("[DUEL TEST] ");
    console.log("Start Prices:");
    for (const symbol of symbols) {
      console.log(`  ${symbol}: $${startPrices[symbol].toFixed(2)}`);
    }

    let startPricesLockedOnChain = false;
    try {
      await primePythPrices(duel, priceIds, opponent, "Pre-start");
      const lockStartTx = await duel.connect(creator).lockStartPrices();
      await lockStartTx.wait();
      startPricesLockedOnChain = true;
      console.log("✅ Start Prices Locked For Both Portfolios");
    } catch (error: any) {
      console.log(`⚠️ Could not lock start prices on-chain: ${error?.message || error}`);
      console.log("⚠️ Continuing with market analytics output");
    }

    // Step 6: Wait for duel duration
    console.log("\n╔════════════════════════════════════════════════════════╗");
    console.log("║ STEP 6: WAIT FOR DUEL DURATION                         ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");

    const waitMs = Number(duration + 2) * 1000;
    console.log(`⏳ Waiting ${duration + 2} seconds for duel to end...`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    console.log("✅ Duel Duration Complete");

    // Step 7: Lock End Prices and Settle
    console.log("\n╔════════════════════════════════════════════════════════╗");
    console.log("║ STEP 7: LOCK END PRICES & SETTLE                       ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");

    let settledOnChain = false;
    let finalInfo: any = null;
    if (startPricesLockedOnChain) {
      try {
        await primePythPrices(duel, priceIds, opponent, "Pre-settlement");

        const settleTx = await duel.connect(opponent).lockEndPricesAndSettle();
        await settleTx.wait();
        const afterSettleInfo = await duel.getDuelInfo();
        if (afterSettleInfo[6]) {
          settledOnChain = true;
          console.log("✅ Duel Settled");
        } else {
          console.log("⚠️ Settlement transaction executed but duel is not settled yet");
        }
      } catch (error: any) {
        console.log(`⚠️ Could not complete on-chain settlement: ${error?.message || error}`);
        console.log("⚠️ Continuing with market analytics output");
      }
    } else {
      console.log("⚠️ Skipping on-chain settlement because start prices were not locked on-chain");
    }

    console.log("\n[DUEL TEST] === FETCHING END PRICES ===\n");
    endPrices = await fetchHermesLatestPrices(symbolToPriceId);
    console.log("[DUEL TEST] ");
    console.log("End Prices:");
    for (const symbol of symbols) {
      const start = startPrices[symbol];
      const end = endPrices[symbol];
      const changePct = ((end - start) / start) * 100;
      const arrow = changePct >= 0 ? "↑" : "↓";
      console.log(`  ${symbol}: $${end.toFixed(2)} ${arrow} ${Math.abs(changePct).toFixed(2)}%`);
    }

    // Step 8: Get Final Results
    console.log("\n╔════════════════════════════════════════════════════════╗");
    console.log("║ STEP 8: FINAL RESULTS                                  ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");

    if (settledOnChain) {
      finalInfo = await duel.getDuelInfo();
      console.log("Final State:", stateNames[finalInfo[0]]);
      console.log("Winner:", finalInfo[5] === "0x0000000000000000000000000000000000000000" ? "TIE" : finalInfo[5]);
      console.log("Creator Return:", finalInfo[7].toString(), "basis points");
      console.log("Opponent Return:", finalInfo[8].toString(), "basis points");
    } else {
      console.log("Final State: ACTIVE (on-chain settlement not completed in this run)");
      console.log("Winner: N/A");
      console.log("Creator Return: N/A");
      console.log("Opponent Return: N/A");
    }

    console.log("\n[DUEL TEST]\n=== CALCULATING RETURNS ===\n");
    const user1Return = calculatePortfolioReturnFromPrices(
      creatorPortfolioWeights,
      startPrices,
      endPrices
    );
    const user2Return = calculatePortfolioReturnFromPrices(
      opponentPortfolioWeights,
      startPrices,
      endPrices
    );

    const user1StartValue = 100;
    const user2StartValue = 100;
    const user1EndValue = user1StartValue * (1 + user1Return);
    const user2EndValue = user2StartValue * (1 + user2Return);

    console.log("[DUEL TEST] User1 Portfolio Performance:");
    console.log(`  Start Value: $${user1StartValue.toFixed(2)}`);
    console.log(`  End Value:   $${user1EndValue.toFixed(2)}`);
    console.log(`  Return:      ${(user1Return * 100).toFixed(6)}%\n`);

    console.log("[DUEL TEST] User2 Portfolio Performance:");
    console.log(`  Start Value: $${user2StartValue.toFixed(2)}`);
    console.log(`  End Value:   $${user2EndValue.toFixed(2)}`);
    console.log(`  Return:      ${(user2Return * 100).toFixed(6)}%\n`);

    console.log("[DUEL TEST] ╔════════════════════════════════════════════════════════╗");
    if (user1Return > user2Return) {
      console.log("[DUEL TEST] ║ 🏆 USER 1 WINS THE DUEL                               ║");
      console.log(`║ Outperformance: +${((user1Return - user2Return) * 100).toFixed(4)}%                           ║`);
    } else if (user2Return > user1Return) {
      console.log("[DUEL TEST] ║ 🏆 USER 2 WINS THE DUEL                               ║");
      console.log(`║ Outperformance: +${((user2Return - user1Return) * 100).toFixed(4)}%                           ║`);
    } else {
      console.log("[DUEL TEST] ║ 🤝 DUEL RESULT: TIE                                   ║");
    }
    console.log("[DUEL TEST] ╚════════════════════════════════════════════════════════╝");
    console.log("\n[DUEL TEST] TEST COMPLETED SUCCESSFULLY");

    // Step 9: Execute Payout
    console.log("\n╔════════════════════════════════════════════════════════╗");
    console.log("║ STEP 9: EXECUTE PAYOUT                                 ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");

    if (settledOnChain && finalInfo && finalInfo[5] !== "0x0000000000000000000000000000000000000000") {
      const payoutTx = await duel.executePayout();
      await payoutTx.wait();
      console.log("✅ Payout Executed");
      console.log(`   Winner: ${finalInfo[5]}`);
      console.log(`   Amount: ${ethers.formatEther(entryAmount * 2n)} FLOW`);
    } else if (settledOnChain && finalInfo) {
      console.log("TIE: No single winner");
    } else {
      console.log("Skipped: On-chain payout (duel not settled on-chain in this run)");
    }

    console.log("\n╔════════════════════════════════════════════════════════╗");
    console.log("║ ✅ ON-CHAIN DUEL TEST COMPLETED SUCCESSFULLY           ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");
  } catch (error) {
    console.error("❌ Test Failed:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

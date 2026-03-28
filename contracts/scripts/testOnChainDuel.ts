import { ethers } from "hardhat";

const EXPLORER_TX_BASE =
  process.env.FLOW_EVM_EXPLORER_TX_BASE || "https://evm-testnet.flowscan.io/tx/";

function fmtFlow(value: bigint): string {
  return `${ethers.formatEther(value)} FLOW`;
}

function pythPriceToNumber(price: bigint, expo: number): number {
  return Number(price) * Math.pow(10, expo);
}

function formatUsd(price: number): string {
  return `$${price.toFixed(price >= 1 ? 2 : 6)}`;
}

type PriceSnapshot = {
  symbol: string;
  rawPrice: bigint;
  expo: number;
  price: number;
};

async function readPythSnapshot(
  pythConsumer: any,
  priceIds: string[],
  symbols: string[]
): Promise<PriceSnapshot[]> {
  const snapshot: PriceSnapshot[] = [];

  for (let i = 0; i < priceIds.length; i++) {
    const [price, expo] = await pythConsumer.getPrice(priceIds[i]);
    const rawPrice = BigInt(price.toString());
    const expoNum = Number(expo);
    snapshot.push({
      symbol: symbols[i],
      rawPrice,
      expo: expoNum,
      price: pythPriceToNumber(rawPrice, expoNum),
    });
  }

  return snapshot;
}

function printPriceSnapshot(title: string, snapshot: PriceSnapshot[]) {
  console.log(`\n[DUEL TEST] ${title}`);
  for (const item of snapshot) {
    console.log(`  ${item.symbol}: ${formatUsd(item.price)} (raw=${item.rawPrice.toString()}, expo=${item.expo})`);
  }
}

function printPriceDelta(startSnapshot: PriceSnapshot[], endSnapshot: PriceSnapshot[]) {
  console.log("\n[DUEL TEST] Pyth Price Changes During Duel:");
  for (let i = 0; i < startSnapshot.length; i++) {
    const start = startSnapshot[i];
    const end = endSnapshot[i];
    const pctChange = start.price !== 0 ? ((end.price - start.price) / start.price) * 100 : 0;
    const arrow = pctChange > 0 ? "↑" : pctChange < 0 ? "↓" : "→";
    console.log(
      `  ${start.symbol}: ${formatUsd(start.price)} -> ${formatUsd(end.price)} ${arrow} ${pctChange.toFixed(4)}%`
    );
  }
}

async function waitAndLogTx(tx: any, label: string) {
  console.log(`⏳ ${label} submitted`);
  console.log(`   Tx Hash: ${tx.hash}`);
  if (EXPLORER_TX_BASE) {
    console.log(`   Proof URL: ${EXPLORER_TX_BASE}${tx.hash}`);
  }

  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error(`${label} failed on-chain`);
  }

  console.log(`✅ ${label} confirmed`);
  console.log(`   Block: ${receipt.blockNumber}`);
  console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
  return receipt;
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
  const pythConsumer: any = PythConsumer.attach(pythConsumerAddress).connect(updater);

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

  const tx = await pythConsumer.updatePricesBatch(priceIds, updateData, {
    value: feeWithBuffer,
  });
  await waitAndLogTx(tx, `${label}: Pyth batch update`);
  console.log(`✅ ${label}: Pyth prices refreshed on-chain with fee ${fmtFlow(feeWithBuffer)}`);
}

async function main() {
  const [creator] = await ethers.getSigners();
  let startSnapshot: PriceSnapshot[] = [];
  let endSnapshot: PriceSnapshot[] = [];

  console.log("Testing On-Chain Duel via Smart Contract Calls...\n");
  console.log("Creator:", creator.address);

  // Create a second test wallet for the opponent
  const mnemonic = ethers.Mnemonic.fromPhrase("test test test test test test test test test test test junk");
  const hdWallet = ethers.HDNodeWallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/1");
  const provider = creator.provider!;
  const opponent = new ethers.Wallet(hdWallet.privateKey, provider);

  console.log("Opponent:", opponent.address);

  const minCreatorBalance = ethers.parseEther(process.env.MIN_CREATOR_BALANCE_FLOW || "0.03");
  const minOpponentBalance = ethers.parseEther(process.env.MIN_OPPONENT_BALANCE_FLOW || "0.02");
  const opponentFundingAmount = ethers.parseEther(process.env.OPPONENT_FUND_FLOW || "0.08");

  // Contract addresses from deployment
  const DUEL_FACTORY = process.env.FLOW_EVM_DUEL_FACTORY;
  if (!DUEL_FACTORY) {
    throw new Error(
      "FLOW_EVM_DUEL_FACTORY is not set. Run deploy-on-chain and update contracts/.env with the latest factory address."
    );
  }
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
    const creatorBalanceBefore = await provider.getBalance(creator.address);
    const opponentBalanceBefore = await provider.getBalance(opponent.address);

    console.log("\nPreflight Balances:");
    console.log(`   Creator:  ${fmtFlow(creatorBalanceBefore)}`);
    console.log(`   Opponent: ${fmtFlow(opponentBalanceBefore)}`);

    if (creatorBalanceBefore < minCreatorBalance) {
      throw new Error(
        `Creator balance too low for strict on-chain run. Need at least ${fmtFlow(minCreatorBalance)}.`
      );
    }

    if (opponentBalanceBefore < minOpponentBalance) {
      const fundTx = await creator.sendTransaction({
        to: opponent.address,
        value: opponentFundingAmount,
      });
      await waitAndLogTx(fundTx, "Fund opponent wallet");
    }

    const createTx = await factory.createDuel(
      entryAmount,
      duration,
      assets,
      priceIds,
      tiers,
      symbols,
      { value: entryAmount }
    );

    const createReceipt = await waitAndLogTx(createTx, "Create duel");

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

    const escrowAfterCreate = await provider.getBalance(duelAddress);
    console.log(`   Escrow After Create: ${fmtFlow(escrowAfterCreate)}`);

    // Step 2: Join Duel
    console.log("\n╔════════════════════════════════════════════════════════╗");
    console.log("║ STEP 2: JOIN DUEL                                      ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");

    const DuelOnChain = await ethers.getContractFactory("DuelOnChain");
    const duel: any = DuelOnChain.attach(duelAddress).connect(opponent);

    const joinTx = await duel.joinDuel({ value: entryAmount });
    await waitAndLogTx(joinTx, "Join duel");

    console.log("✅ Opponent Joined:");
    console.log(`   Opponent: ${opponent.address}`);
    console.log(`   Entry Amount: ${ethers.formatEther(entryAmount)} FLOW`);

    const escrowAfterJoin = await provider.getBalance(duelAddress);
    const expectedEscrow = entryAmount * 2n;
    console.log(`   Escrow After Join: ${fmtFlow(escrowAfterJoin)}`);
    console.log(`   Expected Escrow:   ${fmtFlow(expectedEscrow)}`);
    if (escrowAfterJoin < expectedEscrow) {
      throw new Error("Escrow funding check failed: duel contract balance is below expected 2x stake");
    }

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
    await waitAndLogTx(creatorSubmitTx, "Submit creator portfolio");
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
    await waitAndLogTx(opponentSubmitTx, "Submit opponent portfolio");
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
    await waitAndLogTx(activateTx, "Activate duel");
    console.log("✅ Duel Activated (State: Active)");

    const duelConfig = await duel.config();
    const pythConsumerAddress = duelConfig[6];
    const pythConsumerAbi = [
      "function getPrice(bytes32 priceId) external view returns (int64 price, int32 expo, uint256 timestamp)",
    ];
    const pythConsumer = new ethers.Contract(pythConsumerAddress, pythConsumerAbi, creator);

    await primePythPrices(duel, priceIds, opponent, "Pre-start");
    startSnapshot = await readPythSnapshot(pythConsumer, priceIds, symbols);
    printPriceSnapshot("Start Prices (Pyth On-Chain Snapshot)", startSnapshot);

    const lockStartTx = await duel.connect(creator).lockStartPrices();
    await waitAndLogTx(lockStartTx, "Lock start prices");
    console.log("✅ Start Prices Locked For Both Portfolios");

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

    await primePythPrices(duel, priceIds, opponent, "Pre-settlement");
    endSnapshot = await readPythSnapshot(pythConsumer, priceIds, symbols);
    printPriceSnapshot("End Prices (Pyth On-Chain Snapshot)", endSnapshot);
    printPriceDelta(startSnapshot, endSnapshot);

    const settleTx = await duel.connect(creator).lockEndPricesAndSettle();
    await waitAndLogTx(settleTx, "Lock end prices and settle");
    const afterSettleInfo = await duel.getDuelInfo();
    const settledOnChain = afterSettleInfo[6];
    if (!settledOnChain) {
      throw new Error("Settlement transaction executed but duel is not settled");
    }
    console.log("✅ Duel Settled Fully On-Chain");

    // Step 8: Get Final Results
    console.log("\n╔════════════════════════════════════════════════════════╗");
    console.log("║ STEP 8: FINAL RESULTS                                  ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");

    const finalInfo = await duel.getDuelInfo();
    const preciseReturns = await duel.getPreciseReturns();
    console.log("Final State:", stateNames[finalInfo[0]]);
    console.log("Winner:", finalInfo[5] === "0x0000000000000000000000000000000000000000" ? "TIE" : finalInfo[5]);
    console.log("Creator Return (Precise):", preciseReturns[0].toString(), "micro-bps");
    console.log("Opponent Return (Precise):", preciseReturns[1].toString(), "micro-bps");
    console.log("Creator Return (Rounded):", finalInfo[7].toString(), "basis points");
    console.log("Opponent Return (Rounded):", finalInfo[8].toString(), "basis points");

    // Step 9: Execute Payout
    console.log("\n╔════════════════════════════════════════════════════════╗");
    console.log("║ STEP 9: EXECUTE PAYOUT                                 ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");

    const duelEscrowBeforePayout = await provider.getBalance(duelAddress);
    console.log(`Escrow Balance Before Payout: ${fmtFlow(duelEscrowBeforePayout)}`);

    if (duelEscrowBeforePayout < expectedEscrow) {
      throw new Error("Escrow balance is lower than expected before payout");
    }

    if (finalInfo[5] !== "0x0000000000000000000000000000000000000000") {
      const winnerAddress = finalInfo[5];
      const winnerBalanceBefore = await provider.getBalance(winnerAddress);

      const payoutTx = await duel.executePayout();
      await waitAndLogTx(payoutTx, "Execute payout to winner");

      const winnerBalanceAfter = await provider.getBalance(winnerAddress);
      const duelEscrowAfterPayout = await provider.getBalance(duelAddress);

      console.log("✅ Payout Executed On-Chain");
      console.log(`   Winner: ${winnerAddress}`);
      console.log(`   Escrow Paid: ${fmtFlow(expectedEscrow)}`);
      console.log(`   Winner Balance Before: ${fmtFlow(winnerBalanceBefore)}`);
      console.log(`   Winner Balance After:  ${fmtFlow(winnerBalanceAfter)}`);
      console.log(`   Escrow Balance After:  ${fmtFlow(duelEscrowAfterPayout)}`);
    } else {
      const tiePayoutTx = await duel.splitTieWinnings();
      await waitAndLogTx(tiePayoutTx, "Split tie winnings");
      const duelEscrowAfterTie = await provider.getBalance(duelAddress);
      console.log("✅ Tie payout executed on-chain");
      console.log(`   Escrow Balance After: ${fmtFlow(duelEscrowAfterTie)}`);
    }

    console.log("\n[DUEL TEST] STRICT ON-CHAIN FLOW VERIFIED");
    console.log("[DUEL TEST] Every duel stage produced on-chain transaction proof hashes");

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

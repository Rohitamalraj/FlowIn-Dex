import { ethers } from "hardhat";

// Pyth Network price feeds for EVM
const PYTH_PRICE_IDS: { [key: string]: string } = {
  BTC: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  ETH: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  SOL: "0xfe650f0367d4a7d7a88f861c33fa72485491409aa55d9723710017800bde4e48",
  STRK: "0x6a182399ff70ccf3e06024898942028204125a819e519a335ffa4579e66cd870",
  BNB: "0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f",
  LINK: "0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221",
  USDC: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
};

// User 1 portfolio: BTC 30%, ETH 20%, STRK 10%, BNB 10%, LINK 30%
const USER1_PORTFOLIO: { [key: string]: number } = {
  BTC: 30,
  ETH: 20,
  STRK: 10,
  BNB: 10,
  LINK: 30,
};

// User 2 portfolio: BTC 35%, ETH 15%, STRK 20%, BNB 15%, USDC 15%
const USER2_PORTFOLIO: { [key: string]: number } = {
  BTC: 35,
  ETH: 15,
  STRK: 20,
  BNB: 15,
  USDC: 15,
};

interface PythPrice {
  price: string;
  expo: number;
  conf: string;
}

async function fetchPricesFromPyth(
  symbols: string[]
): Promise<{ [key: string]: number }> {
  const priceIds = symbols.map((sym) => PYTH_PRICE_IDS[sym]);

  // Fetch from Pyth Hermes API
  const response = await fetch(
    "https://hermes.pyth.network/api/latest_price_feeds?ids[]=" +
      priceIds.join("&ids[]=")
  ).then((res) => res.json());

  const prices: { [key: string]: number } = {};
  
  // The response is an array of price feeds
  if (!Array.isArray(response)) {
    throw new Error("Expected array response from Pyth API");
  }

  for (let i = 0; i < symbols.length && i < response.length; i++) {
    const feed = response[i];
    if (!feed.price || feed.price.expo === undefined) {
      throw new Error(`Invalid feed data for ${symbols[i]}`);
    }
    const price = parseFloat(feed.price.price);
    const expo = feed.price.expo;
    prices[symbols[i]] = price * Math.pow(10, expo);
  }

  return prices;
}

function cout(...args: any[]) {
  console.log(`[DUEL TEST]`, ...args);
}

function validatePortfolios(): boolean {
  cout("\n=== VALIDATING PORTFOLIOS ===\n");

  const validateUser = (user: string, portfolio: { [key: string]: number }) => {
    let tierTested = false;
    let tier1 = 0,
      tier2 = 0;

    console.log(`${user} Portfolio:`);
    Object.entries(portfolio).forEach(([asset, weight]) => {
      const tier = ["BTC", "ETH"].includes(asset) ? 1 : 2;
      if (tier === 1) tier1 += weight;
      else tier2 += weight;
      console.log(`  ${asset}: ${weight}%`);
    });

    const total = tier1 + tier2;
    console.log(`Tier1 (BTC+ETH): ${tier1}% | Tier2 (others): ${tier2}% | Total: ${total}%`);

    const valid = tier1 === 50 && tier2 === 50 && total === 100;
    console.log(
      `Result: ${valid ? "✓ VALID" : "✗ INVALID"}\n`
    );
    return valid;
  };

  const user1Valid = validateUser("USER1", USER1_PORTFOLIO);
  const user2Valid = validateUser("USER2", USER2_PORTFOLIO);

  if (!user1Valid || !user2Valid) {
    throw new Error("Portfolio validation failed");
  }

  return true;
}

function calculatePortfolioReturn(
  portfolio: { [key: string]: number },
  startPrices: { [key: string]: number },
  endPrices: { [key: string]: number }
): number {
  let totalReturn = 0;

  for (const [asset, weight] of Object.entries(portfolio)) {
    if (startPrices[asset] === undefined || endPrices[asset] === undefined) {
      throw new Error(`Price missing for ${asset}`);
    }

    const assetReturn = (endPrices[asset] - startPrices[asset]) / startPrices[asset];
    const weightedReturn = (weight / 100) * assetReturn;
    totalReturn += weightedReturn;
  }

  return totalReturn;
}

async function main() {
  const [creator] = await ethers.getSigners();
  if (!creator) {
    throw new Error("No creator signer available");
  }

  cout("\n╔════════════════════════════════════════════════════════╗");
  cout("║     INDEXFLOW 1-MINUTE DUEL PERFORMANCE TEST          ║");
  cout("╚════════════════════════════════════════════════════════╝\n");

  // Step 1: Validate portfolios
  validatePortfolios();

  // Step 2: Get all unique assets from both portfolios
  const allAssets = [...new Set([...Object.keys(USER1_PORTFOLIO), ...Object.keys(USER2_PORTFOLIO)])];
  cout(`Assets in duel: ${allAssets.join(", ")}\n`);

  // Step 3: Fetch start prices
  cout("=== FETCHING START PRICES ===\n");
  const startPrices = await fetchPricesFromPyth(allAssets);

  cout("\nStart Prices:");
  Object.entries(startPrices).forEach(([asset, price]) => {
    console.log(`  ${asset}: $${price.toFixed(2)}`);
  });

  // Display portfolio values at start
  cout("\nPortfolio Values at START:");
  const user1StartValue = 100; // Assume $100 investment each for simplicity
  const user2StartValue = 100;
  console.log(`  User1: $${user1StartValue.toFixed(2)}`);
  console.log(`  User2: $${user2StartValue.toFixed(2)}\n`);

  // Step 4: Wait 60 seconds
  cout("⏳ WAITING 60 SECONDS FOR PRICE CHANGES...\n");
  for (let i = 60; i > 0; i--) {
    if (i % 10 === 0 || i <= 5) {
      process.stdout.write(`\r  Time remaining: ${i}s`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  console.log("\r  ✓ 60 seconds elapsed\n");

  // Step 5: Fetch end prices
  cout("=== FETCHING END PRICES ===\n");
  const endPrices = await fetchPricesFromPyth(allAssets);

  cout("\nEnd Prices:");
  Object.entries(endPrices).forEach(([asset, price]) => {
    const change = endPrices[asset] - startPrices[asset];
    const percentChange = (change / startPrices[asset]) * 100;
    const direction = change >= 0 ? "↑" : "↓";
    console.log(
      `  ${asset}: $${price.toFixed(2)} ${direction} ${Math.abs(percentChange).toFixed(2)}%`
    );
  });

  // Step 6: Calculate returns for both portfolios
  cout("\n=== CALCULATING RETURNS ===\n");

  const user1Return = calculatePortfolioReturn(USER1_PORTFOLIO, startPrices, endPrices);
  const user2Return = calculatePortfolioReturn(USER2_PORTFOLIO, startPrices, endPrices);

  const user1Value = user1StartValue * (1 + user1Return);
  const user2Value = user2StartValue * (1 + user2Return);

  cout("User1 Portfolio Performance:");
  console.log(`  Start Value: $${user1StartValue.toFixed(2)}`);
  console.log(`  End Value:   $${user1Value.toFixed(2)}`);
  console.log(`  Return:      ${(user1Return * 100).toFixed(6)}%\n`);

  cout("User2 Portfolio Performance:");
  console.log(`  Start Value: $${user2StartValue.toFixed(2)}`);
  console.log(`  End Value:   $${user2Value.toFixed(2)}`);
  console.log(`  Return:      ${(user2Return * 100).toFixed(6)}%\n`);

  // Step 7: Determine winner
  cout("╔════════════════════════════════════════════════════════╗");

  if (user1Return > user2Return) {
    const returns = ((user1Return - user2Return) * 100).toFixed(4);
    cout("║ 🏆 USER 1 WINS THE DUEL                               ║");
    console.log(`║ Outperformance: +${returns}%                           ║`);
  } else if (user2Return > user1Return) {
    const returns = ((user2Return - user1Return) * 100).toFixed(4);
    cout("║ 🏆 USER 2 WINS THE DUEL                               ║");
    console.log(`║ Outperformance: +${returns}%                           ║`);
  } else {
    cout("║ 🤝 DUEL RESULT: TIE                                   ║");
  }

  cout("╚════════════════════════════════════════════════════════╝\n");

  cout("TEST COMPLETED SUCCESSFULLY\n");
}

main().catch((error) => {
  cout("TEST FAILED");
  console.error(error);
  process.exit(1);
});

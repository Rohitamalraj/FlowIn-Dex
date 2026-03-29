/**
 * Pyth Network Price Feed IDs for Flow EVM Testnet
 * Source: https://pyth.network/developers/price-feed-ids
 * These are the canonical Pyth Price IDs (bytes32 hex strings) used for
 * on-chain price lookups via the PythConsumer contract.
 */
export const PYTH_PRICE_IDS: Record<string, `0x${string}`> = {
  BTC:  "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  ETH:  "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  SOL:  "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  BNB:  "0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f",
  STRK: "0x6a182399ff70ccf3e06024898942028204125a819e519a335ffa4579e66cd870",
  ARB:  "0x3fa4252848f9f0a1480be62745a4629d9eb1322aebab8a791e344b3b9c1adcf5",
  OP:   "0x385f64d993f7b77d8182ed5003d97c60aa3361f3cecfe711544d2d59165e9bdf",
  // Hermes now serves Polygon as POL/USD; keep MATIC key for UI compatibility.
  MATIC:"0xffd11c5a1cfd42f80afb2df4d9f264c15f956d68153335374ec10722edd70472",
  POL:  "0xffd11c5a1cfd42f80afb2df4d9f264c15f956d68153335374ec10722edd70472",
  USDC: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
  USDT: "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",
  DAI:  "0xb0948a5e5313200c632b51bb5ca32f6de0d36e9950a942d19751e833f70dabfd",
  LINK: "0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221",
  AVAX: "0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7",
}

/**
 * Asset contract addresses on Flow EVM Testnet
 * These are placeholder addresses — in production the AssetRegistry contract
 * provides the canonical list. For the UI we use the Pyth ID as the
 * authoritative on-chain identifier.
 */
export const ASSET_CONTRACT_ADDRESSES: Record<string, `0x${string}`> = {
  BTC:  "0x0000000000000000000000000000000000000001",
  ETH:  "0x0000000000000000000000000000000000000002",
  SOL:  "0x0000000000000000000000000000000000000003",
  BNB:  "0x0000000000000000000000000000000000000004",
  STRK: "0x0000000000000000000000000000000000000005",
  ARB:  "0x0000000000000000000000000000000000000006",
  OP:   "0x0000000000000000000000000000000000000007",
  MATIC:"0x0000000000000000000000000000000000000008",
  LINK: "0x0000000000000000000000000000000000000009",
  AVAX: "0x000000000000000000000000000000000000000a",
  USDC: "0x000000000000000000000000000000000000000b",
  USDT: "0x000000000000000000000000000000000000000c",
  DAI:  "0x000000000000000000000000000000000000000d",
}

/**
 * Asset tiers (0 = Tier1 / blue-chip, 1 = Tier2 / altcoin)
 * Used when submitting portfolio to the DuelFactory contract.
 */
export const ASSET_TIERS: Record<string, number> = {
  BTC:  0,
  ETH:  0,
  SOL:  0,
  BNB:  0,
  LINK: 0,
  AVAX: 0,
  STRK: 1,
  ARB:  1,
  OP:   1,
  MATIC:1,
  USDC: 1,
  USDT: 1,
  DAI:  1,
}

export function getTierWeightTotals(symbols: string[], weights: number[]): { tier1: number; tier2: number } {
  let tier1 = 0
  let tier2 = 0

  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i]
    const weight = weights[i] ?? 0
    const tier = ASSET_TIERS[symbol] ?? 1

    if (tier === 0) {
      tier1 += weight
    } else {
      tier2 += weight
    }
  }

  return { tier1, tier2 }
}

/** Given a list of asset symbols, build the arrays the contract expects */
export function buildContractAssetArrays(symbols: string[]): {
  assets: `0x${string}`[]
  priceIds: `0x${string}`[]
  tiers: number[]
  syms: string[]
} {
  const assets = symbols.map((s) => {
    const addr = ASSET_CONTRACT_ADDRESSES[s]
    if (!addr) {
      throw new Error(`Unsupported asset symbol in allocation: ${s}`)
    }
    return addr
  })

  const priceIds = symbols.map((s) => {
    const id = PYTH_PRICE_IDS[s]
    if (!id) {
      throw new Error(`Missing Pyth price ID for asset: ${s}`)
    }
    return id
  })

  return {
    assets,
    priceIds,
    tiers:    symbols.map(s => ASSET_TIERS[s] ?? 1),
    syms:     symbols,
  }
}

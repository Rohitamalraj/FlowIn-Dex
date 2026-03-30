/**
 * Supported EVM chain metadata and Pyth oracle contract addresses.
 * Source: https://docs.pyth.network/price-feeds/core/contract-addresses/evm
 */

// ─── Pyth contract addresses per chain ID ────────────────────────────────────
export const PYTH_CONTRACT_BY_CHAIN_ID: Record<number, `0x${string}`> = {
  // Mainnets
  1:         "0x4305FB66699C3B2702D4d05CF36551390A4c69C6", // Ethereum
  42161:     "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C", // Arbitrum
  10:        "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C", // Optimism
  8453:      "0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a", // Base
  137:       "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C", // Polygon
  43114:     "0x4305FB66699C3B2702D4d05CF36551390A4c69C6", // Avalanche
  56:        "0x4D7E825f80bDf85e913E0DD2A2D54927e9dE1594", // BNB
  747:       "0x2880aB155794e7179c9eE2e38200202908C17B43", // Flow EVM
  81457:     "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729", // Blast
  5000:      "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729", // Mantle
  534352:    "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729", // Scroll
  324:       "0xf087c864AEccFb6A2Bf1Af6A0382B0d0f6c5D834", // zkSync Era
  59144:     "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729", // Linea
  80094:     "0x2880aB155794e7179c9eE2e38200202908C17B43", // Berachain
  34443:     "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729", // Mode
  167000:    "0x2880aB155794e7179c9eE2e38200202908C17B43", // Taiko
  146:       "0x2880aB155794e7179c9eE2e38200202908C17B43", // Sonic
  130:       "0x2880aB155794e7179c9eE2e38200202908C17B43", // Unichain
  1329:      "0x2880aB155794e7179c9eE2e38200202908C17B43", // Sei EVM
  // Testnets
  545:       "0x2880aB155794e7179c9eE2e38200202908C17B43", // Flow EVM Testnet
  11155111:  "0xDd24F84d36BF92C65F92307595335bdFab5Bbd21", // Sepolia
  421614:    "0x4374e5a8b9C22271E9EB878A2AA31DE97DF15DAF", // Arbitrum Sepolia
  84532:     "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729", // Base Sepolia
  11155420:  "0x0708325268dF9F66270F1401206434524814508b", // Optimism Sepolia
  80002:     "0x2880aB155794e7179c9eE2e38200202908C17B43", // Polygon Amoy
  43113:     "0x23f0e8FAeE7bbb405E7A7C3d60138FCfd43d7509", // Avalanche Fuji
  97:        "0x5744Cbf430D99456a0A8771208b674F27f8EF0Fb", // BNB Testnet
  168587773: "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729", // Blast Sepolia
  534351:    "0x41c9e39574F40Ad34c79f1C99B66A45eFB830d4c", // Scroll Sepolia
  300:       "0x056f829183Ec806A78c26C98961678c24faB71af", // zkSync Era Sepolia
  59141:     "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729", // Linea Sepolia
  80069:     "0x2880aB155794e7179c9eE2e38200202908C17B43", // Berachain Bepolia
  167009:    "0x2880aB155794e7179c9eE2e38200202908C17B43", // Taiko Hekla
}

// ─── Chain metadata for UI display ───────────────────────────────────────────
export interface ChainMeta {
  id: number
  name: string
  shortName: string
  testnet: boolean
  isActive: boolean
  nativeSymbol: string
  logoColor: string
}

export const CHAIN_META: ChainMeta[] = [
  // ── Active deployments ──────────────────────────────────────────────────
  { id: 545,       name: "Flow EVM Testnet", shortName: "Flow Testnet", testnet: true,  isActive: true,  nativeSymbol: "FLOW", logoColor: "#00EF8B" },
  // ── Flow Mainnets ───────────────────────────────────────────────────────
  { id: 747,       name: "Flow EVM",         shortName: "Flow",         testnet: false, isActive: false, nativeSymbol: "FLOW", logoColor: "#00EF8B" },
  // ── Major L1 / L2 Mainnets ──────────────────────────────────────────────
  { id: 1,         name: "Ethereum",         shortName: "Ethereum",     testnet: false, isActive: false, nativeSymbol: "ETH",  logoColor: "#627EEA" },
  { id: 42161,     name: "Arbitrum",         shortName: "Arbitrum",     testnet: false, isActive: false, nativeSymbol: "ETH",  logoColor: "#28A0F0" },
  { id: 10,        name: "Optimism",         shortName: "Optimism",     testnet: false, isActive: false, nativeSymbol: "ETH",  logoColor: "#FF0420" },
  { id: 8453,      name: "Base",             shortName: "Base",         testnet: false, isActive: false, nativeSymbol: "ETH",  logoColor: "#0052FF" },
  { id: 137,       name: "Polygon",          shortName: "Polygon",      testnet: false, isActive: false, nativeSymbol: "POL",  logoColor: "#8247E5" },
  { id: 43114,     name: "Avalanche",        shortName: "Avalanche",    testnet: false, isActive: false, nativeSymbol: "AVAX", logoColor: "#E84142" },
  { id: 56,        name: "BNB Chain",        shortName: "BNB",          testnet: false, isActive: false, nativeSymbol: "BNB",  logoColor: "#F0B90B" },
  { id: 81457,     name: "Blast",            shortName: "Blast",        testnet: false, isActive: false, nativeSymbol: "ETH",  logoColor: "#FCFC03" },
  { id: 80094,     name: "Berachain",        shortName: "Berachain",    testnet: false, isActive: false, nativeSymbol: "BERA", logoColor: "#FF6A00" },
  { id: 146,       name: "Sonic",            shortName: "Sonic",        testnet: false, isActive: false, nativeSymbol: "S",    logoColor: "#00C2FF" },
  { id: 130,       name: "Unichain",         shortName: "Unichain",     testnet: false, isActive: false, nativeSymbol: "ETH",  logoColor: "#FF007A" },
  { id: 1329,      name: "Sei EVM",          shortName: "Sei",          testnet: false, isActive: false, nativeSymbol: "SEI",  logoColor: "#9D1EFF" },
  { id: 167000,    name: "Taiko",            shortName: "Taiko",        testnet: false, isActive: false, nativeSymbol: "ETH",  logoColor: "#E81899" },
  { id: 34443,     name: "Mode",             shortName: "Mode",         testnet: false, isActive: false, nativeSymbol: "ETH",  logoColor: "#DFFE00" },
  { id: 5000,      name: "Mantle",           shortName: "Mantle",       testnet: false, isActive: false, nativeSymbol: "MNT",  logoColor: "#50E3C2" },
  { id: 534352,    name: "Scroll",           shortName: "Scroll",       testnet: false, isActive: false, nativeSymbol: "ETH",  logoColor: "#FFEEDA" },
  { id: 324,       name: "zkSync Era",       shortName: "zkSync",       testnet: false, isActive: false, nativeSymbol: "ETH",  logoColor: "#1755F4" },
  { id: 59144,     name: "Linea",            shortName: "Linea",        testnet: false, isActive: false, nativeSymbol: "ETH",  logoColor: "#61DFFF" },
  // ── Testnets ────────────────────────────────────────────────────────────
  { id: 11155111,  name: "Sepolia",          shortName: "Sepolia",      testnet: true,  isActive: false, nativeSymbol: "ETH",  logoColor: "#627EEA" },
  { id: 421614,    name: "Arb Sepolia",      shortName: "Arb Sep",      testnet: true,  isActive: false, nativeSymbol: "ETH",  logoColor: "#28A0F0" },
  { id: 84532,     name: "Base Sepolia",     shortName: "Base Sep",     testnet: true,  isActive: false, nativeSymbol: "ETH",  logoColor: "#0052FF" },
  { id: 11155420,  name: "OP Sepolia",       shortName: "OP Sep",       testnet: true,  isActive: false, nativeSymbol: "ETH",  logoColor: "#FF0420" },
  { id: 80002,     name: "Polygon Amoy",     shortName: "Amoy",         testnet: true,  isActive: false, nativeSymbol: "POL",  logoColor: "#8247E5" },
  { id: 43113,     name: "Fuji",             shortName: "Fuji",         testnet: true,  isActive: false, nativeSymbol: "AVAX", logoColor: "#E84142" },
  { id: 97,        name: "BNB Testnet",      shortName: "BNB Test",     testnet: true,  isActive: false, nativeSymbol: "tBNB", logoColor: "#F0B90B" },
  { id: 168587773, name: "Blast Sepolia",    shortName: "Blast Sep",    testnet: true,  isActive: false, nativeSymbol: "ETH",  logoColor: "#FCFC03" },
  { id: 534351,    name: "Scroll Sepolia",   shortName: "Scroll Sep",   testnet: true,  isActive: false, nativeSymbol: "ETH",  logoColor: "#FFEEDA" },
  { id: 300,       name: "zkSync Sepolia",   shortName: "zkSync Sep",   testnet: true,  isActive: false, nativeSymbol: "ETH",  logoColor: "#1755F4" },
  { id: 59141,     name: "Linea Sepolia",    shortName: "Linea Sep",    testnet: true,  isActive: false, nativeSymbol: "ETH",  logoColor: "#61DFFF" },
  { id: 80069,     name: "Bepolia",          shortName: "Bepolia",      testnet: true,  isActive: false, nativeSymbol: "BERA", logoColor: "#FF6A00" },
  { id: 167009,    name: "Taiko Hekla",      shortName: "Taiko Hekla",  testnet: true,  isActive: false, nativeSymbol: "ETH",  logoColor: "#E81899" },
]

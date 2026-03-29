// ─── Duel Status Enum ────────────────────────────────────────────────────────

export enum DuelStatus {
  OPEN = "OPEN",           // Created, waiting for opponent
  JOINED = "JOINED",       // Opponent joined, not yet locked
  LOCKED = "LOCKED",       // Allocations locked, evaluation window running
  SETTLING = "SETTLING",   // Encrypted PnL computation in progress
  SETTLED = "SETTLED",     // Winner determined and revealed
  CANCELLED = "CANCELLED", // Duel cancelled (timeout / no opponent)
}

// ─── Assets ──────────────────────────────────────────────────────────────────

export interface Asset {
  symbol: string          // e.g. "BTC"
  name: string            // e.g. "Bitcoin"
  icon: string            // emoji or image path
  currentPrice: number    // USD price at snapshot
  priceChange24h: number  // % change last 24h
}

export const SUPPORTED_ASSETS: Asset[] = [
  { symbol: "BTC", name: "Bitcoin", icon: "₿", currentPrice: 67200, priceChange24h: 2.4 },
  { symbol: "ETH", name: "Ethereum", icon: "Ξ", currentPrice: 3520, priceChange24h: 1.8 },
  { symbol: "SOL", name: "Solana", icon: "◎", currentPrice: 148, priceChange24h: -0.9 },
  { symbol: "BNB", name: "BNB", icon: "⬡", currentPrice: 612, priceChange24h: 0.5 },
  { symbol: "STRK", name: "Starknet", icon: "S", currentPrice: 0.72, priceChange24h: -1.3 },
  { symbol: "ARB", name: "Arbitrum", icon: "A", currentPrice: 1.12, priceChange24h: 1.6 },
  { symbol: "OP", name: "Optimism", icon: "O", currentPrice: 2.38, priceChange24h: 1.1 },
  { symbol: "MATIC", name: "Polygon", icon: "M", currentPrice: 1.01, priceChange24h: -0.4 },
  { symbol: "LINK", name: "Chainlink", icon: "L", currentPrice: 18.9, priceChange24h: 0.8 },
  { symbol: "AVAX", name: "Avalanche", icon: "V", currentPrice: 37.2, priceChange24h: 1.9 },
  { symbol: "USDC", name: "USD Coin", icon: "$", currentPrice: 1.0, priceChange24h: 0.0 },
  { symbol: "USDT", name: "Tether", icon: "T", currentPrice: 1.0, priceChange24h: 0.0 },
  { symbol: "DAI", name: "DAI", icon: "D", currentPrice: 1.0, priceChange24h: 0.0 },
]

// ─── Weight Allocation ────────────────────────────────────────────────────────

/** Basis points: 10000 = 100%. Sum must equal 10000. */
export interface WeightAllocation {
  symbol: string
  basisPoints: number // 0–10000
}

// ─── Participant ──────────────────────────────────────────────────────────────

export interface Participant {
  address: string          // Wallet address
  hasSubmitted: boolean    // Whether encrypted weights submitted
  isWinner?: boolean       // Only revealed post-settlement
}

// ─── Duel ─────────────────────────────────────────────────────────────────────

export interface Duel {
  id: string
  duelAddress?: string
  status: DuelStatus
  creator: Participant
  opponent?: Participant
  assetUniverse: string[]        // list of Asset symbols allowed
  entryAmountEth: number         // ETH entry per player
  durationSeconds: number        // e.g. 86400 = 24h
  createdAt: Date
  startTime?: Date               // when locked phase began
  endTime?: Date                 // when evaluation window closes
  winnerAddress?: string         // set only in SETTLED status
  scoreDelta?: number            // encrypted until settlement; shown post-reveal
  settlementTxHash?: string
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────

export interface DuelFilter {
  status?: DuelStatus
  minEntry?: number
  maxEntry?: number
  maxDuration?: number
}

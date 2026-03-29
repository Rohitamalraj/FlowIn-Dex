/**
 * API Client — typed wrappers around all IndexFlow backend endpoints.
 * Base URL is read from NEXT_PUBLIC_API_URL (default: http://localhost:3000)
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"

// ─── Generic fetch helper ────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json?.message ?? json?.error ?? `API error ${res.status}`)
  }
  return json as T
}

// ─── Response types ──────────────────────────────────────────────────────────

export interface DuelStatusResponse {
  success: boolean
  status: {
    duelId: string
    state: string
    hasOpponent: boolean
    timeRemaining: number | null
    canSettle: boolean
    winner: string | null
  }
}

export interface AutoFinalizeResponse {
  success: boolean
  duelId: string
  duelAddress: string
  autoFinalized: boolean
  settleTxHash: string | null
  settleMethod: string | null
  payoutTxHash: string | null
  payoutMethod: string | null
  duel: DuelRecord
}

export interface UserDuelsResponse {
  success: boolean
  address: string
  duels: DuelRecord[]
  count: number
  offset: number
  limit: number
}

export interface DuelRecord {
  duelId: string
  duelAddress: string
  createdAt: number | null
  state: string
  stateCode: number
  creator: string
  opponent: string | null
  assetUniverse: string[]
  entryAmount: string
  entryAmountFormatted: string
  duration: number
  startTime: number
  endTime: number
  winner: string | null
  settled: boolean
  creatorReturn: string
  opponentReturn: string
}

export interface PriceResponse {
  success: boolean
  price: {
    symbol: string
    price: number
    publishTime: number
  }
}

export interface BatchPriceResponse {
  success: boolean
  prices: Record<string, {
    symbol?: string
    price: number
    publishTime: number
    priceRaw?: string
    confidence?: string
    exponent?: number
    publishTimeReadable?: string
  }>
}

export interface AllDuelsResponse {
  success: boolean
  duels: DuelRecord[]
  offset: number
  limit: number
}

// ─── Duel Lifecycle API ──────────────────────────────────────────────────────

/** Get all platform duels (paginated) */
export async function apiGetAllDuels(offset = 0, limit = 50): Promise<AllDuelsResponse> {
  return apiFetch<AllDuelsResponse>(`/api/duels?offset=${offset}&limit=${limit}`)
}

/** Fetch duel status by duel ID (from event indexer). */
export async function apiGetDuelStatus(duelId: string): Promise<DuelStatusResponse> {
  return apiFetch<DuelStatusResponse>(`/api/duels/${duelId}/status`)
}

export interface IndexedDuelResponse {
  success: boolean
  duel: DuelRecord
}

/** Fetch indexed duel by ID */
export async function apiGetDuelById(duelId: string): Promise<IndexedDuelResponse> {
  return apiFetch<IndexedDuelResponse>(`/api/duels/${duelId}`)
}

/** Trigger backend auto-finalization (settle + payout/split) for an ended duel. */
export async function apiAutoFinalizeDuel(duelId: string): Promise<AutoFinalizeResponse> {
  return apiFetch<AutoFinalizeResponse>(`/api/duels/${duelId}/auto-finalize`, {
    method: "POST",
  })
}

export interface DuelPortfolioResponse {
  success: boolean
  duelAddress: string
  portfolio: {
    participant: string
    symbols: string[]
    weights: number[]
    submitted: boolean
    return: string
  }
}

export async function apiGetCreatorPortfolio(duelAddress: string): Promise<DuelPortfolioResponse> {
  return apiFetch<DuelPortfolioResponse>(`/api/duels/${duelAddress}/creator-portfolio`)
}

export async function apiGetOpponentPortfolio(duelAddress: string): Promise<DuelPortfolioResponse> {
  return apiFetch<DuelPortfolioResponse>(`/api/duels/${duelAddress}/opponent-portfolio`)
}

/** Get all duels for a wallet address. */
export async function apiGetUserDuels(
  address: string,
  offset = 0,
  limit = 20
): Promise<UserDuelsResponse> {
  return apiFetch<UserDuelsResponse>(
    `/api/duels/user/${address}/duels?offset=${offset}&limit=${limit}`
  )
}

// ─── Price API ───────────────────────────────────────────────────────────────

/** Get live price for a single asset symbol. */
export async function apiGetPrice(symbol: string): Promise<PriceResponse> {
  return apiFetch<PriceResponse>(`/api/prices/${symbol}`)
}

/** Get live prices for multiple asset symbols. */
export async function apiGetBatchPrices(symbols: string[]): Promise<BatchPriceResponse> {
  return apiFetch<BatchPriceResponse>("/api/prices/batch", {
    method: "POST",
    body: JSON.stringify({ symbols }),
  })
}

/** Get latest uncached prices for multiple symbols (better for live duel graphs). */
export async function apiGetLiveBatchPrices(symbols: string[]): Promise<BatchPriceResponse> {
  return apiFetch<BatchPriceResponse>("/api/prices/live-batch", {
    method: "POST",
    body: JSON.stringify({ symbols }),
  })
}

/** Get prices for multiple symbols at a specific unix timestamp (seconds). */
export async function apiGetBatchPricesAt(symbols: string[], timestamp: number): Promise<BatchPriceResponse> {
  return apiFetch<BatchPriceResponse>("/api/prices/batch-at", {
    method: "POST",
    body: JSON.stringify({ symbols, timestamp }),
  })
}

import type { DuelStatus, WeightAllocation } from "./duel-types"

// ─── Address ─────────────────────────────────────────────────────────────────

export function truncateAddress(addr: string, chars = 4): string {
  if (addr.length < chars * 2 + 2) return addr
  return `${addr.slice(0, chars + 2)}…${addr.slice(-chars)}`
}

// ─── Duration ─────────────────────────────────────────────────────────────────

export function formatDuration(seconds: number): string {
  if (seconds < 3600)  return `${Math.round(seconds / 60)}m`
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`
  const days = Math.floor(seconds / 86400)
  const hours = Math.round((seconds % 86400) / 3600)
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`
}

export function formatCountdown(endTime: Date): string {
  const now = Date.now()
  const diff = endTime.getTime() - now
  if (diff <= 0) return "Ended"
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  const s = Math.floor((diff % 60_000) / 1_000)
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`
  if (h > 0)  return `${h}h ${m}m`
  return `${m}m ${s}s`
}

export function formatTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60_000)
  const hours   = Math.floor(diff / 3_600_000)
  const days    = Math.floor(diff / 86_400_000)
  if (minutes < 1)  return "just now"
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24)   return `${hours}h ago`
  return `${days}d ago`
}

// ─── Status Labels ────────────────────────────────────────────────────────────

export function getStatusLabel(status: DuelStatus): string {
  const labels: Record<DuelStatus, string> = {
    OPEN:      "Open",
    JOINED:    "Joined",
    LOCKED:    "Locked",
    SETTLING:  "Settling",
    SETTLED:   "Settled",
    CANCELLED: "Cancelled",
  }
  return labels[status] ?? status
}

export function getStatusDescription(status: DuelStatus): string {
  const desc: Record<DuelStatus, string> = {
    OPEN:      "Waiting for an opponent to join.",
    JOINED:    "Opponent joined and portfolio submitted.",
    LOCKED:    "Duel active. Both strategies are now revealed.",
    SETTLING:  "Settlement is being computed from Pyth prices.",
    SETTLED:   "Winner determined and payout ready.",
    CANCELLED: "Duel was cancelled.",
  }
  return desc[status] ?? ""
}

// ─── Weight Validation ────────────────────────────────────────────────────────

export function computeTotalWeight(allocations: WeightAllocation[]): number {
  return allocations.reduce((sum, a) => sum + a.basisPoints, 0)
}

export function isWeightValid(allocations: WeightAllocation[]): boolean {
  return computeTotalWeight(allocations) === 10000
}

export function normalizeWeights(allocations: WeightAllocation[]): WeightAllocation[] {
  const total = computeTotalWeight(allocations)
  if (total === 0) return allocations.map(a => ({ ...a, basisPoints: Math.round(10000 / allocations.length) }))
  return allocations.map(a => ({ ...a, basisPoints: Math.round((a.basisPoints / total) * 10000) }))
}

export function basisPointsToPercent(basisPoints: number): number {
  return basisPoints / 100
}

export function percentToBasisPoints(percent: number): number {
  return Math.round(percent * 100)
}

// ─── Entry Amount ─────────────────────────────────────────────────────────────

export function formatEth(amount: number): string {
  return `${amount.toFixed(3)} FLOW`
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount)
}

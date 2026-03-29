"use client"

import Link from "next/link"
import { ArrowUpRight, Clock, Lock, Users } from "lucide-react"
import type { Duel } from "@/lib/duel-types"
import { DuelStatus, SUPPORTED_ASSETS } from "@/lib/duel-types"
import { formatDuration, formatCountdown, formatTimeAgo, truncateAddress, formatEth } from "@/lib/duel-utils"
import StatusBadge from "./status-badge"

interface DuelCardProps {
  duel: Duel
  onJoin?: (id: string) => void
  compact?: boolean
}

export default function DuelCard({ duel, onJoin, compact = false }: DuelCardProps) {
  const assetObjects = duel.assetUniverse
    .map((sym) => SUPPORTED_ASSETS.find((a) => a.symbol === sym))
    .filter(Boolean)

  const hasOpponent = !!duel.opponent
  const isOpen      = duel.status === DuelStatus.OPEN
  const isSettled   = duel.status === DuelStatus.SETTLED

  return (
    <div
      className={`group relative rounded-2xl border border-border bg-card hover:border-primary/40 transition-all duration-300 hover:shadow-[0_0_24px_hsl(var(--primary)/0.08)] ${
        compact ? "p-4" : "p-5"
      }`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <StatusBadge status={duel.status} size="sm" />
          <span className="text-muted-foreground font-mono text-xs truncate">#{duel.id.substring(0, 10)}</span>
        </div>
        <Link
          href={`/duel/${encodeURIComponent(duel.id)}`}
          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
        >
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Asset pills */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {assetObjects.map((asset) => asset && (
          <span
            key={asset.symbol}
            className="inline-flex items-center gap-1 rounded-full bg-muted/50 border border-border px-2 py-0.5 font-mono text-[11px] text-foreground"
          >
            <span className="text-primary">{asset.icon}</span>
            {asset.symbol}
          </span>
        ))}
      </div>

      {/* Participants */}
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="font-mono text-xs text-muted-foreground">
          {truncateAddress(duel.creator.address)}
        </span>
        <span className="text-muted-foreground text-xs">vs</span>
        {hasOpponent && duel.opponent ? (
          <span className="font-mono text-xs text-muted-foreground">
            {truncateAddress(duel.opponent.address)}
          </span>
        ) : (
          <span className="font-mono text-xs text-primary/70 animate-pulse">Waiting…</span>
        )}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 mb-4 text-xs font-mono text-muted-foreground">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDuration(duel.durationSeconds)}
        </div>
        <div className="flex items-center gap-1">
          <Lock className="h-3 w-3" />
          {formatEth(duel.entryAmountEth)} each
        </div>
        {duel.endTime && duel.status === DuelStatus.LOCKED && (
          <div className="text-amber-400 flex items-center gap-1 ml-auto">
            <Clock className="h-3 w-3" />
            {formatCountdown(duel.endTime)} left
          </div>
        )}
        {!duel.endTime && (
          <span className="ml-auto text-[10px]">Created {formatTimeAgo(duel.createdAt)}</span>
        )}
      </div>

      {/* Winner reveal (settled) */}
      {isSettled && duel.winnerAddress && (
        <div className="rounded-xl bg-primary/10 border border-primary/20 px-3 py-2 flex items-center justify-between mb-4">
          <span className="font-mono text-xs text-primary">Winner</span>
          <span className="font-mono text-xs text-primary font-semibold">
            {truncateAddress(duel.winnerAddress)}
          </span>
          {duel.scoreDelta !== undefined && (
            <span className="font-mono text-xs text-emerald-400">+{duel.scoreDelta.toFixed(2)}%</span>
          )}
        </div>
      )}

      {/* CTA */}
      {isOpen && onJoin && (
        <button
          onClick={() => onJoin(duel.id)}
          className="w-full rounded-full bg-primary text-primary-foreground font-mono text-sm font-semibold py-2 hover:shadow-[0_0_16px_hsl(var(--primary)/0.4)] hover:scale-[1.02] transition-all duration-200"
        >
          Join Duel
        </button>
      )}

      {!isOpen && (
        <Link
          href={`/duel/${duel.id}`}
          className="block w-full rounded-full border border-border text-center font-mono text-sm text-muted-foreground py-2 hover:border-primary/50 hover:text-foreground transition-all duration-200"
        >
          View Details
        </Link>
      )}
    </div>
  )
}

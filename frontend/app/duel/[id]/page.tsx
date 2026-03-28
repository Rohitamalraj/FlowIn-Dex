"use client"

import { use } from "react"
import Link from "next/link"
import { ArrowLeft, Lock, ExternalLink, Users, Clock, Trophy, Shield } from "lucide-react"
import AppShell from "@/components/duel/app-shell"
import StatusBadge from "@/components/duel/status-badge"
import Timeline from "@/components/duel/timeline"
import { getDuelById } from "@/lib/mock-duels"
import { DuelStatus, SUPPORTED_ASSETS } from "@/lib/duel-types"
import { truncateAddress, formatDuration, formatEth, formatCountdown, formatTimeAgo } from "@/lib/duel-utils"

export default function DuelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const duel = getDuelById(id)

  if (!duel) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <p className="font-mono text-muted-foreground">Duel #{id} not found.</p>
          <Link href="/join-duel" className="font-mono text-xs text-primary hover:underline">
            ← Browse duels
          </Link>
        </div>
      </AppShell>
    )
  }

  const assetObjects = duel.assetUniverse
    .map(sym => SUPPORTED_ASSETS.find(a => a.symbol === sym))
    .filter(Boolean)

  const isSettled   = duel.status === DuelStatus.SETTLED
  const isCancelled = duel.status === DuelStatus.CANCELLED
  const isLocked    = duel.status === DuelStatus.LOCKED
  const isSettling  = duel.status === DuelStatus.SETTLING

  return (
    <AppShell>
      {/* Back nav */}
      <div className="border-b border-border px-6 py-3 bg-background">
        <div className="max-w-[1100px] mx-auto">
          <Link href="/join-duel" className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3 w-3" /> Back to Browse
          </Link>
        </div>
      </div>

      <div className="max-w-[1100px] mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <StatusBadge status={duel.status} />
              <span className="font-mono text-xs text-muted-foreground">Duel #{duel.id}</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-montserrat)" }}>
              Portfolio Duel
            </h1>
            <p className="font-mono text-xs text-muted-foreground mt-1">
              Created {formatTimeAgo(duel.createdAt)} · {formatDuration(duel.durationSeconds)} window · {formatEth(duel.entryAmountEth)} entry each
            </p>
          </div>
          {isLocked && duel.endTime && (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 px-5 py-3 text-center">
              <p className="font-mono text-xs text-muted-foreground mb-1">Time Remaining</p>
              <p className="font-mono text-xl font-bold text-amber-400">{formatCountdown(duel.endTime)}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-5">
            {/* Winner Reveal */}
            {isSettled && duel.winnerAddress && (
              <div className="rounded-2xl border border-primary/40 bg-primary/5 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="h-5 w-5 text-primary" />
                  <h2 className="font-mono font-bold text-primary text-sm">Duel Result — Selective Reveal</h2>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-background border border-border p-4">
                    <p className="font-mono text-[10px] text-muted-foreground mb-1">Winner</p>
                    <p className="font-mono text-sm font-bold text-primary">{truncateAddress(duel.winnerAddress)}</p>
                  </div>
                  {duel.scoreDelta !== undefined && (
                    <div className="rounded-xl bg-background border border-border p-4">
                      <p className="font-mono text-[10px] text-muted-foreground mb-1">Performance Delta</p>
                      <p className="font-mono text-sm font-bold text-emerald-400">+{duel.scoreDelta.toFixed(2)}%</p>
                    </div>
                  )}
                </div>
                <div className="mt-4 flex items-start gap-2 rounded-lg bg-muted/20 p-3">
                  <Shield className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <p className="font-mono text-xs text-muted-foreground">
                    Individual portfolio compositions remain encrypted and confidential. Only this outcome was disclosed.
                  </p>
                </div>
                {duel.settlementTxHash && (
                  <a
                    href={`https://explorer.example.com/tx/${duel.settlementTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-3 font-mono text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View settlement tx {truncateAddress(duel.settlementTxHash, 6)}
                  </a>
                )}
              </div>
            )}

            {/* Encrypted state notice */}
            {!isSettled && !isCancelled && (
              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Lock className="h-4 w-4 text-primary" />
                  <h2 className="font-mono font-semibold text-foreground text-sm">Strategy Status</h2>
                </div>
                <div className="space-y-2">
                  {[
                    { label: "Creator's allocation",   encrypted: true },
                    { label: "Opponent's allocation",  encrypted: true },
                    { label: "PnL computations",       encrypted: true },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                      <span className="font-mono text-xs text-muted-foreground">{item.label}</span>
                      <span className="inline-flex items-center gap-1 font-mono text-xs text-amber-400">
                        <Lock className="h-3 w-3" /> Encrypted
                      </span>
                    </div>
                  ))}
                </div>
                {isSettling && (
                  <div className="mt-4 rounded-lg bg-violet-400/10 border border-violet-400/20 p-3 text-center">
                    <p className="font-mono text-xs text-violet-300 animate-pulse">
                      fhEVM settlement computation in progress…
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Asset Universe */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-mono font-semibold text-foreground text-sm mb-4">Asset Universe</h2>
              <div className="space-y-3">
                {assetObjects.map(asset => asset && (
                  <div key={asset.symbol} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-primary text-lg">{asset.icon}</span>
                      <div>
                        <p className="font-mono text-sm font-medium text-foreground">{asset.symbol}</p>
                        <p className="font-mono text-xs text-muted-foreground">{asset.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm text-foreground">${asset.currentPrice.toLocaleString()}</p>
                      <p className={`font-mono text-xs ${asset.priceChange24h >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {asset.priceChange24h >= 0 ? "+" : ""}{asset.priceChange24h.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-5">
            {/* Participants */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-mono font-semibold text-foreground text-sm">Participants</h2>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-[10px] text-muted-foreground mb-0.5">Creator</p>
                    <p className="font-mono text-xs text-foreground">{truncateAddress(duel.creator.address)}</p>
                  </div>
                  <span className={`font-mono text-[10px] rounded-full px-2 py-0.5 border ${
                    isSettled && duel.creator.isWinner
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground"
                  }`}>
                    {isSettled ? (duel.creator.isWinner ? "👑 Winner" : "Loser") : duel.creator.hasSubmitted ? "✓ Submitted" : "Pending"}
                  </span>
                </div>
                {duel.opponent ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-[10px] text-muted-foreground mb-0.5">Opponent</p>
                      <p className="font-mono text-xs text-foreground">{truncateAddress(duel.opponent.address)}</p>
                    </div>
                    <span className={`font-mono text-[10px] rounded-full px-2 py-0.5 border ${
                      isSettled && duel.opponent.isWinner
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground"
                    }`}>
                      {isSettled ? (duel.opponent.isWinner ? "👑 Winner" : "Loser") : duel.opponent.hasSubmitted ? "✓ Submitted" : "Pending"}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    <p className="font-mono text-xs text-primary/70">Waiting for opponent…</p>
                  </div>
                )}
              </div>
            </div>

            {/* Duel Info */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
              {[
                ["Duration",  formatDuration(duel.durationSeconds)],
                ["Entry",     formatEth(duel.entryAmountEth) + " per player"],
                ["Prize Pool", formatEth(duel.entryAmountEth * 2) + " total"],
                ["Created",   formatTimeAgo(duel.createdAt)],
                ...(duel.startTime ? [["Started", formatTimeAgo(duel.startTime)]] : []),
                ...(duel.endTime && isSettled ? [["Ended", formatTimeAgo(duel.endTime)]] : []),
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">{label}</span>
                  <span className="font-mono text-xs text-foreground font-medium">{value}</span>
                </div>
              ))}
            </div>

            {/* Timeline */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="font-mono font-semibold text-foreground text-sm mb-5">Lifecycle</h2>
              <Timeline currentStatus={duel.status} />
            </div>

            {/* Join CTA (if open) */}
            {duel.status === DuelStatus.OPEN && (
              <Link
                href="/join-duel"
                className="block w-full rounded-full bg-primary text-primary-foreground font-mono font-semibold text-sm py-3 text-center hover:shadow-[0_0_20px_hsl(var(--primary)/0.4)] hover:scale-[1.02] transition-all duration-200"
              >
                Join This Duel →
              </Link>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

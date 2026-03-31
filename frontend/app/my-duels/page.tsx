"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useAccount } from "wagmi"
import { Loader2, Trophy, Target, Activity, ShieldCheck, Swords, CircleDashed, Wallet, TrendingUp, TrendingDown, BarChart3 } from "lucide-react"
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts"
import AppShell from "@/components/duel/app-shell"
import Hero from "@/components/duel/hero"
import DuelCard from "@/components/duel/duel-card"
import DuelEmptyState from "@/components/duel/duel-empty-state"
import { DuelStatus, type Duel } from "@/lib/duel-types"
import { formatEth, truncateAddress } from "@/lib/duel-utils"
import { apiGetUserDuels } from "@/lib/api-client"

type Tab = "active" | "pending" | "completed"
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

export default function MyDuelsPage() {
  const { address, isConnected } = useAccount()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<Tab>("active")

  // Fetch duels if connected
  const { data, isLoading } = useQuery({
    queryKey: ["myDuels", address],
    queryFn: () => address ? apiGetUserDuels(address, 0, 50) : Promise.resolve({ success: true, duels: [], address: "", count: 0, offset: 0, limit: 50 }),
    enabled: !!address,
    refetchInterval: 15000,
  })

  // Group fetched duels into UI format
  const rawDuels = (data as any)?.duels || []
  
  const mappedDuels: Duel[] = rawDuels.map((d: any) => {
    const state = String(d.state || "").toLowerCase()
    const hasOpponent = Boolean(
      d.opponent && d.opponent !== "0x0000000000000000000000000000000000000000"
    )

    // Prefer normalized backend state names; fall back to codes for older responses.
    let status = DuelStatus.OPEN
    if (state === "joined") status = DuelStatus.JOINED
    else if (state === "submittedboth" || state === "active" || state === "locked") status = DuelStatus.LOCKED
    else if (state === "settling") status = DuelStatus.SETTLING
    else if (state === "settled") status = DuelStatus.SETTLED
    else if (state === "cancelled") status = DuelStatus.CANCELLED
    else if (d.stateCode === 1) status = DuelStatus.JOINED
    else if (d.stateCode === 2 || d.stateCode === 3) status = DuelStatus.LOCKED
    else if (d.stateCode === 4) status = DuelStatus.SETTLING
    else if (d.stateCode === 5) status = DuelStatus.SETTLED
    else if (d.stateCode === 6) status = DuelStatus.CANCELLED

    return {
      id: d.duelId,
      duelAddress: d.duelAddress,
      status,
      creator: { address: d.creator || "0x", hasSubmitted: true },
      opponent: hasOpponent ? { address: d.opponent, hasSubmitted: true } : undefined,
      assetUniverse: d.assetUniverse || [],
      entryAmountEth: parseFloat(d.entryAmountFormatted || "0"),
      durationSeconds: d.duration || 86400,
      createdAt: new Date((((d.createdAt > 0 ? d.createdAt : null) ?? (d.startTime > 0 ? d.startTime : null) ?? Math.floor(Date.now() / 1000)) * 1000)),
      startTime: d.startTime ? new Date(d.startTime * 1000) : undefined,
      endTime: d.endTime ? new Date(d.endTime * 1000) : undefined,
      winnerAddress: d.winner !== "0x0000000000000000000000000000000000000000" ? d.winner : undefined
    } as Duel
  })

  const myDuels = {
    active:    mappedDuels.filter(d => [DuelStatus.LOCKED, DuelStatus.SETTLING].includes(d.status) || (d.status === DuelStatus.JOINED && Boolean(d.opponent))),
    pending:   mappedDuels.filter(d => d.status === DuelStatus.OPEN || (d.status === DuelStatus.JOINED && !d.opponent)),
    completed: mappedDuels.filter(d => [DuelStatus.SETTLED, DuelStatus.CANCELLED].includes(d.status)),
  }

  const viewerLower = address?.toLowerCase()

  const analyticsRows = useMemo(() => {
    return rawDuels.map((d: any) => {
      const stateCode = Number(d.stateCode ?? -1)
      const state = String(d.state || "").toLowerCase()
      const creator = String(d.creator || "").toLowerCase()
      const opponent = String(d.opponent || "").toLowerCase()
      const winner = d.winner ? String(d.winner).toLowerCase() : ""
      const entryAmountFlow = Number.parseFloat(String(d.entryAmountFormatted || "0")) || 0

      const isViewerCreator = Boolean(viewerLower && creator === viewerLower)
      const isViewerOpponent = Boolean(viewerLower && opponent === viewerLower)
      const isViewerParticipant = isViewerCreator || isViewerOpponent

      const creatorReturnBps = Number(d.creatorReturn ?? 0)
      const opponentReturnBps = Number(d.opponentReturn ?? 0)
      const viewerReturnBps = isViewerCreator
        ? creatorReturnBps
        : isViewerOpponent
          ? opponentReturnBps
          : 0

      const isSettled = state === "settled" || stateCode === 5 || Boolean(d.settled)
      const isTie = isSettled && (!winner || winner === ZERO_ADDRESS)
      const isWin = isSettled && isViewerParticipant && !isTie && winner === viewerLower
      const isLoss = isSettled && isViewerParticipant && !isTie && winner !== viewerLower
      const hasOpponent = Boolean(d.opponent && d.opponent !== ZERO_ADDRESS)

      const netFlow = isSettled
        ? isTie
          ? 0
          : isWin
            ? entryAmountFlow
            : isLoss
              ? -entryAmountFlow
              : 0
        : 0

      const endedAtSec =
        (typeof d.endTime === "number" && d.endTime > 0 ? d.endTime : null) ??
        (typeof d.startTime === "number" && d.startTime > 0 ? d.startTime : null) ??
        (typeof d.createdAt === "number" && d.createdAt > 0 ? d.createdAt : null)

      return {
        duelId: String(d.duelId || ""),
        stateCode,
        state,
        hasOpponent,
        entryAmountFlow,
        isSettled,
        isTie,
        isWin,
        isLoss,
        netFlow,
        viewerReturnBps,
        endedAtSec,
      }
    })
  }, [rawDuels, viewerLower])

  const settledRows = analyticsRows.filter((d) => d.isSettled)
  const playedDuels = settledRows.length
  const wonDuels = settledRows.filter((d) => d.isWin).length
  const lostDuels = settledRows.filter((d) => d.isLoss).length
  const tiedDuels = settledRows.filter((d) => d.isTie).length
  const winRate = playedDuels > 0 ? (wonDuels / playedDuels) * 100 : 0

  const activeExposureFlow = analyticsRows
    .filter((d) => !d.isSettled && d.stateCode !== 6)
    .reduce((sum, d) => sum + d.entryAmountFlow, 0)

  const netEarnedFlow = settledRows.reduce((sum, d) => sum + d.netFlow, 0)
  const grossWonFlow = settledRows.filter((d) => d.isWin).reduce((sum, d) => sum + d.entryAmountFlow, 0)
  const grossLostFlow = settledRows.filter((d) => d.isLoss).reduce((sum, d) => sum + d.entryAmountFlow, 0)
  const averageReturnPct = playedDuels > 0
    ? settledRows.reduce((sum, d) => sum + d.viewerReturnBps / 100, 0) / playedDuels
    : 0
  const bestReturnPct = playedDuels > 0
    ? Math.max(...settledRows.map((d) => d.viewerReturnBps / 100))
    : 0

  const performanceData = useMemo(() => {
    const sorted = [...settledRows].sort((a, b) => (a.endedAtSec ?? 0) - (b.endedAtSec ?? 0))
    let cumulative = 0

    return sorted.map((duel, idx) => {
      cumulative += duel.netFlow
      return {
        label: `D${idx + 1}`,
        duel: `#${duel.duelId.slice(2, 8)}`,
        pnl: Number(duel.netFlow.toFixed(4)),
        cumulative: Number(cumulative.toFixed(4)),
        returnPct: Number((duel.viewerReturnBps / 100).toFixed(2)),
      }
    })
  }, [settledRows])

  const outcomeData = [
    { name: "Wins", value: wonDuels, color: "#34d399" },
    { name: "Losses", value: lostDuels, color: "#fb7185" },
    { name: "Ties", value: tiedDuels, color: "#94a3b8" },
  ].filter((item) => item.value > 0)

  const recentSettled = [...settledRows]
    .sort((a, b) => (b.endedAtSec ?? 0) - (a.endedAtSec ?? 0))
    .slice(0, 5)

  const dashboardStats = [
    {
      label: "Index Duels",
      value: mappedDuels.length.toString(),
      sub: `${playedDuels} played`,
      icon: Swords,
      tone: "text-primary",
    },
    {
      label: "Net Earned",
      value: `${netEarnedFlow >= 0 ? "+" : ""}${netEarnedFlow.toFixed(3)} FLOW`,
      sub: `Won ${grossWonFlow.toFixed(3)} • Lost ${grossLostFlow.toFixed(3)}`,
      icon: netEarnedFlow >= 0 ? TrendingUp : TrendingDown,
      tone: netEarnedFlow >= 0 ? "text-emerald-300" : "text-rose-300",
    },
    {
      label: "Active Exposure",
      value: formatEth(activeExposureFlow),
      sub: `${myDuels.active.length} active / ${myDuels.pending.length} pending`,
      icon: Wallet,
      tone: "text-amber-300",
    },
    {
      label: "Index Performance",
      value: `${averageReturnPct >= 0 ? "+" : ""}${averageReturnPct.toFixed(2)}%`,
      sub: `Best ${bestReturnPct >= 0 ? "+" : ""}${bestReturnPct.toFixed(2)}%`,
      icon: BarChart3,
      tone: "text-cyan-300",
    },
    {
      label: "Win Rate",
      value: `${winRate.toFixed(1)}%`,
      sub: `${wonDuels}W / ${lostDuels}L / ${tiedDuels}T`,
      icon: Trophy,
      tone: "text-primary",
    },
    {
      label: "Wins",
      value: wonDuels.toString(),
      sub: "Settled victories",
      icon: ShieldCheck,
      tone: "text-emerald-300",
    },
    {
      label: "Losses",
      value: lostDuels.toString(),
      sub: "Settled defeats",
      icon: Target,
      tone: "text-rose-300",
    },
    {
      label: "Ties",
      value: tiedDuels.toString(),
      sub: "Neutral outcomes",
      icon: CircleDashed,
      tone: "text-slate-300",
    },
    {
      label: "Live Duels",
      value: myDuels.active.length.toString(),
      sub: "In progress now",
      icon: Activity,
      tone: "text-amber-300",
    },
  ]

  useEffect(() => {
    const requestedTab = searchParams.get("tab")
    if (requestedTab === "active" || requestedTab === "pending" || requestedTab === "completed") {
      setTab(requestedTab)
    }
  }, [searchParams])

  useEffect(() => {
    // Keep users from landing on an empty tab right after creating/joining a duel.
    if (tab === "active" && myDuels.active.length === 0) {
      if (myDuels.pending.length > 0) {
        setTab("pending")
        return
      }
      if (myDuels.completed.length > 0) {
        setTab("completed")
      }
    }
  }, [tab, myDuels.active.length, myDuels.pending.length, myDuels.completed.length])

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "active",    label: "Active",    count: myDuels.active.length    },
    { key: "pending",   label: "Pending",   count: myDuels.pending.length   },
    { key: "completed", label: "Completed", count: myDuels.completed.length },
  ]

  const currentDuels = myDuels[tab]

  return (
    <AppShell>
      <Hero
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "My Duels" }]}
        title="My Duels"
        subtitle="Your active, pending, and completed duels. Only final results are ever disclosed."
      />

      {/* Wallet info strip */}
      <div className="border-b border-border bg-muted/5 px-6 py-3">
        <div className="max-w-[1200px] mx-auto flex items-center gap-3">
          <div className={`h-2 w-2 rounded-full ${isConnected ? "bg-primary animate-pulse" : "bg-red-500"}`} />
          <span className="font-mono text-xs text-muted-foreground">
            {isConnected ? (
              <>Connected as <span className="text-foreground font-semibold">{truncateAddress(address as string)}</span></>
            ) : "Not connected"}
          </span>
          <span className="ml-auto font-mono text-xs text-muted-foreground">
            {mappedDuels.length} total duels
          </span>
        </div>
      </div>

      <div className="border-b border-border px-6 py-5 bg-muted/5">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-4">
          {dashboardStats.map((stat) => {
            const Icon = stat.icon
            return (
              <div key={stat.label} className="rounded-xl border border-border bg-card px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wide">{stat.label}</span>
                  <Icon className={`h-3.5 w-3.5 ${stat.tone}`} />
                </div>
                <p className={`font-mono text-lg font-semibold ${stat.tone}`}>{stat.value}</p>
                <p className="font-mono text-[10px] text-muted-foreground mt-1">{stat.sub}</p>
              </div>
            )
          })}
        </div>

        <div className="max-w-[1200px] mx-auto grid grid-cols-1 xl:grid-cols-3 gap-3">
          <div className="xl:col-span-2 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-mono text-xs text-foreground font-semibold">Cumulative Net FLOW</h3>
              <span className="font-mono text-[10px] text-muted-foreground">Settled duel sequence</span>
            </div>

            {performanceData.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground font-mono text-xs">
                No settled duels yet to chart performance.
              </div>
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={performanceData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={56} />
                    <Tooltip
                      formatter={(value: any, name: string) => {
                        if (name === "cumulative") return [`${Number(value).toFixed(4)} FLOW`, "Cumulative"]
                        if (name === "pnl") return [`${Number(value).toFixed(4)} FLOW`, "Duel PnL"]
                        return [value, name]
                      }}
                      labelFormatter={(label: string, payload: any) => {
                        const duel = payload?.[0]?.payload?.duel
                        return duel ? `${label} (${duel})` : label
                      }}
                    />
                    <Area type="monotone" dataKey="cumulative" stroke="#1DED83" fill="#1DED8322" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-mono text-xs text-foreground font-semibold">Outcome Split</h3>
              <span className="font-mono text-[10px] text-muted-foreground">Settled index duels</span>
            </div>

            {outcomeData.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground font-mono text-xs">
                No settled outcomes yet.
              </div>
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={outcomeData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={76} paddingAngle={2}>
                      {outcomeData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any, name: string) => [value, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="space-y-2">
              {outcomeData.map((row) => (
                <div key={row.name} className="flex items-center justify-between font-mono text-[11px]">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} />
                    {row.name}
                  </div>
                  <span className="text-foreground">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-[1200px] mx-auto mt-3 rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="font-mono text-xs text-foreground font-semibold">Recent Settled Index Duels</h3>
            <span className="font-mono text-[10px] text-muted-foreground">Latest 5 results</span>
          </div>

          {recentSettled.length === 0 ? (
            <div className="px-4 py-6 text-center font-mono text-xs text-muted-foreground">
              No settled duel records yet.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentSettled.map((duel) => {
                const resultLabel = duel.isTie ? "Tie" : duel.isWin ? "Win" : duel.isLoss ? "Loss" : "Settled"
                const resultTone = duel.isTie ? "text-slate-300" : duel.isWin ? "text-emerald-300" : duel.isLoss ? "text-rose-300" : "text-muted-foreground"
                const returnPct = duel.viewerReturnBps / 100
                return (
                  <div key={duel.duelId} className="px-4 py-3 grid grid-cols-4 gap-2 items-center font-mono text-[11px]">
                    <span className="text-muted-foreground">#{duel.duelId.slice(2, 10)}</span>
                    <span className={resultTone}>{resultLabel}</span>
                    <span className="text-foreground">{formatEth(duel.entryAmountFlow)}</span>
                    <span className={`${duel.netFlow >= 0 ? "text-emerald-300" : "text-rose-300"} text-right`}>
                      {duel.netFlow >= 0 ? "+" : ""}{duel.netFlow.toFixed(3)} FLOW ({returnPct >= 0 ? "+" : ""}{returnPct.toFixed(2)}%)
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border px-6">
        <div className="max-w-[1200px] mx-auto flex gap-1 pt-4">
          {TABS.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 rounded-t-lg px-4 py-2.5 font-mono text-xs font-medium border-b-2 transition-all duration-200 ${
                tab === key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                tab === key ? "bg-primary/20 text-primary" : "bg-muted/40 text-muted-foreground"
              }`}>
                {count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Duel list */}
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        {!isConnected ? (
          <DuelEmptyState
            title="Wallet Not Connected"
            description="Connect your wallet to view your created and joined duels."
          />
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="font-mono text-sm">Loading your on-chain duels...</p>
          </div>
        ) : currentDuels.length === 0 ? (
          <DuelEmptyState
            title={tab === "active" ? "No Active Duels" : tab === "pending" ? "No Pending Duels" : "No Completed Duels"}
            description={tab === "completed"
              ? "You haven't completed any duels yet. Jump in and compete!"
              : "Nothing here yet. Create or join a duel to get started."}
            cta={tab !== "completed"
              ? { label: tab === "active" ? "Browse Open Duels" : "Create a Duel", href: tab === "active" ? "/join-duel" : "/create-duel" }
              : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {currentDuels.map(duel => (
              <DuelCard key={duel.id} duel={duel} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}

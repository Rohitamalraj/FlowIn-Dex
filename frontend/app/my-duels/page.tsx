"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useAccount } from "wagmi"
import { Loader2 } from "lucide-react"
import AppShell from "@/components/duel/app-shell"
import Hero from "@/components/duel/hero"
import DuelCard from "@/components/duel/duel-card"
import DuelEmptyState from "@/components/duel/duel-empty-state"
import StatusBadge from "@/components/duel/status-badge"
import { DuelStatus, type Duel } from "@/lib/duel-types"
import { truncateAddress } from "@/lib/duel-utils"
import { apiGetUserDuels } from "@/lib/api-client"

type Tab = "active" | "pending" | "completed"

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

    // Prefer normalized backend state names; fall back to codes for older responses.
    let status = DuelStatus.OPEN
    if (state === "joined" || state === "submittedboth") status = DuelStatus.JOINED
    else if (state === "active" || state === "locked") status = DuelStatus.LOCKED
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
      assetUniverse: d.assetUniverse || [],
      entryAmountEth: parseFloat(d.entryAmountFormatted || "0"),
      durationSeconds: d.duration || 86400,
      createdAt: new Date(((d.createdAt || d.startTime || (Date.now() / 1000)) * 1000)),
      startTime: d.startTime ? new Date(d.startTime * 1000) : undefined,
      endTime: d.endTime ? new Date(d.endTime * 1000) : undefined,
      winnerAddress: d.winner !== "0x0000000000000000000000000000000000000000" ? d.winner : undefined
    } as Duel
  })

  const myDuels = {
    active:    mappedDuels.filter(d => [DuelStatus.LOCKED, DuelStatus.SETTLING].includes(d.status)),
    pending:   mappedDuels.filter(d => [DuelStatus.OPEN, DuelStatus.JOINED].includes(d.status)),
    completed: mappedDuels.filter(d => [DuelStatus.SETTLED, DuelStatus.CANCELLED].includes(d.status)),
  }

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

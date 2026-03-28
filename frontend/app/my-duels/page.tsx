"use client"

import { useState } from "react"
import Link from "next/link"
import AppShell from "@/components/duel/app-shell"
import Hero from "@/components/duel/hero"
import DuelCard from "@/components/duel/duel-card"
import DuelEmptyState from "@/components/duel/duel-empty-state"
import StatusBadge from "@/components/duel/status-badge"
import { MOCK_DUELS, MY_ADDRESS } from "@/lib/mock-duels"
import { DuelStatus, type Duel } from "@/lib/duel-types"
import { truncateAddress, formatDuration, formatEth, formatTimeAgo } from "@/lib/duel-utils"

type Tab = "active" | "pending" | "completed"

function getMyDuels(): { active: Duel[]; pending: Duel[]; completed: Duel[] } {
  const all = MOCK_DUELS.filter(
    d => d.creator.address === MY_ADDRESS || d.opponent?.address === MY_ADDRESS
  )
  return {
    active:    all.filter(d => [DuelStatus.LOCKED, DuelStatus.SETTLING].includes(d.status)),
    pending:   all.filter(d => [DuelStatus.OPEN, DuelStatus.JOINED].includes(d.status)),
    completed: all.filter(d => [DuelStatus.SETTLED, DuelStatus.CANCELLED].includes(d.status)),
  }
}

export default function MyDuelsPage() {
  const [tab, setTab] = useState<Tab>("active")
  const myDuels = getMyDuels()

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
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span className="font-mono text-xs text-muted-foreground">
            Connected as{" "}
            <span className="text-foreground font-semibold">{truncateAddress(MY_ADDRESS)}</span>
          </span>
          <span className="ml-auto font-mono text-xs text-muted-foreground">
            {MOCK_DUELS.filter(d => d.creator.address === MY_ADDRESS || d.opponent?.address === MY_ADDRESS).length} total duels
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
        {currentDuels.length === 0 ? (
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

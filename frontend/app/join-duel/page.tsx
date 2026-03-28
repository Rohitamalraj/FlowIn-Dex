"use client"

import { useState } from "react"
import { Search, Filter, SlidersHorizontal, Lock, Loader2, CheckCircle2 } from "lucide-react"
import AppShell from "@/components/duel/app-shell"
import Hero from "@/components/duel/hero"
import DuelCard from "@/components/duel/duel-card"
import DuelEmptyState from "@/components/duel/duel-empty-state"
import WeightBuilder from "@/components/duel/weight-builder"
import { MOCK_DUELS } from "@/lib/mock-duels"
import { DuelStatus, type Duel, type WeightAllocation } from "@/lib/duel-types"
import { formatDuration, formatEth } from "@/lib/duel-utils"

type DurationFilter = "all" | "short" | "medium" | "long"

export default function JoinDuelPage() {
  const [search, setSearch]               = useState("")
  const [durationFilter, setDurationFilter] = useState<DurationFilter>("all")
  const [maxEntry, setMaxEntry]           = useState<number>(10)
  const [selectedDuel, setSelectedDuel]   = useState<Duel | null>(null)
  const [allocations, setAllocations]     = useState<WeightAllocation[]>([])
  const [allocValid, setAllocValid]       = useState(false)
  const [isJoining, setIsJoining]         = useState(false)
  const [joined, setJoined]               = useState(false)

  const openDuels = MOCK_DUELS.filter((d) => d.status === DuelStatus.OPEN)

  const filteredDuels = openDuels.filter((d) => {
    if (maxEntry < 10 && d.entryAmountEth > maxEntry) return false
    if (durationFilter === "short"  && d.durationSeconds > 21600)   return false
    if (durationFilter === "medium" && (d.durationSeconds <= 21600 || d.durationSeconds > 259200)) return false
    if (durationFilter === "long"   && d.durationSeconds <= 259200) return false
    return true
  })

  const handleSelectDuel = (id: string) => {
    const duel = openDuels.find(d => d.id === id)
    if (duel) {
      setSelectedDuel(duel)
      setJoined(false)
      setAllocValid(false)
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  const handleJoin = async () => {
    setIsJoining(true)
    await new Promise(r => setTimeout(r, 2000))
    setIsJoining(false)
    setJoined(true)
  }

  const DURATION_FILTERS: { label: string; value: DurationFilter }[] = [
    { label: "All",    value: "all"    },
    { label: "< 6h",   value: "short"  },
    { label: "6h–3d",  value: "medium" },
    { label: "3d+",    value: "long"   },
  ]

  return (
    <AppShell>
      <Hero
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Browse Duels" }]}
        title="Browse Open Duels"
        subtitle="Join an existing duel, build your encrypted portfolio, and compete confidentially."
        badge="Open Duels"
      />

      {/* Selected Duel – Join Panel */}
      {selectedDuel && (
        <div className="border-b border-border bg-muted/10">
          <div className="max-w-[800px] mx-auto px-6 py-8">
            {joined ? (
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-10 flex flex-col items-center gap-4 text-center">
                <CheckCircle2 className="h-12 w-12 text-primary" />
                <h2 className="font-mono font-bold text-foreground text-lg">You've Joined!</h2>
                <p className="font-mono text-sm text-muted-foreground">
                  Your encrypted allocation has been submitted. The duel will begin when both players are ready.
                </p>
                <button onClick={() => setSelectedDuel(null)} className="font-mono text-xs text-primary hover:underline mt-2">
                  ← Back to browsing
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-mono font-semibold text-foreground">
                    Joining Duel #{selectedDuel.id}
                  </h2>
                  <button onClick={() => setSelectedDuel(null)} className="font-mono text-xs text-muted-foreground hover:text-foreground">
                    ✕ Cancel
                  </button>
                </div>

                {/* Duel info */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    ["Duration", formatDuration(selectedDuel.durationSeconds)],
                    ["Entry",    formatEth(selectedDuel.entryAmountEth) + " each"],
                    ["Assets",   selectedDuel.assetUniverse.join(", ")],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-border bg-card px-4 py-3">
                      <p className="font-mono text-[10px] text-muted-foreground mb-1">{label}</p>
                      <p className="font-mono text-xs font-semibold text-foreground">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Weight builder */}
                <div className="rounded-2xl border border-border bg-card p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Lock className="h-4 w-4 text-primary" />
                    <span className="font-mono text-sm font-semibold text-foreground">Build Your Allocation</span>
                  </div>
                  <WeightBuilder
                    allowedSymbols={selectedDuel.assetUniverse}
                    onWeightsChange={(allocs, valid) => {
                      setAllocations(allocs)
                      setAllocValid(valid)
                    }}
                  />
                </div>

                {/* Encryption notice */}
                <div className="rounded-xl border border-border bg-muted/20 p-4 flex items-start gap-3">
                  <Lock className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <p className="font-mono text-xs text-muted-foreground">
                    Your weights are encrypted client-side. No plaintext strategy data is sent to the network.
                  </p>
                </div>

                <button
                  onClick={handleJoin}
                  disabled={!allocValid || isJoining}
                  className="w-full rounded-full bg-primary text-primary-foreground font-mono font-semibold py-3 hover:shadow-[0_0_20px_hsl(var(--primary)/0.4)] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isJoining ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Encrypting & Joining…</>
                  ) : (
                    <><Lock className="h-4 w-4" /> Encrypt & Join Duel</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="border-b border-border bg-background px-6 py-4">
        <div className="max-w-[1200px] mx-auto flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by duel ID or asset…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-full border border-border bg-muted/20 pl-9 pr-4 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:bg-muted/30 transition-all"
            />
          </div>

          {/* Duration filter */}
          <div className="flex items-center gap-1">
            {DURATION_FILTERS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setDurationFilter(value)}
                className={`rounded-full border px-3 py-1.5 font-mono text-xs transition-all duration-200 ${
                  durationFilter === value
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Duel Grid */}
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <p className="font-mono text-sm text-muted-foreground">
            <span className="text-foreground font-semibold">{filteredDuels.length}</span> open duels
          </p>
        </div>

        {filteredDuels.length === 0 ? (
          <DuelEmptyState
            title="No Open Duels"
            description="No duels match your filters. Try broadening your search, or create one yourself."
            cta={{ label: "Create a Duel", href: "/create-duel" }}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDuels.map((duel) => (
              <DuelCard key={duel.id} duel={duel} onJoin={handleSelectDuel} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}

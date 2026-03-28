"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import AppShell from "@/components/duel/app-shell"
import Hero from "@/components/duel/hero"
import WeightBuilder from "@/components/duel/weight-builder"
import type { WeightAllocation } from "@/lib/duel-types"
import { SUPPORTED_ASSETS } from "@/lib/duel-types"
import { formatEth, basisPointsToPercent } from "@/lib/duel-utils"
import { CheckCircle2, Loader2, Lock, ArrowRight, ArrowLeft } from "lucide-react"

const DURATION_OPTIONS = [
  { label: "1 Hour",   seconds: 3600    },
  { label: "6 Hours",  seconds: 21600   },
  { label: "24 Hours", seconds: 86400   },
  { label: "3 Days",   seconds: 259200  },
  { label: "7 Days",   seconds: 604800  },
]

const ENTRY_OPTIONS = [0.01, 0.05, 0.1, 0.25, 0.5, 1.0]

export default function CreateDuelPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)

  // Step 1 state
  const [duration, setDuration]         = useState<number>(86400)
  const [entryAmount, setEntryAmount]   = useState<number>(0.05)
  const [selectedAssets, setSelectedAssets] = useState<string[]>(["BTC", "ETH", "SOL"])

  // Step 2 state
  const [allocations, setAllocations]   = useState<WeightAllocation[]>([])
  const [allocValid, setAllocValid]     = useState(false)

  // Step 3 state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted]       = useState(false)

  const toggleAsset = (symbol: string) => {
    setSelectedAssets((prev) =>
      prev.includes(symbol)
        ? prev.length > 2 ? prev.filter((s) => s !== symbol) : prev // min 2
        : prev.length < 5 ? [...prev, symbol] : prev                // max 5
    )
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    await new Promise((r) => setTimeout(r, 2200))
    setIsSubmitting(false)
    setSubmitted(true)
    setTimeout(() => router.push("/my-duels"), 1800)
  }

  return (
    <AppShell>
      <Hero
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Create Duel" }]}
        title="Create a Duel"
        subtitle="Set your parameters, build your encrypted portfolio strategy, and challenge the market."
        badge="New Duel"
      />

      <div className="max-w-[800px] mx-auto px-6 py-10">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-10">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center font-mono text-xs font-bold border transition-all duration-300 ${
                step === s ? "bg-primary text-primary-foreground border-primary" :
                step > s  ? "bg-primary/20 text-primary border-primary/30" :
                             "bg-muted/30 text-muted-foreground border-border"
              }`}>
                {step > s ? <CheckCircle2 className="h-4 w-4" /> : s}
              </div>
              <span className={`font-mono text-xs hidden sm:block ${step >= s ? "text-foreground" : "text-muted-foreground"}`}>
                {s === 1 ? "Parameters" : s === 2 ? "Allocation" : "Review"}
              </span>
              {s < 3 && <div className={`h-px w-10 md:w-16 ${step > s ? "bg-primary/40" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        {/* ── Step 1: Parameters ─────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-8">
            {/* Duration */}
            <div>
              <label className="font-mono text-sm font-semibold text-foreground mb-3 block">Duel Duration</label>
              <div className="flex flex-wrap gap-2">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.seconds}
                    onClick={() => setDuration(opt.seconds)}
                    className={`rounded-full border px-4 py-2 font-mono text-xs transition-all duration-200 ${
                      duration === opt.seconds
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Entry Amount */}
            <div>
              <label className="font-mono text-sm font-semibold text-foreground mb-3 block">Entry Amount (ETH)</label>
              <div className="flex flex-wrap gap-2">
                {ENTRY_OPTIONS.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setEntryAmount(amt)}
                    className={`rounded-full border px-5 py-2 font-mono text-xs transition-all duration-200 ${
                      entryAmount === amt
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {formatEth(amt)}
                  </button>
                ))}
              </div>
            </div>

            {/* Asset Universe */}
            <div>
              <label className="font-mono text-sm font-semibold text-foreground mb-1 block">Asset Universe</label>
              <p className="font-mono text-xs text-muted-foreground mb-3">Select 2–5 assets for the competition.</p>
              <div className="flex flex-col gap-2">
                {SUPPORTED_ASSETS.map((asset) => {
                  const selected = selectedAssets.includes(asset.symbol)
                  return (
                    <button
                      key={asset.symbol}
                      onClick={() => toggleAsset(asset.symbol)}
                      className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-all duration-200 ${
                        selected
                          ? "border-primary/40 bg-primary/5 text-foreground"
                          : "border-border text-muted-foreground hover:border-muted-foreground/40"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-lg ${selected ? "text-primary" : ""}`}>{asset.icon}</span>
                        <span className="font-mono text-sm font-medium">{asset.symbol}</span>
                        <span className="font-mono text-xs text-muted-foreground">{asset.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-muted-foreground">
                          ${asset.currentPrice.toLocaleString()}
                        </span>
                        <span className={`font-mono text-xs ${asset.priceChange24h >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {asset.priceChange24h >= 0 ? "+" : ""}{asset.priceChange24h.toFixed(1)}%
                        </span>
                        <div className={`h-4 w-4 rounded border flex items-center justify-center transition-all ${
                          selected ? "border-primary bg-primary text-primary-foreground" : "border-border"
                        }`}>
                          {selected && <CheckCircle2 className="h-3 w-3" />}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full rounded-full bg-primary text-primary-foreground font-mono font-semibold py-3 hover:shadow-[0_0_20px_hsl(var(--primary)/0.4)] hover:scale-[1.01] transition-all duration-200 flex items-center justify-center gap-2"
            >
              Continue to Allocation <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ── Step 2: Allocation ──────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-8">
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center gap-2 mb-6">
                <Lock className="h-4 w-4 text-primary" />
                <h2 className="font-mono font-semibold text-foreground text-sm">Build Your Portfolio</h2>
              </div>
              <p className="font-mono text-xs text-muted-foreground mb-6">
                Your allocation will be encrypted before submission. Only the final duel result is ever disclosed.
              </p>
              <WeightBuilder
                allowedSymbols={selectedAssets}
                onWeightsChange={(allocs, valid) => {
                  setAllocations(allocs)
                  setAllocValid(valid)
                }}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-2 rounded-full border border-border text-muted-foreground font-mono text-sm px-6 py-3 hover:text-foreground hover:border-muted-foreground transition-all"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!allocValid}
                className="flex-1 rounded-full bg-primary text-primary-foreground font-mono font-semibold py-3 hover:shadow-[0_0_20px_hsl(var(--primary)/0.4)] hover:scale-[1.01] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-none"
              >
                Review & Submit <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Review ──────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-6">
            {submitted ? (
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-12 flex flex-col items-center gap-4">
                <CheckCircle2 className="h-12 w-12 text-primary" />
                <h2 className="font-mono font-bold text-foreground text-lg">Duel Created!</h2>
                <p className="font-mono text-sm text-muted-foreground">Your encrypted strategy is on-chain. Redirecting…</p>
              </div>
            ) : (
              <>
                {/* Summary Card */}
                <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
                  <h2 className="font-mono font-semibold text-foreground">Duel Summary</h2>

                  <div className="space-y-3">
                    {[
                      ["Duration",     DURATION_OPTIONS.find(d => d.seconds === duration)?.label ?? ""],
                      ["Entry Amount", formatEth(entryAmount) + " per player"],
                      ["Asset Universe", selectedAssets.join(", ")],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between border-b border-border pb-3">
                        <span className="font-mono text-xs text-muted-foreground">{label}</span>
                        <span className="font-mono text-xs text-foreground font-semibold">{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Allocation breakdown */}
                  <div>
                    <p className="font-mono text-xs text-muted-foreground mb-2">Your Encrypted Allocation</p>
                    <div className="flex gap-0.5 h-3 rounded-full overflow-hidden mb-2">
                      {allocations.map((alloc) => {
                        const asset = SUPPORTED_ASSETS.find(a => a.symbol === alloc.symbol)
                        return (
                          <div key={alloc.symbol} className="transition-all duration-200" style={{
                            width: `${basisPointsToPercent(alloc.basisPoints)}%`,
                            backgroundColor:
                              alloc.symbol === "BTC"  ? "#F7931A" :
                              alloc.symbol === "ETH"  ? "#627EEA" :
                              alloc.symbol === "SOL"  ? "#9945FF" :
                              alloc.symbol === "BNB"  ? "#F0B90B" : "#2775CA",
                          }} />
                        )
                      })}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {allocations.map((alloc) => (
                        <span key={alloc.symbol} className="font-mono text-xs text-muted-foreground">
                          {alloc.symbol} {basisPointsToPercent(alloc.basisPoints).toFixed(1)}%
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Encryption Notice */}
                <div className="rounded-xl border border-border bg-muted/20 p-4 flex items-start gap-3">
                  <Lock className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <p className="font-mono text-xs text-muted-foreground">
                    Your portfolio weights will be encrypted client-side using the fhEVM relayer SDK before submission. No plaintext data leaves your browser.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(2)}
                    className="flex items-center gap-2 rounded-full border border-border text-muted-foreground font-mono text-sm px-6 py-3 hover:text-foreground hover:border-muted-foreground transition-all"
                  >
                    <ArrowLeft className="h-4 w-4" /> Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="flex-1 rounded-full bg-primary text-primary-foreground font-mono font-semibold py-3 hover:shadow-[0_0_20px_hsl(var(--primary)/0.4)] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {isSubmitting ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Encrypting & Submitting…</>
                    ) : (
                      <><Lock className="h-4 w-4" /> Encrypt & Create Duel</>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}

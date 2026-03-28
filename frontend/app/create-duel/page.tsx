"use client"

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import AppShell from "@/components/duel/app-shell"
import Hero from "@/components/duel/hero"
import { SUPPORTED_ASSETS } from "@/lib/duel-types"
import type { WeightAllocation } from "@/lib/duel-types"
import {
  computeTotalWeight, isWeightValid, normalizeWeights,
  formatEth, basisPointsToPercent,
} from "@/lib/duel-utils"
import { CheckCircle2, Loader2, Lock, ArrowRight, ArrowLeft, Plus, Minus, X, Shuffle, Zap } from "lucide-react"

// ─── Constants ─────────────────────────────────────────────────────────────────
const DURATION_OPTIONS = [
  { label: "1 Hour",   seconds: 3600   },
  { label: "6 Hours",  seconds: 21600  },
  { label: "24 Hours", seconds: 86400  },
  { label: "3 Days",   seconds: 259200 },
  { label: "7 Days",   seconds: 604800 },
]
const ENTRY_OPTIONS = [0.01, 0.05, 0.1, 0.25, 0.5, 1.0]

const ASSET_COLORS: Record<string, string> = {
  BTC:  "#F7931A",
  ETH:  "#627EEA",
  SOL:  "#9945FF",
  BNB:  "#F0B90B",
  USDC: "#2775CA",
}

// Node sizes
const P_W = 190   // Portfolio node width
const P_H = 88    // Portfolio node height
const C_W = 236   // Coin node width
const C_H = 126   // Coin node height
const CANVAS_H = 560
const PORTFOLIO_CX = 180  // portfolio node center-x
const COIN_X = 470        // coin node left-edge x

// ─── Helpers ──────────────────────────────────────────────────────────────────
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = (x2 - x1) * 0.55
  return `M ${x1} ${y1} C ${x1 + cx} ${y1}, ${x2 - cx} ${y2}, ${x2} ${y2}`
}

function distributeY(count: number, idx: number): number {
  const spacing = Math.min(148, (CANVAS_H - 60) / count)
  const totalH  = spacing * count - (spacing - C_H)
  const startY  = Math.max(20, (CANVAS_H - totalH) / 2)
  return startY + idx * spacing
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface FlowNode {
  symbol: string
  basisPoints: number
  x: number
  y: number
}

// ─── Allocation bar ───────────────────────────────────────────────────────────
function AllocBar({ allocs }: { allocs: WeightAllocation[] }) {
  return (
    <div className="flex h-2 rounded-full overflow-hidden gap-px">
      {allocs.map(a => (
        <div key={a.symbol} className="transition-all duration-300"
          style={{ flexBasis: `${a.basisPoints / 100}%`, backgroundColor: ASSET_COLORS[a.symbol] ?? "#555", minWidth: a.basisPoints > 0 ? 2 : 0 }} />
      ))}
      {allocs.length === 0 && <div className="flex-1 bg-muted" />}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CreateDuelPage() {
  const router = useRouter()

  const [step, setStep]               = useState(1)
  const [duration, setDuration]       = useState(86400)
  const [entryAmount, setEntryAmount] = useState(0.05)
  const [nodes, setNodes]             = useState<FlowNode[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted]       = useState(false)

  // Drag state
  const dragRef = useRef<{ symbol: string; ox: number; oy: number; nx: number; ny: number } | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  // Portfolio center Y
  const portfolioCY = CANVAS_H / 2
  const portfolioLeft = PORTFOLIO_CX - P_W / 2
  const portfolioTop  = portfolioCY - P_H / 2
  // Right port of portfolio node
  const portRX = portfolioLeft + P_W
  const portRY = portfolioCY

  // ── derived ──────────────────────────────────────────────────────────────
  const allocs: WeightAllocation[] = nodes.map(n => ({ symbol: n.symbol, basisPoints: n.basisPoints }))
  const total    = computeTotalWeight(allocs)
  const allocValid = isWeightValid(allocs) && nodes.length >= 2
  const selected = nodes.map(n => n.symbol)

  // ── add / remove ─────────────────────────────────────────────────────────
  const addNode = useCallback((symbol: string) => {
    if (nodes.length >= 5 || selected.includes(symbol)) return
    const targetCount = nodes.length + 1
    const equal = Math.floor(10000 / targetCount)
    const newNodes = [
      ...nodes.map((n, i) => ({ ...n, basisPoints: equal, y: distributeY(targetCount, i) })),
      { symbol, basisPoints: 10000 - equal * nodes.length, x: COIN_X, y: distributeY(targetCount, nodes.length) },
    ]
    setNodes(newNodes)
  }, [nodes, selected])

  const removeNode = useCallback((symbol: string) => {
    const remaining = nodes.filter(n => n.symbol !== symbol)
    if (remaining.length === 0) { setNodes([]); return }
    const norm = normalizeWeights(remaining.map(n => ({ symbol: n.symbol, basisPoints: n.basisPoints })))
    setNodes(remaining.map((n, i) => ({
      ...n, basisPoints: norm[i].basisPoints, y: distributeY(remaining.length, i)
    })))
  }, [nodes])

  const adjustPct = (symbol: string, delta: number) => {
    setNodes(prev => prev.map(n =>
      n.symbol === symbol ? { ...n, basisPoints: Math.max(100, Math.min(9800, n.basisPoints + delta)) } : n
    ))
  }

  const handleNormalize = () => {
    const norm = normalizeWeights(allocs)
    setNodes(prev => prev.map(n => ({ ...n, basisPoints: norm.find(a => a.symbol === n.symbol)?.basisPoints ?? n.basisPoints })))
  }

  // ── drag ─────────────────────────────────────────────────────────────────
  const onNodePointerDown = (e: React.PointerEvent, symbol: string) => {
    // Don't drag if clicking a button
    if ((e.target as HTMLElement).closest("button")) return
    e.preventDefault()
    const node = nodes.find(n => n.symbol === symbol)!
    const rect = canvasRef.current!.getBoundingClientRect()
    dragRef.current = {
      symbol,
      ox: e.clientX - rect.left,
      oy: e.clientY - rect.top,
      nx: node.x,
      ny: node.y,
    }
  }

  const onCanvasPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    const rect = canvasRef.current!.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const dx = cx - dragRef.current.ox
    const dy = cy - dragRef.current.oy
    const newX = Math.max(0, Math.min(rect.width - C_W, dragRef.current.nx + dx))
    const newY = Math.max(0, Math.min(CANVAS_H - C_H, dragRef.current.ny + dy))
    setNodes(prev => prev.map(n =>
      n.symbol === dragRef.current!.symbol ? { ...n, x: newX, y: newY } : n
    ))
  }

  const stopDrag = () => { dragRef.current = null }

  // ── submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setIsSubmitting(true)
    await new Promise(r => setTimeout(r, 2200))
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

      <div className="max-w-[1100px] mx-auto px-4 md:px-6 py-10">
        {/* ── Step indicator ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-10">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center font-mono text-xs font-bold border transition-all duration-300 ${
                step === s ? "bg-primary text-primary-foreground border-primary" :
                step > s   ? "bg-primary/20 text-primary border-primary/30" :
                              "bg-muted/30 text-muted-foreground border-border"
              }`}>
                {step > s ? <CheckCircle2 className="h-4 w-4" /> : s}
              </div>
              <span className={`font-mono text-xs hidden sm:block ${step >= s ? "text-foreground" : "text-muted-foreground"}`}>
                {s === 1 ? "Parameters" : s === 2 ? "Portfolio Builder" : "Review"}
              </span>
              {s < 3 && <div className={`h-px w-10 md:w-16 ${step > s ? "bg-primary/40" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            STEP 1 – Parameters
        ══════════════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="space-y-8">
            <div>
              <label className="font-mono text-sm font-semibold text-foreground mb-3 block">Duel Duration</label>
              <div className="flex flex-wrap gap-2">
                {DURATION_OPTIONS.map(opt => (
                  <button key={opt.seconds} onClick={() => setDuration(opt.seconds)}
                    className={`rounded-full border px-4 py-2 font-mono text-xs transition-all duration-200 ${
                      duration === opt.seconds ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="font-mono text-sm font-semibold text-foreground mb-3 block">Entry Amount (ETH)</label>
              <div className="flex flex-wrap gap-2">
                {ENTRY_OPTIONS.map(amt => (
                  <button key={amt} onClick={() => setEntryAmount(amt)}
                    className={`rounded-full border px-5 py-2 font-mono text-xs transition-all duration-200 ${
                      entryAmount === amt ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}>
                    {formatEth(amt)}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => setStep(2)}
              className="w-full rounded-full bg-primary text-primary-foreground font-mono font-semibold py-3 hover:shadow-[0_0_20px_hsl(var(--primary)/0.4)] hover:scale-[1.01] transition-all duration-200 flex items-center justify-center gap-2">
              Build Portfolio Flow <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            STEP 2 – Flow Canvas Portfolio Builder
        ══════════════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="space-y-4">

            {/* ── Coin palette ─────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-2 px-1">
              <span className="font-mono text-[11px] text-muted-foreground mr-1 shrink-0">Add coin:</span>
              {SUPPORTED_ASSETS.map(asset => {
                const added = selected.includes(asset.symbol)
                const full  = nodes.length >= 5 && !added
                return (
                  <button
                    key={asset.symbol}
                    onClick={() => addNode(asset.symbol)}
                    disabled={added || full}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-xs transition-all duration-200 ${
                      added ? "border-primary/40 bg-primary/10 text-primary cursor-not-allowed" :
                      full  ? "border-border/40 text-muted-foreground/40 cursor-not-allowed" :
                              "border-border text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-foreground cursor-pointer"
                    }`}
                  >
                    <span style={{ color: ASSET_COLORS[asset.symbol] }}>{asset.icon}</span>
                    {asset.symbol}
                    {added ? <CheckCircle2 className="h-3 w-3 text-primary" /> : <Plus className="h-3 w-3" />}
                  </button>
                )
              })}
            </div>

            {/* ── Flow canvas ──────────────────────────────────────────── */}
            <div
              ref={canvasRef}
              className="relative rounded-2xl overflow-hidden border border-border select-none"
              style={{
                height: CANVAS_H,
                background: "#07070f",
                backgroundImage: "radial-gradient(circle, #1c1c2e 1.2px, transparent 1.2px)",
                backgroundSize: "28px 28px",
                cursor: dragRef.current ? "grabbing" : "default",
              }}
              onPointerMove={onCanvasPointerMove}
              onPointerUp={stopDrag}
              onPointerLeave={stopDrag}
            >
              {/* ── SVG connection layer ──────────────────────────────── */}
              <svg
                className="absolute inset-0 pointer-events-none"
                style={{ width: "100%", height: "100%", overflow: "visible" }}
              >
                <defs>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>

                {nodes.map(node => {
                  // Left port of coin node
                  const toX = node.x
                  const toY = node.y + C_H / 2
                  return (
                    <g key={node.symbol}>
                      {/* Shadow / glow path */}
                      <path
                        d={bezier(portRX, portRY, toX, toY)}
                        fill="none"
                        stroke={ASSET_COLORS[node.symbol] ?? "#888"}
                        strokeWidth="4"
                        strokeOpacity="0.07"
                        filter="url(#glow)"
                      />
                      {/* Main connection */}
                      <path
                        d={bezier(portRX, portRY, toX, toY)}
                        fill="none"
                        stroke="#2c2c40"
                        strokeWidth="2"
                        strokeDasharray="6 4"
                      >
                        <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="1s" repeatCount="indefinite" />
                      </path>
                      {/* Colored accent thin line */}
                      <path
                        d={bezier(portRX, portRY, toX, toY)}
                        fill="none"
                        stroke={ASSET_COLORS[node.symbol] ?? "#888"}
                        strokeWidth="1.5"
                        strokeOpacity="0.35"
                        strokeDasharray="4 8"
                      />
                      {/* Port dots */}
                      <circle cx={portRX} cy={portRY} r="4" fill="#1a1a2e" stroke="#3a3a5e" strokeWidth="1.5" />
                      <circle cx={toX} cy={toY} r="4" fill="#1a1a2e"
                        stroke={ASSET_COLORS[node.symbol] ?? "#888"} strokeWidth="1.5" strokeOpacity="0.7" />
                    </g>
                  )
                })}
              </svg>

              {/* ── Portfolio Index node (fixed, left) ────────────────── */}
              <div
                className="absolute flex items-center gap-3 rounded-2xl border"
                style={{
                  left: portfolioLeft, top: portfolioTop,
                  width: P_W, height: P_H,
                  borderColor: "rgba(29,237,131,0.35)",
                  background: "linear-gradient(135deg, #0e1a14 0%, #0a0f0e 100%)",
                  boxShadow: "0 0 28px rgba(29,237,131,0.12), inset 0 1px 0 rgba(29,237,131,0.08)",
                  padding: "14px 16px",
                }}
              >
                {/* Icon */}
                <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(29,237,131,0.12)", border: "1px solid rgba(29,237,131,0.25)" }}>
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-mono text-xs font-bold text-white leading-tight">Portfolio Index</p>
                  <p className="font-mono text-[10px] leading-tight" style={{ color: "rgba(29,237,131,0.6)" }}>
                    Your Strategy
                  </p>
                </div>
                {/* Right port */}
                <div className="absolute -right-[9px] top-1/2 -translate-y-1/2 h-[18px] w-[18px] rounded-full flex items-center justify-center"
                  style={{ background: "#07070f", border: "2px solid rgba(29,237,131,0.5)" }}>
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                </div>
              </div>

              {/* ── Coin nodes (draggable) ────────────────────────────── */}
              {nodes.map(node => {
                const asset = SUPPORTED_ASSETS.find(a => a.symbol === node.symbol)!
                const pct   = node.basisPoints / 100
                const color = ASSET_COLORS[node.symbol] ?? "#888"

                return (
                  <div
                    key={node.symbol}
                    onPointerDown={e => onNodePointerDown(e, node.symbol)}
                    className="absolute rounded-2xl overflow-hidden"
                    style={{
                      left: node.x, top: node.y,
                      width: C_W, height: C_H,
                      background: "linear-gradient(135deg, #0f0f1c 0%, #0a0a14 100%)",
                      border: `1px solid ${color}45`,
                      boxShadow: `0 4px 32px ${color}18, inset 0 1px 0 ${color}10`,
                      cursor: "grab",
                    }}
                  >
                    {/* Colored top bar */}
                    <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg, ${color}, ${color}88)` }} />

                    {/* Left port */}
                    <div className="absolute -left-[9px] top-1/2 -translate-y-1/2 h-[18px] w-[18px] rounded-full flex items-center justify-center"
                      style={{ background: "#07070f", border: `2px solid ${color}70` }}>
                      <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                    </div>

                    <div className="p-4 h-full flex flex-col justify-between">
                      {/* Top: icon + name + % */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="flex h-9 w-9 items-center justify-center rounded-xl text-lg font-bold shrink-0"
                            style={{ background: `${color}18`, color }}
                          >
                            {asset.icon}
                          </span>
                          <div>
                            <p className="font-mono text-sm font-bold text-white leading-none">{asset.symbol}</p>
                            <p className="font-mono text-[10px] leading-none mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                              {asset.name}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Large % badge */}
                          <span className="font-mono font-bold tabular-nums text-xl leading-none" style={{ color }}>
                            {pct.toFixed(1)}
                          </span>
                          <span className="font-mono text-xs leading-none" style={{ color: `${color}80` }}>%</span>
                          {/* Remove */}
                          <button
                            onClick={() => removeNode(node.symbol)}
                            className="ml-1 h-5 w-5 rounded-md flex items-center justify-center transition-all duration-150 hover:bg-red-400/20"
                            style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                          >
                            <X className="h-2.5 w-2.5 text-white/30 hover:text-red-400" />
                          </button>
                        </div>
                      </div>

                      {/* Slider + controls */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => adjustPct(node.symbol, -500)}
                          className="h-7 w-7 rounded-lg flex items-center justify-center transition-all duration-150 hover:brightness-125 shrink-0"
                          style={{ background: `${color}18`, border: `1px solid ${color}40`, color }}
                        >
                          <Minus className="h-3 w-3" />
                        </button>

                        {/* Track */}
                        <div className="relative flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                          <div
                            className="absolute inset-y-0 left-0 rounded-full transition-all duration-200"
                            style={{ width: `${Math.min(pct, 100)}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)` }}
                          />
                          <input
                            type="range" min={1} max={100} step={1}
                            value={Math.round(pct)}
                            onChange={e => adjustPct(node.symbol, (Number(e.target.value) - Math.round(pct)) * 100)}
                            className="absolute inset-0 w-full opacity-0 cursor-pointer"
                          />
                        </div>

                        <button
                          onClick={() => adjustPct(node.symbol, 500)}
                          className="h-7 w-7 rounded-lg flex items-center justify-center transition-all duration-150 hover:brightness-125 shrink-0"
                          style={{ background: `${color}18`, border: `1px solid ${color}40`, color }}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* ── Empty state ───────────────────────────────────────── */}
              {nodes.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
                  <p className="font-mono text-sm" style={{ color: "rgba(255,255,255,0.2)" }}>
                    Select coins above to build your portfolio flow
                  </p>
                  <p className="font-mono text-xs" style={{ color: "rgba(255,255,255,0.1)" }}>
                    Min 2 · Max 5 assets · Drag nodes to rearrange
                  </p>
                </div>
              )}

              {/* ── Canvas label ─────────────────────────────────────── */}
              <div className="absolute bottom-3 left-3 font-mono text-[10px]" style={{ color: "rgba(255,255,255,0.15)" }}>
                Drag nodes to rearrange · Scroll canvas to pan
              </div>
            </div>

            {/* ── Allocation status bar ─────────────────────────────── */}
            <div className="rounded-2xl border border-border bg-card px-5 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-3">
                  {nodes.map(n => (
                    <div key={n.symbol} className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ASSET_COLORS[n.symbol] }} />
                      <span className="font-mono text-xs text-muted-foreground">
                        {n.symbol} <span className="text-foreground font-semibold">{(n.basisPoints / 100).toFixed(1)}%</span>
                      </span>
                    </div>
                  ))}
                  {nodes.length === 0 && <span className="font-mono text-xs text-muted-foreground/50">No assets added yet</span>}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {nodes.length >= 2 && !allocValid && (
                    <button onClick={handleNormalize}
                      className="flex items-center gap-1 font-mono text-xs text-primary border border-primary/30 rounded-full px-2.5 py-1 hover:bg-primary/10 transition-colors">
                      <Shuffle className="h-3 w-3" /> Balance
                    </button>
                  )}
                  <span className={`font-mono text-xs font-bold tabular-nums ${
                    nodes.length < 2 ? "text-muted-foreground/40" :
                    allocValid       ? "text-primary" : "text-red-400"
                  }`}>
                    {(total / 100).toFixed(1)}% / 100%
                  </span>
                  {allocValid && (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] text-primary border border-primary/25 bg-primary/8 rounded-full px-2 py-0.5">
                      <CheckCircle2 className="h-3 w-3" /> Valid
                    </span>
                  )}
                </div>
              </div>
              <AllocBar allocs={allocs} />
            </div>

            {/* ── Navigation ───────────────────────────────────────────── */}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep(1)}
                className="flex items-center gap-2 rounded-full border border-border text-muted-foreground font-mono text-sm px-6 py-3 hover:text-foreground hover:border-muted-foreground transition-all">
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

        {/* ══════════════════════════════════════════════════════════════════
            STEP 3 – Review
        ══════════════════════════════════════════════════════════════════ */}
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
                <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
                  <h2 className="font-mono font-semibold text-foreground">Duel Summary</h2>
                  {[
                    ["Duration",    DURATION_OPTIONS.find(d => d.seconds === duration)?.label ?? ""],
                    ["Entry Amount", formatEth(entryAmount) + " per player"],
                    ["Prize Pool",   formatEth(entryAmount * 2) + " total"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between border-b border-border pb-3">
                      <span className="font-mono text-xs text-muted-foreground">{label}</span>
                      <span className="font-mono text-xs text-foreground font-semibold">{value}</span>
                    </div>
                  ))}
                  <div>
                    <p className="font-mono text-xs text-muted-foreground mb-3">Portfolio Allocation (Encrypted on Submit)</p>
                    <AllocBar allocs={allocs} />
                    <div className="flex flex-wrap gap-2 mt-3">
                      {nodes.map(n => (
                        <div key={n.symbol} className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ASSET_COLORS[n.symbol] }} />
                          <span className="font-mono text-xs font-semibold text-foreground">{n.symbol}</span>
                          <span className="font-mono text-xs text-muted-foreground">{(n.basisPoints / 100).toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-muted/20 p-4 flex items-start gap-3">
                  <Lock className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <p className="font-mono text-xs text-muted-foreground">
                    Your portfolio weights will be encrypted client-side using the fhEVM relayer SDK. No plaintext data leaves your browser.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setStep(2)}
                    className="flex items-center gap-2 rounded-full border border-border text-muted-foreground font-mono text-sm px-6 py-3 hover:text-foreground hover:border-muted-foreground transition-all">
                    <ArrowLeft className="h-4 w-4" /> Back
                  </button>
                  <button onClick={handleSubmit} disabled={isSubmitting}
                    className="flex-1 rounded-full bg-primary text-primary-foreground font-mono font-semibold py-3 hover:shadow-[0_0_20px_hsl(var(--primary)/0.4)] transition-all flex items-center justify-center gap-2 disabled:opacity-70">
                    {isSubmitting
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Encrypting & Submitting…</>
                      : <><Lock className="h-4 w-4" /> Encrypt & Create Duel</>}
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

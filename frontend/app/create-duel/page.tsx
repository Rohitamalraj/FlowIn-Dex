"use client"

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAccount, useBalance, usePublicClient, useSwitchChain, useWriteContract } from "wagmi"
import { decodeEventLog, parseEther } from "viem"
import AppShell from "@/components/duel/app-shell"
import Hero from "@/components/duel/hero"
import { SUPPORTED_ASSETS } from "@/lib/duel-types"
import type { WeightAllocation } from "@/lib/duel-types"
import {
  computeTotalWeight,
  isWeightValid,
  normalizeWeights,
  formatEth,
} from "@/lib/duel-utils"
import { ASSET_TIERS, buildContractAssetArrays, getTierWeightTotals } from "@/lib/pyth-config"
import { FACTORY_ABI, DUEL_ABI } from "@/lib/contracts"
import { CheckCircle2, Loader2, Lock, ArrowRight, ArrowLeft, Plus, Minus, X, Shuffle, Zap, Wallet } from "lucide-react"

// ─── Constants ─────────────────────────────────────────────────────────────────
const DURATION_OPTIONS = [
  { label: "2 min",  seconds: 120  },
  { label: "5 min",  seconds: 300  },
  { label: "10 min", seconds: 600  },
  { label: "30 min", seconds: 1800 },
  { label: "1 Hour", seconds: 3600 },
]
const FLOW_EVM_TESTNET_CHAIN_ID = Number(process.env.NEXT_PUBLIC_FLOW_EVM_CHAIN_ID ?? "545")
const FLOW_EVM_TESTNET_NAME = "Flow EVM Testnet"
const ENTRY_OPTIONS = [0.01, 0.05, 0.1, 0.25, 0.5, 1.0]

const ASSET_COLORS: Record<string, string> = {
  BTC:  "#F7931A",
  ETH:  "#627EEA",
  SOL:  "#9945FF",
  BNB:  "#F0B90B",
  STRK: "#8A63D2",
  ARB:  "#28A0F0",
  OP:   "#FF0420",
  MATIC:"#8247E5",
  LINK: "#2A5ADA",
  AVAX: "#E84142",
  USDC: "#2775CA",
  USDT: "#26A17B",
  DAI:  "#F5AC37",
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

function truncateAddress(address?: string): string {
  if (!address) return ""
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function rebalanceToTierSplit(allocations: WeightAllocation[]): WeightAllocation[] | null {
  const tier1 = allocations.filter((a) => (ASSET_TIERS[a.symbol] ?? 1) === 0)
  const tier2 = allocations.filter((a) => (ASSET_TIERS[a.symbol] ?? 1) === 1)

  if (tier1.length === 0 || tier2.length === 0) {
    return null
  }

  const rebalanceGroup = (group: WeightAllocation[], target: number): WeightAllocation[] => {
    const current = group.reduce((sum, item) => sum + item.basisPoints, 0)

    if (current === 0) {
      const even = Math.floor(target / group.length)
      const result = group.map((item, index) => ({
        ...item,
        basisPoints: index === group.length - 1 ? target - even * (group.length - 1) : even,
      }))
      return result
    }

    let remaining = target
    const result = group.map((item, index) => {
      const nextWeight =
        index === group.length - 1
          ? remaining
          : Math.floor((item.basisPoints * target) / current)

      remaining -= nextWeight
      return { ...item, basisPoints: nextWeight }
    })

    return result
  }

  const tier1Balanced = rebalanceGroup(tier1, 5000)
  const tier2Balanced = rebalanceGroup(tier2, 5000)
  const merged = [...tier1Balanced, ...tier2Balanced]
  const mergedMap = new Map(merged.map((item) => [item.symbol, item.basisPoints]))

  return allocations.map((item) => ({
    ...item,
    basisPoints: mergedMap.get(item.symbol) ?? item.basisPoints,
  }))
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
  const { address, chainId, isConnected } = useAccount()
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient({ chainId: FLOW_EVM_TESTNET_CHAIN_ID })
  const isWrongNetwork = isConnected && chainId !== FLOW_EVM_TESTNET_CHAIN_ID
  const { data: walletBalance, isLoading: isBalanceLoading } = useBalance({
    address,
    chainId: FLOW_EVM_TESTNET_CHAIN_ID,
    query: { enabled: Boolean(address) },
  })

  const [step, setStep]               = useState(1)
  const [duration, setDuration]       = useState(86400)
  const [entryAmount, setEntryAmount] = useState(0.05)
  const [nodes, setNodes]             = useState<FlowNode[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted]       = useState(false)
  const [submitError, setSubmitError]   = useState<string | null>(null)
  const [createdDuelAddress, setCreatedDuelAddress] = useState<string | null>(null)

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
  const symbols = nodes.map((n) => n.symbol)
  const weights = nodes.map((n) => n.basisPoints)
  const total = computeTotalWeight(allocs)
  const { tier1: tier1Weight, tier2: tier2Weight } = getTierWeightTotals(symbols, weights)
  const hasTier1Asset = symbols.some((symbol) => (ASSET_TIERS[symbol] ?? 1) === 0)
  const hasTier2Asset = symbols.some((symbol) => (ASSET_TIERS[symbol] ?? 1) === 1)
  const tierSplitValid = tier1Weight === 5000 && tier2Weight === 5000
  const allocValid = isWeightValid(allocs) && nodes.length >= 2 && hasTier1Asset && hasTier2Asset
  const selected = symbols

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
    const tierBalanced = rebalanceToTierSplit(allocs)
    const nextAllocations = tierBalanced ?? normalizeWeights(allocs)
    const nextMap = new Map(nextAllocations.map((a) => [a.symbol, a.basisPoints]))

    setNodes((prev) =>
      prev.map((node) => ({
        ...node,
        basisPoints: nextMap.get(node.symbol) ?? node.basisPoints,
      }))
    )
  }

  // ── drag ─────────────────────────────────────────────────────────────────
  const onNodePointerDown = (e: React.PointerEvent, symbol: string) => {
    // Don't drag if clicking a button
    if ((e.target as HTMLElement).closest("button")) return
    e.preventDefault()
    const node = nodes.find(n => n.symbol === symbol)
    const canvas = canvasRef.current
    if (!node || !canvas) return

    const rect = canvas.getBoundingClientRect()
    dragRef.current = {
      symbol,
      ox: e.clientX - rect.left,
      oy: e.clientY - rect.top,
      nx: node.x,
      ny: node.y,
    }
  }

  const onCanvasPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    const canvas = canvasRef.current
    if (!drag || !canvas) return

    const rect = canvas.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const dx = cx - drag.ox
    const dy = cy - drag.oy
    const newX = Math.max(0, Math.min(rect.width - C_W, drag.nx + dx))
    const newY = Math.max(0, Math.min(CANVAS_H - C_H, drag.ny + dy))
    setNodes(prev => prev.map(n =>
      n.symbol === drag.symbol ? { ...n, x: newX, y: newY } : n
    ))
  }

  const stopDrag = () => { dragRef.current = null }

  // ── submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!isConnected || !address || !publicClient) {
      setSubmitError("Please connect your wallet first.")
      return
    }

    if (!allocValid) {
      setSubmitError("Add at least 2 assets with one Tier 1 and one Tier 2 asset, and ensure total weight is 100%.")
      return
    }

    if (chainId !== FLOW_EVM_TESTNET_CHAIN_ID) {
      if (!switchChainAsync) {
        setSubmitError(`Please switch your wallet to ${FLOW_EVM_TESTNET_NAME} (chain ${FLOW_EVM_TESTNET_CHAIN_ID}).`)
        return
      }

      try {
        await switchChainAsync({ chainId: FLOW_EVM_TESTNET_CHAIN_ID })
        setSubmitError(`Network switched to ${FLOW_EVM_TESTNET_NAME}. Click \"Create Duel On-Chain\" again to continue.`)
      } catch (switchError: any) {
        setSubmitError(
          switchError?.shortMessage ||
          switchError?.message ||
          `Please switch your wallet to ${FLOW_EVM_TESTNET_NAME} (chain ${FLOW_EVM_TESTNET_CHAIN_ID}).`
        )
      }
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)
    try {
      let submitAllocations = [...allocs]

      if (!tierSplitValid) {
        const rebalanced = rebalanceToTierSplit(submitAllocations)
        if (!rebalanced) {
          throw new Error("Portfolio must include at least one Tier 1 and one Tier 2 asset.")
        }

        submitAllocations = rebalanced
        const rebalancedMap = new Map(rebalanced.map((a) => [a.symbol, a.basisPoints]))
        setNodes((prev) =>
          prev.map((node) => ({
            ...node,
            basisPoints: rebalancedMap.get(node.symbol) ?? node.basisPoints,
          }))
        )
      }

      const submitSymbols = submitAllocations.map((n) => n.symbol)
      const submitWeights = submitAllocations.map((n) => n.basisPoints)
      const submitTierTotals = getTierWeightTotals(submitSymbols, submitWeights)
      if (submitTierTotals.tier1 !== 5000 || submitTierTotals.tier2 !== 5000) {
        throw new Error("Portfolio must be exactly 50/50 across Tier 1 and Tier 2 before submission.")
      }

      const entryWei = parseEther(entryAmount.toString())

      if (walletBalance && walletBalance.value < entryWei) {
        throw new Error(`Insufficient wallet balance. You need at least ${entryAmount} FLOW to create this duel.`)
      }

      const factoryAddress =
        (process.env.NEXT_PUBLIC_FLOW_EVM_DUEL_FACTORY ?? process.env.NEXT_PUBLIC_FLOW_EVM_FACTORY) as
          | `0x${string}`
          | undefined

      if (!factoryAddress || !/^0x[a-fA-F0-9]{40}$/.test(factoryAddress)) {
        throw new Error("Factory address not configured correctly (expected a 0x-prefixed EVM address).")
      }

      const isSelectorMismatch = (message: string) =>
        /gas limit too high|no data present|missing revert data|function selector|not recognized/i.test(message)

      // 1️⃣ Create the duel on-chain
      let receipt1: any
      let requiresPortfolioSubmit = false
      try {
        // ShieldVaultFactory signature (active Flow EVM test deployment).
        const hash1 = await writeContractAsync({
          chainId: FLOW_EVM_TESTNET_CHAIN_ID,
          address: factoryAddress,
          abi: FACTORY_ABI,
          functionName: "createDuel",
          args: [entryWei, BigInt(duration), submitSymbols, submitWeights] as any,
          value: entryWei,
        })

        receipt1 = await publicClient.waitForTransactionReceipt({ hash: hash1, confirmations: 1 })
        if (receipt1.status !== "success") throw new Error("Duel creation transaction reverted")
      } catch (createErr: any) {
        const createMessage = createErr?.shortMessage || createErr?.message || ""
        if (!isSelectorMismatch(createMessage)) {
          throw createErr
        }

        // Fallback for DuelFactory/DuelFactoryOnChain signature.
        const { assets, priceIds, tiers, syms } = buildContractAssetArrays(submitSymbols)
        const assetAddresses = assets as `0x${string}`[]
        const assetPriceIds = priceIds as `0x${string}`[]

        const fallbackHash = await writeContractAsync({
          chainId: FLOW_EVM_TESTNET_CHAIN_ID,
          address: factoryAddress,
          abi: FACTORY_ABI,
          functionName: "createDuel",
          args: [entryWei, BigInt(duration), assetAddresses, assetPriceIds, tiers, syms] as any,
          value: entryWei,
        })

        receipt1 = await publicClient.waitForTransactionReceipt({ hash: fallbackHash, confirmations: 1 })
        if (receipt1.status !== "success") throw new Error("Duel creation transaction reverted")
        requiresPortfolioSubmit = true
      }

      // Parse logs to find DuelCreated event
      let newDuelAddress = ""
      for (const log of receipt1.logs) {
        try {
          const decoded = decodeEventLog({
            abi: FACTORY_ABI,
            data: log.data,
            topics: log.topics,
            strict: false,
          })

          if (decoded.eventName === "DuelCreated") {
            newDuelAddress = (decoded.args as any).duelContract
            break
          }
        } catch (e) {
          // Ignore error parsing unrelated logs
        }
      }

      if (!newDuelAddress) throw new Error("Failed to parse duel address from transaction logs")
      setCreatedDuelAddress(newDuelAddress)

      // 2️⃣ Submit creator's portfolio
      if (requiresPortfolioSubmit) {
        const { assets, priceIds } = buildContractAssetArrays(submitSymbols)
        const assetAddresses = assets as `0x${string}`[]
        const assetPriceIds = priceIds as `0x${string}`[]

        try {
          const hash2 = await writeContractAsync({
            chainId: FLOW_EVM_TESTNET_CHAIN_ID,
            address: newDuelAddress as `0x${string}`,
            abi: DUEL_ABI,
            functionName: "submitPortfolio",
            args: [assetAddresses, assetPriceIds, submitWeights],
          })

          const receipt2 = await publicClient.waitForTransactionReceipt({ hash: hash2, confirmations: 1 })
          if (receipt2.status !== "success") throw new Error("Portfolio submission transaction reverted")
        } catch (submitErr: any) {
          const submitMessage = submitErr?.shortMessage || submitErr?.message || ""
          if (!isSelectorMismatch(submitMessage)) {
            throw submitErr
          }
          // ShieldVaultDuel stores creator portfolio at creation and does not expose submitPortfolio.
        }
      }

      setIsSubmitting(false)
      setSubmitted(true)
      setTimeout(() => router.push("/my-duels?tab=pending"), 1800)
    } catch (err: any) {
      console.error(err)
      const message = err?.shortMessage || err?.message || "Transaction failed. Please try again."

      if (/flow-mainnet/i.test(message) && /invalid for chain/i.test(message)) {
        setSubmitError(
          `Wrong network detected. Switch your wallet to ${FLOW_EVM_TESTNET_NAME} (chain ${FLOW_EVM_TESTNET_CHAIN_ID}) and retry.`
        )
      } else {
        setSubmitError(message)
      }

      setIsSubmitting(false)
    }
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
            <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Wallet className="h-4 w-4 text-primary" />
                <div>
                  <p className="font-mono text-xs text-muted-foreground">Connected Wallet</p>
                  <p className="font-mono text-sm text-foreground font-semibold">
                    {isConnected && address ? truncateAddress(address) : "Not connected"}
                  </p>
                  <p className={`font-mono text-[11px] ${isWrongNetwork ? "text-amber-400" : "text-muted-foreground"}`}>
                    {isConnected
                      ? isWrongNetwork
                        ? `Wrong network (chain ${chainId ?? "?"}). Switch to ${FLOW_EVM_TESTNET_NAME}.`
                        : `${FLOW_EVM_TESTNET_NAME} (chain ${FLOW_EVM_TESTNET_CHAIN_ID})`
                      : `${FLOW_EVM_TESTNET_NAME} required`}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-xs text-muted-foreground">Balance</p>
                <p className="font-mono text-sm text-primary font-semibold">
                  {isConnected
                    ? isBalanceLoading
                      ? "Loading..."
                      : `${Number(walletBalance?.formatted ?? "0").toFixed(4)} ${walletBalance?.symbol ?? "FLOW"}`
                    : "--"}
                </p>
              </div>
            </div>

            {isWrongNetwork && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 p-4">
                <p className="font-mono text-xs text-amber-300">
                  Your wallet is on chain {chainId}. This app is deployed on {FLOW_EVM_TESTNET_NAME} (chain {FLOW_EVM_TESTNET_CHAIN_ID}).
                </p>
              </div>
            )}

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
              <label className="font-mono text-sm font-semibold text-foreground mb-3 block">Entry Amount (FLOW)</label>
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
                  {nodes.length >= 2 && (!allocValid || !tierSplitValid) && (
                    <button onClick={handleNormalize}
                      className="flex items-center gap-1 font-mono text-xs text-primary border border-primary/30 rounded-full px-2.5 py-1 hover:bg-primary/10 transition-colors">
                      <Shuffle className="h-3 w-3" /> Balance 50/50
                    </button>
                  )}
                  <span className={`font-mono text-xs font-bold tabular-nums ${
                    nodes.length < 2 ? "text-muted-foreground/40" :
                    allocValid ? "text-primary" : "text-red-400"
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
              <div className="mt-2 flex items-center justify-between font-mono text-[10px]">
                <span className="text-muted-foreground">Tier 1: {(tier1Weight / 100).toFixed(1)}%</span>
                <span className="text-muted-foreground">Tier 2: {(tier2Weight / 100).toFixed(1)}%</span>
                <span className={tierSplitValid ? "text-primary" : "text-amber-400"}>
                  {tierSplitValid ? "50/50 split ready" : "Target is 50/50"}
                </span>
              </div>
              {!hasTier1Asset || !hasTier2Asset ? (
                <p className="mt-2 font-mono text-[10px] text-amber-400">
                  Add at least one Tier 1 asset and one Tier 2 asset to satisfy on-chain rules.
                </p>
              ) : null}
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
                {createdDuelAddress && (
                  <p className="font-mono text-xs text-primary/80">{truncateAddress(createdDuelAddress)}</p>
                )}
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
                  <h2 className="font-mono font-semibold text-foreground">Duel Summary</h2>
                  {[
                    ["Duration",    DURATION_OPTIONS.find(d => d.seconds === duration)?.label ?? ""],
                    ["Entry Amount", formatEth(entryAmount) + " per player"],
                    ["Prize Pool",   formatEth(entryAmount * 2) + " total"],
                    ["Tier Split", `${(tier1Weight / 100).toFixed(1)}% Tier 1 / ${(tier2Weight / 100).toFixed(1)}% Tier 2`],
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

                {!tierSplitValid && hasTier1Asset && hasTier2Asset && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 p-4">
                    <p className="font-mono text-xs text-amber-300">
                      On-chain settlement requires an exact 50/50 split between Tier 1 and Tier 2. We will auto-balance your weights at submit.
                    </p>
                  </div>
                )}

                {/* Wallet not connected warning */}
                {!isConnected && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 p-4 flex items-center gap-3">
                    <Wallet className="h-4 w-4 text-amber-400 shrink-0" />
                    <p className="font-mono text-xs text-amber-300">
                      Connect your wallet to create a duel on-chain.
                    </p>
                  </div>
                )}

                {isWrongNetwork && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 p-4 flex items-center gap-3">
                    <Wallet className="h-4 w-4 text-amber-400 shrink-0" />
                    <p className="font-mono text-xs text-amber-300">
                      Switch to {FLOW_EVM_TESTNET_NAME} (chain {FLOW_EVM_TESTNET_CHAIN_ID}) before creating this duel.
                    </p>
                  </div>
                )}

                {/* Error display */}
                {submitError && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/8 p-4">
                    <p className="font-mono text-xs text-red-400">{submitError}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => setStep(2)}
                    className="flex items-center gap-2 rounded-full border border-border text-muted-foreground font-mono text-sm px-6 py-3 hover:text-foreground hover:border-muted-foreground transition-all">
                    <ArrowLeft className="h-4 w-4" /> Back
                  </button>
                  <button onClick={handleSubmit} disabled={isSubmitting || !isConnected || isSwitchingChain}
                    className="flex-1 rounded-full bg-primary text-primary-foreground font-mono font-semibold py-3 hover:shadow-[0_0_20px_hsl(var(--primary)/0.4)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    {isSwitchingChain
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Switching Network…</>
                      : isSubmitting
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating On-Chain…</>
                      : <><Lock className="h-4 w-4" /> Create Duel On-Chain</>}
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

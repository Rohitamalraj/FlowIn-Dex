"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi"
import { parseEther } from "viem"
import { Search, Lock, Loader2, CheckCircle2, Wallet, Plus, Minus, X, Shuffle, Zap, ArrowLeft, ArrowRight } from "lucide-react"
import AppShell from "@/components/duel/app-shell"
import Hero from "@/components/duel/hero"
import DuelCard from "@/components/duel/duel-card"
import DuelEmptyState from "@/components/duel/duel-empty-state"
import { apiGetAllDuels } from "@/lib/api-client"
import { DuelStatus, SUPPORTED_ASSETS, type Duel, type WeightAllocation } from "@/lib/duel-types"
import {
  computeTotalWeight,
  formatDuration,
  formatEth,
  formatTimeAgo,
  isWeightValid,
  normalizeWeights,
  truncateAddress,
} from "@/lib/duel-utils"
import { ASSET_TIERS, buildContractAssetArrays, getTierWeightTotals } from "@/lib/pyth-config"
import { DUEL_ABI } from "@/lib/contracts"

type DurationFilter = "all" | "short" | "medium" | "long"

const FLOW_EVM_TESTNET_CHAIN_ID = Number(process.env.NEXT_PUBLIC_FLOW_EVM_CHAIN_ID ?? "545")
const FLOW_EVM_TESTNET_NAME = "Flow EVM Testnet"
const MIN_INDEX_ASSETS = 2
const MAX_INDEX_ASSETS = 5

const ASSET_COLORS: Record<string, string> = {
  BTC: "#F7931A",
  ETH: "#627EEA",
  SOL: "#9945FF",
  BNB: "#F0B90B",
  STRK: "#8A63D2",
  ARB: "#28A0F0",
  OP: "#FF0420",
  MATIC: "#8247E5",
  LINK: "#2A5ADA",
  AVAX: "#E84142",
  USDC: "#2775CA",
  USDT: "#26A17B",
  DAI: "#F5AC37",
}

const P_W = 190
const P_H = 88
const C_W = 236
const C_H = 126
const CANVAS_H = 560
const PORTFOLIO_CX = 180
const COIN_X = 470

interface FlowNode {
  symbol: string
  basisPoints: number
  x: number
  y: number
}

function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = (x2 - x1) * 0.55
  return `M ${x1} ${y1} C ${x1 + cx} ${y1}, ${x2 - cx} ${y2}, ${x2} ${y2}`
}

function distributeY(count: number, idx: number): number {
  const spacing = Math.min(148, (CANVAS_H - 60) / count)
  const totalH = spacing * count - (spacing - C_H)
  const startY = Math.max(20, (CANVAS_H - totalH) / 2)
  return startY + idx * spacing
}

function createNodesFromSymbols(symbols: string[]): FlowNode[] {
  if (symbols.length === 0) return []

  const equal = Math.floor(10000 / symbols.length)
  return symbols.map((symbol, idx) => ({
    symbol,
    basisPoints: idx === symbols.length - 1 ? 10000 - equal * (symbols.length - 1) : equal,
    x: COIN_X,
    y: distributeY(symbols.length, idx),
  }))
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
      return group.map((item, index) => ({
        ...item,
        basisPoints: index === group.length - 1 ? target - even * (group.length - 1) : even,
      }))
    }

    let remaining = target
    return group.map((item, index) => {
      const nextWeight = index === group.length - 1 ? remaining : Math.floor((item.basisPoints * target) / current)
      remaining -= nextWeight
      return { ...item, basisPoints: nextWeight }
    })
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

function AllocBar({ allocs }: { allocs: WeightAllocation[] }) {
  return (
    <div className="flex h-2 rounded-full overflow-hidden gap-px">
      {allocs.map((a) => (
        <div
          key={a.symbol}
          className="transition-all duration-300"
          style={{
            flexBasis: `${a.basisPoints / 100}%`,
            backgroundColor: ASSET_COLORS[a.symbol] ?? "#555",
            minWidth: a.basisPoints > 0 ? 2 : 0,
          }}
        />
      ))}
      {allocs.length === 0 && <div className="flex-1 bg-muted" />}
    </div>
  )
}

export default function JoinDuelPage() {
  const router = useRouter()
  const { address, chainId, isConnected } = useAccount()
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient({ chainId: FLOW_EVM_TESTNET_CHAIN_ID })

  const isWrongNetwork = isConnected && chainId !== FLOW_EVM_TESTNET_CHAIN_ID

  const [search, setSearch] = useState("")
  const [durationFilter, setDurationFilter] = useState<DurationFilter>("all")
  const [maxEntry, setMaxEntry] = useState<number>(10)
  const [selectedDuel, setSelectedDuel] = useState<Duel | null>(null)
  const [nodes, setNodes] = useState<FlowNode[]>([])
  const [isJoining, setIsJoining] = useState(false)
  const [joined, setJoined] = useState(false)
  const [joinStep, setJoinStep] = useState(1)
  const [joinError, setJoinError] = useState<string | null>(null)

  const dragRef = useRef<{ symbol: string; ox: number; oy: number; nx: number; ny: number } | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ["allDuels"],
    queryFn: () => apiGetAllDuels(0, 50),
    refetchInterval: 15000,
  })

  const allocs: WeightAllocation[] = nodes.map((n) => ({ symbol: n.symbol, basisPoints: n.basisPoints }))
  const symbols = nodes.map((n) => n.symbol)
  const total = computeTotalWeight(allocs)
  const { tier1: tier1Weight, tier2: tier2Weight } = getTierWeightTotals(
    symbols,
    allocs.map((n) => n.basisPoints)
  )
  const hasTier1Asset = symbols.some((symbol) => (ASSET_TIERS[symbol] ?? 1) === 0)
  const hasTier2Asset = symbols.some((symbol) => (ASSET_TIERS[symbol] ?? 1) === 1)
  const tierSplitValid = tier1Weight === 5000 && tier2Weight === 5000
  const allocValid = isWeightValid(allocs) && nodes.length >= MIN_INDEX_ASSETS && hasTier1Asset && hasTier2Asset
  const selected = symbols

  const portfolioCY = CANVAS_H / 2
  const portfolioLeft = PORTFOLIO_CX - P_W / 2
  const portfolioTop = portfolioCY - P_H / 2
  const portRX = portfolioLeft + P_W
  const portRY = portfolioCY

  const openDuels: Duel[] = (data?.duels || [])
    .filter((d) => d.stateCode === 0)
    .map((d) => {
      const createdAtSeconds =
        typeof d.createdAt === "number"
          ? d.createdAt
          : typeof d.startTime === "number"
            ? d.startTime
            : Math.floor(Date.now() / 1000)

      return {
        id: d.duelId,
        _fullAddress: d.duelAddress,
        duelAddress: d.duelAddress,
        status: DuelStatus.OPEN,
        creator: { address: d.creator || "0x", hasSubmitted: true },
        assetUniverse: d.assetUniverse?.length ? d.assetUniverse : ["BTC", "ETH", "SOL"],
        entryAmountEth: parseFloat(d.entryAmountFormatted),
        durationSeconds: d.duration,
        createdAt: new Date(createdAtSeconds * 1000),
      } as any
    })

  useEffect(() => {
    if (!data?.duels) return
    console.log("[JoinDuel] Loaded open duel feed", {
      duelCount: data.duels.length,
    })
  }, [data])

  useEffect(() => {
    if (!error) return
    console.error("[JoinDuel] Failed to fetch duels", error)
  }, [error])

  useEffect(() => {
    if (!joined || !selectedDuel) return

    const targetPath = `/duel/${encodeURIComponent(selectedDuel.id)}`
    console.log("[JoinDuel] Redirecting to duel detail after join", {
      duelId: selectedDuel.id,
      targetPath,
    })

    const timeoutId = window.setTimeout(() => {
      router.push(targetPath)
    }, 900)

    return () => window.clearTimeout(timeoutId)
  }, [joined, selectedDuel, router])

  const filteredDuels = openDuels.filter((d) => {
    const query = search.trim().toLowerCase()
    if (query) {
      const haystack = `${d.id} ${d.creator.address} ${d.assetUniverse.join(" ")}`.toLowerCase()
      if (!haystack.includes(query)) return false
    }

    if (maxEntry < 10 && d.entryAmountEth > maxEntry) return false
    if (durationFilter === "short" && d.durationSeconds > 21600) return false
    if (durationFilter === "medium" && (d.durationSeconds <= 21600 || d.durationSeconds > 259200)) return false
    if (durationFilter === "long" && d.durationSeconds <= 259200) return false
    return true
  })

  const handleSelectDuel = (id: string) => {
    const duel = openDuels.find((d) => d.id === id)
    if (!duel) return

    const supportedSymbols = new Set(SUPPORTED_ASSETS.map((a) => a.symbol))
    const suggestedSymbols = duel.assetUniverse.filter((symbol) => supportedSymbols.has(symbol)).slice(0, MAX_INDEX_ASSETS)
    const initialSymbols =
      suggestedSymbols.length >= MIN_INDEX_ASSETS
        ? suggestedSymbols
        : SUPPORTED_ASSETS.slice(0, 3).map((a) => a.symbol)

    setSelectedDuel(duel)
    setNodes(createNodesFromSymbols(initialSymbols))
    setJoined(false)
    setJoinStep(1)
    setJoinError(null)

    console.log("[JoinDuel] Selected duel", {
      duelId: duel.id,
      duelAddress: (duel as any)._fullAddress,
      addressA: duel.creator.address,
      postedTokenUniverse: duel.assetUniverse,
      initialAddressBSymbols: initialSymbols,
    })

    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const addNode = useCallback(
    (symbol: string) => {
      if (nodes.length >= MAX_INDEX_ASSETS || selected.includes(symbol)) return

      setJoinError(null)

      const targetCount = nodes.length + 1
      const equal = Math.floor(10000 / targetCount)
      const newNodes = [
        ...nodes.map((n, i) => ({ ...n, basisPoints: equal, y: distributeY(targetCount, i) })),
        {
          symbol,
          basisPoints: 10000 - equal * nodes.length,
          x: COIN_X,
          y: distributeY(targetCount, nodes.length),
        },
      ]
      setNodes(newNodes)

      console.log("[JoinDuel] Added symbol to Address B index", {
        symbol,
        symbols: newNodes.map((n) => n.symbol),
      })
    },
    [nodes, selected]
  )

  const removeNode = useCallback(
    (symbol: string) => {
      if (nodes.length <= MIN_INDEX_ASSETS) {
        setJoinError(`Keep at least ${MIN_INDEX_ASSETS} assets in your index.`)
        return
      }

      const remaining = nodes.filter((n) => n.symbol !== symbol)
      if (remaining.length === 0) {
        setNodes([])
        return
      }

      const norm = normalizeWeights(remaining.map((n) => ({ symbol: n.symbol, basisPoints: n.basisPoints })))
      const normalizedNodes = remaining.map((n, i) => ({
        ...n,
        basisPoints: norm[i].basisPoints,
        y: distributeY(remaining.length, i),
      }))

      setNodes(normalizedNodes)
      setJoinError(null)

      console.log("[JoinDuel] Removed symbol from Address B index", {
        symbol,
        symbols: normalizedNodes.map((n) => n.symbol),
      })
    },
    [nodes]
  )

  const adjustPct = (symbol: string, delta: number) => {
    setNodes((prev) =>
      prev.map((n) =>
        n.symbol === symbol
          ? { ...n, basisPoints: Math.max(100, Math.min(9800, n.basisPoints + delta)) }
          : n
      )
    )
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

    console.log("[JoinDuel] Normalized Address B allocation", {
      mode: tierBalanced ? "tier-balance-50-50" : "sum-to-100",
      allocations: nextAllocations,
    })
  }

  const onNodePointerDown = (e: React.PointerEvent, symbol: string) => {
    if ((e.target as HTMLElement).closest("button")) return
    e.preventDefault()

    const node = nodes.find((n) => n.symbol === symbol)
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

    setNodes((prev) => prev.map((n) => (n.symbol === drag.symbol ? { ...n, x: newX, y: newY } : n)))
  }

  const stopDrag = () => {
    dragRef.current = null
  }

  const handleJoin = async () => {
    if (!isConnected || !address || !selectedDuel || !publicClient) {
      setJoinError("Please connect your wallet first.")
      return
    }

    if (!allocValid) {
      setJoinError(
        "Build a valid index first: at least 2 assets, 100% total, and exactly 50/50 split between Tier 1 and Tier 2."
      )
      return
    }

    if (chainId !== FLOW_EVM_TESTNET_CHAIN_ID) {
      if (!switchChainAsync) {
        setJoinError(`Please switch your wallet to ${FLOW_EVM_TESTNET_NAME} (chain ${FLOW_EVM_TESTNET_CHAIN_ID}).`)
        return
      }

      try {
        await switchChainAsync({ chainId: FLOW_EVM_TESTNET_CHAIN_ID })
        setJoinError(`Network switched to ${FLOW_EVM_TESTNET_NAME}. Click \"Join & Start Duel\" again to continue.`)
      } catch (switchError: any) {
        setJoinError(
          switchError?.shortMessage ||
            switchError?.message ||
            `Please switch your wallet to ${FLOW_EVM_TESTNET_NAME} (chain ${FLOW_EVM_TESTNET_CHAIN_ID}).`
        )
      }
      return
    }

    setIsJoining(true)
    setJoinError(null)

    let debugGroupOpened = false

    try {
      let submitAllocations = [...allocs]

      if (!tierSplitValid) {
        const rebalanced = rebalanceToTierSplit(submitAllocations)
        if (!rebalanced) {
          throw new Error("Address B index must include at least one Tier 1 and one Tier 2 asset.")
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

      const submitSymbols = submitAllocations.map((a) => a.symbol)
      const submitWeights = submitAllocations.map((a) => a.basisPoints)
      const submitTierTotals = getTierWeightTotals(submitSymbols, submitWeights)
      if (submitTierTotals.tier1 !== 5000 || submitTierTotals.tier2 !== 5000) {
        throw new Error("Address B index must be exactly 50/50 across Tier 1 and Tier 2 before joining.")
      }

      const entryWei = parseEther(selectedDuel.entryAmountEth.toString())
      const duelAddress = (selectedDuel as any)._fullAddress as `0x${string}`

      console.groupCollapsed(`[JoinDuel] Joining duel ${selectedDuel.id}`)
      debugGroupOpened = true
      console.log("[JoinDuel] Join request payload", {
        addressB: address,
        duelAddress,
        entryWei: entryWei.toString(),
        submitSymbols,
        submitWeights,
      })
      console.table(submitAllocations)

      const { assets, priceIds } = buildContractAssetArrays(submitSymbols)
      const isSelectorMismatch = (message: string) =>
        /gas limit too high|no data present|missing revert data|function selector|not recognized/i.test(message)
      let requiresSubmitPortfolio = false

      try {
        console.log("[JoinDuel] Attempting joinDuel(symbols, weights)")
        const hash1 = await writeContractAsync({
          chainId: FLOW_EVM_TESTNET_CHAIN_ID,
          address: duelAddress,
          abi: DUEL_ABI,
          functionName: "joinDuel",
          args: [submitSymbols, submitWeights] as any,
          value: entryWei,
        })

        console.log("[JoinDuel] joinDuel(symbols,weights) tx sent", { hash: hash1 })

        const receipt1 = await publicClient.waitForTransactionReceipt({ hash: hash1, confirmations: 1 })
        console.log("[JoinDuel] joinDuel(symbols,weights) receipt", {
          status: receipt1.status,
          blockNumber: receipt1.blockNumber?.toString(),
        })
        if (receipt1.status !== "success") throw new Error("Join transaction reverted")
      } catch (joinErr: any) {
        const joinMessage = joinErr?.shortMessage || joinErr?.message || ""
        console.warn("[JoinDuel] joinDuel(symbols,weights) primary signature failed", {
          joinMessage,
          joinErr,
        })

        if (!isSelectorMismatch(joinMessage)) {
          throw joinErr
        }

        console.log("[JoinDuel] Retrying with legacy joinDuel()")
        const fallbackHash = await writeContractAsync({
          chainId: FLOW_EVM_TESTNET_CHAIN_ID,
          address: duelAddress,
          abi: DUEL_ABI,
          functionName: "joinDuel",
          value: entryWei,
        })

        console.log("[JoinDuel] joinDuel() tx sent", { hash: fallbackHash })

        const fallbackReceipt = await publicClient.waitForTransactionReceipt({ hash: fallbackHash, confirmations: 1 })
        console.log("[JoinDuel] joinDuel() receipt", {
          status: fallbackReceipt.status,
          blockNumber: fallbackReceipt.blockNumber?.toString(),
        })
        if (fallbackReceipt.status !== "success") throw new Error("Join transaction reverted")
        requiresSubmitPortfolio = true
      }

      if (requiresSubmitPortfolio) {
        console.log("[JoinDuel] Attempting submitPortfolio()")
        const hash2 = await writeContractAsync({
          chainId: FLOW_EVM_TESTNET_CHAIN_ID,
          address: duelAddress,
          abi: DUEL_ABI,
          functionName: "submitPortfolio",
          args: [assets, priceIds, submitWeights],
        })

        console.log("[JoinDuel] submitPortfolio tx sent", { hash: hash2 })

        const receipt2 = await publicClient.waitForTransactionReceipt({ hash: hash2, confirmations: 1 })
        console.log("[JoinDuel] submitPortfolio receipt", {
          status: receipt2.status,
          blockNumber: receipt2.blockNumber?.toString(),
        })
        if (receipt2.status !== "success") throw new Error("Portfolio submission reverted")
      }

      console.log("[JoinDuel] Join flow completed successfully", {
        duelId: selectedDuel.id,
        requiresSubmitPortfolio,
      })

      if (debugGroupOpened) {
        console.groupEnd()
        debugGroupOpened = false
      }

      setIsJoining(false)
      setJoined(true)
      console.log("[JoinDuel] Join success; auto-redirect scheduled", {
        duelId: selectedDuel.id,
      })
    } catch (err: any) {
      console.error(err)
      if (debugGroupOpened) {
        console.groupEnd()
      }

      setIsJoining(false)
      const message = err?.shortMessage || err?.message || "Failed to join duel. Check your wallet."

      if (/flow-mainnet/i.test(message) && /invalid for chain/i.test(message)) {
        setJoinError(
          `Wrong network detected. Switch your wallet to ${FLOW_EVM_TESTNET_NAME} (chain ${FLOW_EVM_TESTNET_CHAIN_ID}) and retry.`
        )
      } else {
        setJoinError(message)
      }
    }
  }

  const DURATION_FILTERS: { label: string; value: DurationFilter }[] = [
    { label: "All", value: "all" },
    { label: "< 6h", value: "short" },
    { label: "6h-3d", value: "medium" },
    { label: "3d+", value: "long" },
  ]

  return (
    <AppShell>
      <Hero
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Browse Duels" }]}
        title="Browse Open Duels"
        subtitle="View posted metadata, stake, timing, and tokens. Build your own index with the same flow UI before joining."
        badge="Open Duels"
      />

      {selectedDuel && (
        <div className="border-b border-border bg-muted/10">
          <div className="max-w-[1100px] mx-auto px-6 py-8">
            {joined ? (
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-10 flex flex-col items-center gap-4 text-center">
                <CheckCircle2 className="h-12 w-12 text-primary" />
                <h2 className="font-mono font-bold text-foreground text-lg">You&apos;ve Joined!</h2>
                <p className="font-mono text-sm text-muted-foreground">
                  Your portfolio has been posted and the duel is now active. Redirecting to the live duel...
                </p>
                <button onClick={() => setSelectedDuel(null)} className="font-mono text-xs text-primary hover:underline mt-2">
                  &larr; Back to browsing
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-mono font-semibold text-foreground">Joining Duel #{selectedDuel.id}</h2>
                  <button
                    onClick={() => setSelectedDuel(null)}
                    className="font-mono text-xs text-muted-foreground hover:text-foreground"
                  >
                    X Cancel
                  </button>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  {[1, 2, 3].map((s) => (
                    <div key={s} className="flex items-center gap-2">
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center font-mono text-xs font-bold border transition-all duration-300 ${
                          joinStep === s
                            ? "bg-primary text-primary-foreground border-primary"
                            : joinStep > s
                              ? "bg-primary/20 text-primary border-primary/30"
                              : "bg-muted/30 text-muted-foreground border-border"
                        }`}
                      >
                        {joinStep > s ? <CheckCircle2 className="h-4 w-4" /> : s}
                      </div>
                      <span className={`font-mono text-xs hidden sm:block ${joinStep >= s ? "text-foreground" : "text-muted-foreground"}`}>
                        {s === 1 ? "Parameters" : s === 2 ? "Portfolio Builder" : "Review"}
                      </span>
                      {s < 3 && <div className={`h-px w-10 md:w-16 ${joinStep > s ? "bg-primary/40" : "bg-border"}`} />}
                    </div>
                  ))}
                </div>

                {joinStep === 1 && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        ["Duration", formatDuration(selectedDuel.durationSeconds)],
                        ["Entry", formatEth(selectedDuel.entryAmountEth) + " each"],
                        ["Posted Tokens", selectedDuel.assetUniverse.join(", ")],
                        ["Address A", truncateAddress(selectedDuel.creator.address)],
                        ["Created", formatTimeAgo(selectedDuel.createdAt)],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-xl border border-border bg-card px-4 py-3">
                          <p className="font-mono text-[10px] text-muted-foreground mb-1">{label}</p>
                          <p className="font-mono text-xs font-semibold text-foreground">{value}</p>
                        </div>
                      ))}
                    </div>

                    {isWrongNetwork && (
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 p-4 flex items-start gap-3">
                        <Wallet className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                        <p className="font-mono text-xs text-amber-300">
                          Wallet is on chain {chainId}. Switch to {FLOW_EVM_TESTNET_NAME} (chain {FLOW_EVM_TESTNET_CHAIN_ID}) before joining.
                        </p>
                      </div>
                    )}

                    {joinError && (
                      <div className="rounded-xl border border-red-500/30 bg-red-500/8 p-4">
                        <p className="font-mono text-xs text-red-400">{joinError}</p>
                      </div>
                    )}

                    <button
                      onClick={() => setJoinStep(2)}
                      className="w-full rounded-full bg-primary text-primary-foreground font-mono font-semibold py-3 hover:shadow-[0_0_20px_hsl(var(--primary)/0.4)] hover:scale-[1.01] transition-all duration-200 flex items-center justify-center gap-2"
                    >
                      Build Portfolio Flow <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {joinStep === 2 && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4 text-primary" />
                        <span className="font-mono text-sm font-semibold text-foreground">Build Address B Index</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 px-1">
                        <span className="font-mono text-[11px] text-muted-foreground mr-1 shrink-0">Add coin:</span>
                        {SUPPORTED_ASSETS.map((asset) => {
                          const added = selected.includes(asset.symbol)
                          const full = nodes.length >= MAX_INDEX_ASSETS && !added
                          return (
                            <button
                              key={asset.symbol}
                              onClick={() => addNode(asset.symbol)}
                              disabled={added || full}
                              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-xs transition-all duration-200 ${
                                added
                                  ? "border-primary/40 bg-primary/10 text-primary cursor-not-allowed"
                                  : full
                                    ? "border-border/40 text-muted-foreground/40 cursor-not-allowed"
                                    : "border-border text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-foreground cursor-pointer"
                              }`}
                            >
                              <span style={{ color: ASSET_COLORS[asset.symbol] }}>{asset.icon}</span>
                              {asset.symbol}
                              {added ? <CheckCircle2 className="h-3 w-3 text-primary" /> : <Plus className="h-3 w-3" />}
                            </button>
                          )
                        })}
                      </div>

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
                        <svg className="absolute inset-0 pointer-events-none" style={{ width: "100%", height: "100%", overflow: "visible" }}>
                          <defs>
                            <filter id="glow">
                              <feGaussianBlur stdDeviation="2" result="blur" />
                              <feMerge>
                                <feMergeNode in="blur" />
                                <feMergeNode in="SourceGraphic" />
                              </feMerge>
                            </filter>
                          </defs>

                          {nodes.map((node) => {
                            const toX = node.x
                            const toY = node.y + C_H / 2
                            return (
                              <g key={node.symbol}>
                                <path
                                  d={bezier(portRX, portRY, toX, toY)}
                                  fill="none"
                                  stroke={ASSET_COLORS[node.symbol] ?? "#888"}
                                  strokeWidth="4"
                                  strokeOpacity="0.07"
                                  filter="url(#glow)"
                                />
                                <path
                                  d={bezier(portRX, portRY, toX, toY)}
                                  fill="none"
                                  stroke="#2c2c40"
                                  strokeWidth="2"
                                  strokeDasharray="6 4"
                                >
                                  <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="1s" repeatCount="indefinite" />
                                </path>
                                <path
                                  d={bezier(portRX, portRY, toX, toY)}
                                  fill="none"
                                  stroke={ASSET_COLORS[node.symbol] ?? "#888"}
                                  strokeWidth="1.5"
                                  strokeOpacity="0.35"
                                  strokeDasharray="4 8"
                                />
                                <circle cx={portRX} cy={portRY} r="4" fill="#1a1a2e" stroke="#3a3a5e" strokeWidth="1.5" />
                                <circle
                                  cx={toX}
                                  cy={toY}
                                  r="4"
                                  fill="#1a1a2e"
                                  stroke={ASSET_COLORS[node.symbol] ?? "#888"}
                                  strokeWidth="1.5"
                                  strokeOpacity="0.7"
                                />
                              </g>
                            )
                          })}
                        </svg>

                        <div
                          className="absolute flex items-center gap-3 rounded-2xl border"
                          style={{
                            left: portfolioLeft,
                            top: portfolioTop,
                            width: P_W,
                            height: P_H,
                            borderColor: "rgba(29,237,131,0.35)",
                            background: "linear-gradient(135deg, #0e1a14 0%, #0a0f0e 100%)",
                            boxShadow: "0 0 28px rgba(29,237,131,0.12), inset 0 1px 0 rgba(29,237,131,0.08)",
                            padding: "14px 16px",
                          }}
                        >
                          <div
                            className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                            style={{ background: "rgba(29,237,131,0.12)", border: "1px solid rgba(29,237,131,0.25)" }}
                          >
                            <Zap className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-mono text-xs font-bold text-white leading-tight">Portfolio Index</p>
                            <p className="font-mono text-[10px] leading-tight" style={{ color: "rgba(29,237,131,0.6)" }}>
                              Address B Strategy
                            </p>
                          </div>
                          <div
                            className="absolute -right-[9px] top-1/2 -translate-y-1/2 h-[18px] w-[18px] rounded-full flex items-center justify-center"
                            style={{ background: "#07070f", border: "2px solid rgba(29,237,131,0.5)" }}
                          >
                            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                          </div>
                        </div>

                        {nodes.map((node) => {
                          const asset = SUPPORTED_ASSETS.find((a) => a.symbol === node.symbol)!
                          const pct = node.basisPoints / 100
                          const color = ASSET_COLORS[node.symbol] ?? "#888"

                          return (
                            <div
                              key={node.symbol}
                              onPointerDown={(e) => onNodePointerDown(e, node.symbol)}
                              className="absolute rounded-2xl overflow-hidden"
                              style={{
                                left: node.x,
                                top: node.y,
                                width: C_W,
                                height: C_H,
                                background: "linear-gradient(135deg, #0f0f1c 0%, #0a0a14 100%)",
                                border: `1px solid ${color}45`,
                                boxShadow: `0 4px 32px ${color}18, inset 0 1px 0 ${color}10`,
                                cursor: "grab",
                              }}
                            >
                              <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg, ${color}, ${color}88)` }} />

                              <div
                                className="absolute -left-[9px] top-1/2 -translate-y-1/2 h-[18px] w-[18px] rounded-full flex items-center justify-center"
                                style={{ background: "#07070f", border: `2px solid ${color}70` }}
                              >
                                <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                              </div>

                              <div className="p-4 h-full flex flex-col justify-between">
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
                                    <span className="font-mono font-bold tabular-nums text-xl leading-none" style={{ color }}>
                                      {pct.toFixed(1)}
                                    </span>
                                    <span className="font-mono text-xs leading-none" style={{ color: `${color}80` }}>%</span>
                                    <button
                                      onClick={() => removeNode(node.symbol)}
                                      className="ml-1 h-5 w-5 rounded-md flex items-center justify-center transition-all duration-150 hover:bg-red-400/20"
                                      style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                                    >
                                      <X className="h-2.5 w-2.5 text-white/30 hover:text-red-400" />
                                    </button>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => adjustPct(node.symbol, -500)}
                                    className="h-7 w-7 rounded-lg flex items-center justify-center transition-all duration-150 hover:brightness-125 shrink-0"
                                    style={{ background: `${color}18`, border: `1px solid ${color}40`, color }}
                                  >
                                    <Minus className="h-3 w-3" />
                                  </button>

                                  <div className="relative flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                                    <div
                                      className="absolute inset-y-0 left-0 rounded-full transition-all duration-200"
                                      style={{ width: `${Math.min(pct, 100)}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)` }}
                                    />
                                    <input
                                      type="range"
                                      min={1}
                                      max={100}
                                      step={1}
                                      value={Math.round(pct)}
                                      onChange={(e) => adjustPct(node.symbol, (Number(e.target.value) - Math.round(pct)) * 100)}
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

                        {nodes.length === 0 && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
                            <p className="font-mono text-sm" style={{ color: "rgba(255,255,255,0.2)" }}>
                              Select coins above to build Address B portfolio flow
                            </p>
                            <p className="font-mono text-xs" style={{ color: "rgba(255,255,255,0.1)" }}>
                              Min 2 · Max 5 assets · Drag nodes to rearrange
                            </p>
                          </div>
                        )}

                        <div className="absolute bottom-3 left-3 font-mono text-[10px]" style={{ color: "rgba(255,255,255,0.15)" }}>
                          Drag nodes to rearrange
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border bg-card px-5 py-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-wrap gap-3">
                            {nodes.map((n) => (
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
                            {nodes.length >= MIN_INDEX_ASSETS && (!allocValid || !tierSplitValid) && (
                              <button
                                onClick={handleNormalize}
                                className="flex items-center gap-1 font-mono text-xs text-primary border border-primary/30 rounded-full px-2.5 py-1 hover:bg-primary/10 transition-colors"
                              >
                                <Shuffle className="h-3 w-3" /> Balance 50/50
                              </button>
                            )}
                            <span
                              className={`font-mono text-xs font-bold tabular-nums ${
                                nodes.length < MIN_INDEX_ASSETS ? "text-muted-foreground/40" : allocValid ? "text-primary" : "text-red-400"
                              }`}
                            >
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
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => setJoinStep(1)}
                        className="flex items-center gap-2 rounded-full border border-border text-muted-foreground font-mono text-sm px-6 py-3 hover:text-foreground hover:border-muted-foreground transition-all"
                      >
                        <ArrowLeft className="h-4 w-4" /> Back
                      </button>
                      <button
                        onClick={() => setJoinStep(3)}
                        disabled={!allocValid}
                        className="flex-1 rounded-full bg-primary text-primary-foreground font-mono font-semibold py-3 hover:shadow-[0_0_20px_hsl(var(--primary)/0.4)] hover:scale-[1.01] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Review & Join <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}

                {joinStep === 3 && (
                  <div className="space-y-6">
                    <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
                      <h2 className="font-mono font-semibold text-foreground">Join Summary</h2>
                      {[
                        ["Duration", formatDuration(selectedDuel.durationSeconds)],
                        ["Entry Amount", formatEth(selectedDuel.entryAmountEth) + " per player"],
                        ["Prize Pool", formatEth(selectedDuel.entryAmountEth * 2) + " total"],
                        ["Address A", truncateAddress(selectedDuel.creator.address)],
                        ["Address B", address ? truncateAddress(address) : "Not connected"],
                        ["Tier Split", `${(tier1Weight / 100).toFixed(1)}% Tier 1 / ${(tier2Weight / 100).toFixed(1)}% Tier 2`],
                      ].map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between border-b border-border pb-3">
                          <span className="font-mono text-xs text-muted-foreground">{label}</span>
                          <span className="font-mono text-xs text-foreground font-semibold">{value}</span>
                        </div>
                      ))}

                      <div>
                        <p className="font-mono text-xs text-muted-foreground mb-3">Address B Allocation</p>
                        <AllocBar allocs={allocs} />
                        <div className="flex flex-wrap gap-2 mt-3">
                          {nodes.map((n) => (
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
                      <Lock className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                      <p className="font-mono text-xs text-muted-foreground">
                        Address B builds an independent index with the same constraints as Create Duel. Both strategies are revealed after start.
                      </p>
                    </div>

                    {isWrongNetwork && (
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 p-4 flex items-start gap-3">
                        <Wallet className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                        <p className="font-mono text-xs text-amber-300">
                          Wallet is on chain {chainId}. Switch to {FLOW_EVM_TESTNET_NAME} (chain {FLOW_EVM_TESTNET_CHAIN_ID}) before joining.
                        </p>
                      </div>
                    )}

                    {joinError && (
                      <div className="rounded-xl border border-red-500/30 bg-red-500/8 p-4">
                        <p className="font-mono text-xs text-red-400">{joinError}</p>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={() => setJoinStep(2)}
                        className="flex items-center gap-2 rounded-full border border-border text-muted-foreground font-mono text-sm px-6 py-3 hover:text-foreground hover:border-muted-foreground transition-all"
                      >
                        <ArrowLeft className="h-4 w-4" /> Back
                      </button>

                      <button
                        onClick={handleJoin}
                        disabled={!allocValid || isJoining || isSwitchingChain}
                        className="flex-1 rounded-full bg-primary text-primary-foreground font-mono font-semibold py-3 hover:shadow-[0_0_20px_hsl(var(--primary)/0.4)] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isSwitchingChain ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" /> Switching Network...
                          </>
                        ) : isJoining ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" /> Joining and Starting...
                          </>
                        ) : (
                          <>
                            <Lock className="h-4 w-4" /> Join and Start Duel
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="border-b border-border bg-background px-6 py-4">
        <div className="max-w-[1200px] mx-auto flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by duel ID or asset..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-full border border-border bg-muted/20 pl-9 pr-4 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:bg-muted/30 transition-all"
            />
          </div>

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

      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <p className="font-mono text-sm text-muted-foreground">
            <span className="text-foreground font-semibold">{filteredDuels.length}</span> open duels
            {isLoading ? " (syncing...)" : ""}
          </p>
        </div>

        {!isLoading && filteredDuels.length === 0 ? (
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

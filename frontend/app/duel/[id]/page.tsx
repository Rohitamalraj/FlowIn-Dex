"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Loader2, Lock, Trophy, Users, Wallet, LineChart as LineChartIcon } from "lucide-react"
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, CartesianGrid } from "recharts"
import AppShell from "@/components/duel/app-shell"
import StatusBadge from "@/components/duel/status-badge"
import Timeline from "@/components/duel/timeline"
import { DuelStatus, SUPPORTED_ASSETS, type Duel } from "@/lib/duel-types"
import {
  truncateAddress,
  formatDuration,
  formatEth,
  formatCountdown,
  formatTimeAgo,
  getExplorerUrl,
  getExplorerName,
} from "@/lib/duel-utils"
import {
  apiGetBatchPricesAt,
  apiGetCreatorPortfolio,
  apiGetDuelById,
  apiGetLiveBatchPrices,
  apiGetOpponentPortfolio,
} from "@/lib/api-client"
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi"
import { DUEL_ABI } from "@/lib/contracts"
import { buildContractAssetArrays, PYTH_PRICE_IDS } from "@/lib/pyth-config"

const FLOW_EVM_TESTNET_CHAIN_ID = Number(process.env.NEXT_PUBLIC_FLOW_EVM_CHAIN_ID ?? "545")
const FLOW_EVM_TESTNET_NAME = "Flow EVM Testnet"
const PRICE_SCALE = 100_000_000

type PriceMap = Record<string, { price: number; publishTime: number }>

type ChartPoint = {
  time: string
  creator: number
  opponent: number
}

type PendingPortfolio = {
  symbols: string[]
  weights: number[]
}

type DuelPortfolioData = {
  participant: string
  symbols: string[]
  priceIds?: string[]
  weights: number[]
  submitted: boolean
  return: string
}

const PRICE_ID_TO_SYMBOL = Object.entries(PYTH_PRICE_IDS).reduce<Record<string, string>>((acc, [symbol, id]) => {
  const key = String(id).toLowerCase()
  if (!acc[key] && symbol !== "POL") {
    acc[key] = symbol
  }
  return acc
}, {})

function normalizePortfolio(portfolio: DuelPortfolioData | undefined): DuelPortfolioData | undefined {
  if (!portfolio) return undefined

  let symbols = Array.isArray(portfolio.symbols)
    ? portfolio.symbols
        .map((s) => String(s || "").trim().toUpperCase())
        .filter((s) => s.length > 0)
    : []

  let weights = Array.isArray(portfolio.weights)
    ? portfolio.weights.map((w) => Number(w)).filter((w) => Number.isFinite(w) && w > 0)
    : []

  let priceIds = Array.isArray(portfolio.priceIds)
    ? portfolio.priceIds.map((id) => String(id || "").trim()).filter((id) => id.length > 0)
    : []

  if (symbols.length === 0 && priceIds.length > 0 && weights.length > 0) {
    const paired = priceIds
      .map((id, idx) => ({
        symbol: PRICE_ID_TO_SYMBOL[id.toLowerCase()],
        weight: weights[idx],
        priceId: id,
      }))
      .filter((item) => Boolean(item.symbol) && Number.isFinite(item.weight) && item.weight > 0)

    symbols = paired.map((item) => item.symbol as string)
    weights = paired.map((item) => item.weight)
    priceIds = paired.map((item) => item.priceId)
  }

  const minLength = Math.min(symbols.length, weights.length)

  return {
    participant: String(portfolio.participant || ""),
    symbols: symbols.slice(0, minLength),
    priceIds,
    weights: weights.slice(0, minLength),
    submitted: Boolean(portfolio.submitted),
    return: String(portfolio.return ?? "0"),
  }
}

function mapStateToStatus(state: string): DuelStatus {
  if (state === "Created") return DuelStatus.OPEN
  if (state === "Joined") return DuelStatus.JOINED
  if (state === "SubmittedBoth") return DuelStatus.LOCKED
  if (state === "Active" || state === "Locked") return DuelStatus.LOCKED
  if (state === "Settling") return DuelStatus.SETTLING
  if (state === "Settled") return DuelStatus.SETTLED
  if (state === "Cancelled") return DuelStatus.CANCELLED
  return DuelStatus.OPEN
}

function isSelectorMismatch(message: string): boolean {
  return /gas limit too high|no data present|missing revert data|function selector|not recognized/i.test(message)
}

function toScaledPrice(price: number | undefined, errorMessage: string): bigint {
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
    throw new Error(errorMessage)
  }
  return BigInt(Math.round(price * PRICE_SCALE))
}

function computeIndexValue(
  symbols: string[],
  weights: number[],
  prices: PriceMap,
  baseline: Record<string, number>
): number {
  if (!symbols.length || symbols.length !== weights.length) {
    return 100
  }

  let total = 0
  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i]
    const weight = (weights[i] ?? 0) / 10000
    const current = prices[symbol]?.price
    const start = baseline[symbol]

    if (typeof current !== "number" || typeof start !== "number" || start <= 0) {
      continue
    }

    total += weight * ((current / start) * 100)
  }

  return total > 0 ? total : 100
}

export default function DuelDetailPage() {
  const params = useParams<{ id: string | string[] }>()
  const idParam = Array.isArray(params?.id) ? params.id[0] : params?.id
  const duelKey = idParam ? decodeURIComponent(idParam) : ""

  const [isSettlingAction, setIsSettlingAction] = useState(false)
  const [isPayoutAction, setIsPayoutAction] = useState(false)
  const [isSplitAction, setIsSplitAction] = useState(false)
  const [isSubmittingStartAction, setIsSubmittingStartAction] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [chartData, setChartData] = useState<ChartPoint[]>([])
  const [pendingCreatorPortfolio, setPendingCreatorPortfolio] = useState<PendingPortfolio | null>(null)
  const [clockSec, setClockSec] = useState(() => Math.floor(Date.now() / 1000))
  const [lastTxHash, setLastTxHash] = useState<string | null>(null)
  const [lastTxType, setLastTxType] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockSec(Math.floor(Date.now() / 1000))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["duel", duelKey],
    queryFn: () => apiGetDuelById(duelKey),
    enabled: Boolean(duelKey),
    refetchInterval: 10000,
  })

  const rawDuel = data?.duel
  const duelAddress = rawDuel?.duelAddress as `0x${string}` | undefined

  const createdAtSeconds =
    typeof rawDuel?.createdAt === "number" && rawDuel.createdAt > 0
      ? rawDuel.createdAt
      : typeof rawDuel?.startTime === "number" && rawDuel.startTime > 0
        ? rawDuel.startTime
        : Math.floor(Date.now() / 1000)

  const status = rawDuel ? mapStateToStatus(rawDuel.state) : DuelStatus.OPEN
  const isSettled = status === DuelStatus.SETTLED
  const isCancelled = status === DuelStatus.CANCELLED
  const isLocked = status === DuelStatus.LOCKED
  const isSettling = status === DuelStatus.SETTLING
  const canRevealStrategies = isLocked || isSettling || isSettled

  const creatorIsWinner = Boolean(
    isSettled &&
      rawDuel?.winner &&
      rawDuel?.creator &&
      rawDuel.winner.toLowerCase() === rawDuel.creator.toLowerCase()
  )

  const opponentIsWinner = Boolean(
    isSettled &&
      rawDuel?.winner &&
      rawDuel?.opponent &&
      rawDuel.winner.toLowerCase() === rawDuel.opponent.toLowerCase()
  )

  const duel: Duel | null = rawDuel
    ? {
        id: rawDuel.duelId,
        duelAddress: rawDuel.duelAddress,
        status,
        creator: {
          address: rawDuel.creator,
          hasSubmitted: rawDuel.state !== "Created",
          isWinner: creatorIsWinner,
        },
        opponent: rawDuel.opponent
          ? {
              address: rawDuel.opponent,
              hasSubmitted: true,
              isWinner: opponentIsWinner,
            }
          : undefined,
        assetUniverse: rawDuel.assetUniverse?.length ? rawDuel.assetUniverse : [],
        entryAmountEth: parseFloat(rawDuel.entryAmountFormatted),
        durationSeconds: Number(rawDuel.duration || 0),
        createdAt: new Date(createdAtSeconds * 1000),
        startTime: rawDuel.startTime ? new Date(rawDuel.startTime * 1000) : undefined,
        endTime: rawDuel.endTime ? new Date(rawDuel.endTime * 1000) : undefined,
        winnerAddress: rawDuel.winner || undefined,
      }
    : null

  const nowSec = clockSec
  const duelStartTimestampSec = duel?.startTime
    ? Math.floor(duel.startTime.getTime() / 1000)
    : rawDuel?.startTime
      ? Number(rawDuel.startTime)
      : undefined
  const duelEndTimestampSec = duel?.endTime
    ? Math.floor(duel.endTime.getTime() / 1000)
    : rawDuel?.endTime
      ? Number(rawDuel.endTime)
      : undefined

  const hasDuelEnded = Boolean(
    isSettled ||
      isCancelled ||
      (duelEndTimestampSec && Number.isFinite(duelEndTimestampSec) && nowSec >= duelEndTimestampSec)
  )

  const isDuelWindowActive = Boolean(
    !isSettled &&
      !isCancelled &&
      duelStartTimestampSec &&
      duelEndTimestampSec &&
      nowSec >= duelStartTimestampSec &&
      nowSec < duelEndTimestampSec
  )

  const { address, chainId, isConnected } = useAccount()
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient({ chainId: FLOW_EVM_TESTNET_CHAIN_ID })
  const isWrongNetwork = isConnected && chainId !== FLOW_EVM_TESTNET_CHAIN_ID

  const creatorPortfolioQuery = useQuery({
    queryKey: ["duel-creator-portfolio", duelAddress],
    queryFn: () => apiGetCreatorPortfolio(duelAddress as string),
    enabled: Boolean(duelAddress),
    refetchInterval: 15000,
  })

  const opponentPortfolioQuery = useQuery({
    queryKey: ["duel-opponent-portfolio", duelAddress],
    queryFn: () => apiGetOpponentPortfolio(duelAddress as string),
    enabled: Boolean(duelAddress),
    refetchInterval: 15000,
  })

  const creatorPortfolio = useMemo(
    () => normalizePortfolio(creatorPortfolioQuery.data?.portfolio as DuelPortfolioData | undefined),
    [creatorPortfolioQuery.data?.portfolio]
  )

  const opponentPortfolio = useMemo(
    () => normalizePortfolio(opponentPortfolioQuery.data?.portfolio as DuelPortfolioData | undefined),
    [opponentPortfolioQuery.data?.portfolio]
  )

  const priceSymbols = useMemo(() => {
    const set = new Set<string>()
    ;(creatorPortfolio?.symbols || []).forEach((s) => set.add(s))
    ;(opponentPortfolio?.symbols || []).forEach((s) => set.add(s))
    return Array.from(set)
  }, [creatorPortfolio?.symbols, opponentPortfolio?.symbols])

  const priceSymbolsKey = priceSymbols.join(",")

  const startPricesQuery = useQuery({
    queryKey: ["duel-start-prices", duelAddress, duelStartTimestampSec, priceSymbolsKey],
    queryFn: () => apiGetBatchPricesAt(priceSymbols, duelStartTimestampSec as number),
    enabled:
      Boolean(duelAddress) &&
      canRevealStrategies &&
      priceSymbols.length > 0 &&
      Boolean(duelStartTimestampSec),
    staleTime: Infinity,
  })

  const livePricesQuery = useQuery({
    queryKey: ["duel-live-prices", duelAddress, priceSymbolsKey],
    queryFn: () => apiGetLiveBatchPrices(priceSymbols),
    enabled: Boolean(duelAddress) && canRevealStrategies && priceSymbols.length > 0 && !hasDuelEnded,
    refetchInterval: isDuelWindowActive ? 1000 : false,
    refetchIntervalInBackground: isDuelWindowActive,
  })

  useEffect(() => {
    if (!duelAddress || !canRevealStrategies) return
    if (!hasDuelEnded) return

    console.log("[DuelDetail] Duel ended. Live graph polling is paused.", {
      duelAddress,
      duelId: duel?.id,
      duelEndTimestampSec,
    })
  }, [duelAddress, canRevealStrategies, hasDuelEnded, duelEndTimestampSec, duel?.id])

  useEffect(() => {
    setChartData([])
  }, [duelAddress])

  useEffect(() => {
    if (!duelAddress) {
      setPendingCreatorPortfolio(null)
      return
    }

    const storageKey = `pending-portfolio-${duelAddress.toLowerCase()}`
    const raw = localStorage.getItem(storageKey)
    if (!raw) {
      setPendingCreatorPortfolio(null)
      return
    }

    try {
      const parsed = JSON.parse(raw)
      const symbols = Array.isArray(parsed?.symbols)
        ? parsed.symbols.filter((s: unknown): s is string => typeof s === "string" && s.length > 0)
        : []
      const weights = Array.isArray(parsed?.weights)
        ? parsed.weights
            .map((w: unknown) => Number(w))
            .filter((w: number) => Number.isFinite(w) && w > 0)
        : []

      if (symbols.length >= 2 && symbols.length === weights.length) {
        setPendingCreatorPortfolio({ symbols, weights })
      } else {
        setPendingCreatorPortfolio(null)
      }
    } catch {
      setPendingCreatorPortfolio(null)
    }
  }, [duelAddress])

  useEffect(() => {
    if (!duelAddress || !creatorPortfolio?.submitted) return

    const storageKey = `pending-portfolio-${duelAddress.toLowerCase()}`
    localStorage.removeItem(storageKey)
    setPendingCreatorPortfolio((prev) => (prev ? null : prev))
  }, [duelAddress, creatorPortfolio?.submitted])

  useEffect(() => {
    if (hasDuelEnded) return
    if (!creatorPortfolio || !opponentPortfolio || !livePricesQuery.data || !startPricesQuery.data) return

    const latestPrices = livePricesQuery.data.prices
    const startPrices = startPricesQuery.data.prices

    const baseline: Record<string, number> = {}
    for (const symbol of priceSymbols) {
      const start = startPrices[symbol]?.price
      if (typeof start === "number" && Number.isFinite(start) && start > 0) {
        baseline[symbol] = start
      }
    }

    if (Object.keys(baseline).length === 0) return

    const creatorIndex = computeIndexValue(
      creatorPortfolio.symbols,
      creatorPortfolio.weights,
      latestPrices,
      baseline
    )

    const opponentIndex = computeIndexValue(
      opponentPortfolio.symbols,
      opponentPortfolio.weights,
      latestPrices,
      baseline
    )

    if (!Number.isFinite(creatorIndex) || !Number.isFinite(opponentIndex)) return

    const publishTimes = Object.values(latestPrices)
      .map((p) => Number(p?.publishTime || 0))
      .filter((p) => Number.isFinite(p) && p > 0)
    const tickTime = publishTimes.length
      ? new Date(Math.max(...publishTimes) * 1000)
      : new Date()

    const point: ChartPoint = {
      time: tickTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      creator: Number(creatorIndex.toFixed(3)),
      opponent: Number(opponentIndex.toFixed(3)),
    }

    setChartData((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].time === point.time) {
        return [...prev.slice(0, -1), point]
      }
      return [...prev.slice(-299), point]
    })
  }, [
    hasDuelEnded,
    creatorPortfolio,
    opponentPortfolio,
    livePricesQuery.data,
    startPricesQuery.data,
    priceSymbolsKey,
    priceSymbols,
  ])

  useEffect(() => {
    if (isSettled || isCancelled) {
      setActionError(null)
    }
  }, [isSettled, isCancelled])

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="font-mono text-sm">Loading duel details...</p>
        </div>
      </AppShell>
    )
  }

  if (!duel || !rawDuel) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <p className="font-mono text-muted-foreground">Duel not found.</p>
          <Link href="/join-duel" className="font-mono text-xs text-primary hover:underline">
            ← Browse duels
          </Link>
        </div>
      </AppShell>
    )
  }

  const canSettleCheck = isLocked && duel.endTime ? Math.floor(duel.endTime.getTime() / 1000) <= nowSec : false
  const isTie = isSettled && !duel.winnerAddress
  let escrowBalanceWei = BigInt(0)
  try {
    escrowBalanceWei = BigInt(String((rawDuel as any).escrowBalance ?? "0"))
  } catch {
    escrowBalanceWei = BigInt(0)
  }

  const viewerAddressLower = address?.toLowerCase()
  const firstPlayerLower = duel.creator.address.toLowerCase()
  const secondPlayerLower = duel.opponent?.address?.toLowerCase()
  const hasOpponentJoined = Boolean(
    duel.opponent && duel.opponent.address !== "0x0000000000000000000000000000000000000000"
  )
  const creatorHasSubmitted = Boolean(creatorPortfolio?.submitted)
  const opponentHasSubmitted = Boolean(opponentPortfolio?.submitted)
  const isViewerCreator = Boolean(viewerAddressLower && viewerAddressLower === firstPlayerLower)
  const isViewerParticipant = Boolean(
    viewerAddressLower &&
      (viewerAddressLower === firstPlayerLower || (secondPlayerLower && viewerAddressLower === secondPlayerLower))
  )
  const winnerAddressLower = duel.winnerAddress?.toLowerCase()
  const isConnectedWinner = Boolean(
    isSettled &&
      isViewerParticipant &&
      winnerAddressLower &&
      viewerAddressLower === winnerAddressLower
  )
  const isConnectedLoser = Boolean(
    isSettled &&
      isViewerParticipant &&
      winnerAddressLower &&
      viewerAddressLower &&
      viewerAddressLower !== winnerAddressLower
  )
  const isRewardClaimable = isSettled && escrowBalanceWei > BigInt(0)
  const isSubmittedBothPreActivation = rawDuel.state === "SubmittedBoth"
  const canShowSettleAction =
    hasDuelEnded &&
    canSettleCheck &&
    !isSettled &&
    !isSettling &&
    !isCancelled &&
    !isSubmittedBothPreActivation &&
    isViewerParticipant
  const canSubmitSavedCreatorPortfolio = Boolean(
    duelAddress &&
      status === DuelStatus.JOINED &&
      hasOpponentJoined &&
      isViewerCreator &&
      !creatorHasSubmitted &&
      pendingCreatorPortfolio
  )

  const handleSubmitSavedPortfolioAndStart = async () => {
    if (!duelAddress || !pendingCreatorPortfolio || !isConnected || !publicClient) {
      setActionError("Connect wallet before submitting your saved portfolio.")
      return
    }

    if (!isViewerCreator) {
      setActionError("Only the creator wallet can submit the saved creator portfolio.")
      return
    }

    if (chainId !== FLOW_EVM_TESTNET_CHAIN_ID) {
      if (!switchChainAsync) {
        setActionError(`Switch wallet to ${FLOW_EVM_TESTNET_NAME} (chain ${FLOW_EVM_TESTNET_CHAIN_ID}).`)
        return
      }

      try {
        await switchChainAsync({ chainId: FLOW_EVM_TESTNET_CHAIN_ID })
        setActionError(`Network switched to ${FLOW_EVM_TESTNET_NAME}. Click submit again.`)
      } catch (switchError: any) {
        setActionError(
          switchError?.shortMessage ||
            switchError?.message ||
            `Switch wallet to ${FLOW_EVM_TESTNET_NAME} (chain ${FLOW_EVM_TESTNET_CHAIN_ID}).`
        )
      }
      return
    }

    setIsSubmittingStartAction(true)
    setActionError(null)

    try {
      const { assets, priceIds } = buildContractAssetArrays(pendingCreatorPortfolio.symbols)

      const submitHash = await writeContractAsync({
        chainId: FLOW_EVM_TESTNET_CHAIN_ID,
        address: duelAddress,
        abi: DUEL_ABI,
        functionName: "submitPortfolio",
        args: [assets, priceIds, pendingCreatorPortfolio.weights],
        gas: 500_000n,
      })

      const submitReceipt = await publicClient.waitForTransactionReceipt({ hash: submitHash, confirmations: 1 })
      if (submitReceipt.status !== "success") {
        throw new Error("Portfolio submission reverted")
      }

      setLastTxHash(submitHash)
      setLastTxType("Portfolio Submission")

      try {
        const activateHash = await writeContractAsync({
          chainId: FLOW_EVM_TESTNET_CHAIN_ID,
          address: duelAddress,
          abi: DUEL_ABI,
          functionName: "activateDuel",
          gas: 300_000n,
        })
        await publicClient.waitForTransactionReceipt({ hash: activateHash, confirmations: 1 })
        setLastTxHash(activateHash)
        setLastTxType("Duel Activation")
      } catch (activateErr: any) {
        const activateMessage = activateErr?.shortMessage || activateErr?.message || ""
        console.warn("[DuelDetail] activateDuel skipped after creator submission", {
          activateMessage,
        })
      }

      localStorage.removeItem(`pending-portfolio-${duelAddress.toLowerCase()}`)
      setPendingCreatorPortfolio(null)
      await Promise.all([refetch(), creatorPortfolioQuery.refetch(), opponentPortfolioQuery.refetch()])
    } catch (err: any) {
      console.error(err)
      const message = err?.shortMessage || err?.message || "Failed to submit creator portfolio"
      setActionError(message)
    } finally {
      setIsSubmittingStartAction(false)
    }
  }

  const handleSettle = async () => {
    if (!duelAddress || !isConnected || !publicClient) {
      setActionError("Connect wallet before settlement.")
      return
    }

    if (chainId !== FLOW_EVM_TESTNET_CHAIN_ID) {
      if (!switchChainAsync) {
        setActionError(`Switch wallet to ${FLOW_EVM_TESTNET_NAME} (chain ${FLOW_EVM_TESTNET_CHAIN_ID}).`)
        return
      }

      try {
        await switchChainAsync({ chainId: FLOW_EVM_TESTNET_CHAIN_ID })
        setActionError(`Network switched to ${FLOW_EVM_TESTNET_NAME}. Click settle again.`)
      } catch (switchError: any) {
        setActionError(
          switchError?.shortMessage ||
            switchError?.message ||
            `Switch wallet to ${FLOW_EVM_TESTNET_NAME} (chain ${FLOW_EVM_TESTNET_CHAIN_ID}).`
        )
      }
      return
    }

    setIsSettlingAction(true)
    setActionError(null)

    try {
      let hash: `0x${string}`

      try {
        hash = await writeContractAsync({
          chainId: FLOW_EVM_TESTNET_CHAIN_ID,
          address: duelAddress,
          abi: DUEL_ABI,
          functionName: "lockEndPricesAndSettle",
        })
      } catch (settleErr: any) {
        const message = settleErr?.shortMessage || settleErr?.message || ""
        if (!isSelectorMismatch(message)) {
          throw settleErr
        }

        if (!creatorPortfolio || !opponentPortfolio || !livePricesQuery.data || !startPricesQuery.data) {
          throw new Error("Live price data not ready. Wait for the versus graph to load and try again.")
        }

        const latestPrices = livePricesQuery.data.prices
        const startPrices = startPricesQuery.data.prices

        const creatorEnd = creatorPortfolio.symbols.map((s) =>
          toScaledPrice(latestPrices[s]?.price, `Missing live end price for ${s}`)
        )
        const opponentEnd = opponentPortfolio.symbols.map((s) =>
          toScaledPrice(latestPrices[s]?.price, `Missing live end price for ${s}`)
        )
        const creatorStart = creatorPortfolio.symbols.map((s) =>
          toScaledPrice(startPrices[s]?.price, `Missing duel start price for ${s}`)
        )
        const opponentStart = opponentPortfolio.symbols.map((s) =>
          toScaledPrice(startPrices[s]?.price, `Missing duel start price for ${s}`)
        )

        hash = await writeContractAsync({
          chainId: FLOW_EVM_TESTNET_CHAIN_ID,
          address: duelAddress,
          abi: DUEL_ABI,
          functionName: "settle",
          args: [creatorEnd, opponentEnd, creatorStart, opponentStart] as any,
        })
      }

      const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 })
      if (receipt.status !== "success") {
        throw new Error("Settlement transaction reverted")
      }

      setLastTxHash(hash)
      setLastTxType("Duel Settlement")

      await refetch()
    } catch (err: any) {
      console.error(err)
      const message = err?.shortMessage || err?.message || "Settlement failed"
      if (/flow-mainnet/i.test(message) && /invalid for chain/i.test(message)) {
        setActionError(`Wrong network detected. Switch to ${FLOW_EVM_TESTNET_NAME} and retry.`)
      } else {
        setActionError(message)
      }
    } finally {
      setIsSettlingAction(false)
    }
  }

  const handlePayout = async () => {
    if (!duelAddress || !isConnected || !publicClient) {
      setActionError("Connect wallet before payout.")
      return
    }

    if (!isConnectedWinner) {
      setActionError("Only the winner wallet can collect reward.")
      return
    }

    if (!isRewardClaimable) {
      setActionError("Reward already collected.")
      return
    }

    if (chainId !== FLOW_EVM_TESTNET_CHAIN_ID) {
      if (!switchChainAsync) {
        setActionError(`Switch wallet to ${FLOW_EVM_TESTNET_NAME} (chain ${FLOW_EVM_TESTNET_CHAIN_ID}).`)
        return
      }

      try {
        await switchChainAsync({ chainId: FLOW_EVM_TESTNET_CHAIN_ID })
        setActionError(`Network switched to ${FLOW_EVM_TESTNET_NAME}. Click payout again.`)
      } catch (switchError: any) {
        setActionError(
          switchError?.shortMessage ||
            switchError?.message ||
            `Switch wallet to ${FLOW_EVM_TESTNET_NAME} (chain ${FLOW_EVM_TESTNET_CHAIN_ID}).`
        )
      }
      return
    }

    setIsPayoutAction(true)
    setActionError(null)

    try {
      const hash = await writeContractAsync({
        chainId: FLOW_EVM_TESTNET_CHAIN_ID,
        address: duelAddress,
        abi: DUEL_ABI,
        functionName: "executePayout",
        gas: 100000n, // Set reasonable gas limit
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 })
      if (receipt.status !== "success") {
        throw new Error("Payout transaction reverted")
      }

      setLastTxHash(hash)
      setLastTxType("Reward Payout")

      await refetch()
    } catch (err: any) {
      console.error(err)
      const message = err?.shortMessage || err?.message || "Payout execution failed"
      setActionError(message)
    } finally {
      setIsPayoutAction(false)
    }
  }

  const handleSplitTie = async () => {
    if (!duelAddress || !isConnected || !publicClient) {
      setActionError("Connect wallet before split payout.")
      return
    }

    if (!isTie) {
      setActionError("Split payout is only available for tied duels.")
      return
    }

    if (!isViewerParticipant) {
      setActionError("Only duel participants can claim tie split rewards.")
      return
    }

    if (!isRewardClaimable) {
      setActionError("Tie rewards already claimed.")
      return
    }

    setIsSplitAction(true)
    setActionError(null)

    try {
      const hash = await writeContractAsync({
        chainId: FLOW_EVM_TESTNET_CHAIN_ID,
        address: duelAddress,
        abi: DUEL_ABI,
        functionName: "splitTieWinnings",
        gas: 100000n, // Set reasonable gas limit
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 })
      if (receipt.status !== "success") {
        throw new Error("Split payout transaction reverted")
      }

      setLastTxHash(hash)
      setLastTxType("Tie Split Payout")

      await refetch()
    } catch (err: any) {
      console.error(err)
      const message = err?.shortMessage || err?.message || "Split payout failed"
      setActionError(message)
    } finally {
      setIsSplitAction(false)
    }
  }

  const tokenUniverseSymbols = Array.from(
    new Set([
      ...duel.assetUniverse,
      ...(creatorPortfolio?.symbols || []),
      ...(opponentPortfolio?.symbols || []),
    ])
  )

  const livePriceMap = livePricesQuery.data?.prices || {}
  const startPriceMap = startPricesQuery.data?.prices || {}
  const baselinePriceMap: Record<string, number> = Object.fromEntries(
    Object.entries(startPriceMap)
      .filter(([, value]) => typeof value?.price === "number" && Number.isFinite(value.price) && value.price > 0)
      .map(([symbol, value]) => [symbol, value.price])
  )

  const tokenRows = tokenUniverseSymbols.map((symbol) => {
    const meta = SUPPORTED_ASSETS.find((a) => a.symbol === symbol)
    const live = livePriceMap[symbol]?.price
    const start = startPriceMap[symbol]?.price
    const duelChangePct =
      typeof live === "number" && typeof start === "number" && start > 0
        ? ((live - start) / start) * 100
        : null

    return {
      symbol,
      name: meta?.name || symbol,
      icon: meta?.icon || "•",
      live,
      duelChangePct,
    }
  })

  const creatorIndexValue = creatorPortfolio
    ? computeIndexValue(creatorPortfolio.symbols, creatorPortfolio.weights, livePriceMap, baselinePriceMap)
    : chartData.length
      ? chartData[chartData.length - 1].creator
      : 100

  const opponentIndexValue = opponentPortfolio
    ? computeIndexValue(opponentPortfolio.symbols, opponentPortfolio.weights, livePriceMap, baselinePriceMap)
    : chartData.length
      ? chartData[chartData.length - 1].opponent
      : 100

  const creatorPnL = creatorIndexValue - 100
  const opponentPnL = opponentIndexValue - 100
  const firstPlayerAddress = truncateAddress(duel.creator.address)
  const secondPlayerAddress = duel.opponent ? truncateAddress(duel.opponent.address) : "Pending address"
  const endsDisplay = duel.endTime
    ? duel.endTime.getTime() > Date.now()
      ? `in ${formatCountdown(duel.endTime)}`
      : formatTimeAgo(duel.endTime)
    : null

  return (
    <AppShell>
      <div className="border-b border-border px-6 py-3 bg-background">
        <div className="max-w-[1100px] mx-auto">
          <Link
            href="/join-duel"
            className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3 w-3" /> Back to Browse
          </Link>
        </div>
      </div>

      <div className="max-w-[1100px] mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <StatusBadge status={duel.status} />
              <span className="font-mono text-xs text-muted-foreground">Duel #{duel.id.substring(0, 10)}</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-montserrat)" }}>
              Portfolio Duel
            </h1>
            <p className="font-mono text-xs text-muted-foreground mt-1">
              Created {formatTimeAgo(duel.createdAt)} · {formatDuration(duel.durationSeconds)} window · {formatEth(duel.entryAmountEth)} entry each
            </p>
            {isWrongNetwork && (
              <p className="font-mono text-xs text-amber-400 mt-1 inline-flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5" />
                Wallet on chain {chainId}. Switch to {FLOW_EVM_TESTNET_NAME} (chain {FLOW_EVM_TESTNET_CHAIN_ID}) for on-chain actions.
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {isLocked && duel.endTime && (
              <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 px-5 py-3 text-center">
                <p className="font-mono text-xs text-muted-foreground mb-1">Time Remaining</p>
                <p className="font-mono text-xl font-bold text-amber-400">{formatCountdown(duel.endTime)}</p>
              </div>
            )}

            {canShowSettleAction && (
              <button
                onClick={handleSettle}
                disabled={isSettlingAction || isSwitchingChain}
                className="rounded-2xl border border-primary/50 bg-primary/20 text-primary px-5 py-3 font-mono font-bold hover:bg-primary/30 disabled:opacity-50"
              >
                {isSwitchingChain ? "Switching..." : isSettlingAction ? "Settling..." : "Settle Duel"}
              </button>
            )}

            {isSettled && !isTie && isConnectedWinner && isRewardClaimable && (
              <button
                onClick={handlePayout}
                disabled={isPayoutAction || isSwitchingChain}
                className="rounded-2xl border border-primary/50 bg-primary/20 text-primary px-5 py-3 font-mono font-bold hover:bg-primary/30 disabled:opacity-50"
              >
                {isSwitchingChain ? "Switching..." : isPayoutAction ? "Collecting..." : "Collect Reward"}
              </button>
            )}

            {isSettled && isTie && isViewerParticipant && isRewardClaimable && (
              <button
                onClick={handleSplitTie}
                disabled={isSplitAction || isSwitchingChain}
                className="rounded-2xl border border-primary/50 bg-primary/20 text-primary px-5 py-3 font-mono font-bold hover:bg-primary/30 disabled:opacity-50"
              >
                {isSwitchingChain ? "Switching..." : isSplitAction ? "Splitting..." : "Split Tie"}
              </button>
            )}

            {isSettled && !isTie && isConnectedWinner && !isRewardClaimable && (
              <div className="rounded-2xl border border-primary/30 bg-primary/10 px-5 py-3 text-center min-w-[190px]">
                <p className="font-mono text-xs text-muted-foreground mb-1">Reward</p>
                <p className="font-mono text-sm font-bold text-primary">Already Collected</p>
              </div>
            )}

            {isSettled && !isTie && isConnectedLoser && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-center min-w-[170px]">
                <p className="font-mono text-xs text-muted-foreground mb-1">Result</p>
                <p className="font-mono text-sm font-bold text-red-400">You Lost</p>
              </div>
            )}
          </div>
        </div>

        {actionError && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/8 p-4">
            <p className="font-mono text-xs text-red-400">{actionError}</p>
          </div>
        )}

        {lastTxHash && lastTxType && (
          <div className="mb-6 rounded-xl border border-primary/30 bg-primary/8 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="font-mono text-xs text-primary font-semibold mb-1">✓ {lastTxType} Confirmed</p>
                <p className="font-mono text-[11px] text-muted-foreground">
                  Transaction: {truncateAddress(lastTxHash, 8)}
                </p>
              </div>
              <a
                href={getExplorerUrl(FLOW_EVM_TESTNET_CHAIN_ID, lastTxHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-primary/50 bg-primary/20 text-primary px-4 py-2 font-mono text-xs font-semibold hover:bg-primary/30 transition-colors flex items-center gap-1.5"
              >
                View on {getExplorerName(FLOW_EVM_TESTNET_CHAIN_ID)}
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        )}

        {status === DuelStatus.JOINED && hasOpponentJoined && (
          <div className="mb-6 rounded-xl border border-amber-400/30 bg-amber-400/8 p-4 flex flex-col gap-3">
            <p className="font-mono text-xs text-amber-200">
              This duel is waiting for both portfolio submissions before it can move to Active.
            </p>

            {canSubmitSavedCreatorPortfolio && (
              <button
                onClick={handleSubmitSavedPortfolioAndStart}
                disabled={isSubmittingStartAction || isSwitchingChain}
                className="self-start rounded-full border border-primary/50 bg-primary/20 text-primary px-4 py-2 font-mono text-xs font-semibold hover:bg-primary/30 disabled:opacity-50"
              >
                {isSwitchingChain
                  ? "Switching..."
                  : isSubmittingStartAction
                    ? "Submitting..."
                    : "Submit Saved Portfolio & Start"}
              </button>
            )}

            {isViewerCreator && !creatorHasSubmitted && !pendingCreatorPortfolio && (
              <p className="font-mono text-[11px] text-amber-100/80">
                Creator portfolio not found in local storage. Rebuild and submit from the creator wallet to start this duel.
              </p>
            )}

            {!isViewerCreator && (
              <p className="font-mono text-[11px] text-amber-100/80">
                Waiting for creator wallet to submit its portfolio.
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            {isSettled && duel.winnerAddress && (
              <div className="rounded-2xl border border-primary/40 bg-primary/5 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="h-5 w-5 text-primary" />
                  <h2 className="font-mono font-bold text-primary text-sm">Duel Result</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-xl bg-background border border-border p-4">
                    <p className="font-mono text-[10px] text-muted-foreground mb-1">Winner</p>
                    <p className="font-mono text-sm font-bold text-primary">{truncateAddress(duel.winnerAddress)}</p>
                  </div>
                  <div className="rounded-xl bg-background border border-border p-4">
                    <p className="font-mono text-[10px] text-muted-foreground mb-1">Prize Pool</p>
                    <p className="font-mono text-sm font-bold text-primary">{formatEth(duel.entryAmountEth * 2)}</p>
                  </div>
                </div>
                {isViewerParticipant && (
                  <p className={`font-mono text-xs mt-4 ${isConnectedWinner ? "text-primary" : isConnectedLoser ? "text-red-400" : "text-muted-foreground"}`}>
                    {isConnectedWinner
                      ? "You won this duel. Collect your reward using the button above."
                      : isConnectedLoser
                        ? "You lost this duel. Better luck in the next one."
                        : "Winner determined on-chain."}
                  </p>
                )}
              </div>
            )}

            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center gap-2 mb-3">
                <Lock className="h-4 w-4 text-primary" />
                <h2 className="font-mono font-semibold text-foreground text-sm">Strategy Reveal</h2>
              </div>

              {!canRevealStrategies && (
                <p className="font-mono text-xs text-muted-foreground">
                  Selected tokens are public, but full allocations are hidden until duel start.
                </p>
              )}

              {canRevealStrategies && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-border bg-background p-4">
                    <p className="font-mono text-xs font-semibold text-foreground mb-3">{firstPlayerAddress} Index</p>
                    {creatorPortfolioQuery.isLoading ? (
                      <p className="font-mono text-xs text-muted-foreground">Loading allocation...</p>
                    ) : (creatorPortfolio?.symbols || []).length === 0 ? (
                      <p className="font-mono text-xs text-muted-foreground">Allocation not available yet.</p>
                    ) : (
                      (creatorPortfolio?.symbols || []).map((symbol, idx) => (
                        <div key={`creator-${symbol}-${idx}`} className="flex items-center justify-between border-b border-border py-2 last:border-0">
                          <span className="font-mono text-xs text-muted-foreground">{symbol}</span>
                          <span className="font-mono text-xs text-foreground font-semibold">
                            {((creatorPortfolio?.weights?.[idx] ?? 0) / 100).toFixed(1)}%
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="rounded-xl border border-border bg-background p-4">
                    <p className="font-mono text-xs font-semibold text-foreground mb-3">{secondPlayerAddress} Index</p>
                    {opponentPortfolioQuery.isLoading ? (
                      <p className="font-mono text-xs text-muted-foreground">Loading allocation...</p>
                    ) : (opponentPortfolio?.symbols || []).length === 0 ? (
                      <p className="font-mono text-xs text-muted-foreground">Allocation not available yet.</p>
                    ) : (
                      (opponentPortfolio?.symbols || []).map((symbol, idx) => (
                        <div key={`opponent-${symbol}-${idx}`} className="flex items-center justify-between border-b border-border py-2 last:border-0">
                          <span className="font-mono text-xs text-muted-foreground">{symbol}</span>
                          <span className="font-mono text-xs text-foreground font-semibold">
                            {((opponentPortfolio?.weights?.[idx] ?? 0) / 100).toFixed(1)}%
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {canRevealStrategies && !hasDuelEnded && (
              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <LineChartIcon className="h-4 w-4 text-primary" />
                    <h2 className="font-mono font-semibold text-foreground text-sm">Pyth Live Versus</h2>
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {firstPlayerAddress} {creatorPnL >= 0 ? "+" : ""}{creatorPnL.toFixed(2)}% · {secondPlayerAddress} {opponentPnL >= 0 ? "+" : ""}{opponentPnL.toFixed(2)}%
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <div className="rounded-xl border border-border bg-background px-4 py-3">
                    <p className="font-mono text-[10px] text-muted-foreground mb-1">{firstPlayerAddress} Performance</p>
                    <p className="font-mono text-sm font-semibold text-foreground">Index {creatorIndexValue.toFixed(2)}</p>
                    <p className={`font-mono text-xs ${creatorPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {creatorPnL >= 0 ? "+" : ""}{creatorPnL.toFixed(2)}% {hasDuelEnded ? "final" : "live"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-background px-4 py-3">
                    <p className="font-mono text-[10px] text-muted-foreground mb-1">{secondPlayerAddress} Performance</p>
                    <p className="font-mono text-sm font-semibold text-foreground">Index {opponentIndexValue.toFixed(2)}</p>
                    <p className={`font-mono text-xs ${opponentPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {opponentPnL >= 0 ? "+" : ""}{opponentPnL.toFixed(2)}% {hasDuelEnded ? "final" : "live"}
                    </p>
                  </div>
                </div>

                {chartData.length < 2 ? (
                  <div className="rounded-xl border border-border bg-background p-4 text-center">
                    <p className="font-mono text-xs text-muted-foreground">
                      {startPricesQuery.isLoading
                        ? "Loading duel start prices..."
                        : livePricesQuery.isLoading
                          ? "Loading live prices..."
                          : "Waiting for price ticks to build versus chart..."}
                    </p>
                  </div>
                ) : (
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="time" tick={{ fontSize: 11 }} minTickGap={24} />
                        <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} width={56} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="creator" stroke="#1DED83" strokeWidth={2} dot={false} name={firstPlayerAddress} />
                        <Line type="monotone" dataKey="opponent" stroke="#5DA9FF" strokeWidth={2} dot={false} name={secondPlayerAddress} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {canRevealStrategies && hasDuelEnded && (
              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <LineChartIcon className="h-4 w-4 text-primary" />
                    <h2 className="font-mono font-semibold text-foreground text-sm">Versus Finalized</h2>
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground">Duel window closed</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border bg-background px-4 py-3">
                    <p className="font-mono text-[10px] text-muted-foreground mb-1">{firstPlayerAddress} Final Performance</p>
                    <p className="font-mono text-sm font-semibold text-foreground">Index {creatorIndexValue.toFixed(2)}</p>
                    <p className={`font-mono text-xs ${creatorPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {creatorPnL >= 0 ? "+" : ""}{creatorPnL.toFixed(2)}% final
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-background px-4 py-3">
                    <p className="font-mono text-[10px] text-muted-foreground mb-1">{secondPlayerAddress} Final Performance</p>
                    <p className="font-mono text-sm font-semibold text-foreground">Index {opponentIndexValue.toFixed(2)}</p>
                    <p className={`font-mono text-xs ${opponentPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {opponentPnL >= 0 ? "+" : ""}{opponentPnL.toFixed(2)}% final
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-mono font-semibold text-foreground text-sm mb-4">Token Universe</h2>
              <div className="space-y-3">
                {tokenRows.map((token) => (
                    <div key={token.symbol} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-primary text-lg">{token.icon}</span>
                        <div>
                          <p className="font-mono text-sm font-medium text-foreground">{token.symbol}</p>
                          <p className="font-mono text-xs text-muted-foreground">{token.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm text-foreground">
                          {typeof token.live === "number" ? `$${token.live.toLocaleString(undefined, { maximumFractionDigits: 6 })}` : "--"}
                        </p>
                        <p className={`font-mono text-xs ${
                          typeof token.duelChangePct === "number"
                            ? token.duelChangePct >= 0
                              ? "text-emerald-400"
                              : "text-red-400"
                            : "text-muted-foreground"
                        }`}>
                          {typeof token.duelChangePct === "number"
                            ? `${token.duelChangePct >= 0 ? "+" : ""}${token.duelChangePct.toFixed(2)}% vs start`
                            : "Awaiting baseline"}
                        </p>
                      </div>
                    </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-mono font-semibold text-foreground text-sm">Participants</h2>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-xs text-foreground">{firstPlayerAddress}</p>
                  </div>
                  <span className={`font-mono text-[10px] rounded-full px-2 py-0.5 border ${
                    isSettled && duel.creator.isWinner
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground"
                  }`}>
                    {isSettled ? (duel.creator.isWinner ? "Winner" : "Loser") : creatorHasSubmitted ? "Submitted" : "Pending"}
                  </span>
                </div>

                {duel.opponent ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-xs text-foreground">{secondPlayerAddress}</p>
                    </div>
                    <span className={`font-mono text-[10px] rounded-full px-2 py-0.5 border ${
                      isSettled && duel.opponent.isWinner
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground"
                    }`}>
                      {isSettled ? (duel.opponent.isWinner ? "Winner" : "Loser") : opponentHasSubmitted ? "Submitted" : "Pending"}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    <p className="font-mono text-xs text-primary/70">Waiting for second wallet…</p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
              {[
                ["Duration", formatDuration(duel.durationSeconds)],
                ["Entry", formatEth(duel.entryAmountEth) + " per player"],
                [`Stake (${firstPlayerAddress})`, formatEth(duel.entryAmountEth)],
                [`Stake (${duel.opponent ? secondPlayerAddress : "pending"})`, duel.opponent ? formatEth(duel.entryAmountEth) : "Not staked yet"],
                ["Prize Pool", formatEth(duel.entryAmountEth * 2) + " total"],
                ["Created", formatTimeAgo(duel.createdAt)],
                ...(duel.startTime ? [["Started", formatTimeAgo(duel.startTime)]] : []),
                ...(endsDisplay ? [["Ends", endsDisplay]] : []),
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">{label}</span>
                  <span className="font-mono text-xs text-foreground font-medium">{value}</span>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="font-mono font-semibold text-foreground text-sm mb-5">Lifecycle</h2>
              <Timeline currentStatus={duel.status} />
            </div>

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

"use client"

import { useState, useCallback } from "react"
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react"
import { SUPPORTED_ASSETS, type WeightAllocation } from "@/lib/duel-types"
import {
  basisPointsToPercent,
  percentToBasisPoints,
  computeTotalWeight,
  isWeightValid,
  normalizeWeights,
} from "@/lib/duel-utils"

interface WeightBuilderProps {
  /** Subset of SUPPORTED_ASSETS symbols that are allowed in this duel */
  allowedSymbols?: string[]
  onWeightsChange?: (allocations: WeightAllocation[], valid: boolean) => void
  disabled?: boolean
}

export default function WeightBuilder({
  allowedSymbols,
  onWeightsChange,
  disabled = false,
}: WeightBuilderProps) {
  const assets = allowedSymbols
    ? SUPPORTED_ASSETS.filter((a) => allowedSymbols.includes(a.symbol))
    : SUPPORTED_ASSETS

  const initialWeights: WeightAllocation[] = assets.map((a, i) => ({
    symbol: a.symbol,
    basisPoints: i === 0 ? 10000 - (assets.length - 1) * Math.floor(10000 / assets.length)
                         : Math.floor(10000 / assets.length),
  }))

  const [allocations, setAllocations] = useState<WeightAllocation[]>(initialWeights)

  const total = computeTotalWeight(allocations)
  const valid = isWeightValid(allocations)

  const handleSliderChange = useCallback(
    (symbol: string, percent: number) => {
      setAllocations((prev) => {
        const updated = prev.map((a) =>
          a.symbol === symbol ? { ...a, basisPoints: percentToBasisPoints(percent) } : a
        )
        onWeightsChange?.(updated, isWeightValid(updated))
        return updated
      })
    },
    [onWeightsChange]
  )

  const handleNormalize = () => {
    const normalized = normalizeWeights(allocations)
    setAllocations(normalized)
    onWeightsChange?.(normalized, true)
  }

  return (
    <div className="space-y-5">
      {/* Asset sliders */}
      <div className="space-y-4">
        {assets.map((asset) => {
          const alloc = allocations.find((a) => a.symbol === asset.symbol)
          const pct   = alloc ? basisPointsToPercent(alloc.basisPoints) : 0
          return (
            <div key={asset.symbol} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-primary font-mono text-base">{asset.icon}</span>
                  <span className="font-mono text-sm text-foreground font-medium">{asset.symbol}</span>
                  <span className="font-mono text-xs text-muted-foreground">{asset.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-primary font-semibold tabular-nums">
                    {pct.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Slider */}
              <div className="relative h-2">
                <div className="absolute inset-0 rounded-full bg-muted" />
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-150"
                  style={{ width: `${pct}%` }}
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.5}
                  value={pct}
                  disabled={disabled}
                  onChange={(e) => handleSliderChange(asset.symbol, Number(e.target.value))}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer disabled:cursor-not-allowed h-full"
                />
              </div>

              {/* Allocation bar visual */}
              <div className="flex gap-0.5 h-1 rounded-full overflow-hidden">
                {assets.map((a) => {
                  const ap = allocations.find((x) => x.symbol === a.symbol)
                  const apct = ap ? basisPointsToPercent(ap.basisPoints) : 0
                  return (
                    <div
                      key={a.symbol}
                      className="transition-all duration-200"
                      style={{
                        width: `${apct}%`,
                        backgroundColor:
                          a.symbol === "BTC"  ? "#F7931A" :
                          a.symbol === "ETH"  ? "#627EEA" :
                          a.symbol === "SOL"  ? "#9945FF" :
                          a.symbol === "BNB"  ? "#F0B90B" :
                                                "#2775CA",
                      }}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Total indicator */}
      <div className="rounded-xl border p-3 flex items-center justify-between"
        style={{ borderColor: valid ? "hsl(var(--primary)/0.4)" : "rgb(239 68 68 / 0.4)" }}>
        <div className="flex items-center gap-2">
          {valid ? (
            <CheckCircle2 className="h-4 w-4 text-primary" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-400" />
          )}
          <span className="font-mono text-xs text-muted-foreground">
            {valid ? "Allocation valid — ready to encrypt" : `Total must equal 100% (currently ${(total / 100).toFixed(1)}%)`}
          </span>
        </div>
        {!valid && (
          <button
            onClick={handleNormalize}
            className="flex items-center gap-1 text-xs font-mono text-primary hover:text-primary/80 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Auto-normalize
          </button>
        )}
      </div>
    </div>
  )
}

"use client"

import { useEffect, useRef, memo } from "react"

const TV_SYMBOL_MAP: Record<string, string> = {
  BTC:  "BINANCE:BTCUSDT",
  ETH:  "BINANCE:ETHUSDT",
  SOL:  "BINANCE:SOLUSDT",
  BNB:  "BINANCE:BNBUSDT",
  STRK: "BINANCE:STRKUSDT",
  ARB:  "BINANCE:ARBUSDT",
  OP:   "BINANCE:OPUSDT",
  MATIC:"BINANCE:MATICUSDT",
  POL:  "BINANCE:POLUSDT",
  LINK: "BINANCE:LINKUSDT",
  AVAX: "BINANCE:AVAXUSDT",
  USDC: "BINANCE:BTCUSDT",
  USDT: "BINANCE:BTCUSDT",
  DAI:  "BINANCE:BTCUSDT",
}

const STABLECOINS = new Set(["USDC", "USDT", "DAI"])

export function resolveTVSymbol(symbols: string[]): string {
  const nonStable = symbols.find((s) => !STABLECOINS.has(s.toUpperCase()))
  const symbol = (nonStable || symbols[0] || "BTC").toUpperCase()
  return TV_SYMBOL_MAP[symbol] ?? "BINANCE:BTCUSDT"
}

interface TradingViewWidgetProps {
  symbol: string
  interval?: string
  height?: number
}

function TradingViewWidget({ symbol, interval = "1", height = 400 }: TradingViewWidgetProps) {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!container.current) return

    container.current.innerHTML = ""

    const widgetDiv = document.createElement("div")
    widgetDiv.className = "tradingview-widget-container__widget"
    widgetDiv.style.height = "100%"
    widgetDiv.style.width = "100%"
    container.current.appendChild(widgetDiv)

    const script = document.createElement("script")
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"
    script.type = "text/javascript"
    script.async = true
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval,
      timezone: "exchange",
      theme: "dark",
      style: "1",
      locale: "en",
      allow_symbol_change: false,
      calendar: false,
      withdateranges: false,
      save_image: false,
      details: false,
      hotlist: false,
      support_host: "https://www.tradingview.com",
    })
    container.current.appendChild(script)

    return () => {
      if (container.current) {
        container.current.innerHTML = ""
      }
    }
  }, [symbol, interval])

  return (
    <div
      ref={container}
      className="tradingview-widget-container rounded-xl overflow-hidden"
      style={{ height, width: "100%" }}
    />
  )
}

export default memo(TradingViewWidget)

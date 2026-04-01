"use client"

/**
 * Web3Providers
 * Wraps the app with WagmiConfig + RainbowKit providers (Wagmi v0 API).
 */

import React from "react"
import { WagmiConfig } from "wagmi"
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit"
import { wagmiClient, chains } from "@/lib/wallet-config"

import "@rainbow-me/rainbowkit/styles.css"

export default function Web3Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiConfig client={wagmiClient}>
      <RainbowKitProvider
        chains={chains}
        theme={darkTheme({
          accentColor: "#1DED83",
          accentColorForeground: "#000",
          borderRadius: "large",
          fontStack: "system",
          overlayBlur: "small",
        })}
      >
        {children}
      </RainbowKitProvider>
    </WagmiConfig>
  )
}

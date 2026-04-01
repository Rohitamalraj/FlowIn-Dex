"use client"

import { getDefaultConfig } from "@rainbow-me/rainbowkit"
import { http } from "wagmi"
import type { Chain } from "viem"

export const flowEvmTestnet = {
  id: 545,
  name: "Flow EVM Testnet",
  nativeCurrency: { decimals: 18, name: "Flow", symbol: "FLOW" },
  rpcUrls: {
    default: { http: ["https://testnet.evm.nodes.onflow.org"] },
  },
  blockExplorers: {
    default: { name: "Flowscan", url: "https://evm-testnet.flowscan.io" },
  },
  testnet: true,
} as const satisfies Chain

export const wagmiConfig = getDefaultConfig({
  appName: "FlowIn-Dex",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "00000000000000000000000000000000",
  chains: [flowEvmTestnet],
  transports: {
    [flowEvmTestnet.id]: http(),
  },
  ssr: true,
})

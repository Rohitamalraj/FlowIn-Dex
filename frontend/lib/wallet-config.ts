"use client"

/**
 * Wagmi + RainbowKit wallet configuration (Wagmi v0 API).
 * Supports Flow EVM (active) + all EVM chains from Pyth docs (coming soon).
 */

import { getDefaultWallets } from "@rainbow-me/rainbowkit"
import { configureChains, createClient } from "wagmi"
import { publicProvider } from "wagmi/providers/public"
import {
  mainnet, goerli,
  arbitrum, arbitrumGoerli,
  optimism, optimismGoerli,
  polygon, polygonMumbai,
} from "wagmi/chains"
import type { Chain } from "wagmi"

// ─── Flow EVM Chain Definitions ───────────────────────────────────────────────

export const flowEvmTestnet: Chain = {
  id: 545,
  name: "Flow EVM Testnet",
  network: "flow-evm-testnet",
  nativeCurrency: { decimals: 18, name: "Flow", symbol: "FLOW" },
  rpcUrls: {
    default: { http: ["https://testnet.evm.nodes.onflow.org"] },
    public: { http: ["https://testnet.evm.nodes.onflow.org"] },
  },
  blockExplorers: {
    default: { name: "Flow EVM Testnet Explorer", url: "https://evm-testnet.flowscan.io" },
  },
  testnet: true,
}

export const flowEvmMainnet: Chain = {
  id: 747,
  name: "Flow EVM",
  network: "flow-evm",
  nativeCurrency: { decimals: 18, name: "Flow", symbol: "FLOW" },
  rpcUrls: {
    default: { http: ["https://mainnet.evm.nodes.onflow.org"] },
    public: { http: ["https://mainnet.evm.nodes.onflow.org"] },
  },
  blockExplorers: {
    default: { name: "Flow EVM Explorer", url: "https://evm.flowscan.io" },
  },
}

const { chains, provider, webSocketProvider } = configureChains(
  [
    flowEvmTestnet,
    flowEvmMainnet,
    mainnet,
    goerli,
    arbitrum,
    arbitrumGoerli,
    optimism,
    optimismGoerli,
    polygon,
    polygonMumbai,
  ],
  [publicProvider()]
)

const rawWalletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim()
const hasValidWalletConnectProjectId = Boolean(rawWalletConnectProjectId && /^[a-fA-F0-9]{32}$/.test(rawWalletConnectProjectId))
const walletConnectProjectId = hasValidWalletConnectProjectId
  ? rawWalletConnectProjectId!
  : "00000000000000000000000000000000"

const { connectors } = getDefaultWallets({
  appName: "FlowIn-Dex",
  chains,
  projectId: walletConnectProjectId,
})

export const wagmiClient = createClient({
  autoConnect: true,
  connectors,
  provider,
  webSocketProvider,
})

export { chains }

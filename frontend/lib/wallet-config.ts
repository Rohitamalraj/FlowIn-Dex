"use client"

/**
 * Wagmi + RainbowKit wallet configuration for Flow EVM Testnet.
 * Flow Wallet has been explicitly removed to prevent cross-VM proxy conflicts.
 * Uses MetaMask primarily.
 */

import { getDefaultConfig } from "@rainbow-me/rainbowkit"
import {
  metaMaskWallet,
  rainbowWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets"
import { defineChain } from "viem"

// ─── Flow EVM Chain Definitions ───────────────────────────────────────────────

export const flowEvmTestnet = defineChain({
  id: 545,
  name: "Flow EVM Testnet",
  network: "flow-evm-testnet",
  nativeCurrency: { decimals: 18, name: "Flow", symbol: "FLOW" },
  rpcUrls: {
    default: { http: ["https://testnet.evm.nodes.onflow.org"] },
    public:  { http: ["https://testnet.evm.nodes.onflow.org"] },
  },
  blockExplorers: {
    default: { name: "Flow EVM Testnet Explorer", url: "https://evm-testnet.flowscan.io" },
  },
  testnet: true,
})

const rawWalletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim()
const hasValidWalletConnectProjectId = Boolean(rawWalletConnectProjectId && /^[a-fA-F0-9]{32}$/.test(rawWalletConnectProjectId))
const walletConnectProjectId = hasValidWalletConnectProjectId
  ? rawWalletConnectProjectId
  : "00000000000000000000000000000000"

const recommendedWallets = hasValidWalletConnectProjectId
  ? [metaMaskWallet, rainbowWallet, walletConnectWallet]
  : [metaMaskWallet]

function createWagmiConfig() {
  return getDefaultConfig({
    appName: "ShieldVault",
    projectId: walletConnectProjectId ?? "00000000000000000000000000000000",
    wallets: [
      {
        groupName: "Recommended",
        wallets: recommendedWallets,
      },
    ],
    chains: [flowEvmTestnet],
    ssr: true,
  })
}

declare global {
  // eslint-disable-next-line no-var
  var __shieldvaultWagmiConfig: ReturnType<typeof getDefaultConfig> | undefined
}

export const wagmiConfig = globalThis.__shieldvaultWagmiConfig ?? createWagmiConfig()
if (!globalThis.__shieldvaultWagmiConfig) {
  globalThis.__shieldvaultWagmiConfig = wagmiConfig
}

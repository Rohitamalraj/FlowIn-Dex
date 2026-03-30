"use client"

/**
 * Wagmi + RainbowKit wallet configuration.
 * Supports Flow EVM (active) + all EVM chains from Pyth docs (coming soon).
 * Flow Wallet has been explicitly removed to prevent cross-VM proxy conflicts.
 */

import { getDefaultConfig } from "@rainbow-me/rainbowkit"
import {
  metaMaskWallet,
  rainbowWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets"
import { defineChain } from "viem"
import {
  mainnet, sepolia,
  arbitrum, arbitrumSepolia,
  optimism, optimismSepolia,
  base, baseSepolia,
  polygon, polygonAmoy,
  avalanche, avalancheFuji,
  bsc, bscTestnet,
  blast, blastSepolia,
  scroll, scrollSepolia,
  zksync, zkSyncSepoliaTestnet,
  linea, lineaSepolia,
  mantle,
} from "viem/chains"

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

export const flowEvmMainnet = defineChain({
  id: 747,
  name: "Flow EVM",
  network: "flow-evm",
  nativeCurrency: { decimals: 18, name: "Flow", symbol: "FLOW" },
  rpcUrls: {
    default: { http: ["https://mainnet.evm.nodes.onflow.org"] },
    public:  { http: ["https://mainnet.evm.nodes.onflow.org"] },
  },
  blockExplorers: {
    default: { name: "Flow EVM Explorer", url: "https://evm.flowscan.io" },
  },
})

// ─── Custom chain definitions (newer/niche chains not yet in viem/chains) ─────

const berachainMainnet = defineChain({
  id: 80094,
  name: "Berachain",
  network: "berachain",
  nativeCurrency: { decimals: 18, name: "BERA", symbol: "BERA" },
  rpcUrls: {
    default: { http: ["https://rpc.berachain.com"] },
    public:  { http: ["https://rpc.berachain.com"] },
  },
  blockExplorers: {
    default: { name: "Berascan", url: "https://berascan.com" },
  },
})

const sonicMainnet = defineChain({
  id: 146,
  name: "Sonic",
  network: "sonic",
  nativeCurrency: { decimals: 18, name: "Sonic", symbol: "S" },
  rpcUrls: {
    default: { http: ["https://rpc.soniclabs.com"] },
    public:  { http: ["https://rpc.soniclabs.com"] },
  },
  blockExplorers: {
    default: { name: "Sonicscan", url: "https://sonicscan.org" },
  },
})

const unichainMainnet = defineChain({
  id: 130,
  name: "Unichain",
  network: "unichain",
  nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
  rpcUrls: {
    default: { http: ["https://mainnet.unichain.org"] },
    public:  { http: ["https://mainnet.unichain.org"] },
  },
  blockExplorers: {
    default: { name: "Uniscan", url: "https://uniscan.xyz" },
  },
})

const seiEvm = defineChain({
  id: 1329,
  name: "Sei EVM",
  network: "sei-evm",
  nativeCurrency: { decimals: 18, name: "Sei", symbol: "SEI" },
  rpcUrls: {
    default: { http: ["https://evm-rpc.sei-apis.com"] },
    public:  { http: ["https://evm-rpc.sei-apis.com"] },
  },
  blockExplorers: {
    default: { name: "Seitrace", url: "https://seitrace.com" },
  },
})

const modeNetwork = defineChain({
  id: 34443,
  name: "Mode",
  network: "mode",
  nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
  rpcUrls: {
    default: { http: ["https://mainnet.mode.network"] },
    public:  { http: ["https://mainnet.mode.network"] },
  },
  blockExplorers: {
    default: { name: "Mode Explorer", url: "https://explorer.mode.network" },
  },
})

const taikoMainnet = defineChain({
  id: 167000,
  name: "Taiko",
  network: "taiko",
  nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
  rpcUrls: {
    default: { http: ["https://rpc.mainnet.taiko.xyz"] },
    public:  { http: ["https://rpc.mainnet.taiko.xyz"] },
  },
  blockExplorers: {
    default: { name: "Taikoscan", url: "https://taikoscan.io" },
  },
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
    chains: [
      flowEvmTestnet, flowEvmMainnet,
      mainnet, sepolia,
      arbitrum, arbitrumSepolia,
      optimism, optimismSepolia,
      base, baseSepolia,
      polygon, polygonAmoy,
      avalanche, avalancheFuji,
      bsc, bscTestnet,
      blast, blastSepolia,
      scroll, scrollSepolia,
      zksync, zkSyncSepoliaTestnet,
      linea, lineaSepolia,
      mantle,
      berachainMainnet, sonicMainnet, unichainMainnet,
      seiEvm, modeNetwork, taikoMainnet,
    ] as any,
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

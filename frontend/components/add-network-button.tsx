"use client"

import { useState } from "react"
import { Plus } from "lucide-react"

export function AddFlowTestnetButton() {
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const addFlowTestnet = async () => {
    setIsAdding(true)
    setError(null)
    setSuccess(false)

    try {
      if (!window.ethereum) {
        throw new Error("No wallet detected. Please install MetaMask or another Web3 wallet.")
      }

      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0x221', // 545 in hex
          chainName: 'Flow EVM Testnet',
          nativeCurrency: {
            name: 'Flow',
            symbol: 'FLOW',
            decimals: 18
          },
          rpcUrls: ['https://testnet.evm.nodes.onflow.org'],
          blockExplorerUrls: ['https://evm-testnet.flowscan.io']
        }]
      })

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      console.error('Failed to add network:', err)
      if (err.code === 4902) {
        setError("Network already exists in your wallet")
      } else if (err.code === 4001) {
        setError("You rejected the request")
      } else {
        setError(err.message || "Failed to add network")
      }
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={addFlowTestnet}
        disabled={isAdding}
        className="inline-flex items-center gap-2 rounded-full border border-primary/50 bg-primary/20 text-primary px-4 py-2 font-mono text-xs font-semibold hover:bg-primary/30 transition-colors disabled:opacity-50"
      >
        <Plus className="h-3.5 w-3.5" />
        {isAdding ? "Adding..." : "Add Flow EVM Testnet"}
      </button>
      
      {error && (
        <p className="font-mono text-xs text-red-400">{error}</p>
      )}
      
      {success && (
        <p className="font-mono text-xs text-primary">✓ Network added successfully!</p>
      )}
    </div>
  )
}

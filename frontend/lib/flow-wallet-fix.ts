/**
 * Flow Wallet Fix
 * Workaround for Flow Wallet's cross-VM issues
 */

export async function ensureFlowEVMTestnet() {
  if (!window.ethereum) {
    throw new Error("No wallet detected")
  }

  try {
    // First, try to switch to Flow EVM Testnet
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x221' }], // 545 in hex
    })
  } catch (switchError: any) {
    // If the chain doesn't exist, add it
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x221',
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
      } catch (addError) {
        throw new Error("Failed to add Flow EVM Testnet to wallet")
      }
    } else {
      throw switchError
    }
  }
}

export function isFlowWallet(): boolean {
  return !!(window.ethereum && (window.ethereum as any).isFlow)
}

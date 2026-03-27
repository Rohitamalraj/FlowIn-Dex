import * as fcl from "@onflow/fcl";

export const FLOW_EVM_FACTORY =
  process.env.NEXT_PUBLIC_FLOW_EVM_FACTORY ||
  "0x181Ee4a77935f1Ca2EB5E40d34ED1C39f0FF603a";

export const FLOW_EVM_REGISTRY =
  process.env.NEXT_PUBLIC_FLOW_EVM_REGISTRY ||
  "0xd9bcd9b1A4d4b351F3f1961C2A17DC9917167C43";

export const FLOW_EVM_RPC =
  process.env.NEXT_PUBLIC_FLOW_EVM_RPC ||
  "https://testnet.evm.nodes.onflow.org";

/**
 * Flow Client Library Configuration
 * Supports walletless onboarding and account abstraction
 */

const FLOW_TESTNET_CONFIG = {
  "accessNode.api": "https://rest-testnet.onflow.org",
  "discovery.wallet": "https://fcl-discovery.onflow.org/testnet/authn",
  "discovery.authn.endpoint": "https://fcl-discovery.onflow.org/api/testnet/authn",
  "app.detail.title": "IndexForge",
  "app.detail.icon": "https://indexforge.app/logo.png",
  "flow.network": "testnet",
  "0xFungibleToken": "0x9a0766d93b6608b7",
  "0xFlowToken": "0x7e60df042a9c0868",
  "0xIndexForge": "0xYOUR_INDEX_FORGE_ADDRESS", // Update after deployment
  "0xEVM": "0xe467b9dd11fa00df"
};

const FLOW_MAINNET_CONFIG = {
  "accessNode.api": "https://rest-mainnet.onflow.org",
  "discovery.wallet": "https://fcl-discovery.onflow.org/authn",
  "discovery.authn.endpoint": "https://fcl-discovery.onflow.org/api/authn",
  "app.detail.title": "IndexForge",
  "app.detail.icon": "https://indexforge.app/logo.png",
  "flow.network": "mainnet",
  "0xFungibleToken": "0xf233dcee88fe0abe",
  "0xFlowToken": "0x1654653399040a61",
  "0xIndexForge": "0xYOUR_INDEX_FORGE_ADDRESS", // Update after deployment
  "0xEVM": "0xe467b9dd11fa00df"
};

/**
 * Initialize Flow Client Library
 * @param network - "testnet" or "mainnet"
 */
export function initFCL(network: "testnet" | "mainnet" = "testnet") {
  const config = network === "mainnet" ? FLOW_MAINNET_CONFIG : FLOW_TESTNET_CONFIG;

  fcl.config(config);
}

/**
 * Authenticate user with walletless onboarding
 * Supports email, social, and Web3 wallets
 */
export async function authenticate() {
  try {
    const user = await fcl.authenticate();
    return user;
  } catch (error) {
    console.error("Authentication failed:", error);
    throw error;
  }
}

/**
 * Unauthenticate (logout)
 */
export async function unauthenticate() {
  await fcl.unauthenticate();
}

/**
 * Get current user
 */
export function getCurrentUser() {
  return fcl.currentUser;
}

/**
 * Subscribe to authentication state changes
 */
export function onAuthChange(callback: (user: any) => void) {
  return fcl.currentUser.subscribe(callback);
}

/**
 * Execute transaction with optional gas sponsorship
 * @param cadence - Cadence transaction code
 * @param args - Transaction arguments
 * @param sponsor - Optional sponsor address for gas-free transactions
 */
export async function executeTransaction(
  cadence: string,
  args: any[] = [],
  sponsor?: string
) {
  try {
    const transactionId = await fcl.mutate({
      cadence,
      args: (arg: any, t: any) => args,
      payer: sponsor ? fcl.authz : undefined, // Use sponsor if provided
      proposer: fcl.authz,
      authorizations: [fcl.authz],
      limit: 9999,
    });

    console.log("Transaction submitted:", transactionId);

    // Wait for transaction to be sealed
    const transaction = await fcl.tx(transactionId).onceSealed();

    console.log("Transaction sealed:", transaction);

    return transaction;
  } catch (error) {
    console.error("Transaction failed:", error);
    throw error;
  }
}

/**
 * Execute read-only script
 * @param cadence - Cadence script code
 * @param args - Script arguments
 */
export async function executeScript<T = any>(
  cadence: string,
  args: any[] = []
): Promise<T> {
  try {
    const result = await fcl.query({
      cadence,
      args: (arg: any, t: any) => args,
    });

    return result as T;
  } catch (error) {
    console.error("Script execution failed:", error);
    throw error;
  }
}

/**
 * Get user's FLOW balance
 */
export async function getFlowBalance(address: string): Promise<string> {
  const script = `
    import FlowToken from 0xFlowToken
    import FungibleToken from 0xFungibleToken

    pub fun main(address: Address): UFix64 {
      let account = getAccount(address)
      let vaultRef = account.getCapability(/public/flowTokenBalance)
        .borrow<&FlowToken.Vault{FungibleToken.Balance}>()
        ?? panic("Could not borrow Balance reference")

      return vaultRef.balance
    }
  `;

  const balance = await executeScript(script, [fcl.arg(address, fcl.t.Address)]);
  return balance;
}

/**
 * Check if user has IndexDuelCollection set up
 */
export async function hasIndexDuelCollection(address: string): Promise<boolean> {
  const script = `
    import IndexForge from 0xIndexForge

    pub fun main(address: Address): Bool {
      let account = getAccount(address)
      return account
        .getCapability<&IndexForge.IndexDuelCollection{IndexForge.IndexDuelCollectionPublic}>(
          IndexForge.IndexDuelCollectionPublicPath
        )
        .check()
    }
  `;

  const hasCollection = await executeScript(script, [fcl.arg(address, fcl.t.Address)]);
  return hasCollection;
}

/**
 * Get user's duel IDs
 */
export async function getUserDuelIds(address: string): Promise<string[]> {
  const script = `
    import IndexForge from 0xIndexForge

    pub fun main(address: Address): [String] {
      let collection = getAccount(address)
        .getCapability<&IndexForge.IndexDuelCollection{IndexForge.IndexDuelCollectionPublic}>(
          IndexForge.IndexDuelCollectionPublicPath
        )
        .borrow()
        ?? panic("Could not borrow collection")

      return collection.getDuelIds()
    }
  `;

  const duelIds = await executeScript(script, [fcl.arg(address, fcl.t.Address)]);
  return duelIds;
}

/**
 * Get duel information
 */
export async function getDuelInfo(
  address: string,
  duelId: string
): Promise<any> {
  const script = `
    import IndexForge from 0xIndexForge

    pub fun main(address: Address, duelId: String): {String: AnyStruct}? {
      let collection = getAccount(address)
        .getCapability<&IndexForge.IndexDuelCollection{IndexForge.IndexDuelCollectionPublic}>(
          IndexForge.IndexDuelCollectionPublicPath
        )
        .borrow()

      if collection == nil {
        return nil
      }

      let duelRef = collection!.borrowDuel(duelId: duelId)

      if duelRef == nil {
        return nil
      }

      return duelRef!.getInfo()
    }
  `;

  const duelInfo = await executeScript(script, [
    fcl.arg(address, fcl.t.Address),
    fcl.arg(duelId, fcl.t.String),
  ]);

  return duelInfo;
}

// Initialize FCL on import
if (typeof window !== "undefined") {
  initFCL(process.env.NEXT_PUBLIC_FLOW_NETWORK as "testnet" | "mainnet" || "testnet");
}

import { ethers } from 'ethers';

/**
 * OnChainDuelService
 * Interacts with the DuelFactoryOnChain contract for transparent settlement
 */

const FACTORY_ABI = [
  "function createDuel(uint256 entryAmount, uint256 duration, address[] assets, bytes32[] priceIds, uint8[] tiers, string[] symbols) payable returns (bytes32 duelId, address duelAddress)",
  "function getDuelDetails(bytes32 duelId) view returns (address duelAddress)",
  "function getDuelsPaginated(address user, uint256 offset, uint256 limit) view returns (bytes32[] duelIds, address[] duelAddresses)",
  "function getDuelCount() view returns (uint256)",
];

const DUEL_ABI = [
  "function joinDuel() payable",
  "function submitPortfolio(address[] assets, bytes32[] priceIds, uint32[] weights)",
  "function activateDuel()",
  "function lockEndPricesAndSettle()",
  "function executePayout()",
  "function getDuelInfo() view returns (uint8 state, uint256 entryAmount, uint256 duration, uint256 startTime, uint256 endTime, address winner, bool settled, int256 creatorReturn, int256 opponentReturn)",
  "function getCreatorPortfolio() view returns (address participant, address[] assets, bytes32[] priceIds, uint32[] weights, bool submitted, int256 return)",
  "function getOpponentPortfolio() view returns (address participant, address[] assets, bytes32[] priceIds, uint32[] weights, bool submitted, int256 return)",
];

export class OnChainDuelService {
  private provider: ethers.Provider;
  private signer?: ethers.Signer;
  private factoryAddress: string;
  private factoryContract: ethers.Contract;

  constructor(rpcUrl: string, factoryAddress: string, privateKey?: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.factoryAddress = factoryAddress;
    this.factoryContract = new ethers.Contract(factoryAddress, FACTORY_ABI, this.provider);

    if (privateKey) {
      this.signer = new ethers.Wallet(privateKey, this.provider);
      this.factoryContract = this.factoryContract.connect(this.signer) as ethers.Contract;
    }
  }

  /**
   * Create a new on-chain duel
   */
  async createDuel(
    creator: string,
    entryAmount: bigint,
    duration: number,
    assets: string[],
    priceIds: string[],
    tiers: number[], // 0 = TIER_1, 1 = TIER_2
    symbols: string[]
  ): Promise<{ duelId: string; duelAddress: string; txHash: string }> {
    try {
      if (!this.signer) {
        throw new Error("Signer required for creating duels");
      }

      const connectedFactory = this.factoryContract.connect(this.signer) as ethers.Contract;

      const tx = await (connectedFactory as any).createDuel(
        entryAmount,
        duration,
        assets,
        priceIds,
        tiers,
        symbols,
        { value: entryAmount }
      );

      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error("Transaction failed");
      }

      // Parse DuelCreated event
      const iface = new ethers.Interface([
        "event DuelCreated(bytes32 indexed duelId, address indexed duelContract, address indexed creator, uint256 entryAmount, uint256 duration)",
      ]);

      let duelId = "";
      let duelAddress = "";

      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed && parsed.name === "DuelCreated") {
            duelId = parsed.args[0];
            duelAddress = parsed.args[1];
          }
        } catch {}
      }

      if (!duelAddress) {
        throw new Error("DuelCreated event not found in transaction");
      }

      return {
        duelId,
        duelAddress,
        txHash: receipt.hash,
      };
    } catch (error) {
      console.error("Error creating duel:", error);
      throw error;
    }
  }

  /**
   * Join an existing duel
   */
  async joinDuel(duelAddress: string, entryAmount: bigint): Promise<{ txHash: string }> {
    try {
      if (!this.signer) {
        throw new Error("Signer required for joining duels");
      }

      const duelContract = new ethers.Contract(duelAddress, DUEL_ABI, this.signer);
      const tx = await duelContract.joinDuel({ value: entryAmount });
      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error("Transaction failed");
      }

      return { txHash: receipt.hash };
    } catch (error) {
      console.error("Error joining duel:", error);
      throw error;
    }
  }

  /**
   * Submit portfolio for a duel
   */
  async submitPortfolio(
    duelAddress: string,
    assets: string[],
    priceIds: string[],
    weights: number[] // basis points (0-10000)
  ): Promise<{ txHash: string }> {
    try {
      if (!this.signer) {
        throw new Error("Signer required for submitting portfolios");
      }

      const duelContract = new ethers.Contract(duelAddress, DUEL_ABI, this.signer);
      const tx = await duelContract.submitPortfolio(assets, priceIds, weights);
      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error("Transaction failed");
      }

      return { txHash: receipt.hash };
    } catch (error) {
      console.error("Error submitting portfolio:", error);
      throw error;
    }
  }

  /**
   * Get duel details
   */
  async getDuelInfo(duelAddress: string): Promise<any> {
    try {
      const duelContract = new ethers.Contract(duelAddress, DUEL_ABI, this.provider);
      const info = await duelContract.getDuelInfo();

      const stateNames = ["Created", "Joined", "SubmittedBoth", "Active", "Settling", "Settled", "Cancelled"];

      return {
        state: stateNames[info[0]],
        stateCode: info[0],
        entryAmount: info[1].toString(),
        entryAmountFormatted: ethers.formatEther(info[1]),
        duration: info[2].toNumber(),
        startTime: info[3].toNumber(),
        endTime: info[4].toNumber(),
        winner: info[5],
        settled: info[6],
        creatorReturn: info[7].toString(), // basis points
        opponentReturn: info[8].toString(), // basis points
      };
    } catch (error) {
      console.error("Error fetching duel info:", error);
      throw error;
    }
  }

  /**
   * Get creator's portfolio
   */
  async getCreatorPortfolio(duelAddress: string): Promise<any> {
    try {
      const duelContract = new ethers.Contract(duelAddress, DUEL_ABI, this.provider);
      const portfolio = await duelContract.getCreatorPortfolio();

      return {
        participant: portfolio[0],
        assets: portfolio[1],
        priceIds: portfolio[2],
        weights: portfolio[3].map((w: any) => w.toNumber()),
        submitted: portfolio[4],
        return: portfolio[5].toString(),
      };
    } catch (error) {
      console.error("Error fetching creator portfolio:", error);
      throw error;
    }
  }

  /**
   * Get opponent's portfolio
   */
  async getOpponentPortfolio(duelAddress: string): Promise<any> {
    try {
      const duelContract = new ethers.Contract(duelAddress, DUEL_ABI, this.provider);
      const portfolio = await duelContract.getOpponentPortfolio();

      return {
        participant: portfolio[0],
        assets: portfolio[1],
        priceIds: portfolio[2],
        weights: portfolio[3].map((w: any) => w.toNumber()),
        submitted: portfolio[4],
        return: portfolio[5].toString(),
      };
    } catch (error) {
      console.error("Error fetching opponent portfolio:", error);
      throw error;
    }
  }

  /**
   * Activate duel (move to Active state)
   */
  async activateDuel(duelAddress: string): Promise<{ txHash: string }> {
    try {
      if (!this.signer) {
        throw new Error("Signer required for activating duels");
      }

      const duelContract = new ethers.Contract(duelAddress, DUEL_ABI, this.signer);
      const tx = await duelContract.activateDuel();
      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error("Transaction failed");
      }

      return { txHash: receipt.hash };
    } catch (error) {
      console.error("Error activating duel:", error);
      throw error;
    }
  }

  /**
   * Lock end prices and settle duel
   */
  async lockEndPricesAndSettle(duelAddress: string): Promise<{ txHash: string }> {
    try {
      if (!this.signer) {
        throw new Error("Signer required for settling duels");
      }

      const duelContract = new ethers.Contract(duelAddress, DUEL_ABI, this.signer);
      const tx = await duelContract.lockEndPricesAndSettle();
      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error("Transaction failed");
      }

      return { txHash: receipt.hash };
    } catch (error) {
      console.error("Error settling duel:", error);
      throw error;
    }
  }

  /**
   * Execute payout to winner
   */
  async executePayout(duelAddress: string): Promise<{ txHash: string }> {
    try {
      if (!this.signer) {
        throw new Error("Signer required for executing payouts");
      }

      const duelContract = new ethers.Contract(duelAddress, DUEL_ABI, this.signer);
      const tx = await duelContract.executePayout();
      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error("Transaction failed");
      }

      return { txHash: receipt.hash };
    } catch (error) {
      console.error("Error executing payout:", error);
      throw error;
    }
  }

  /**
   * Get user's duels
   */
  async getUserDuels(userAddress: string, offset: number = 0, limit: number = 10): Promise<any[]> {
    try {
      const result = await this.factoryContract.getDuelsPaginated(userAddress, offset, limit);
      return result.duelIds.map((id: string, index: number) => ({
        duelId: id,
        duelAddress: result.duelAddresses[index],
      }));
    } catch (error) {
      console.error("Error fetching user duels:", error);
      throw error;
    }
  }

  /**
   * Get all duels count
   */
  async getDuelCount(): Promise<number> {
    try {
      const count = await this.factoryContract.getDuelCount();
      return count.toNumber();
    } catch (error) {
      console.error("Error fetching duel count:", error);
      throw error;
    }
  }
}

// Singleton instance
let instance: OnChainDuelService | null = null;

export function initializeOnChainDuelService(rpcUrl: string, factoryAddress: string, privateKey?: string) {
  instance = new OnChainDuelService(rpcUrl, factoryAddress, privateKey);
  return instance;
}

export function getOnChainDuelService(): OnChainDuelService {
  if (!instance) {
    const rpcUrl = process.env.FLOW_EVM_RPC_URL || "https://testnet.evm.nodes.onflow.org";
    const factoryAddress = process.env.FLOW_EVM_DUEL_FACTORY;
    if (!factoryAddress) {
      throw new Error("Set FLOW_EVM_DUEL_FACTORY in backend/.env");
    }
    const privateKey = process.env.FLOW_EVM_PRIVATE_KEY;

    instance = new OnChainDuelService(rpcUrl, factoryAddress, privateKey);
  }
  return instance;
}

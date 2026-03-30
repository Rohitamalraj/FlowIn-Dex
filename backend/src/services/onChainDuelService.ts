import { ethers } from 'ethers';

/**
 * OnChainDuelService
 * Interacts with ShieldVaultFactory/ShieldVaultDuel on Flow EVM.
 * Includes compatibility fallbacks for older duel contract shapes.
 */

const FACTORY_ABI = [
  "event DuelCreated(bytes32 indexed duelId, address indexed duelContract, address indexed creator, uint256 entryAmount, uint256 duration)",
  "function createDuel(uint256 entryAmount, uint256 duration, string[] symbols, uint32[] weights) payable returns (bytes32 duelId, address duelAddress)",
  "function createDuel(uint256 entryAmount, uint256 duration, address[] assets, bytes32[] priceIds, uint8[] tiers, string[] symbols) payable returns (bytes32 duelId, address duelAddress)",
  "function getDuelDetails(bytes32 duelId) view returns (address duelAddress)",
  "function getDuelsPaginated(address user, uint256 offset, uint256 limit) view returns (bytes32[] duelIds, address[] duelAddresses)",
  "function getAllDuelsPaginated(uint256 offset, uint256 limit) view returns (bytes32[] duelIds, address[] duelAddresses)",
  "function getDuelCount() view returns (uint256)",
];

const DUEL_ABI = [
  "function joinDuel() payable",
  "function joinDuel(string[] symbols, uint32[] weights) payable",
  "function submitPortfolio(address[] assets, bytes32[] priceIds, uint32[] weights)",
  "function activateDuel()",
  "function lockEndPricesAndSettle()",
  "function settle(int256[] creatorPrices, int256[] opponentPrices, int256[] creatorStartPrices, int256[] opponentStartPrices)",
  "function executePayout()",
  "function splitTie()",
  "function splitTieWinnings()",
  "function getDuelInfo() view returns (uint8 state, uint256 entryAmount, uint256 duration, uint256 startTime, uint256 endTime, address winner, bool settled, int256 creatorReturn, int256 opponentReturn)",
  "function getCreatorPortfolio() view returns (address participant, string[] symbols, uint32[] weights, bool submitted)",
  "function getOpponentPortfolio() view returns (address participant, string[] symbols, uint32[] weights, bool submitted)",
];

export class OnChainDuelService {
  private provider: ethers.Provider;
  private signer?: ethers.Signer;
  private factoryAddress: string;
  private factoryContract: ethers.Contract;

  /** Permanent cache: duelId → createdAt timestamp (never changes) */
  private createdAtCache = new Map<string, number>();
  /** Permanent cache: duelAddress → creator portfolio (immutable once submitted) */
  private creatorPortfolioCache = new Map<string, any>();
  /** Permanent cache: duelAddress → opponent portfolio (immutable once submitted) */
  private opponentPortfolioCache = new Map<string, any>();

  /** Retry a fn up to maxAttempts on TIMEOUT or rate-limit errors */
  private async withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
    let lastErr: any;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        lastErr = err;
        const msg = String(err?.code || err?.message || '');
        const isTransient = /TIMEOUT|timeout|-32007|rate.limit/i.test(msg);
        if (!isTransient || attempt === maxAttempts) throw err;
        await new Promise(r => setTimeout(r, 300 * attempt));
      }
    }
    throw lastErr;
  }

  constructor(rpcUrl: string, factoryAddress: string, privateKey?: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.factoryAddress = factoryAddress;
    this.factoryContract = new ethers.Contract(factoryAddress, FACTORY_ABI, this.provider);

    if (privateKey) {
      this.signer = new ethers.Wallet(privateKey, this.provider);
      this.factoryContract = this.factoryContract.connect(this.signer) as ethers.Contract;
    }
  }

  isSignerAvailable(): boolean {
    return Boolean(this.signer);
  }

  async getContractBalance(contractAddress: string): Promise<bigint> {
    return this.provider.getBalance(contractAddress);
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
    symbols: string[],
    weights: number[] = []
  ): Promise<{ duelId: string; duelAddress: string; txHash: string }> {
    try {
      if (!this.signer) {
        throw new Error("Signer required for creating duels");
      }

      const connectedFactory = this.factoryContract.connect(this.signer) as ethers.Contract;

      const normalizedWeights =
        weights.length === symbols.length
          ? weights.map((w) => Number(w))
          : symbols.map((_, i) =>
              i === symbols.length - 1
                ? 10000 - Math.floor(10000 / Math.max(symbols.length, 1)) * (symbols.length - 1)
                : Math.floor(10000 / Math.max(symbols.length, 1))
            );

      let tx: ethers.ContractTransactionResponse;
      try {
        tx = await (connectedFactory as any).createDuel(
          entryAmount,
          duration,
          symbols,
          normalizedWeights,
          { value: entryAmount }
        );
      } catch (createErr: any) {
        const message = createErr?.shortMessage || createErr?.message || "";
        if (!this.isSelectorMismatch(message)) {
          throw createErr;
        }

        tx = await (connectedFactory as any).createDuel(
          entryAmount,
          duration,
          assets,
          priceIds,
          tiers,
          symbols,
          { value: entryAmount }
        );
      }

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
  async joinDuel(
    duelAddress: string,
    entryAmount: bigint,
    symbols: string[] = [],
    weights: number[] = []
  ): Promise<{ txHash: string }> {
    try {
      if (!this.signer) {
        throw new Error("Signer required for joining duels");
      }

      const duelContract = new ethers.Contract(duelAddress, DUEL_ABI, this.signer);

      let tx: ethers.ContractTransactionResponse;
      try {
        tx = await duelContract.joinDuel({ value: entryAmount });
      } catch (joinErr: any) {
        const message = joinErr?.shortMessage || joinErr?.message || "";
        if (!this.isSelectorMismatch(message)) {
          throw joinErr;
        }

        if (symbols.length === 0 || symbols.length !== weights.length) {
          throw new Error("joinDuel fallback requires symbols and matching weights");
        }

        tx = await duelContract.joinDuel(symbols, weights.map((w: number) => Number(w)), { value: entryAmount });
      }

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
      const info = await this.withRetry(() => duelContract.getDuelInfo());
      const creatorPort = await this.withRetry(() => duelContract.getCreatorPortfolio()).catch(() => null);
      const opponentPort = await this.withRetry(() => duelContract.getOpponentPortfolio()).catch(() => null);

      const stateCode = Number(info[0]);
      const startTime = Number(info[3]);
      const endTime = Number(info[4]);
      const settled = Boolean(info[6]);

      const creatorAddress = creatorPort && creatorPort[0] !== "0x0000000000000000000000000000000000000000" ? creatorPort[0] : "0x";
      const opponentAddress = opponentPort && opponentPort[0] !== "0x0000000000000000000000000000000000000000" ? opponentPort[0] : null;

      return {
        state: this.mapState(stateCode, startTime, endTime, settled),
        stateCode,
        entryAmount: info[1].toString(),
        entryAmountFormatted: ethers.formatEther(info[1]),
        duration: Number(info[2]),
        startTime,
        endTime,
        winner: info[5] !== "0x0000000000000000000000000000000000000000" ? info[5] : null,
        settled,
        creatorReturn: info[7].toString(), // basis points
        opponentReturn: info[8].toString(), // basis points
        creator: creatorAddress,
        opponent: opponentAddress,
        assetUniverse: creatorPort ? creatorPort[1].map((s: any) => String(s)) : [],
      };
    } catch (error) {
      console.error("Error fetching duel info:", error);
      throw error;
    }
  }

  /**
   * Get creator's portfolio (cached permanently once submitted)
   */
  async getCreatorPortfolio(duelAddress: string): Promise<any> {
    const cached = this.creatorPortfolioCache.get(duelAddress);
    if (cached) return cached;
    try {
      const duelContract = new ethers.Contract(duelAddress, DUEL_ABI, this.provider);
      const portfolio = await this.withRetry(() => duelContract.getCreatorPortfolio());

      const result = {
        participant: portfolio[0],
        symbols: portfolio[1],
        priceIds: [], // deprecated
        weights: portfolio[2].map((w: any) => Number(w)),
        submitted: portfolio[3],
        return: "0",
      };
      if (result.submitted) this.creatorPortfolioCache.set(duelAddress, result);
      return result;
    } catch (error) {
      console.error("Error fetching creator portfolio:", error);
      throw error;
    }
  }

  /**
   * Get opponent's portfolio (cached permanently once submitted)
   */
  async getOpponentPortfolio(duelAddress: string): Promise<any> {
    const cached = this.opponentPortfolioCache.get(duelAddress);
    if (cached) return cached;
    try {
      const duelContract = new ethers.Contract(duelAddress, DUEL_ABI, this.provider);
      const portfolio = await this.withRetry(() => duelContract.getOpponentPortfolio());

      const result = {
        participant: portfolio[0],
        symbols: portfolio[1],
        priceIds: [], // deprecated
        weights: portfolio[2].map((w: any) => Number(w)),
        submitted: portfolio[3],
        return: "0",
      };
      if (result.submitted) this.opponentPortfolioCache.set(duelAddress, result);
      return result;
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

  async settleDuel(
    duelAddress: string,
    creatorPrices: bigint[],
    opponentPrices: bigint[],
    creatorStartPrices: bigint[],
    opponentStartPrices: bigint[]
  ): Promise<{ txHash: string; method: 'settle' | 'lockEndPricesAndSettle' }> {
    try {
      if (!this.signer) {
        throw new Error("Signer required for settling duels");
      }

      const duelContract = new ethers.Contract(duelAddress, DUEL_ABI, this.signer);

      try {
        const tx = await duelContract.settle(
          creatorPrices,
          opponentPrices,
          creatorStartPrices,
          opponentStartPrices
        );
        const receipt = await tx.wait();
        if (!receipt) {
          throw new Error("Settlement transaction failed");
        }

        return { txHash: receipt.hash, method: 'settle' };
      } catch (settleErr: any) {
        const message = settleErr?.shortMessage || settleErr?.message || "";
        if (!this.isSelectorMismatch(message)) {
          throw settleErr;
        }

        const tx = await duelContract.lockEndPricesAndSettle();
        const receipt = await tx.wait();
        if (!receipt) {
          throw new Error("Settlement transaction failed");
        }

        return { txHash: receipt.hash, method: 'lockEndPricesAndSettle' };
      }
    } catch (error) {
      console.error("Error settling duel:", error);
      throw error;
    }
  }

  async splitTie(duelAddress: string): Promise<{ txHash: string; method: 'splitTie' | 'splitTieWinnings' }> {
    try {
      if (!this.signer) {
        throw new Error("Signer required for split payout");
      }

      const duelContract = new ethers.Contract(duelAddress, DUEL_ABI, this.signer);

      try {
        const tx = await duelContract.splitTie();
        const receipt = await tx.wait();

        if (!receipt) {
          throw new Error("Split payout transaction failed");
        }

        return { txHash: receipt.hash, method: 'splitTie' };
      } catch (splitErr: any) {
        const message = splitErr?.shortMessage || splitErr?.message || "";
        if (!this.isSelectorMismatch(message)) {
          throw splitErr;
        }

        const tx = await duelContract.splitTieWinnings();
        const receipt = await tx.wait();

        if (!receipt) {
          throw new Error("Split payout transaction failed");
        }

        return { txHash: receipt.hash, method: 'splitTieWinnings' };
      }
    } catch (error) {
      console.error("Error executing split payout:", error);
      throw error;
    }
  }

  async executePayoutOrSplitTie(
    duelAddress: string,
    winner: string | null
  ): Promise<{ txHash: string; method: 'executePayout' | 'splitTie' | 'splitTieWinnings' }> {
    if (!winner || winner === ethers.ZeroAddress) {
      return this.splitTie(duelAddress);
    }

    const result = await this.executePayout(duelAddress);
    return { txHash: result.txHash, method: 'executePayout' };
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
      // Ethers v6 result array
      const duelIds = result[0] || [];
      const duelAddresses = result[1] || [];
      return duelIds.map((id: string, index: number) => ({
        duelId: id,
        duelAddress: duelAddresses[index],
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
      return Number(count);
    } catch (error) {
      console.error("Error fetching duel count:", error);
      throw error;
    }
  }

  /**
   * Get all duels across the platform
   */
  async getAllDuels(offset: number = 0, limit: number = 50): Promise<any[]> {
    try {
      const result = await this.factoryContract.getAllDuelsPaginated(offset, limit);
      const duelIds = result[0] || [];
      const duelAddresses = result[1] || [];
      return duelIds.map((id: string, index: number) => ({
        duelId: id,
        duelAddress: duelAddresses[index],
      }));
    } catch (error) {
      console.error("Error fetching all duels:", error);
      throw error;
    }
  }

  /**
   * Resolve a duel address from a duelId.
   */
  async getDuelAddress(duelId: string): Promise<string | null> {
    try {
      const duelAddress = await this.factoryContract.getDuelDetails(duelId);
      if (!duelAddress || duelAddress === ethers.ZeroAddress) {
        return null;
      }
      return duelAddress;
    } catch {
      return null;
    }
  }

  /**
   * Fetch duel creation timestamp from DuelCreated event block (cached permanently).
   */
  async getDuelCreatedAt(duelId: string): Promise<number | null> {
    const cached = this.createdAtCache.get(duelId);
    if (cached !== undefined) return cached;
    try {
      const filter = this.factoryContract.filters.DuelCreated(duelId);
      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 500_000);
      const logs = await this.factoryContract.queryFilter(filter, fromBlock, "latest");
      if (!logs.length) {
        return null;
      }

      const block = await this.provider.getBlock(logs[0].blockNumber);
      const ts = block ? Number(block.timestamp) : null;
      if (ts) this.createdAtCache.set(duelId, ts);
      return ts;
    } catch {
      return null;
    }
  }

  private isSelectorMismatch(message: string): boolean {
    return /missing revert data|function selector|not recognized|no data present/i.test(message);
  }

  private mapState(stateCode: number, startTime: number, endTime: number, settled: boolean): string {
    if (stateCode === 0) return "Created";
    if (stateCode === 1) return "Joined";
    if (stateCode === 2) return endTime > 0 ? "Active" : "SubmittedBoth";
    if (stateCode === 3) {
      if (settled) return "Settled";
      return endTime > 0 ? "Active" : "Settling";
    }
    if (stateCode === 4) {
      if (settled) return "Settled";
      return startTime > 0 || endTime > 0 ? "Cancelled" : "Settling";
    }
    if (stateCode === 5) return "Settled";
    if (stateCode === 6) return "Cancelled";
    return "Unknown";
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

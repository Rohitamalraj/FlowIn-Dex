import { ethers } from 'ethers';
import NodeCache from 'node-cache';

/**
 * Event Indexer Service
 * Listens to blockchain events and indexes duel states
 */
export class EventIndexer {
  private static instance: EventIndexer;
  private provider: ethers.JsonRpcProvider;
  private duelFactoryContract: ethers.Contract;
  private duelCache: NodeCache;
  private isRunning: boolean = false;

  // ABI snippets for event listening
  private readonly DUEL_FACTORY_ABI = [
    'event DuelCreated(bytes32 indexed duelId, address indexed duelContract, address indexed creator, uint256 entryAmount, uint256 duration)',
    'function getDuelAddress(bytes32 duelId) view returns (address)',
    'function getDuelDetails(bytes32 duelId) view returns (bool exists, address duelAddress, uint8 duelState, address creator, address opponent, address winner)'
  ];

  private readonly DUEL_ABI = [
    'event DuelJoined(bytes32 indexed duelId, address indexed opponent)',
    'event WeightsSubmitted(bytes32 indexed duelId, address indexed participant)',
    'event DuelLocked(bytes32 indexed duelId, uint256 startTime, uint256 endTime)',
    'event SettlementStarted(bytes32 indexed duelId)',
    'event WinnerDecrypted(bytes32 indexed duelId, address indexed winner)',
    'event PayoutExecuted(bytes32 indexed duelId, address indexed winner, uint256 amount)',
    'event DuelCancelled(bytes32 indexed duelId)',
    'function getDuelInfo() view returns (uint8 currentState, address creatorAddr, address opponentAddr, uint256 entryAmount, uint256 startTime, uint256 endTime, address winnerAddr)'
  ];

  private constructor() {
    const rpcUrl = process.env.FLOW_EVM_RPC_URL || process.env.ZAMA_RPC_URL || 'https://testnet.evm.nodes.onflow.org';
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    const factoryAddress = process.env.FLOW_EVM_DUEL_FACTORY;
    if (!factoryAddress) {
      throw new Error('FLOW_EVM_DUEL_FACTORY not set in environment');
    }

    this.duelFactoryContract = new ethers.Contract(
      factoryAddress,
      this.DUEL_FACTORY_ABI,
      this.provider
    );

    // Cache with 5 minute TTL
    const cacheTTL = parseInt(process.env.DUEL_CACHE_TTL || '300');
    this.duelCache = new NodeCache({ stdTTL: cacheTTL, checkperiod: 120 });
  }

  public static getInstance(): EventIndexer {
    if (!EventIndexer.instance) {
      EventIndexer.instance = new EventIndexer();
    }
    return EventIndexer.instance;
  }

  /**
   * Start listening to events
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log('  ⚠️  Event indexer already running');
      return;
    }

    console.log('  📡 Starting event listeners...');

    // Listen to DuelCreated events
    this.duelFactoryContract.on('DuelCreated', async (duelId, duelContract, creator, entryAmount, duration, event) => {
      console.log(`\n🆕 New Duel Created:`);
      console.log(`  Duel ID: ${duelId}`);
      console.log(`  Contract: ${duelContract}`);
      console.log(`  Creator: ${creator}`);
      console.log(`  Entry: ${ethers.formatEther(entryAmount)} ETH`);

      await this.indexDuel(duelId, duelContract);
    });

    console.log('  ✅ Event listeners active');
    this.isRunning = true;
  }

  /**
   * Stop listening to events
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('Stopping event indexer...');
    this.duelFactoryContract.removeAllListeners();
    this.isRunning = false;
    console.log('Event indexer stopped');
  }

  /**
   * Index a duel and its events
   * @param duelId Duel identifier
   * @param duelAddress Duel contract address
   */
  private async indexDuel(duelId: string, duelAddress: string): Promise<void> {
    try {
      const duelContract = new ethers.Contract(duelAddress, this.DUEL_ABI, this.provider);

      // Get current duel info
      const duelInfo = await duelContract.getDuelInfo();

      const indexedDuel: IndexedDuel = {
        duelId,
        duelAddress,
        state: this.mapDuelState(Number(duelInfo.currentState)),
        creator: duelInfo.creatorAddr,
        opponent: duelInfo.opponentAddr !== ethers.ZeroAddress ? duelInfo.opponentAddr : null,
        entryAmount: duelInfo.entryAmount.toString(),
        startTime: duelInfo.startTime !== 0n ? Number(duelInfo.startTime) : null,
        endTime: duelInfo.endTime !== 0n ? Number(duelInfo.endTime) : null,
        winner: duelInfo.winnerAddr !== ethers.ZeroAddress ? duelInfo.winnerAddr : null,
        lastUpdated: Date.now()
      };

      // Cache the duel
      this.duelCache.set(duelId, indexedDuel);

      // Set up event listeners for this specific duel
      this.setupDuelEventListeners(duelId, duelContract);

    } catch (error) {
      console.error(`Error indexing duel ${duelId}:`, error);
    }
  }

  /**
   * Set up event listeners for individual duel contract
   */
  private setupDuelEventListeners(duelId: string, duelContract: ethers.Contract): void {
    duelContract.on('DuelJoined', async (eventDuelId, opponent) => {
      console.log(`\n👥 Duel Joined: ${duelId.slice(0, 10)}...`);
      console.log(`  Opponent: ${opponent}`);
      await this.updateDuelCache(duelId, duelContract);
    });

    duelContract.on('WeightsSubmitted', async (eventDuelId, participant) => {
      console.log(`\n⚖️  Weights Submitted: ${duelId.slice(0, 10)}...`);
      console.log(`  Participant: ${participant}`);
      await this.updateDuelCache(duelId, duelContract);
    });

    duelContract.on('DuelLocked', async (eventDuelId, startTime, endTime) => {
      console.log(`\n🔒 Duel Locked: ${duelId.slice(0, 10)}...`);
      console.log(`  Start: ${new Date(Number(startTime) * 1000).toISOString()}`);
      console.log(`  End: ${new Date(Number(endTime) * 1000).toISOString()}`);
      await this.updateDuelCache(duelId, duelContract);
    });

    duelContract.on('WinnerDecrypted', async (eventDuelId, winner) => {
      console.log(`\n🏆 Winner Decrypted: ${duelId.slice(0, 10)}...`);
      console.log(`  Winner: ${winner}`);
      await this.updateDuelCache(duelId, duelContract);
    });

    duelContract.on('DuelCancelled', async (eventDuelId) => {
      console.log(`\n❌ Duel Cancelled: ${duelId.slice(0, 10)}...`);
      await this.updateDuelCache(duelId, duelContract);
    });
  }

  /**
   * Update duel cache with latest info
   */
  private async updateDuelCache(duelId: string, duelContract: ethers.Contract): Promise<void> {
    try {
      const duelInfo = await duelContract.getDuelInfo();
      const duelAddress = await duelContract.getAddress();

      const indexedDuel: IndexedDuel = {
        duelId,
        duelAddress,
        state: this.mapDuelState(Number(duelInfo.currentState)),
        creator: duelInfo.creatorAddr,
        opponent: duelInfo.opponentAddr !== ethers.ZeroAddress ? duelInfo.opponentAddr : null,
        entryAmount: duelInfo.entryAmount.toString(),
        startTime: duelInfo.startTime !== 0n ? Number(duelInfo.startTime) : null,
        endTime: duelInfo.endTime !== 0n ? Number(duelInfo.endTime) : null,
        winner: duelInfo.winnerAddr !== ethers.ZeroAddress ? duelInfo.winnerAddr : null,
        lastUpdated: Date.now()
      };

      this.duelCache.set(duelId, indexedDuel);
    } catch (error) {
      console.error(`Error updating duel cache for ${duelId}:`, error);
    }
  }

  /**
   * Get indexed duel data
   * @param duelId Duel identifier
   * @returns Indexed duel data or null
   */
  public async getDuel(duelId: string): Promise<IndexedDuel | null> {
    // Check cache first
    const cachedDuel = this.duelCache.get<IndexedDuel>(duelId);
    if (cachedDuel) {
      return cachedDuel;
    }

    // Fetch from blockchain if not cached
    try {
      const duelAddress = await this.duelFactoryContract.getDuelAddress(duelId);
      if (duelAddress === ethers.ZeroAddress) {
        return null;
      }

      await this.indexDuel(duelId, duelAddress);
      return this.duelCache.get<IndexedDuel>(duelId) || null;
    } catch (error) {
      console.error(`Error fetching duel ${duelId}:`, error);
      return null;
    }
  }

  /**
   * Clear duel cache
   */
  public clearCache(): void {
    this.duelCache.flushAll();
  }

  /**
   * Map numeric state to string
   */
  private mapDuelState(state: number): DuelState {
    const states: DuelState[] = ['Created', 'Joined', 'Locked', 'Settling', 'Settled', 'Cancelled'];
    return states[state] || 'Unknown';
  }
}

/**
 * Indexed duel data interface
 */
export interface IndexedDuel {
  duelId: string;
  duelAddress: string;
  state: DuelState;
  creator: string;
  opponent: string | null;
  entryAmount: string;
  startTime: number | null;
  endTime: number | null;
  winner: string | null;
  lastUpdated: number;
}

export type DuelState = 'Created' | 'Joined' | 'Locked' | 'Settling' | 'Settled' | 'Cancelled' | 'Unknown';

import { parseAbi } from "viem"

export const FACTORY_ABI = parseAbi([
  // DuelFactoryOnChain / DuelFactory
  "function createDuel(uint256 entryAmount, uint256 duration, address[] assets, bytes32[] priceIds, uint8[] tiers, string[] symbols) payable returns (bytes32 duelId, address duelAddress)",
  // FlowIn-Dex legacy factory
  "function createDuel(uint256 entryAmount, uint256 duration, string[] symbols, uint32[] weights) payable returns (bytes32 duelId, address duelAddress)",
  "function getDuelDetails(bytes32 duelId) view returns (address duelAddress)",
  "function getDuelsPaginated(address user, uint256 offset, uint256 limit) view returns (bytes32[] duelIds, address[] duelAddresses)",
  "function getAllDuelsPaginated(uint256 offset, uint256 limit) view returns (bytes32[] duelIds, address[] duelAddresses)",
  "function getDuelCount() view returns (uint256)",
  "event DuelCreated(bytes32 indexed duelId, address indexed duelContract, address indexed creator, uint256 entryAmount, uint256 duration)",
])

export const DUEL_ABI = parseAbi([
  // DuelOnChain / Duel
  "function joinDuel() payable",
  // FlowIn-Dex legacy duel
  "function joinDuel(string[] symbols, uint32[] weights) payable",
  "function submitPortfolio(address[] assets, bytes32[] priceIds, uint32[] weights)",
  "function activateDuel()",
  "function lockStartPrices()",
  "function lockEndPricesAndSettle()",
  "function settle(int256[] creatorPrices, int256[] opponentPrices, int256[] creatorStartPrices, int256[] opponentStartPrices)",
  "function executePayout()",
  "function splitTie()",
  "function splitTieWinnings()",
  "function getDuelInfo() view returns (uint8 state, uint256 entryAmount, uint256 duration, uint256 startTime, uint256 endTime, address winner, bool settled, int256 creatorReturn, int256 opponentReturn)",
  "function getPreciseReturns() view returns (int256 creatorReturnPrecise, int256 opponentReturnPrecise)",
])

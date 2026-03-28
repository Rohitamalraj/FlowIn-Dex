import { DuelStatus, type Duel } from "./duel-types"

const NOW = new Date()
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000)
const hoursFromNow = (h: number) => new Date(NOW.getTime() + h * 3_600_000)

export const MOCK_DUELS: Duel[] = [
  // ── OPEN ──────────────────────────────────────────────────────────────────
  {
    id: "1",
    status: DuelStatus.OPEN,
    creator: { address: "0xA1B2C3D4E5F67890123456789012345678901234", hasSubmitted: true },
    assetUniverse: ["BTC", "ETH", "SOL"],
    entryAmountEth: 0.05,
    durationSeconds: 86400,
    createdAt: hoursAgo(2),
  },
  {
    id: "2",
    status: DuelStatus.OPEN,
    creator: { address: "0xD4E5F67890123456789012345678901234A1B2C3", hasSubmitted: true },
    assetUniverse: ["BTC", "ETH", "SOL", "BNB", "USDC"],
    entryAmountEth: 0.2,
    durationSeconds: 259200,
    createdAt: hoursAgo(5),
  },
  {
    id: "3",
    status: DuelStatus.OPEN,
    creator: { address: "0xF00DFACE1234567890ABCDEF0987654321DEADBE", hasSubmitted: true },
    assetUniverse: ["BTC", "ETH"],
    entryAmountEth: 0.01,
    durationSeconds: 3600,
    createdAt: hoursAgo(0.5),
  },

  // ── JOINED ─────────────────────────────────────────────────────────────────
  {
    id: "4",
    status: DuelStatus.JOINED,
    creator:  { address: "0xAABBCCDD1122334455667788990011223344AABB", hasSubmitted: true },
    opponent: { address: "0x1234567890ABCDEF1234567890ABCDEF12345678", hasSubmitted: false },
    assetUniverse: ["BTC", "ETH", "SOL"],
    entryAmountEth: 0.1,
    durationSeconds: 172800,
    createdAt: hoursAgo(12),
  },

  // ── LOCKED ─────────────────────────────────────────────────────────────────
  {
    id: "5",
    status: DuelStatus.LOCKED,
    creator:  { address: "0xBEEFCAFE1234567890BEEF1234567890BEEFCAFE", hasSubmitted: true },
    opponent: { address: "0xDEADC0DE1234567890DEAD1234567890DEADC0DE", hasSubmitted: true },
    assetUniverse: ["BTC", "ETH", "SOL", "BNB"],
    entryAmountEth: 0.25,
    durationSeconds: 86400,
    createdAt: hoursAgo(30),
    startTime: hoursAgo(6),
    endTime: hoursFromNow(18),
  },
  {
    id: "6",
    status: DuelStatus.LOCKED,
    creator:  { address: "0x9876543210FEDCBA9876543210FEDCBA98765432", hasSubmitted: true },
    opponent: { address: "0x0123456789ABCDEF0123456789ABCDEF01234567", hasSubmitted: true },
    assetUniverse: ["BTC", "ETH", "USDC"],
    entryAmountEth: 0.05,
    durationSeconds: 43200,
    createdAt: hoursAgo(20),
    startTime: hoursAgo(8),
    endTime: hoursFromNow(4),
  },

  // ── SETTLING ──────────────────────────────────────────────────────────────
  {
    id: "7",
    status: DuelStatus.SETTLING,
    creator:  { address: "0xE1F2A3B4C5D67890E1F2A3B4C5D6789012345678", hasSubmitted: true },
    opponent: { address: "0x123456789ABCDEF1234567890ABCDEF123456789", hasSubmitted: true },
    assetUniverse: ["BTC", "ETH", "SOL"],
    entryAmountEth: 0.1,
    durationSeconds: 86400,
    createdAt: hoursAgo(50),
    startTime: hoursAgo(26),
    endTime: hoursAgo(2),
  },

  // ── SETTLED ───────────────────────────────────────────────────────────────
  {
    id: "8",
    status: DuelStatus.SETTLED,
    creator:  { address: "0xAAAAAAAABBBBBBBBCCCCCCCCDDDDDDDD00001111", hasSubmitted: true, isWinner: false },
    opponent: { address: "0x1111222233334444555566667777888899990000", hasSubmitted: true, isWinner: true },
    assetUniverse: ["BTC", "ETH", "SOL", "BNB"],
    entryAmountEth: 0.3,
    durationSeconds: 172800,
    createdAt: hoursAgo(100),
    startTime: hoursAgo(72),
    endTime: hoursAgo(24),
    winnerAddress: "0x1111222233334444555566667777888899990000",
    scoreDelta: 7.34,
    settlementTxHash: "0xabc123def456789abc123def456789abc123def456789abc123def456789abc1",
  },
  {
    id: "9",
    status: DuelStatus.SETTLED,
    creator:  { address: "0xFEDCBA9876543210FEDCBA9876543210FEDCBA98", hasSubmitted: true, isWinner: true },
    opponent: { address: "0x0987654321FEDCBA0987654321FEDCBA09876543", hasSubmitted: true, isWinner: false },
    assetUniverse: ["BTC", "USDC"],
    entryAmountEth: 0.05,
    durationSeconds: 3600,
    createdAt: hoursAgo(48),
    startTime: hoursAgo(40),
    endTime: hoursAgo(39),
    winnerAddress: "0xFEDCBA9876543210FEDCBA9876543210FEDCBA98",
    scoreDelta: 2.11,
    settlementTxHash: "0xdef456789abc123def456789abc123def456789abc123def456789abc123def4",
  },

  // ── CANCELLED ─────────────────────────────────────────────────────────────
  {
    id: "10",
    status: DuelStatus.CANCELLED,
    creator: { address: "0x00112233445566778899AABBCCDDEEFF00112233", hasSubmitted: true },
    assetUniverse: ["BTC", "ETH"],
    entryAmountEth: 0.5,
    durationSeconds: 86400,
    createdAt: hoursAgo(96),
  },
]

export function getDuelById(id: string): Duel | undefined {
  return MOCK_DUELS.find((d) => d.id === id)
}

export function getOpenDuels(): Duel[] {
  return MOCK_DUELS.filter((d) => d.status === DuelStatus.OPEN)
}

export function getActiveDuels(): Duel[] {
  return MOCK_DUELS.filter((d) =>
    [DuelStatus.JOINED, DuelStatus.LOCKED, DuelStatus.SETTLING].includes(d.status)
  )
}

export function getSettledDuels(): Duel[] {
  return MOCK_DUELS.filter((d) => d.status === DuelStatus.SETTLED)
}

// Simulate "my duels" by picking some from the mock dataset
export const MY_ADDRESS = "0xBEEFCAFE1234567890BEEF1234567890BEEFCAFE"

export function getMyDuels(): Duel[] {
  return MOCK_DUELS.filter(
    (d) =>
      d.creator.address === MY_ADDRESS ||
      d.opponent?.address === MY_ADDRESS
  )
}

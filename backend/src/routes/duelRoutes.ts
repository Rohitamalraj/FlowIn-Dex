import { Router, Request, Response } from 'express';
import { getOnChainDuelService } from '../services/onChainDuelService';
import { PythPriceService } from '../services/pythPriceService';
import { ethers } from 'ethers';

export const duelRoutes = Router();

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const PRICE_SCALE = 100_000_000;

function normalizeSymbol(symbol: string): string {
  return String(symbol || '').trim().toUpperCase();
}

function toScaledPrice(price: number, symbol: string, stage: 'start' | 'end'): bigint {
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`Invalid ${stage} price for ${symbol}`);
  }
  return BigInt(Math.round(price * PRICE_SCALE));
}

async function buildSettlementPayload(service: any, duelAddress: string) {
  const info = await service.getDuelInfo(duelAddress);
  const startTime = Number(info?.startTime || 0);
  if (!Number.isFinite(startTime) || startTime <= 0) {
    throw new Error('Duel start time is not available for settlement');
  }

  const creatorPortfolio = await service.getCreatorPortfolio(duelAddress);
  const opponentPortfolio = await service.getOpponentPortfolio(duelAddress);

  const creatorSymbols = (creatorPortfolio?.symbols || []).map(normalizeSymbol);
  const opponentSymbols = (opponentPortfolio?.symbols || []).map(normalizeSymbol);

  if (!creatorSymbols.length || !opponentSymbols.length) {
    throw new Error('Both portfolios must be available before settlement');
  }

  const uniqueSymbols = Array.from(new Set([...creatorSymbols, ...opponentSymbols]));
  const pythService = PythPriceService.getInstance();

  const [startPrices, endPrices] = await Promise.all([
    pythService.getPricesAt(uniqueSymbols, startTime),
    pythService.getPricesLive(uniqueSymbols),
  ]);

  const getScaled = (symbol: string, stage: 'start' | 'end'): bigint => {
    const source = stage === 'start' ? startPrices : endPrices;
    const price = Number(source.get(symbol)?.formattedPrice || 0);
    return toScaledPrice(price, symbol, stage);
  };

  return {
    info,
    creatorEndPrices: creatorSymbols.map((s: string) => getScaled(s, 'end')),
    opponentEndPrices: opponentSymbols.map((s: string) => getScaled(s, 'end')),
    creatorStartPrices: creatorSymbols.map((s: string) => getScaled(s, 'start')),
    opponentStartPrices: opponentSymbols.map((s: string) => getScaled(s, 'start')),
  };
}

async function autoFinalizeDuel(service: any, duelAddress: string) {
  const now = Math.floor(Date.now() / 1000);
  let info = await service.getDuelInfo(duelAddress);
  let settleResult: { txHash: string; method: string } | null = null;
  let payoutResult: { txHash: string; method: string } | null = null;

  const hasOpponent = Boolean(info?.opponent && info.opponent !== ZERO_ADDRESS);
  const hasEnded = Number(info?.endTime || 0) > 0 && now >= Number(info.endTime);

  if (hasOpponent && hasEnded && !info?.settled) {
    const payload = await buildSettlementPayload(service, duelAddress);
    settleResult = await service.settleDuel(
      duelAddress,
      payload.creatorEndPrices,
      payload.opponentEndPrices,
      payload.creatorStartPrices,
      payload.opponentStartPrices
    );
    info = await service.getDuelInfo(duelAddress);
  }

  const escrowBalance = await service.getContractBalance(duelAddress);
  if (info?.settled && escrowBalance > 0n) {
    payoutResult = await service.executePayoutOrSplitTie(duelAddress, info.winner || null);
    info = await service.getDuelInfo(duelAddress);
  }

  return {
    info,
    hasOpponent,
    hasEnded,
    settleResult,
    payoutResult,
  };
}

/**
 * GET /api/duels/
 * Get all duels across the platform.
 */
duelRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const { offset = 0, limit = 50 } = req.query;
    const service = getOnChainDuelService();
    const duels = await service.getAllDuels(Number(offset), Number(limit));

    const fullDuels = await Promise.all(
      duels.map(async (d: any) => {
        try {
          const [info, createdAt] = await Promise.all([
            service.getDuelInfo(d.duelAddress),
            service.getDuelCreatedAt(d.duelId),
          ]);

          return {
            duelId: d.duelId,
            duelAddress: d.duelAddress,
            createdAt,
            ...info,
          };
        } catch {
          return null;
        }
      })
    );

    const filtered = fullDuels.filter((d) => d !== null);

    res.json({
      success: true,
      duels: filtered,
      offset: Number(offset),
      limit: Number(limit),
    });
  } catch (error: any) {
    console.error('Error fetching all duels:', error);
    res.status(500).json({ error: 'Failed to fetch all duels', message: error.message });
  }
});

/**
 * POST /api/duels/create
 * Create a new on-chain duel.
 */
duelRoutes.post('/create', async (req: Request, res: Response) => {
  try {
    const {
      entryAmount,
      duration,
      creatorAddress,
      symbols,
      weights = [],
      assets = [],
      priceIds = [],
      tiers = [],
    } = req.body;

    if (!entryAmount || !duration || !creatorAddress || !symbols || !Array.isArray(symbols) || symbols.length < 2) {
      return res.status(400).json({
        error: 'Missing required fields: entryAmount, duration, creatorAddress, symbols[]',
      });
    }

    if (!ethers.isAddress(creatorAddress)) {
      return res.status(400).json({ error: 'Invalid creator address' });
    }

    if (Array.isArray(weights) && weights.length > 0 && weights.length !== symbols.length) {
      return res.status(400).json({
        error: 'weights length must match symbols length',
      });
    }

    const service = getOnChainDuelService();
    const result = await service.createDuel(
      creatorAddress,
      BigInt(entryAmount),
      Number(duration),
      assets,
      priceIds,
      tiers,
      symbols,
      weights
    );

    res.json({
      success: true,
      duelId: result.duelId,
      duelAddress: result.duelAddress,
      txHash: result.txHash,
      entryAmount,
      duration,
      creatorAddress,
      symbols,
      weights,
    });
  } catch (error: any) {
    console.error('Error creating duel:', error);
    res.status(500).json({ error: 'Failed to create duel', message: error.message });
  }
});

/**
 * POST /api/duels/:duelAddress/join
 * Join an existing duel.
 */
duelRoutes.post('/:duelAddress/join', async (req: Request, res: Response) => {
  try {
    const { duelAddress } = req.params;
    const { entryAmount, playerAddress, symbols = [], weights = [] } = req.body;

    if (!entryAmount || !playerAddress) {
      return res.status(400).json({
        error: 'Missing required fields: entryAmount, playerAddress',
      });
    }

    if (!ethers.isAddress(duelAddress) || !ethers.isAddress(playerAddress)) {
      return res.status(400).json({ error: 'Invalid address format' });
    }

    if ((symbols.length > 0 || weights.length > 0) && symbols.length !== weights.length) {
      return res.status(400).json({
        error: 'symbols and weights must have the same length',
      });
    }

    const service = getOnChainDuelService();
    const result = await service.joinDuel(duelAddress, BigInt(entryAmount), symbols, weights);

    res.json({
      success: true,
      duelAddress,
      playerAddress,
      txHash: result.txHash,
      message: 'Successfully joined duel',
    });
  } catch (error: any) {
    console.error('Error joining duel:', error);
    res.status(500).json({ error: 'Failed to join duel', message: error.message });
  }
});

/**
 * POST /api/duels/:duelAddress/submit-portfolio
 * Submit portfolio for a duel.
 */
duelRoutes.post('/:duelAddress/submit-portfolio', async (req: Request, res: Response) => {
  try {
    const { duelAddress } = req.params;
    const { assets, priceIds, weights, playerAddress } = req.body;

    if (!assets || !priceIds || !weights || !playerAddress) {
      return res.status(400).json({
        error: 'Missing required fields: assets, priceIds, weights, playerAddress',
      });
    }

    if (!ethers.isAddress(duelAddress) || !ethers.isAddress(playerAddress)) {
      return res.status(400).json({ error: 'Invalid address format' });
    }

    const totalWeight = weights.reduce((a: number, b: number) => a + b, 0);
    if (totalWeight !== 10000) {
      return res.status(400).json({
        error: `Portfolio weights must sum to 10000 basis points, got ${totalWeight}`,
      });
    }

    const service = getOnChainDuelService();
    const result = await service.submitPortfolio(duelAddress, assets, priceIds, weights);

    res.json({
      success: true,
      duelAddress,
      playerAddress,
      txHash: result.txHash,
      message: 'Portfolio submitted successfully',
    });
  } catch (error: any) {
    console.error('Error submitting portfolio:', error);
    res.status(500).json({ error: 'Failed to submit portfolio', message: error.message });
  }
});

/**
 * POST /api/duels/:duelAddress/activate
 * Activate duel (for contract variants that require explicit activation).
 */
duelRoutes.post('/:duelAddress/activate', async (req: Request, res: Response) => {
  try {
    const { duelAddress } = req.params;

    if (!ethers.isAddress(duelAddress)) {
      return res.status(400).json({ error: 'Invalid duel address' });
    }

    const service = getOnChainDuelService();
    const result = await service.activateDuel(duelAddress);

    res.json({
      success: true,
      duelAddress,
      txHash: result.txHash,
      message: 'Duel activated successfully',
    });
  } catch (error: any) {
    console.error('Error activating duel:', error);
    res.status(500).json({ error: 'Failed to activate duel', message: error.message });
  }
});

/**
 * POST /api/duels/:duelAddress/settle
 * Settle duel (legacy route, forwards to lockEndPricesAndSettle when available).
 */
duelRoutes.post('/:duelAddress/settle', async (req: Request, res: Response) => {
  try {
    const { duelAddress } = req.params;

    if (!ethers.isAddress(duelAddress)) {
      return res.status(400).json({ error: 'Invalid duel address' });
    }

    const service = getOnChainDuelService();
    if (!service.isSignerAvailable()) {
      return res.status(409).json({
        error: 'Backend signer not configured',
        message: 'Set FLOW_EVM_PRIVATE_KEY in backend/.env to enable automatic settlement',
      });
    }

    const info = await service.getDuelInfo(duelAddress);
    const now = Math.floor(Date.now() / 1000);
    if (Number(info?.endTime || 0) <= 0 || now < Number(info.endTime)) {
      return res.status(400).json({
        error: 'Duel has not ended yet',
        message: 'Settlement is only available after duel end time',
      });
    }

    const payload = await buildSettlementPayload(service, duelAddress);
    const result = await service.settleDuel(
      duelAddress,
      payload.creatorEndPrices,
      payload.opponentEndPrices,
      payload.creatorStartPrices,
      payload.opponentStartPrices
    );

    const updated = await service.getDuelInfo(duelAddress);

    res.json({
      success: true,
      duelAddress,
      txHash: result.txHash,
      method: result.method,
      duel: updated,
      message: 'Duel settled successfully',
    });
  } catch (error: any) {
    console.error('Error settling duel:', error);
    res.status(500).json({ error: 'Failed to settle duel', message: error.message });
  }
});

/**
 * POST /api/duels/:duelAddress/payout
 * Execute payout to winner.
 */
duelRoutes.post('/:duelAddress/payout', async (req: Request, res: Response) => {
  try {
    const { duelAddress } = req.params;

    if (!ethers.isAddress(duelAddress)) {
      return res.status(400).json({ error: 'Invalid duel address' });
    }

    const service = getOnChainDuelService();
    if (!service.isSignerAvailable()) {
      return res.status(409).json({
        error: 'Backend signer not configured',
        message: 'Set FLOW_EVM_PRIVATE_KEY in backend/.env to enable automatic payout',
      });
    }

    const info = await service.getDuelInfo(duelAddress);
    if (!info?.settled) {
      return res.status(400).json({
        error: 'Duel not settled',
        message: 'Settle the duel before executing payout',
      });
    }

    const escrowBalance = await service.getContractBalance(duelAddress);
    if (escrowBalance <= 0n) {
      return res.json({
        success: true,
        duelAddress,
        txHash: null,
        method: null,
        message: 'Payout already executed',
      });
    }

    const result = await service.executePayoutOrSplitTie(duelAddress, info.winner || null);
    const updated = await service.getDuelInfo(duelAddress);

    res.json({
      success: true,
      duelAddress,
      txHash: result.txHash,
      method: result.method,
      duel: updated,
      message: 'Payout executed successfully',
    });
  } catch (error: any) {
    console.error('Error executing payout:', error);
    res.status(500).json({ error: 'Failed to execute payout', message: error.message });
  }
});

/**
 * GET /api/duels/:duelAddress/info
 * Get on-chain duel information by duel address.
 */
duelRoutes.get('/:duelAddress/info', async (req: Request, res: Response) => {
  try {
    const { duelAddress } = req.params;

    if (!ethers.isAddress(duelAddress)) {
      return res.status(400).json({ error: 'Invalid duel address' });
    }

    const service = getOnChainDuelService();
    const info = await service.getDuelInfo(duelAddress);

    res.json({
      success: true,
      duelAddress,
      duel: info,
    });
  } catch (error: any) {
    console.error('Error fetching duel info:', error);
    res.status(500).json({ error: 'Failed to fetch duel info', message: error.message });
  }
});

/**
 * GET /api/duels/:duelAddress/creator-portfolio
 * Get creator portfolio for a duel.
 */
duelRoutes.get('/:duelAddress/creator-portfolio', async (req: Request, res: Response) => {
  try {
    const { duelAddress } = req.params;

    if (!ethers.isAddress(duelAddress)) {
      return res.status(400).json({ error: 'Invalid duel address' });
    }

    const service = getOnChainDuelService();
    const portfolio = await service.getCreatorPortfolio(duelAddress);

    res.json({
      success: true,
      duelAddress,
      portfolio,
    });
  } catch (error: any) {
    console.error('Error fetching creator portfolio:', error);
    res.status(500).json({ error: 'Failed to fetch creator portfolio', message: error.message });
  }
});

/**
 * GET /api/duels/:duelAddress/opponent-portfolio
 * Get opponent portfolio for a duel.
 */
duelRoutes.get('/:duelAddress/opponent-portfolio', async (req: Request, res: Response) => {
  try {
    const { duelAddress } = req.params;

    if (!ethers.isAddress(duelAddress)) {
      return res.status(400).json({ error: 'Invalid duel address' });
    }

    const service = getOnChainDuelService();
    const portfolio = await service.getOpponentPortfolio(duelAddress);

    res.json({
      success: true,
      duelAddress,
      portfolio,
    });
  } catch (error: any) {
    console.error('Error fetching opponent portfolio:', error);
    res.status(500).json({ error: 'Failed to fetch opponent portfolio', message: error.message });
  }
});

/**
 * GET /api/duels/user/:address/duels
 * Get all duels for a user.
 */
duelRoutes.get('/user/:address/duels', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const { offset = 0, limit = 10 } = req.query;

    if (!ethers.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid address format' });
    }

    const service = getOnChainDuelService();
    const duels = await service.getUserDuels(address, Number(offset), Number(limit));

    const fullDuels = await Promise.all(
      duels.map(async (d: any) => {
        try {
          const [info, createdAt] = await Promise.all([
            service.getDuelInfo(d.duelAddress),
            service.getDuelCreatedAt(d.duelId),
          ]);

          return {
            duelId: d.duelId,
            duelAddress: d.duelAddress,
            createdAt,
            ...info,
          };
        } catch {
          return null;
        }
      })
    );

    const filtered = fullDuels.filter((d) => d !== null);

    res.json({
      success: true,
      address,
      duels: filtered,
      count: filtered.length,
      offset: Number(offset),
      limit: Number(limit),
    });
  } catch (error: any) {
    console.error('Error fetching user duels:', error);
    res.status(500).json({ error: 'Failed to fetch user duels', message: error.message });
  }
});

/**
 * POST /api/duels/:duelId/auto-finalize
 * Automatically settle and payout/split an ended duel.
 */
duelRoutes.post('/:duelId/auto-finalize', async (req: Request, res: Response) => {
  try {
    const { duelId } = req.params;
    const service = getOnChainDuelService();

    if (!service.isSignerAvailable()) {
      return res.status(409).json({
        error: 'Backend signer not configured',
        message: 'Set FLOW_EVM_PRIVATE_KEY in backend/.env to enable auto-finalization',
      });
    }

    const duelAddress = await service.getDuelAddress(duelId);
    if (!duelAddress) {
      return res.status(404).json({
        error: 'Duel not found',
        duelId,
      });
    }

    const finalized = await autoFinalizeDuel(service, duelAddress);
    const createdAt = await service.getDuelCreatedAt(duelId);

    res.json({
      success: true,
      duelId,
      duelAddress,
      autoFinalized: Boolean(finalized.settleResult || finalized.payoutResult),
      settleTxHash: finalized.settleResult?.txHash ?? null,
      settleMethod: finalized.settleResult?.method ?? null,
      payoutTxHash: finalized.payoutResult?.txHash ?? null,
      payoutMethod: finalized.payoutResult?.method ?? null,
      duel: {
        duelId,
        duelAddress,
        createdAt,
        ...finalized.info,
      },
    });
  } catch (error: any) {
    console.error('Error auto-finalizing duel:', error);
    res.status(500).json({ error: 'Failed to auto-finalize duel', message: error.message });
  }
});

/**
 * GET /api/duels/:duelId
 * Get duel details by duel ID.
 */
duelRoutes.get('/:duelId', async (req: Request, res: Response) => {
  try {
    const { duelId } = req.params;

    const service = getOnChainDuelService();
    const duelAddress = await service.getDuelAddress(duelId);

    if (!duelAddress) {
      return res.status(404).json({
        error: 'Duel not found',
        duelId,
      });
    }

    const [info, createdAt] = await Promise.all([
      service.getDuelInfo(duelAddress),
      service.getDuelCreatedAt(duelId),
    ]);

    res.json({
      success: true,
      duel: {
        duelId,
        duelAddress,
        createdAt,
        ...info,
      },
    });
  } catch (error: any) {
    console.error('Error fetching duel:', error);
    res.status(500).json({ error: 'Failed to fetch duel', message: error.message });
  }
});

/**
 * GET /api/duels/:duelId/status
 * Get current status of a duel.
 */
duelRoutes.get('/:duelId/status', async (req: Request, res: Response) => {
  try {
    const { duelId } = req.params;

    const service = getOnChainDuelService();
    const duelAddress = await service.getDuelAddress(duelId);

    if (!duelAddress) {
      return res.status(404).json({
        error: 'Duel not found',
        duelId,
      });
    }

    const info = await service.getDuelInfo(duelAddress);
    const now = Math.floor(Date.now() / 1000);

    let timeRemaining: number | null = null;
    if (info.endTime && Number(info.endTime) > 0) {
      timeRemaining = Math.max(0, Number(info.endTime) - now);
    }

    const activeLikeState = info.state === 'Active' || info.state === 'Locked';

    res.json({
      success: true,
      status: {
        duelId,
        state: info.state,
        hasOpponent: Boolean(info.opponent && info.opponent !== ZERO_ADDRESS),
        timeRemaining,
        canSettle: activeLikeState && timeRemaining === 0,
        winner: info.winner,
      },
    });
  } catch (error: any) {
    console.error('Error fetching duel status:', error);
    res.status(500).json({ error: 'Failed to fetch duel status', message: error.message });
  }
});

/**
 * GET /api/duels/:duelId/can-settle
 * Check if a duel can be settled.
 */
duelRoutes.get('/:duelId/can-settle', async (req: Request, res: Response) => {
  try {
    const { duelId } = req.params;

    const service = getOnChainDuelService();
    const duelAddress = await service.getDuelAddress(duelId);

    if (!duelAddress) {
      return res.status(404).json({
        error: 'Duel not found',
        duelId,
      });
    }

    const info = await service.getDuelInfo(duelAddress);
    const now = Math.floor(Date.now() / 1000);
    const canSettle =
      (info.state === 'Active' || info.state === 'Locked') &&
      Number(info.endTime || 0) > 0 &&
      now >= Number(info.endTime);

    res.json({
      success: true,
      canSettle,
      duelId,
      state: info.state,
      endTime: info.endTime,
      currentTime: now,
    });
  } catch (error: any) {
    console.error('Error checking settlement status:', error);
    res.status(500).json({ error: 'Failed to check settlement status', message: error.message });
  }
});

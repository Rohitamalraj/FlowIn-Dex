import { Router, Request, Response } from 'express';
import { EventIndexer } from '../services/eventIndexer';
import { getOnChainDuelService } from '../services/onChainDuelService';
import { ethers } from 'ethers';

export const duelRoutes = Router();

/**
 * POST /api/duels/create
 * Create a new on-chain duel
 */
duelRoutes.post('/create', async (req: Request, res: Response) => {
  try {
    const { entryAmount, duration, assets, priceIds, tiers, symbols, creatorAddress } = req.body;

    // Validate inputs
    if (!entryAmount || !duration || !assets || !priceIds || !tiers || !symbols || !creatorAddress) {
      return res.status(400).json({
        error: 'Missing required fields: entryAmount, duration, assets, priceIds, tiers, symbols, creatorAddress'
      });
    }

    if (!ethers.isAddress(creatorAddress)) {
      return res.status(400).json({
        error: 'Invalid creator address'
      });
    }

    const service = getOnChainDuelService();
    const result = await service.createDuel(
      creatorAddress,
      BigInt(entryAmount),
      duration,
      assets,
      priceIds,
      tiers,
      symbols
    );

    res.json({
      success: true,
      duelId: result.duelId,
      duelAddress: result.duelAddress,
      txHash: result.txHash,
      entryAmount,
      duration,
      creatorAddress
    });
  } catch (error: any) {
    console.error('Error creating duel:', error);
    res.status(500).json({
      error: 'Failed to create duel',
      message: error.message
    });
  }
});

/**
 * POST /api/duels/:duelAddress/join
 * Join an existing duel
 */
duelRoutes.post('/:duelAddress/join', async (req: Request, res: Response) => {
  try {
    const { duelAddress } = req.params;
    const { entryAmount, playerAddress } = req.body;

    if (!entryAmount || !playerAddress) {
      return res.status(400).json({
        error: 'Missing required fields: entryAmount, playerAddress'
      });
    }

    if (!ethers.isAddress(duelAddress) || !ethers.isAddress(playerAddress)) {
      return res.status(400).json({
        error: 'Invalid address format'
      });
    }

    const service = getOnChainDuelService();
    const result = await service.joinDuel(duelAddress, BigInt(entryAmount));

    res.json({
      success: true,
      duelAddress,
      playerAddress,
      txHash: result.txHash,
      message: 'Successfully joined duel'
    });
  } catch (error: any) {
    console.error('Error joining duel:', error);
    res.status(500).json({
      error: 'Failed to join duel',
      message: error.message
    });
  }
});

/**
 * POST /api/duels/:duelAddress/submit-portfolio
 * Submit portfolio for a duel
 */
duelRoutes.post('/:duelAddress/submit-portfolio', async (req: Request, res: Response) => {
  try {
    const { duelAddress } = req.params;
    const { assets, priceIds, weights, playerAddress } = req.body;

    if (!assets || !priceIds || !weights || !playerAddress) {
      return res.status(400).json({
        error: 'Missing required fields: assets, priceIds, weights, playerAddress'
      });
    }

    if (!ethers.isAddress(duelAddress) || !ethers.isAddress(playerAddress)) {
      return res.status(400).json({
        error: 'Invalid address format'
      });
    }

    // Validate portfolio allocation (should sum to 10000 basis points)
    const totalWeight = weights.reduce((a: number, b: number) => a + b, 0);
    if (totalWeight !== 10000) {
      return res.status(400).json({
        error: `Portfolio weights must sum to 10000 basis points, got ${totalWeight}`
      });
    }

    const service = getOnChainDuelService();
    const result = await service.submitPortfolio(duelAddress, assets, priceIds, weights);

    res.json({
      success: true,
      duelAddress,
      playerAddress,
      txHash: result.txHash,
      message: 'Portfolio submitted successfully'
    });
  } catch (error: any) {
    console.error('Error submitting portfolio:', error);
    res.status(500).json({
      error: 'Failed to submit portfolio',
      message: error.message
    });
  }
});

/**
 * POST /api/duels/:duelAddress/activate
 * Activate duel (move from SubmittedBoth to Active)
 */
duelRoutes.post('/:duelAddress/activate', async (req: Request, res: Response) => {
  try {
    const { duelAddress } = req.params;

    if (!ethers.isAddress(duelAddress)) {
      return res.status(400).json({
        error: 'Invalid duel address'
      });
    }

    const service = getOnChainDuelService();
    const result = await service.activateDuel(duelAddress);

    res.json({
      success: true,
      duelAddress,
      txHash: result.txHash,
      message: 'Duel activated successfully'
    });
  } catch (error: any) {
    console.error('Error activating duel:', error);
    res.status(500).json({
      error: 'Failed to activate duel',
      message: error.message
    });
  }
});

/**
 * POST /api/duels/:duelAddress/settle
 * Lock end prices and settle duel
 */
duelRoutes.post('/:duelAddress/settle', async (req: Request, res: Response) => {
  try {
    const { duelAddress } = req.params;

    if (!ethers.isAddress(duelAddress)) {
      return res.status(400).json({
        error: 'Invalid duel address'
      });
    }

    const service = getOnChainDuelService();
    const result = await service.lockEndPricesAndSettle(duelAddress);

    res.json({
      success: true,
      duelAddress,
      txHash: result.txHash,
      message: 'Duel settled successfully'
    });
  } catch (error: any) {
    console.error('Error settling duel:', error);
    res.status(500).json({
      error: 'Failed to settle duel',
      message: error.message
    });
  }
});

/**
 * POST /api/duels/:duelAddress/payout
 * Execute payout to winner
 */
duelRoutes.post('/:duelAddress/payout', async (req: Request, res: Response) => {
  try {
    const { duelAddress } = req.params;

    if (!ethers.isAddress(duelAddress)) {
      return res.status(400).json({
        error: 'Invalid duel address'
      });
    }

    const service = getOnChainDuelService();
    const result = await service.executePayout(duelAddress);

    res.json({
      success: true,
      duelAddress,
      txHash: result.txHash,
      message: 'Payout executed successfully'
    });
  } catch (error: any) {
    console.error('Error executing payout:', error);
    res.status(500).json({
      error: 'Failed to execute payout',
      message: error.message
    });
  }
});

/**
 * GET /api/duels/:duelAddress/info
 * Get on-chain duel information
 */
duelRoutes.get('/:duelAddress/info', async (req: Request, res: Response) => {
  try {
    const { duelAddress } = req.params;

    if (!ethers.isAddress(duelAddress)) {
      return res.status(400).json({
        error: 'Invalid duel address'
      });
    }

    const service = getOnChainDuelService();
    const info = await service.getDuelInfo(duelAddress);

    res.json({
      success: true,
      duelAddress,
      duel: info
    });
  } catch (error: any) {
    console.error('Error fetching duel info:', error);
    res.status(500).json({
      error: 'Failed to fetch duel info',
      message: error.message
    });
  }
});

/**
 * GET /api/duels/:duelAddress/creator-portfolio
 * Get creator's portfolio for a duel
 */
duelRoutes.get('/:duelAddress/creator-portfolio', async (req: Request, res: Response) => {
  try {
    const { duelAddress } = req.params;

    if (!ethers.isAddress(duelAddress)) {
      return res.status(400).json({
        error: 'Invalid duel address'
      });
    }

    const service = getOnChainDuelService();
    const portfolio = await service.getCreatorPortfolio(duelAddress);

    res.json({
      success: true,
      duelAddress,
      portfolio
    });
  } catch (error: any) {
    console.error('Error fetching creator portfolio:', error);
    res.status(500).json({
      error: 'Failed to fetch creator portfolio',
      message: error.message
    });
  }
});

/**
 * GET /api/duels/:duelAddress/opponent-portfolio
 * Get opponent's portfolio for a duel
 */
duelRoutes.get('/:duelAddress/opponent-portfolio', async (req: Request, res: Response) => {
  try {
    const { duelAddress } = req.params;

    if (!ethers.isAddress(duelAddress)) {
      return res.status(400).json({
        error: 'Invalid duel address'
      });
    }

    const service = getOnChainDuelService();
    const portfolio = await service.getOpponentPortfolio(duelAddress);

    res.json({
      success: true,
      duelAddress,
      portfolio
    });
  } catch (error: any) {
    console.error('Error fetching opponent portfolio:', error);
    res.status(500).json({
      error: 'Failed to fetch opponent portfolio',
      message: error.message
    });
  }
});

/**
 * GET /api/duels/user/:address
 * Get all duels for a user (on-chain)
 */
duelRoutes.get('/user/:address/duels', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const { offset = 0, limit = 10 } = req.query;

    if (!ethers.isAddress(address)) {
      return res.status(400).json({
        error: 'Invalid address format'
      });
    }

    const service = getOnChainDuelService();
    const duels = await service.getUserDuels(address, Number(offset), Number(limit));

    res.json({
      success: true,
      address,
      duels,
      count: duels.length,
      offset: Number(offset),
      limit: Number(limit)
    });
  } catch (error: any) {
    console.error('Error fetching user duels:', error);
    res.status(500).json({
      error: 'Failed to fetch user duels',
      message: error.message
    });
  }
});


duelRoutes.get('/:duelId', async (req: Request, res: Response) => {
  try {
    const { duelId } = req.params;

    const indexer = EventIndexer.getInstance();
    const duel = await indexer.getDuel(duelId);

    if (!duel) {
      return res.status(404).json({
        error: 'Duel not found',
        duelId
      });
    }

    res.json({
      success: true,
      duel: {
        ...duel,
        entryAmountFormatted: ethers.formatEther(duel.entryAmount)
      }
    });
  } catch (error: any) {
    console.error('Error fetching duel:', error);
    res.status(500).json({
      error: 'Failed to fetch duel',
      message: error.message
    });
  }
});

/**
 * GET /api/duels/:duelId/status
 * Get current status of a duel
 */
duelRoutes.get('/:duelId/status', async (req: Request, res: Response) => {
  try {
    const { duelId } = req.params;

    const indexer = EventIndexer.getInstance();
    const duel = await indexer.getDuel(duelId);

    if (!duel) {
      return res.status(404).json({
        error: 'Duel not found',
        duelId
      });
    }

    // Calculate time remaining if duel is locked
    let timeRemaining = null;
    if (duel.state === 'Locked' && duel.endTime) {
      const now = Math.floor(Date.now() / 1000);
      timeRemaining = Math.max(0, duel.endTime - now);
    }

    res.json({
      success: true,
      status: {
        duelId: duel.duelId,
        state: duel.state,
        hasOpponent: duel.opponent !== null,
        timeRemaining,
        canSettle: duel.state === 'Locked' && timeRemaining === 0,
        winner: duel.winner
      }
    });
  } catch (error: any) {
    console.error('Error fetching duel status:', error);
    res.status(500).json({
      error: 'Failed to fetch duel status',
      message: error.message
    });
  }
});

/**
 * GET /api/duels/user/:address
 * Get all duels for a user
 */
duelRoutes.get('/user/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    if (!ethers.isAddress(address)) {
      return res.status(400).json({
        error: 'Invalid address format'
      });
    }

    // Note: In production, this would query indexed duels from a database
    // For now, we'll return a placeholder response
    res.json({
      success: true,
      address,
      duels: [],
      message: 'User duel indexing coming soon - query via DuelFactory contract for now'
    });
  } catch (error: any) {
    console.error('Error fetching user duels:', error);
    res.status(500).json({
      error: 'Failed to fetch user duels',
      message: error.message
    });
  }
});

/**
 * GET /api/duels/:duelId/can-settle
 * Check if a duel can be settled
 */
duelRoutes.get('/:duelId/can-settle', async (req: Request, res: Response) => {
  try {
    const { duelId } = req.params;

    const indexer = EventIndexer.getInstance();
    const duel = await indexer.getDuel(duelId);

    if (!duel) {
      return res.status(404).json({
        error: 'Duel not found',
        duelId
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const canSettle = duel.state === 'Locked' && duel.endTime !== null && now >= duel.endTime;

    res.json({
      success: true,
      canSettle,
      duelId,
      state: duel.state,
      endTime: duel.endTime,
      currentTime: now
    });
  } catch (error: any) {
    console.error('Error checking settlement status:', error);
    res.status(500).json({
      error: 'Failed to check settlement status',
      message: error.message
    });
  }
});

/**
 * POST /api/duels/clear-cache
 * Clear the duel cache (admin function)
 */
duelRoutes.post('/clear-cache', (req: Request, res: Response) => {
  try {
    const indexer = EventIndexer.getInstance();
    indexer.clearCache();

    res.json({
      success: true,
      message: 'Duel cache cleared'
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to clear cache',
      message: error.message
    });
  }
});

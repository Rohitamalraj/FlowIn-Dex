import { Router, Request, Response } from 'express';
import { PythPriceService } from '../services/pythPriceService';

export const priceRoutes = Router();

/**
 * GET /api/prices/supported
 * Get list of supported assets
 */
priceRoutes.get('/supported', (req: Request, res: Response) => {
  try {
    const pythService = PythPriceService.getInstance();
    const supported = pythService.getSupportedSymbols();

    res.json({
      success: true,
      symbols: supported,
      count: supported.length
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to get supported symbols',
      message: error.message
    });
  }
});

/**
 * GET /api/prices/:symbol
 * Get current price for a single asset
 */
priceRoutes.get('/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;

    const pythService = PythPriceService.getInstance();
    const priceData = await pythService.getPrice(symbol);

    res.json({
      success: true,
      price: {
        symbol: priceData.symbol,
        price: priceData.formattedPrice,
        priceRaw: priceData.price,
        confidence: priceData.conf,
        exponent: priceData.expo,
        publishTime: priceData.publishTime,
        publishTimeReadable: new Date(priceData.publishTime * 1000).toISOString()
      }
    });
  } catch (error: any) {
    console.error(`Error fetching price for ${req.params.symbol}:`, error);
    res.status(500).json({
      error: 'Failed to fetch price',
      message: error.message
    });
  }
});

/**
 * POST /api/prices/batch
 * Get current prices for multiple assets
 * Body: { symbols: string[] }
 */
priceRoutes.post('/batch', async (req: Request, res: Response) => {
  try {
    const { symbols } = req.body;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'symbols array is required'
      });
    }

    const pythService = PythPriceService.getInstance();
    const priceMap = await pythService.getPrices(symbols);

    const prices: any = {};
    priceMap.forEach((priceData, symbol) => {
      prices[symbol] = {
        symbol: priceData.symbol,
        price: priceData.formattedPrice,
        priceRaw: priceData.price,
        confidence: priceData.conf,
        exponent: priceData.expo,
        publishTime: priceData.publishTime,
        publishTimeReadable: new Date(priceData.publishTime * 1000).toISOString()
      };
    });

    res.json({
      success: true,
      prices,
      count: Object.keys(prices).length
    });
  } catch (error: any) {
    console.error('Error fetching batch prices:', error);
    res.status(500).json({
      error: 'Failed to fetch prices',
      message: error.message
    });
  }
});

/**
 * GET /api/prices/feed-id/:symbol
 * Get Pyth price feed ID for a symbol
 */
priceRoutes.get('/feed-id/:symbol', (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;

    const pythService = PythPriceService.getInstance();
    const feedId = pythService.getPriceFeedId(symbol);

    res.json({
      success: true,
      symbol: symbol.toUpperCase(),
      feedId
    });
  } catch (error: any) {
    res.status(404).json({
      error: 'Price feed not found',
      message: error.message
    });
  }
});

/**
 * POST /api/prices/clear-cache
 * Clear the price cache (admin function)
 */
priceRoutes.post('/clear-cache', (req: Request, res: Response) => {
  try {
    const pythService = PythPriceService.getInstance();
    pythService.clearCache();

    res.json({
      success: true,
      message: 'Price cache cleared'
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to clear cache',
      message: error.message
    });
  }
});

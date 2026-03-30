import { EvmPriceServiceConnection, PriceFeed } from '@pythnetwork/pyth-evm-js';
import NodeCache from 'node-cache';
import axios from 'axios';

/**
 * Pyth Price Service
 * Handles fetching and caching of price data from Pyth Network
 */
export class PythPriceService {
  private static instance: PythPriceService;
  private priceServiceConnection: EvmPriceServiceConnection;
  private priceCache: NodeCache;
  private priceServiceUrl: string;

  // Pyth Price Feed IDs
  public static readonly PRICE_FEED_IDS: { [key: string]: string } = {
    'BTC': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
    'ETH': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
    'SOL': '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
    'BNB': '0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f',
    'STRK': '0x6a182399ff70ccf3e06024898942028204125a819e519a335ffa4579e66cd870',
    'ARB': '0x3fa4252848f9f0a1480be62745a4629d9eb1322aebab8a791e344b3b9c1adcf5',
    'OP': '0x385f64d993f7b77d8182ed5003d97c60aa3361f3cecfe711544d2d59165e9bdf',
    // Hermes now serves Polygon as POL/USD; keep MATIC symbol mapped for UI compatibility.
    'MATIC': '0xffd11c5a1cfd42f80afb2df4d9f264c15f956d68153335374ec10722edd70472',
    'POL': '0xffd11c5a1cfd42f80afb2df4d9f264c15f956d68153335374ec10722edd70472',
    'LINK': '0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221',
    'AVAX': '0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7',
    'USDC': '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
    'USDT': '0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b',
    'DAI': '0xb0948a5e5313200c632b51bb5ca32f6de0d36e9950a942d19751e833f70dabfd',
    // New assets
    'DOGE': '0xdcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c',
    'XRP':  '0xec5d399846a9209f3fe5881d70aae9268c94339ff9817e8d18ff19fa05eea1c8',
    'ADA':  '0x2a01deaec9e51a579277b34b122399984d0bbf57e2458a7e42fecd2829867a0d',
    'LTC':  '0x6e3f3fa8253588df9326580180233eb791e03b443a3ba7a1d892e73874e19a54',
    'DOT':  '0xca3eed9b267293f6595901c734c7525ce8ef49adafe8284606ceb307afa2ca5b',
    'ATOM': '0xb00b60f88b03a6a625a8d1c048c3f66653edf217439983d037e7222c4e612819',
    'NEAR': '0xc415de8d2eba7db216527dff4b60e8f3a5311c740dadb233e13e12547e226750',
    'APT':  '0x03ae4db29ed4ae33d323568895aa00337e658e348b37509f5372ae51f0af00d5',
    'SUI':  '0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744',
    'UNI':  '0x78d185a741d07edb3412b09008b7c5cfb9bbbd7d568bf00ba737b456ba171501',
    'AAVE': '0x2b9ab1e972a281585084148ba1389800799bd4be63b957507db1349314e47445',
    'PEPE': '0xd69731a2e74ac1ce884fc3890f7ee324b6deb66147055249568869ed700882e4',
    'SHIB': '0xf0d57deca57b3da2fe63a493f4c25925fdfd8edf834b20f93e1f84dbd1504d4a',
    'WIF':  '0x4ca4beeca86f0d164160323817a4e42b10010a724c2217c6ee41b54cd4cc61fc',
    'TIA':  '0x09f7c1d7dfbb7df2b8fe3d3d87ee94a2259d212da4f30c1f0540d066dfa44723'
  };

  private constructor() {
    this.priceServiceUrl = process.env.PYTH_PRICE_SERVICE_URL || 'https://hermes.pyth.network';
    this.priceServiceConnection = new EvmPriceServiceConnection(this.priceServiceUrl);

    // Cache with 60 second TTL by default
    const cacheTTL = parseInt(process.env.PRICE_CACHE_TTL || '60');
    this.priceCache = new NodeCache({ stdTTL: cacheTTL, checkperiod: 120 });
  }

  public static getInstance(): PythPriceService {
    if (!PythPriceService.instance) {
      PythPriceService.instance = new PythPriceService();
    }
    return PythPriceService.instance;
  }

  /**
   * Initialize the price service
   */
  public async initialize(): Promise<void> {
    console.log('  📡 Connecting to Pyth Price Service:', this.priceServiceUrl);

    // Test connection
    try {
      const testPriceIds = [PythPriceService.PRICE_FEED_IDS['BTC']];
      const testPrices = await this.priceServiceConnection.getLatestPriceFeeds(testPriceIds);

      if (testPrices && testPrices.length > 0) {
        console.log('  ✅ Successfully connected to Pyth Network');
        console.log(`  📊 Test price (BTC): $${testPrices[0].getPriceUnchecked().price}`);
      }
    } catch (error) {
      console.error('  ⚠️  Failed to test Pyth connection:', error);
      throw error;
    }
  }

  /**
   * Get current price for a single asset
   * @param symbol Asset symbol (e.g., 'BTC', 'ETH')
   * @returns Price data
   */
  public async getPrice(symbol: string): Promise<PriceData> {
    const cacheKey = `price_${symbol}`;

    // Check cache first
    const cachedPrice = this.priceCache.get<PriceData>(cacheKey);
    if (cachedPrice) {
      return cachedPrice;
    }

    const priceId = PythPriceService.PRICE_FEED_IDS[symbol.toUpperCase()];
    if (!priceId) {
      throw new Error(`Price feed not found for symbol: ${symbol}`);
    }

    try {
      const priceFeeds = await this.priceServiceConnection.getLatestPriceFeeds([priceId]);

      if (!priceFeeds || priceFeeds.length === 0) {
        throw new Error(`No price data returned for ${symbol}`);
      }

      const priceFeed = priceFeeds[0];
      const price = priceFeed.getPriceUnchecked();

      const priceData: PriceData = {
        symbol: symbol.toUpperCase(),
        priceId,
        price: price.price,
        conf: price.conf,
        expo: price.expo,
        publishTime: price.publishTime,
        formattedPrice: this.formatPrice(price.price, price.expo)
      };

      // Cache the price
      this.priceCache.set(cacheKey, priceData);

      return priceData;
    } catch (error) {
      console.error(`Error fetching price for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get current prices for multiple assets
   * @param symbols Array of asset symbols
   * @returns Map of symbol to price data
   */
  public async getPrices(symbols: string[]): Promise<Map<string, PriceData>> {
    const priceMap = new Map<string, PriceData>();

    const priceIds = symbols.map(symbol => {
      const id = PythPriceService.PRICE_FEED_IDS[symbol.toUpperCase()];
      if (!id) {
        throw new Error(`Price feed not found for symbol: ${symbol}`);
      }
      return id;
    });

    try {
      const priceFeeds = await this.priceServiceConnection.getLatestPriceFeeds(priceIds);

      if (!priceFeeds || priceFeeds.length === 0) {
        throw new Error("No price feeds returned for requested symbols");
      }

      priceFeeds.forEach((priceFeed: PriceFeed, index: number) => {
        const symbol = symbols[index].toUpperCase();
        const price = priceFeed.getPriceUnchecked();

        const priceData: PriceData = {
          symbol,
          priceId: priceIds[index],
          price: price.price,
          conf: price.conf,
          expo: price.expo,
          publishTime: price.publishTime,
          formattedPrice: this.formatPrice(price.price, price.expo)
        };

        priceMap.set(symbol, priceData);

        // Cache individual prices
        this.priceCache.set(`price_${symbol}`, priceData);
      });

      return priceMap;
    } catch (error) {
      console.error('Error fetching multiple prices:', error);
      throw error;
    }
  }

  /**
   * Get uncached latest prices for multiple assets.
   * Uses Hermes REST latest endpoint to avoid stale cache in duel live charts.
   */
  public async getPricesLive(symbols: string[]): Promise<Map<string, PriceData>> {
    const normalized = this.normalizeSymbols(symbols);
    const ids = normalized.map((symbol) => this.getPriceFeedId(symbol));
    const payload = await this.fetchHermesParsed(`v2/updates/price/latest`, ids);
    return this.mapParsedPrices(normalized, ids, payload?.parsed);
  }

  /**
   * Get prices at (or closest before) a given unix timestamp for multiple assets.
   */
  public async getPricesAt(symbols: string[], timestampSec: number): Promise<Map<string, PriceData>> {
    const normalized = this.normalizeSymbols(symbols);
    const ids = normalized.map((symbol) => this.getPriceFeedId(symbol));
    const safeTs = Math.max(1, Math.floor(timestampSec));
    const payload = await this.fetchHermesParsed(`v2/updates/price/${safeTs}`, ids);
    return this.mapParsedPrices(normalized, ids, payload?.parsed);
  }

  /**
   * Get price feed ID for a symbol
   * @param symbol Asset symbol
   * @returns Pyth price feed ID
   */
  public getPriceFeedId(symbol: string): string {
    const id = PythPriceService.PRICE_FEED_IDS[symbol.toUpperCase()];
    if (!id) {
      throw new Error(`Price feed not found for symbol: ${symbol}`);
    }
    return id;
  }

  /**
   * Get all supported symbols
   * @returns Array of supported symbols
   */
  public getSupportedSymbols(): string[] {
    return Object.keys(PythPriceService.PRICE_FEED_IDS);
  }

  private normalizeSymbols(symbols: string[]): string[] {
    const seen = new Set<string>();
    const normalized: string[] = [];

    for (const symbol of symbols) {
      const upper = String(symbol || "").toUpperCase().trim();
      if (!upper || seen.has(upper)) continue;
      seen.add(upper);
      normalized.push(upper);
    }

    if (normalized.length === 0) {
      throw new Error("At least one symbol is required");
    }

    return normalized;
  }

  private async fetchHermesParsed(path: string, priceIds: string[]): Promise<any> {
    const url = `${this.priceServiceUrl}/${path}`;

    try {
      const response = await axios.get(url, {
        params: { "ids[]": priceIds },
        timeout: 15000,
        paramsSerializer: {
          serialize: (params: Record<string, any>) => {
            const ids = Array.isArray(params["ids[]"]) ? params["ids[]"] : [];
            return ids.map((id: string) => `ids[]=${encodeURIComponent(id)}`).join("&");
          },
        },
      });

      return response.data;
    } catch (error: any) {
      const status = error?.response?.status;
      const responseData = error?.response?.data;
      const details = typeof responseData === "string"
        ? responseData
        : (responseData ? JSON.stringify(responseData) : error?.message || "Unknown Hermes error");

      throw new Error(`Hermes request failed (${status ?? "no-status"}) for ${path}: ${details}`);
    }
  }

  private mapParsedPrices(symbols: string[], ids: string[], parsedFeeds: any[]): Map<string, PriceData> {
    if (!Array.isArray(parsedFeeds) || parsedFeeds.length === 0) {
      throw new Error("No parsed Pyth feeds returned");
    }

    const parsedById = new Map<string, any>();
    for (const feed of parsedFeeds) {
      const feedId = String(feed?.id || "").toLowerCase();
      if (!feedId) continue;
      parsedById.set(feedId, feed);
    }

    const out = new Map<string, PriceData>();

    for (let i = 0; i < symbols.length; i++) {
      const symbol = symbols[i];
      const id = ids[i].replace(/^0x/i, "").toLowerCase();
      const feed = parsedById.get(id);
      const price = feed?.price;

      if (!price || price.price === undefined || price.expo === undefined) {
        throw new Error(`No parsed price found for ${symbol}`);
      }

      const rawPrice = String(price.price);
      const expo = Number(price.expo);
      const publishTime = Number(price.publish_time || 0);

      const data: PriceData = {
        symbol,
        priceId: ids[i],
        price: rawPrice,
        conf: String(price.conf || "0"),
        expo,
        publishTime,
        formattedPrice: this.formatPrice(rawPrice, expo),
      };

      out.set(symbol, data);
    }

    return out;
  }

  /**
   * Format price with exponent
   * @param price Raw price value
   * @param expo Exponent
   * @returns Formatted price as number
   */
  private formatPrice(price: string, expo: number): number {
    const priceNum = parseFloat(price);
    return priceNum * Math.pow(10, expo);
  }

  /**
   * Clear price cache
   */
  public clearCache(): void {
    this.priceCache.flushAll();
  }
}

/**
 * Price data interface
 */
export interface PriceData {
  symbol: string;
  priceId: string;
  price: string;
  conf: string;
  expo: number;
  publishTime: number;
  formattedPrice: number;
}

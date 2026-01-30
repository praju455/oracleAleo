import {
  PriceProvider,
  PriceResult,
  BinanceProvider,
  CoinbaseProvider,
  KrakenProvider,
  HuobiProvider,
  OKExProvider,
  GateIOProvider,
  BybitProvider,
  CoinGeckoProvider,
  KuCoinProvider,
  CryptoCompareProvider
} from '../providers';
import { config } from '../config';
import { logger } from './logger';
import { circuitBreaker } from './circuitBreaker';

export interface AggregatedPrice {
  pair: string;
  price: number;
  scaledPrice: bigint;      // Price * 10^8 for on-chain
  timestamp: number;
  sources: string[];
  sourceCount: number;
}

export interface AggregatedPriceWithCircuitBreaker extends AggregatedPrice {
  circuitBreakerStatus: {
    allowed: boolean;
    isHalted: boolean;
    reason?: string;
    tripCount: number;
  };
}

export class PriceAggregator {
  private providers: PriceProvider[];

  constructor() {
    // Initialize all providers (Phase 1: 10 providers)
    this.providers = [
      // Original providers (Phase 0)
      new BinanceProvider(),
      new CoinbaseProvider(),
      new KrakenProvider(),
      // New providers (Phase 1)
      new HuobiProvider(),
      new OKExProvider(),
      new GateIOProvider(),
      new BybitProvider(),
      new CoinGeckoProvider(),
      new KuCoinProvider(),
      new CryptoCompareProvider()
    ];

    logger.info(`Price aggregator initialized with ${this.providers.length} providers`);
  }

  async fetchAllPrices(pair: string): Promise<PriceResult[]> {
    const promises = this.providers.map(provider => provider.fetchPrice(pair));
    const results = await Promise.all(promises);
    return results.filter((r): r is PriceResult => r !== null);
  }

  calculateMedian(prices: number[]): number {
    if (prices.length === 0) return 0;

    const sorted = [...prices].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  }

  removeOutliers(prices: number[], median: number): number[] {
    if (median === 0) return prices;

    return prices.filter(price => {
      const deviation = Math.abs(price - median) / median;
      return deviation <= config.outlierThreshold;
    });
  }

  async getAggregatedPrice(pair: string): Promise<AggregatedPriceWithCircuitBreaker | null> {
    const results = await this.fetchAllPrices(pair);

    // Dynamic minimum sources (ALEO is on fewer exchanges in Phase 1)
    const minNeeded = pair === 'ALEO/USD' ? 2 : config.minSources;

    if (results.length < minNeeded) {
      logger.warn(`Insufficient sources for ${pair}: got ${results.length}, need ${minNeeded}`);
      return null;
    }

    const prices = results.map(r => r.price);

    // Calculate initial median
    const initialMedian = this.calculateMedian(prices);

    // Remove outliers
    const filteredPrices = this.removeOutliers(prices, initialMedian);

    if (filteredPrices.length < config.minSources) {
      logger.warn(`Too many outliers for ${pair}: ${prices.length - filteredPrices.length} removed`);
      return null;
    }

    // Calculate final median from filtered prices
    const finalPrice = this.calculateMedian(filteredPrices);

    // Check circuit breaker
    const cbResult = circuitBreaker.checkPrice(pair, finalPrice);

    // Scale price for on-chain (multiply by 10^8)
    const scaledPrice = BigInt(Math.round(finalPrice * Number(config.priceScale)));

    const sources = results
      .filter(r => filteredPrices.includes(r.price))
      .map(r => r.source);

    logger.info(`Aggregated ${pair}: $${finalPrice.toFixed(2)} from ${sources.join(', ')} [CB: ${cbResult.allowed ? 'OK' : 'HALTED'}]`);

    return {
      pair,
      price: finalPrice,
      scaledPrice,
      timestamp: Date.now(),
      sources,
      sourceCount: sources.length,
      circuitBreakerStatus: {
        allowed: cbResult.allowed,
        isHalted: cbResult.state.isHalted,
        reason: cbResult.reason,
        tripCount: cbResult.state.tripCount
      }
    };
  }

  async getAllPrices(): Promise<Map<string, AggregatedPriceWithCircuitBreaker>> {
    const prices = new Map<string, AggregatedPriceWithCircuitBreaker>();

    // Fetch all pairs in parallel for better performance
    const promises = config.supportedPairs.map(async pair => {
      const aggregated = await this.getAggregatedPrice(pair);
      return { pair, aggregated };
    });

    const results = await Promise.all(promises);

    for (const { pair, aggregated } of results) {
      if (aggregated) {
        prices.set(pair, aggregated);
      }
    }

    return prices;
  }

  async healthCheck(): Promise<{ [key: string]: boolean }> {
    const status: { [key: string]: boolean } = {};

    // Run health checks in parallel
    const checks = await Promise.all(
      this.providers.map(async provider => ({
        name: provider.name,
        healthy: await provider.healthCheck()
      }))
    );

    for (const check of checks) {
      status[check.name] = check.healthy;
    }

    return status;
  }

  getProviderCount(): number {
    return this.providers.length;
  }

  getProviderNames(): string[] {
    return this.providers.map(p => p.name);
  }
}

// Singleton instance
export const priceAggregator = new PriceAggregator();

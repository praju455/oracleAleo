import { AggregatedPrice } from './priceAggregator';
import { logger } from './logger';

export interface TWAPResult {
  pair: string;
  twap1h: number;        // 1 hour TWAP
  twap24h: number;       // 24 hour TWAP
  twap7d: number;        // 7 day TWAP
  currentPrice: number;
  deviation1h: number;   // Percentage deviation from 1h TWAP
  deviation24h: number;  // Percentage deviation from 24h TWAP
  timestamp: number;
  dataPoints: {
    '1h': number;
    '24h': number;
    '7d': number;
  };
}

interface StoredPriceWithTimestamp {
  price: number;
  timestamp: number;
}

export class TWAPCalculator {
  /**
   * Calculate Time-Weighted Average Price from historical data
   * TWAP = Σ(price_i * time_weight_i) / Σ(time_weight_i)
   * where time_weight_i = time_interval between observations
   */
  calculateTWAP(history: StoredPriceWithTimestamp[], windowMs: number): number {
    if (history.length === 0) return 0;
    if (history.length === 1) return history[0].price;

    const now = Date.now();
    const cutoffTime = now - windowMs;

    // Filter to relevant time window
    const relevantPrices = history.filter(p => p.timestamp >= cutoffTime);

    if (relevantPrices.length === 0) {
      // No data in window, use latest available
      return history[history.length - 1].price;
    }

    if (relevantPrices.length === 1) {
      return relevantPrices[0].price;
    }

    // Sort by timestamp
    relevantPrices.sort((a, b) => a.timestamp - b.timestamp);

    // Calculate time-weighted average
    let weightedSum = 0;
    let totalWeight = 0;

    for (let i = 0; i < relevantPrices.length - 1; i++) {
      const current = relevantPrices[i];
      const next = relevantPrices[i + 1];
      const timeWeight = next.timestamp - current.timestamp;

      // Use average of current and next price for the interval
      const avgPrice = (current.price + next.price) / 2;
      weightedSum += avgPrice * timeWeight;
      totalWeight += timeWeight;
    }

    // Handle the last price point to current time
    const lastPrice = relevantPrices[relevantPrices.length - 1];
    const lastWeight = now - lastPrice.timestamp;
    if (lastWeight > 0) {
      weightedSum += lastPrice.price * lastWeight;
      totalWeight += lastWeight;
    }

    if (totalWeight === 0) {
      return relevantPrices[relevantPrices.length - 1].price;
    }

    return weightedSum / totalWeight;
  }

  /**
   * Calculate all TWAP metrics for a given pair
   */
  calculateAllTWAPs(
    pair: string,
    history: StoredPriceWithTimestamp[],
    currentPrice: number
  ): TWAPResult {
    const ONE_HOUR = 60 * 60 * 1000;
    const ONE_DAY = 24 * ONE_HOUR;
    const SEVEN_DAYS = 7 * ONE_DAY;

    const twap1h = this.calculateTWAP(history, ONE_HOUR);
    const twap24h = this.calculateTWAP(history, ONE_DAY);
    const twap7d = this.calculateTWAP(history, SEVEN_DAYS);

    // Calculate deviations
    const deviation1h = twap1h > 0 ? ((currentPrice - twap1h) / twap1h) * 100 : 0;
    const deviation24h = twap24h > 0 ? ((currentPrice - twap24h) / twap24h) * 100 : 0;

    // Count data points in each window
    const now = Date.now();
    const dataPoints = {
      '1h': history.filter(p => p.timestamp >= now - ONE_HOUR).length,
      '24h': history.filter(p => p.timestamp >= now - ONE_DAY).length,
      '7d': history.filter(p => p.timestamp >= now - SEVEN_DAYS).length
    };

    logger.debug(`TWAP ${pair}: 1h=${twap1h.toFixed(2)} 24h=${twap24h.toFixed(2)} 7d=${twap7d.toFixed(2)}`);

    return {
      pair,
      twap1h,
      twap24h,
      twap7d,
      currentPrice,
      deviation1h,
      deviation24h,
      timestamp: Date.now(),
      dataPoints
    };
  }

  /**
   * Simple Moving Average (SMA) for comparison
   */
  calculateSMA(history: StoredPriceWithTimestamp[], windowMs: number): number {
    if (history.length === 0) return 0;

    const now = Date.now();
    const cutoffTime = now - windowMs;
    const relevantPrices = history.filter(p => p.timestamp >= cutoffTime);

    if (relevantPrices.length === 0) {
      return history[history.length - 1].price;
    }

    const sum = relevantPrices.reduce((acc, p) => acc + p.price, 0);
    return sum / relevantPrices.length;
  }

  /**
   * Exponential Moving Average (EMA)
   * More weight to recent prices
   */
  calculateEMA(history: StoredPriceWithTimestamp[], periods: number): number {
    if (history.length === 0) return 0;
    if (history.length === 1) return history[0].price;

    // Sort by timestamp
    const sorted = [...history].sort((a, b) => a.timestamp - b.timestamp);
    const relevantPrices = sorted.slice(-periods);

    if (relevantPrices.length === 0) {
      return sorted[sorted.length - 1].price;
    }

    const multiplier = 2 / (relevantPrices.length + 1);
    let ema = relevantPrices[0].price;

    for (let i = 1; i < relevantPrices.length; i++) {
      ema = (relevantPrices[i].price - ema) * multiplier + ema;
    }

    return ema;
  }
}

// Singleton instance
export const twapCalculator = new TWAPCalculator();

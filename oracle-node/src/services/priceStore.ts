import { AggregatedPrice } from './priceAggregator';
import { logger } from './logger';

interface StoredPrice extends AggregatedPrice {
  signature?: string;
  operatorAddress?: string;
}

interface PriceStats {
  high: number;
  low: number;
  open: number;
  close: number;
  average: number;
  volatility: number;
  change: number;
  changePercent: number;
  dataPoints: number;
}

interface PriceCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class PriceStore {
  private prices: Map<string, StoredPrice> = new Map();
  private priceHistory: Map<string, StoredPrice[]> = new Map();
  private maxHistoryLength = 10000; // Extended to ~27 hours at 10s intervals

  setPrice(price: AggregatedPrice, signature?: string, operatorAddress?: string): void {
    const stored: StoredPrice = {
      ...price,
      signature,
      operatorAddress
    };

    this.prices.set(price.pair, stored);

    // Add to history
    if (!this.priceHistory.has(price.pair)) {
      this.priceHistory.set(price.pair, []);
    }

    const history = this.priceHistory.get(price.pair)!;
    history.push(stored);

    // Trim history if too long
    if (history.length > this.maxHistoryLength) {
      history.shift();
    }

    logger.debug(`Stored price for ${price.pair}: $${price.price}`);
  }

  getPrice(pair: string): StoredPrice | null {
    return this.prices.get(pair) || null;
  }

  getAllPrices(): StoredPrice[] {
    return Array.from(this.prices.values());
  }

  getHistory(pair: string, limit?: number): StoredPrice[] {
    const history = this.priceHistory.get(pair) || [];
    if (limit) {
      return history.slice(-limit);
    }
    return history;
  }

  // Get history within a time range
  getHistoryByTimeRange(pair: string, startTime: number, endTime: number): StoredPrice[] {
    const history = this.priceHistory.get(pair) || [];
    return history.filter(p => p.timestamp >= startTime && p.timestamp <= endTime);
  }

  // Get price statistics for a time window
  getStats(pair: string, windowMs: number): PriceStats | null {
    const now = Date.now();
    const history = this.getHistoryByTimeRange(pair, now - windowMs, now);

    if (history.length === 0) return null;

    const prices = history.map(p => p.price);
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    const open = prices[0];
    const close = prices[prices.length - 1];
    const average = prices.reduce((a, b) => a + b, 0) / prices.length;

    // Calculate volatility (standard deviation)
    const squaredDiffs = prices.map(p => Math.pow(p - average, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / prices.length;
    const volatility = Math.sqrt(avgSquaredDiff);

    const change = close - open;
    const changePercent = open > 0 ? (change / open) * 100 : 0;

    return {
      high,
      low,
      open,
      close,
      average,
      volatility,
      change,
      changePercent,
      dataPoints: prices.length
    };
  }

  // Get OHLC candles for charting
  getCandles(pair: string, intervalMs: number, limit: number = 100): PriceCandle[] {
    const history = this.priceHistory.get(pair) || [];
    if (history.length === 0) return [];

    const candles: PriceCandle[] = [];
    const now = Date.now();
    const startTime = now - (intervalMs * limit);

    // Group prices by candle interval
    const candleMap = new Map<number, StoredPrice[]>();

    for (const price of history) {
      if (price.timestamp < startTime) continue;
      const candleTime = Math.floor(price.timestamp / intervalMs) * intervalMs;
      if (!candleMap.has(candleTime)) {
        candleMap.set(candleTime, []);
      }
      candleMap.get(candleTime)!.push(price);
    }

    // Convert to candles
    const sortedTimes = Array.from(candleMap.keys()).sort((a, b) => a - b);
    for (const time of sortedTimes) {
      const prices = candleMap.get(time)!;
      const priceValues = prices.map(p => p.price);
      candles.push({
        timestamp: time,
        open: priceValues[0],
        high: Math.max(...priceValues),
        low: Math.min(...priceValues),
        close: priceValues[priceValues.length - 1],
        volume: prices.length
      });
    }

    return candles.slice(-limit);
  }

  // Get trend analysis
  getTrend(pair: string): { trend: 'up' | 'down' | 'sideways'; strength: number; support: number; resistance: number } | null {
    const stats1h = this.getStats(pair, 60 * 60 * 1000);
    const stats24h = this.getStats(pair, 24 * 60 * 60 * 1000);

    if (!stats1h || !stats24h) return null;

    const currentPrice = this.getPrice(pair)?.price || stats1h.close;

    // Determine trend based on moving averages
    const shortTermAvg = stats1h.average;
    const longTermAvg = stats24h.average;

    let trend: 'up' | 'down' | 'sideways';
    let strength: number;

    if (shortTermAvg > longTermAvg * 1.02) {
      trend = 'up';
      strength = ((shortTermAvg / longTermAvg) - 1) * 100;
    } else if (shortTermAvg < longTermAvg * 0.98) {
      trend = 'down';
      strength = (1 - (shortTermAvg / longTermAvg)) * 100;
    } else {
      trend = 'sideways';
      strength = 0;
    }

    return {
      trend,
      strength: Math.min(strength, 100),
      support: stats24h.low,
      resistance: stats24h.high
    };
  }

  getPriceAge(pair: string): number | null {
    const price = this.prices.get(pair);
    if (!price) return null;
    return Date.now() - price.timestamp;
  }

  isStale(pair: string, maxAgeMs: number): boolean {
    const age = this.getPriceAge(pair);
    if (age === null) return true;
    return age > maxAgeMs;
  }

  // Get all history counts for debugging
  getHistoryCounts(): { [pair: string]: number } {
    const counts: { [pair: string]: number } = {};
    for (const [pair, history] of this.priceHistory) {
      counts[pair] = history.length;
    }
    return counts;
  }
}

// Singleton instance
export const priceStore = new PriceStore();

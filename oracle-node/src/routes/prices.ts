import { Router, Request, Response } from 'express';
import { priceStore, priceAggregator, aleoSigner, twapCalculator, circuitBreaker } from '../services';
import { config } from '../config';

const router = Router();

/**
 * GET /price/:pair
 * Get latest signed price for a trading pair with TWAP data
 */
router.get('/:pair', async (req: Request, res: Response) => {
  try {
    const pair = req.params.pair.toUpperCase().replace('-', '/');

    if (!config.supportedPairs.includes(pair)) {
      return res.status(400).json({
        error: 'Unsupported pair',
        supportedPairs: config.supportedPairs
      });
    }

    // Check circuit breaker status first
    const cbState = circuitBreaker.getState_public(pair);
    if (cbState.isHalted) {
      const remainingMs = circuitBreaker.getRemainingHaltTime(pair);
      return res.status(503).json({
        error: 'Circuit breaker halted',
        pair,
        circuitBreaker: {
          isHalted: true,
          haltedAt: cbState.haltedAt,
          haltUntil: cbState.haltUntil,
          remainingMs,
          reason: cbState.lastTripReason,
          tripCount: cbState.tripCount
        }
      });
    }

    let price = priceStore.getPrice(pair);

    // If no price or stale, fetch fresh
    let signedData: any = null;

    if (!price || priceStore.isStale(pair, config.heartbeatInterval)) {
      const fresh = await priceAggregator.getAggregatedPrice(pair);
      if (fresh) {
        signedData = aleoSigner.signPrice(pair, fresh.scaledPrice, fresh.timestamp);
        priceStore.setPrice(fresh, signedData.signature, signedData.publicKey);
        price = priceStore.getPrice(pair);
      }
    }

    if (!price) {
      return res.status(503).json({
        error: 'Price temporarily unavailable',
        pair
      });
    }

    // Get fresh signed data if not already fetched
    if (!signedData) {
      signedData = aleoSigner.signPrice(pair, price.scaledPrice, price.timestamp);
    }

    // Calculate TWAP
    const history = priceStore.getHistory(pair);
    const twap = twapCalculator.calculateAllTWAPs(
      pair,
      history.map(h => ({ price: h.price, timestamp: h.timestamp })),
      price.price
    );

    return res.json({
      pair: price.pair,
      price: price.price,
      scaledPrice: price.scaledPrice.toString(),
      timestamp: price.timestamp,
      sources: price.sources,
      sourceCount: price.sourceCount,
      signature: signedData.signature,
      operatorAddress: signedData.publicKey,
      // Extended signature data for on-chain verification
      signatureR: signedData.signatureR,
      signatureS: signedData.signatureS,
      nonce: signedData.nonce,
      messageHash: signedData.messageHash,
      signatureVerified: true,
      twap: {
        '1h': twap.twap1h,
        '24h': twap.twap24h,
        '7d': twap.twap7d,
        deviation1h: twap.deviation1h,
        deviation24h: twap.deviation24h,
        dataPoints: twap.dataPoints
      },
      circuitBreaker: {
        isHalted: false,
        tripCount: cbState.tripCount
      }
    });
  } catch (error) {
    console.error('Error fetching price:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /prices
 * Get all supported pairs with latest prices, TWAP, and circuit breaker status
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const allPrices = priceStore.getAllPrices();

    // Fetch any missing prices
    for (const pair of config.supportedPairs) {
      if (!priceStore.getPrice(pair)) {
        const fresh = await priceAggregator.getAggregatedPrice(pair);
        if (fresh) {
          const signed = aleoSigner.signPrice(pair, fresh.scaledPrice, fresh.timestamp);
          priceStore.setPrice(fresh, signed.signature, signed.publicKey);
        }
      }
    }

    const prices = priceStore.getAllPrices().map(price => {
      const history = priceStore.getHistory(price.pair);
      const twap = twapCalculator.calculateAllTWAPs(
        price.pair,
        history.map(h => ({ price: h.price, timestamp: h.timestamp })),
        price.price
      );
      const cbState = circuitBreaker.getState_public(price.pair);

      return {
        pair: price.pair,
        price: price.price,
        scaledPrice: price.scaledPrice.toString(),
        timestamp: price.timestamp,
        sources: price.sources,
        sourceCount: price.sourceCount,
        signature: price.signature,
        operatorAddress: price.operatorAddress,
        age: Date.now() - price.timestamp,
        twap: {
          '1h': twap.twap1h,
          '24h': twap.twap24h,
          '7d': twap.twap7d,
          deviation1h: twap.deviation1h,
          deviation24h: twap.deviation24h,
          dataPoints: twap.dataPoints
        },
        circuitBreaker: {
          isHalted: cbState.isHalted,
          tripCount: cbState.tripCount,
          lastTripReason: cbState.lastTripReason
        }
      };
    });

    // Get circuit breaker status for all pairs
    const circuitBreakerStatus = circuitBreaker.getAllStates();

    return res.json({
      prices,
      supportedPairs: config.supportedPairs,
      timestamp: Date.now(),
      providerCount: priceAggregator.getProviderCount(),
      providers: priceAggregator.getProviderNames(),
      circuitBreaker: {
        config: circuitBreaker.getConfig(),
        states: circuitBreakerStatus
      }
    });
  } catch (error) {
    console.error('Error fetching prices:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /price/:pair/history
 * Get price history for a pair
 */
router.get('/:pair/history', (req: Request, res: Response) => {
  try {
    const pair = req.params.pair.toUpperCase().replace('-', '/');
    const limit = parseInt(req.query.limit as string) || 100;

    if (!config.supportedPairs.includes(pair)) {
      return res.status(400).json({
        error: 'Unsupported pair',
        supportedPairs: config.supportedPairs
      });
    }

    const history = priceStore.getHistory(pair, limit);

    // Calculate TWAP for historical context
    const currentPrice = priceStore.getPrice(pair);
    const twap = currentPrice
      ? twapCalculator.calculateAllTWAPs(
          pair,
          history.map(h => ({ price: h.price, timestamp: h.timestamp })),
          currentPrice.price
        )
      : null;

    return res.json({
      pair,
      history: history.map(h => ({
        price: h.price,
        scaledPrice: h.scaledPrice.toString(),
        timestamp: h.timestamp,
        sources: h.sources
      })),
      count: history.length,
      twap: twap ? {
        '1h': twap.twap1h,
        '24h': twap.twap24h,
        '7d': twap.twap7d
      } : null
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /price/:pair/twap
 * Get detailed TWAP data for a pair
 */
router.get('/:pair/twap', (req: Request, res: Response) => {
  try {
    const pair = req.params.pair.toUpperCase().replace('-', '/');

    if (!config.supportedPairs.includes(pair)) {
      return res.status(400).json({
        error: 'Unsupported pair',
        supportedPairs: config.supportedPairs
      });
    }

    const currentPrice = priceStore.getPrice(pair);
    if (!currentPrice) {
      return res.status(503).json({
        error: 'Price data not available',
        pair
      });
    }

    const history = priceStore.getHistory(pair);
    const twap = twapCalculator.calculateAllTWAPs(
      pair,
      history.map(h => ({ price: h.price, timestamp: h.timestamp })),
      currentPrice.price
    );

    return res.json({
      pair,
      currentPrice: currentPrice.price,
      twap: {
        '1h': {
          value: twap.twap1h,
          deviation: twap.deviation1h,
          dataPoints: twap.dataPoints['1h']
        },
        '24h': {
          value: twap.twap24h,
          deviation: twap.deviation24h,
          dataPoints: twap.dataPoints['24h']
        },
        '7d': {
          value: twap.twap7d,
          dataPoints: twap.dataPoints['7d']
        }
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error fetching TWAP:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /circuit-breaker
 * Get circuit breaker status for all pairs
 */
router.get('/circuit-breaker/status', (_req: Request, res: Response) => {
  try {
    const states = circuitBreaker.getAllStates();
    const config_cb = circuitBreaker.getConfig();

    return res.json({
      config: config_cb,
      states,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error fetching circuit breaker status:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /circuit-breaker/:pair/resume
 * Manually resume a halted pair (admin only)
 */
router.post('/circuit-breaker/:pair/resume', (req: Request, res: Response) => {
  try {
    const pair = req.params.pair.toUpperCase().replace('-', '/');

    if (!config.supportedPairs.includes(pair)) {
      return res.status(400).json({
        error: 'Unsupported pair',
        supportedPairs: config.supportedPairs
      });
    }

    circuitBreaker.resume(pair);

    return res.json({
      success: true,
      pair,
      message: `Circuit breaker resumed for ${pair}`
    });
  } catch (error) {
    console.error('Error resuming circuit breaker:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /price/:pair/stats
 * Get price statistics for different time windows
 */
router.get('/:pair/stats', (req: Request, res: Response) => {
  try {
    const pair = req.params.pair.toUpperCase().replace('-', '/');
    const window = req.query.window as string || '1h';

    if (!config.supportedPairs.includes(pair)) {
      return res.status(400).json({
        error: 'Unsupported pair',
        supportedPairs: config.supportedPairs
      });
    }

    // Parse window to milliseconds
    const windowMs: { [key: string]: number } = {
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    };

    const ms = windowMs[window] || windowMs['1h'];

    const stats = priceStore.getStats(pair, ms);
    const trend = priceStore.getTrend(pair);

    if (!stats) {
      return res.status(503).json({
        error: 'Insufficient data for statistics',
        pair
      });
    }

    return res.json({
      pair,
      window,
      stats,
      trend,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /price/:pair/candles
 * Get OHLC candles for charting
 */
router.get('/:pair/candles', (req: Request, res: Response) => {
  try {
    const pair = req.params.pair.toUpperCase().replace('-', '/');
    const interval = req.query.interval as string || '1m';
    const limit = parseInt(req.query.limit as string) || 100;

    if (!config.supportedPairs.includes(pair)) {
      return res.status(400).json({
        error: 'Unsupported pair',
        supportedPairs: config.supportedPairs
      });
    }

    // Parse interval to milliseconds
    const intervalMs: { [key: string]: number } = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000
    };

    const ms = intervalMs[interval] || intervalMs['1m'];
    const candles = priceStore.getCandles(pair, ms, Math.min(limit, 500));

    return res.json({
      pair,
      interval,
      candles,
      count: candles.length,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error fetching candles:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /price/:pair/analysis
 * Get comprehensive analysis for a pair
 */
router.get('/:pair/analysis', (req: Request, res: Response) => {
  try {
    const pair = req.params.pair.toUpperCase().replace('-', '/');

    if (!config.supportedPairs.includes(pair)) {
      return res.status(400).json({
        error: 'Unsupported pair',
        supportedPairs: config.supportedPairs
      });
    }

    const currentPrice = priceStore.getPrice(pair);
    if (!currentPrice) {
      return res.status(503).json({
        error: 'Price data not available',
        pair
      });
    }

    // Get all time window stats
    const stats5m = priceStore.getStats(pair, 5 * 60 * 1000);
    const stats1h = priceStore.getStats(pair, 60 * 60 * 1000);
    const stats24h = priceStore.getStats(pair, 24 * 60 * 60 * 1000);

    // Get trend
    const trend = priceStore.getTrend(pair);

    // Get TWAP
    const history = priceStore.getHistory(pair);
    const twap = twapCalculator.calculateAllTWAPs(
      pair,
      history.map(h => ({ price: h.price, timestamp: h.timestamp })),
      currentPrice.price
    );

    // Get circuit breaker state
    const cbState = circuitBreaker.getState_public(pair);

    // Get candles for chart
    const candles1m = priceStore.getCandles(pair, 60 * 1000, 60); // Last 60 minutes
    const candles5m = priceStore.getCandles(pair, 5 * 60 * 1000, 100); // Last ~8 hours

    return res.json({
      pair,
      currentPrice: {
        price: currentPrice.price,
        scaledPrice: currentPrice.scaledPrice.toString(),
        timestamp: currentPrice.timestamp,
        sources: currentPrice.sources,
        sourceCount: currentPrice.sourceCount,
        signature: currentPrice.signature,
        signatureVerified: !!currentPrice.signature
      },
      stats: {
        '5m': stats5m,
        '1h': stats1h,
        '24h': stats24h
      },
      trend,
      twap: {
        '1h': { value: twap.twap1h, deviation: twap.deviation1h },
        '24h': { value: twap.twap24h, deviation: twap.deviation24h },
        '7d': { value: twap.twap7d }
      },
      circuitBreaker: {
        isHalted: cbState.isHalted,
        tripCount: cbState.tripCount,
        lastTripReason: cbState.lastTripReason,
        config: circuitBreaker.getConfig()
      },
      charts: {
        candles1m,
        candles5m
      },
      historyCount: history.length,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error fetching analysis:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

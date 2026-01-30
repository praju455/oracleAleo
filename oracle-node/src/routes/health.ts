import { Router, Request, Response } from 'express';
import { priceAggregator, priceStore, aleoSigner } from '../services';
import { config } from '../config';

const router = Router();

/**
 * GET /health
 * Health check endpoint with source status
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const sourceStatus = await priceAggregator.healthCheck();
    const healthySources = Object.values(sourceStatus).filter(v => v).length;
    const totalSources = Object.keys(sourceStatus).length;

    const priceStatus: { [key: string]: { available: boolean; age: number | null } } = {};
    for (const pair of config.supportedPairs) {
      const age = priceStore.getPriceAge(pair);
      priceStatus[pair] = {
        available: age !== null,
        age
      };
    }

    const isHealthy = healthySources >= config.minSources;

    return res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: Date.now(),
      operator: aleoSigner.getOperatorAddress(),
      sources: {
        status: sourceStatus,
        healthy: healthySources,
        total: totalSources,
        required: config.minSources
      },
      prices: priceStatus,
      config: {
        supportedPairs: config.supportedPairs,
        fetchInterval: config.fetchInterval,
        heartbeatInterval: config.heartbeatInterval,
        outlierThreshold: config.outlierThreshold
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    return res.status(500).json({
      status: 'error',
      error: 'Health check failed'
    });
  }
});

/**
 * GET /operator
 * Get operator information
 */
router.get('/operator', (_req: Request, res: Response) => {
  return res.json({
    address: aleoSigner.getOperatorAddress(),
    supportedPairs: config.supportedPairs,
    timestamp: Date.now()
  });
});

export default router;

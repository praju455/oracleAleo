import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_ORACLE_API_URL || 'http://localhost:3000';

export interface TWAPData {
  '1h': number;
  '24h': number;
  '7d': number;
  deviation1h: number;
  deviation24h: number;
  dataPoints: {
    '1h': number;
    '24h': number;
    '7d': number;
  };
}

export interface CircuitBreakerStatus {
  isHalted: boolean;
  tripCount: number;
  lastTripReason?: string | null;
  haltedAt?: number;
  haltUntil?: number;
  remainingMs?: number;
}

export interface SignatureData {
  signature?: string;
  signatureR?: string;
  signatureS?: string;
  nonce?: string;
  messageHash?: string;
  signatureVerified?: boolean;
}

export interface PriceData {
  pair: string;
  price: number;
  scaledPrice: string;
  timestamp: number;
  sources: string[];
  sourceCount: number;
  signature?: string;
  operatorAddress?: string;
  age?: number;
  twap?: TWAPData;
  circuitBreaker?: CircuitBreakerStatus;
  // Extended signature data
  signatureR?: string;
  signatureS?: string;
  nonce?: string;
  messageHash?: string;
  signatureVerified?: boolean;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'error';
  timestamp: number;
  operator: string;
  sources: {
    status: { [key: string]: boolean };
    healthy: number;
    total: number;
    required: number;
  };
}

export interface CircuitBreakerConfig {
  enabled: boolean;
  maxPriceChangePercent: number;
  checkWindowMs: number;
  haltDurationMs: number;
}

export interface AllPricesResponse {
  prices: PriceData[];
  supportedPairs: string[];
  timestamp: number;
  providerCount: number;
  providers: string[];
  circuitBreaker: {
    config: CircuitBreakerConfig;
    states: CircuitBreakerStatus[];
  };
}

export interface TWAPResponse {
  pair: string;
  currentPrice: number;
  twap: {
    '1h': { value: number; deviation: number; dataPoints: number };
    '24h': { value: number; deviation: number; dataPoints: number };
    '7d': { value: number; dataPoints: number };
  };
  timestamp: number;
}

export interface PriceStats {
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

export interface TrendData {
  trend: 'up' | 'down' | 'sideways';
  strength: number;
  support: number;
  resistance: number;
}

export interface PriceCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface AnalysisResponse {
  pair: string;
  currentPrice: {
    price: number;
    scaledPrice: string;
    timestamp: number;
    sources: string[];
    sourceCount: number;
    signature?: string;
    signatureVerified: boolean;
  };
  stats: {
    '5m': PriceStats | null;
    '1h': PriceStats | null;
    '24h': PriceStats | null;
  };
  trend: TrendData | null;
  twap: {
    '1h': { value: number; deviation: number };
    '24h': { value: number; deviation: number };
    '7d': { value: number };
  };
  circuitBreaker: {
    isHalted: boolean;
    tripCount: number;
    lastTripReason?: string | null;
    config: CircuitBreakerConfig;
  };
  charts: {
    candles1m: PriceCandle[];
    candles5m: PriceCandle[];
  };
  historyCount: number;
  timestamp: number;
}

export const oracleAPI = {
  // Get price for a specific pair
  async getPrice(pair: string): Promise<PriceData> {
    const response = await axios.get(`${API_BASE_URL}/price/${pair.replace('/', '-')}`);
    return response.data;
  },

  // Get all prices
  async getAllPrices(): Promise<AllPricesResponse> {
    const response = await axios.get(`${API_BASE_URL}/prices`);
    return response.data;
  },

  // Get price history
  async getPriceHistory(pair: string, limit: number = 100): Promise<{ pair: string; history: PriceData[]; count: number; twap?: TWAPData }> {
    const response = await axios.get(`${API_BASE_URL}/price/${pair.replace('/', '-')}/history`, {
      params: { limit }
    });
    return response.data;
  },

  // Get TWAP data for a pair
  async getTWAP(pair: string): Promise<TWAPResponse> {
    const response = await axios.get(`${API_BASE_URL}/price/${pair.replace('/', '-')}/twap`);
    return response.data;
  },

  // Get circuit breaker status
  async getCircuitBreakerStatus(): Promise<{ config: CircuitBreakerConfig; states: CircuitBreakerStatus[]; timestamp: number }> {
    const response = await axios.get(`${API_BASE_URL}/circuit-breaker/status`);
    return response.data;
  },

  // Resume circuit breaker for a pair (admin)
  async resumeCircuitBreaker(pair: string): Promise<{ success: boolean; pair: string; message: string }> {
    const response = await axios.post(`${API_BASE_URL}/circuit-breaker/${pair.replace('/', '-')}/resume`);
    return response.data;
  },

  // Get health status
  async getHealth(): Promise<HealthStatus> {
    const response = await axios.get(`${API_BASE_URL}/health`);
    return response.data;
  },

  // Get operator info
  async getOperator(): Promise<{ address: string; supportedPairs: string[]; timestamp: number }> {
    const response = await axios.get(`${API_BASE_URL}/operator`);
    return response.data;
  },

  // Get price statistics for a time window
  async getStats(pair: string, window: string = '1h'): Promise<{ pair: string; window: string; stats: PriceStats; trend: TrendData | null; timestamp: number }> {
    const response = await axios.get(`${API_BASE_URL}/price/${pair.replace('/', '-')}/stats`, {
      params: { window }
    });
    return response.data;
  },

  // Get OHLC candles for charting
  async getCandles(pair: string, interval: string = '1m', limit: number = 100): Promise<{ pair: string; interval: string; candles: PriceCandle[]; count: number; timestamp: number }> {
    const response = await axios.get(`${API_BASE_URL}/price/${pair.replace('/', '-')}/candles`, {
      params: { interval, limit }
    });
    return response.data;
  },

  // Get comprehensive analysis for a pair
  async getAnalysis(pair: string): Promise<AnalysisResponse> {
    const response = await axios.get(`${API_BASE_URL}/price/${pair.replace('/', '-')}/analysis`);
    return response.data;
  }
};

export default oracleAPI;

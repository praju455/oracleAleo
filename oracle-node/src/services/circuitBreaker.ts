import { logger } from './logger';

export interface CircuitBreakerConfig {
  maxPriceChangePercent: number;   // Maximum allowed price change (e.g., 0.10 = 10%)
  checkWindowMs: number;           // Time window to check for rapid changes (e.g., 60000 = 1 min)
  haltDurationMs: number;          // How long to halt after breaker trips (e.g., 300000 = 5 min)
  enabled: boolean;
}

export interface CircuitBreakerState {
  pair: string;
  isHalted: boolean;
  haltedAt: number | null;
  haltUntil: number | null;
  lastPrice: number | null;
  lastPriceTimestamp: number | null;
  tripCount: number;               // Number of times circuit has tripped
  lastTripReason: string | null;
}

export interface PriceCheckResult {
  allowed: boolean;
  reason?: string;
  priceChange?: number;
  state: CircuitBreakerState;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  maxPriceChangePercent: 0.10,     // 10% max change
  checkWindowMs: 60000,            // 1 minute window
  haltDurationMs: 300000,          // 5 minute halt
  enabled: true
};

export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private states: Map<string, CircuitBreakerState> = new Map();

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.info(`Circuit breaker initialized: ${this.config.maxPriceChangePercent * 100}% threshold, ${this.config.haltDurationMs / 1000}s halt duration`);
  }

  private getState(pair: string): CircuitBreakerState {
    if (!this.states.has(pair)) {
      this.states.set(pair, {
        pair,
        isHalted: false,
        haltedAt: null,
        haltUntil: null,
        lastPrice: null,
        lastPriceTimestamp: null,
        tripCount: 0,
        lastTripReason: null
      });
    }
    return this.states.get(pair)!;
  }

  /**
   * Check if a new price submission is allowed
   * Returns whether the price update should proceed
   */
  checkPrice(pair: string, newPrice: number): PriceCheckResult {
    if (!this.config.enabled) {
      return {
        allowed: true,
        reason: 'Circuit breaker disabled',
        state: this.getState(pair)
      };
    }

    const state = this.getState(pair);
    const now = Date.now();

    // Check if currently halted
    if (state.isHalted && state.haltUntil) {
      if (now < state.haltUntil) {
        const remainingMs = state.haltUntil - now;
        return {
          allowed: false,
          reason: `Circuit breaker halted. Resumes in ${Math.ceil(remainingMs / 1000)}s`,
          state
        };
      } else {
        // Halt period expired, resume
        this.resume(pair);
        logger.info(`Circuit breaker auto-resumed for ${pair}`);
      }
    }

    // If no previous price, allow this one
    if (state.lastPrice === null || state.lastPriceTimestamp === null) {
      this.updateLastPrice(pair, newPrice);
      return {
        allowed: true,
        reason: 'First price recorded',
        state: this.getState(pair)
      };
    }

    // Check if last price is within the check window
    const timeSinceLastPrice = now - state.lastPriceTimestamp;
    if (timeSinceLastPrice > this.config.checkWindowMs) {
      // Last price is too old, reset and allow
      this.updateLastPrice(pair, newPrice);
      return {
        allowed: true,
        reason: 'Previous price outside check window',
        state: this.getState(pair)
      };
    }

    // Calculate price change
    const priceChange = Math.abs(newPrice - state.lastPrice) / state.lastPrice;

    // Check if price change exceeds threshold
    if (priceChange > this.config.maxPriceChangePercent) {
      // Trip the circuit breaker
      this.trip(pair, `Price change of ${(priceChange * 100).toFixed(2)}% exceeds ${this.config.maxPriceChangePercent * 100}% threshold`);
      return {
        allowed: false,
        reason: `Circuit breaker tripped: ${(priceChange * 100).toFixed(2)}% change exceeds threshold`,
        priceChange,
        state: this.getState(pair)
      };
    }

    // Price change is within acceptable range
    this.updateLastPrice(pair, newPrice);
    return {
      allowed: true,
      priceChange,
      state: this.getState(pair)
    };
  }

  /**
   * Trip the circuit breaker for a pair
   */
  private trip(pair: string, reason: string): void {
    const state = this.getState(pair);
    const now = Date.now();

    state.isHalted = true;
    state.haltedAt = now;
    state.haltUntil = now + this.config.haltDurationMs;
    state.tripCount++;
    state.lastTripReason = reason;

    logger.warn(`CIRCUIT BREAKER TRIPPED for ${pair}: ${reason}. Halted until ${new Date(state.haltUntil).toISOString()}`);
  }

  /**
   * Manually resume a halted pair
   */
  resume(pair: string): void {
    const state = this.getState(pair);
    state.isHalted = false;
    state.haltedAt = null;
    state.haltUntil = null;
    logger.info(`Circuit breaker resumed for ${pair}`);
  }

  /**
   * Update the last known price for a pair
   */
  private updateLastPrice(pair: string, price: number): void {
    const state = this.getState(pair);
    state.lastPrice = price;
    state.lastPriceTimestamp = Date.now();
  }

  /**
   * Force halt a pair (admin action)
   */
  forceHalt(pair: string, reason: string = 'Manual halt'): void {
    this.trip(pair, reason);
  }

  /**
   * Get status of all circuit breakers
   */
  getAllStates(): CircuitBreakerState[] {
    return Array.from(this.states.values());
  }

  /**
   * Get status for a specific pair
   */
  getState_public(pair: string): CircuitBreakerState {
    return this.getState(pair);
  }

  /**
   * Check if a specific pair is halted
   */
  isHalted(pair: string): boolean {
    const state = this.getState(pair);
    const now = Date.now();

    if (state.isHalted && state.haltUntil) {
      if (now >= state.haltUntil) {
        this.resume(pair);
        return false;
      }
      return true;
    }
    return false;
  }

  /**
   * Get remaining halt time in milliseconds
   */
  getRemainingHaltTime(pair: string): number {
    const state = this.getState(pair);
    if (!state.isHalted || !state.haltUntil) return 0;

    const remaining = state.haltUntil - Date.now();
    return Math.max(0, remaining);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info(`Circuit breaker config updated: ${JSON.stringify(this.config)}`);
  }

  /**
   * Get current configuration
   */
  getConfig(): CircuitBreakerConfig {
    return { ...this.config };
  }
}

// Singleton instance with default config
export const circuitBreaker = new CircuitBreaker();

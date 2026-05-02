/**
 * Simple Circuit Breaker implementation for HiveMind agents.
 * Prevents overwhelming a failing model/service.
 */

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
}

export class CircuitBreaker {
  private failures = 0;
  private state = CircuitState.CLOSED;
  private lastFailureTime = 0;

  constructor(
    private threshold: number = 3,
    private resetTimeoutMs: number = 60000 // 1 minute
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      const now = Date.now();
      if (now - this.lastFailureTime > this.resetTimeoutMs) {
        console.log('[CircuitBreaker] Reset timeout reached. Moving to HALF-OPEN (testing recovery)');
        this.state = CircuitState.CLOSED;
        this.failures = 0;
      } else {
        throw new Error(`Circuit Breaker is OPEN. Cooling down for ${Math.ceil((this.resetTimeoutMs - (now - this.lastFailureTime)) / 1000)}s`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = CircuitState.CLOSED;
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.threshold) {
      console.warn(`[CircuitBreaker] Threshold ${this.threshold} reached. Opening circuit.`);
      this.state = CircuitState.OPEN;
    }
  }

  getState() {
    return this.state;
  }
}

// Registry for per-agent circuit breakers
const breakers: Record<string, CircuitBreaker> = {};

export const getBreaker = (key: string): CircuitBreaker => {
  if (!breakers[key]) {
    breakers[key] = new CircuitBreaker();
  }
  return breakers[key];
};

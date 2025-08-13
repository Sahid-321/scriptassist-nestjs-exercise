import { Injectable, Logger } from '@nestjs/common';
import CircuitBreaker from 'opossum';
type CBOptions = ConstructorParameters<typeof CircuitBreaker>[1];

/**
 * A generic circuit breaker service for protecting external calls.
 * Usage: Inject and wrap any async function (e.g., HTTP, DB, cache, etc).
 */
@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private breakers = new Map<string, InstanceType<typeof CircuitBreaker>>();

  /**
   * Get or create a circuit breaker for a given key and options.
   * @param key Unique key for the breaker (e.g., 'external-api')
   * @param action The async function to protect
   * @param options Opossum circuit breaker options
   */
  getBreaker<TArgs extends any[], TResult>(
    key: string,
    action: (...args: TArgs) => Promise<TResult>,
    options?: Partial<CBOptions>
  ): InstanceType<typeof CircuitBreaker> {
    if (this.breakers.has(key)) {
      return this.breakers.get(key) as InstanceType<typeof CircuitBreaker>;
    }
    const breaker = new CircuitBreaker(action, {
      timeout: 10000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
      ...options,
    });
    breaker.on('open', () => this.logger.warn(`Circuit breaker [${key}] OPEN`));
    breaker.on('halfOpen', () => this.logger.log(`Circuit breaker [${key}] HALF-OPEN`));
    breaker.on('close', () => this.logger.log(`Circuit breaker [${key}] CLOSED`));
    breaker.on('reject', () => this.logger.warn(`Circuit breaker [${key}] REJECTED`));
    breaker.on('timeout', () => this.logger.warn(`Circuit breaker [${key}] TIMEOUT`));
    breaker.on('failure', (err: any) => this.logger.error(`Circuit breaker [${key}] FAILURE`, err));
    this.breakers.set(key, breaker);
    return breaker;
  }
}

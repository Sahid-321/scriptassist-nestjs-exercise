import { Injectable, Logger } from '@nestjs/common';
import CircuitBreaker from 'opossum';

/**
 * FaultIsolationService: Provides utilities to enforce fault isolation boundaries.
 * - Use to wrap external calls or critical sections with circuit breakers.
 * - Ensures failures in one boundary do not cascade to others.
 */
@Injectable()
export class FaultIsolationService {
  private readonly logger = new Logger(FaultIsolationService.name);

  /**
   * Wrap a function with a circuit breaker for fault isolation.
   * @param key Unique key for the isolation boundary
   * @param fn The async function to protect
   * @param options Circuit breaker options
   */
  isolate<TArgs extends any[], TResult>(
    key: string,
    fn: (...args: TArgs) => Promise<TResult>,
    options?: ConstructorParameters<typeof CircuitBreaker>[1]
  ): (...args: TArgs) => Promise<TResult> {
    const breaker = new CircuitBreaker(fn, {
      timeout: 10000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
      ...(options || {}),
    });
    breaker.on('open', () => this.logger.warn(`Fault isolation boundary [${key}] OPEN`));
    breaker.on('close', () => this.logger.log(`Fault isolation boundary [${key}] CLOSED`));
    breaker.on('failure', (err: any) => this.logger.error(`Fault isolation boundary [${key}] FAILURE`, err));
    return (...args: TArgs) => breaker.fire(...args);
  }
}

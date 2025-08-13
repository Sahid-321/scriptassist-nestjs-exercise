import { Injectable, Logger } from '@nestjs/common';

/**
 * PredictablePerformanceService: Provides utilities to enforce predictable latency and throughput.
 * - Use to wrap async functions with timeouts and rate limits.
 * - Ensures operations do not exceed expected latency or throughput.
 */
@Injectable()
export class PredictablePerformanceService {
  private readonly logger = new Logger(PredictablePerformanceService.name);

  /**
   * Wrap an async function with a timeout (in ms).
   */
  withTimeout<TArgs extends any[], TResult>(fn: (...args: TArgs) => Promise<TResult>, timeoutMs = 5000): (...args: TArgs) => Promise<TResult> {
    return (...args: TArgs) => {
      return Promise.race([
        fn(...args),
        new Promise<TResult>((_, reject) => setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)),
      ]);
    };
  }

  /**
   * Wrap an async function with a simple rate limiter (token bucket).
   * @param fn The async function to protect
   * @param rate Number of allowed calls per interval
   * @param intervalMs Interval in milliseconds
   */
  withRateLimit<TArgs extends any[], TResult>(fn: (...args: TArgs) => Promise<TResult>, rate = 10, intervalMs = 1000): (...args: TArgs) => Promise<TResult> {
    let tokens = rate;
    let lastRefill = Date.now();
    const queue: { args: TArgs; resolve: (v: TResult) => void; reject: (e: any) => void }[] = [];

    const refill = () => {
      const now = Date.now();
      const elapsed = now - lastRefill;
      if (elapsed > intervalMs) {
        tokens = rate;
        lastRefill = now;
        while (tokens > 0 && queue.length > 0) {
          const { args, resolve, reject } = queue.shift()!;
          tokens--;
          fn(...args).then(resolve).catch(reject);
        }
      }
    };

    setInterval(refill, intervalMs / 2);

    return (...args: TArgs) => {
      refill();
      if (tokens > 0) {
        tokens--;
        return fn(...args);
      } else {
        return new Promise<TResult>((resolve, reject) => {
          queue.push({ args, resolve, reject });
          this.logger.warn(`Rate limit exceeded, request queued (queue size: ${queue.length})`);
        });
      }
    };
  }
}

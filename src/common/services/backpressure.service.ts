import { Injectable, Logger } from '@nestjs/common';

/**
 * BackpressureService: Provides utilities to apply backpressure to external calls or resource-intensive operations.
 * - Use to limit concurrency and queue length for async operations.
 * - Prevents resource exhaustion and protects system stability.
 */
@Injectable()
export class BackpressureService {
  private readonly logger = new Logger(BackpressureService.name);

  /**
   * Create a backpressure-protected async function.
   * @param fn The async function to protect
   * @param maxConcurrency Maximum number of concurrent executions
   * @param maxQueue Maximum number of queued requests (0 = unlimited)
   */
  withBackpressure<TArgs extends any[], TResult>(
    fn: (...args: TArgs) => Promise<TResult>,
    maxConcurrency = 10,
    maxQueue = 100
  ): (...args: TArgs) => Promise<TResult> {
    let active = 0;
    const queue: { args: TArgs; resolve: (v: TResult) => void; reject: (e: any) => void }[] = [];

    const tryNext = () => {
      if (active < maxConcurrency && queue.length > 0) {
        const { args, resolve, reject } = queue.shift()!;
        run(args, resolve, reject);
      }
    };

    const run = (args: TArgs, resolve: (v: TResult) => void, reject: (e: any) => void) => {
      active++;
      fn(...args)
        .then(resolve)
        .catch(reject)
        .finally(() => {
          active--;
          tryNext();
        });
    };

    return (...args: TArgs) => {
      if (active < maxConcurrency) {
        return new Promise<TResult>((resolve, reject) => run(args, resolve, reject));
      } else if (maxQueue === 0 || queue.length < maxQueue) {
        return new Promise<TResult>((resolve, reject) => {
          queue.push({ args, resolve, reject });
          this.logger.warn(`Backpressure: request queued (queue size: ${queue.length})`);
        });
      } else {
        this.logger.error('Backpressure: queue overflow, request rejected');
        return Promise.reject(new Error('Backpressure: queue overflow'));
      }
    };
  }
}

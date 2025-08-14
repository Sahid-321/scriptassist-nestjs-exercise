import { PredictablePerformanceService } from './predictable-performance.service';

describe('PredictablePerformanceService', () => {
  let service: PredictablePerformanceService;

  beforeEach(() => {
    service = new PredictablePerformanceService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should timeout slow functions', async () => {
    const slow = async () => {
      await new Promise((r) => setTimeout(r, 50));
      return 'done';
    };
    const wrapped = service.withTimeout(slow, 10);
    await expect(wrapped()).rejects.toThrow('Operation timed out');
  });

  it('should rate limit calls', async () => {
    let count = 0;
    const fn = async () => {
      count++;
      return 'ok';
    };
    const wrapped = service.withRateLimit(fn, 1, 100);
    const p1 = wrapped();
    const p2 = wrapped();
    await Promise.all([p1, p2]);
    // Only one call should execute immediately, the other after interval
    expect(count).toBe(2);
  });
});

import { BackpressureService } from './backpressure.service';

describe('BackpressureService', () => {
  let service: BackpressureService;

  beforeEach(() => {
    service = new BackpressureService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should limit concurrency', async () => {
    let running = 0;
    let maxRunning = 0;
    const fn = async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 10));
      running--;
      return 'ok';
    };
    const wrapped = service.withBackpressure(fn, 2, 10);
    await Promise.all([wrapped(), wrapped(), wrapped(), wrapped()]);
    expect(maxRunning).toBeLessThanOrEqual(2);
  });
});

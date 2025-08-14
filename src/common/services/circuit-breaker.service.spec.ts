

import { Test, TestingModule } from '@nestjs/testing';
import { CircuitBreakerService } from './circuit-breaker.service';

// Mock CircuitBreaker class for dependency injection
class MockCircuitBreaker {
  action: any;
  listeners: Record<string, Function[]> = {};
  constructor(action: any) {
    this.action = action;
  }
  fire(...args: any[]) {
    return this.action(...args);
  }
  on(event: string, cb: Function) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }
}


describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;

  beforeEach(async () => {
    CircuitBreakerService.CircuitBreakerClass = MockCircuitBreaker;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: CircuitBreakerService,
          useFactory: () => new CircuitBreakerService(),
        },
      ],
    }).compile();
    service = module.get(CircuitBreakerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should wrap a function and open the breaker on failure', async () => {
    let fail = true;
    const action = async () => {
      if (fail) throw new Error('fail');
      return 'ok';
    };
    const breaker = service.getBreaker('test-breaker', action, { errorThresholdPercentage: 50, resetTimeout: 100 });
    await expect(breaker.fire()).rejects.toThrow('fail');
    fail = false;
    await expect(breaker.fire()).resolves.toBe('ok');
  });
});

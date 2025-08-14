import { Test, TestingModule } from '@nestjs/testing';
import { SelfHealingService } from './self-healing.service';
import { CircuitBreakerService } from './circuit-breaker.service';

describe('SelfHealingService', () => {
  let service: SelfHealingService;
  let circuitBreakerService: CircuitBreakerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SelfHealingService,
        {
          provide: CircuitBreakerService,
          useValue: {
            getBreaker: jest.fn(() => {
              return {
                on: jest.fn(),
              };
            }),
          },
        },
      ],
    }).compile();
    service = module.get(SelfHealingService);
    circuitBreakerService = module.get(CircuitBreakerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should register a self-healing handler', () => {
    const onHeal = jest.fn();
    service.registerSelfHealing('breaker-key', onHeal);
    expect(circuitBreakerService.getBreaker).toHaveBeenCalledWith('breaker-key', expect.any(Function), { allowWarmUp: true });
  });
});

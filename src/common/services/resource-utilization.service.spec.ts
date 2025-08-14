import { ResourceUtilizationService } from './resource-utilization.service';

describe('ResourceUtilizationService', () => {
  let service: ResourceUtilizationService;

  beforeEach(() => {
    service = new ResourceUtilizationService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should report memory as healthy for high threshold', () => {
    expect(service.isMemoryHealthy(100000)).toBe(true);
  });

  it('should report event loop as healthy for high threshold', async () => {
    expect(await service.isEventLoopHealthy(1000)).toBe(true);
  });
});

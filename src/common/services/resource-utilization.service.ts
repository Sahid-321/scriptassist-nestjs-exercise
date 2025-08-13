import { Injectable, Logger } from '@nestjs/common';

/**
 * ResourceUtilizationService: Monitors and manages resource usage for efficient utilization.
 * - Provides methods to check and log CPU, memory, and event loop usage.
 * - Can be extended to trigger alerts or throttle workloads.
 */
@Injectable()
export class ResourceUtilizationService {
  private readonly logger = new Logger(ResourceUtilizationService.name);

  /**
   * Log current memory and CPU usage.
   */
  logUsage(context = 'ResourceUtilization') {
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();
    this.logger.log(`[${context}] Memory: RSS=${(mem.rss/1048576).toFixed(2)}MB HeapUsed=${(mem.heapUsed/1048576).toFixed(2)}MB HeapTotal=${(mem.heapTotal/1048576).toFixed(2)}MB`);
    this.logger.log(`[${context}] CPU: User=${(cpu.user/1000).toFixed(2)}ms System=${(cpu.system/1000).toFixed(2)}ms`);
  }

  /**
   * Returns true if memory usage is below the given threshold (in MB).
   */
  isMemoryHealthy(maxRssMB = 512): boolean {
    const mem = process.memoryUsage();
    return mem.rss / 1048576 < maxRssMB;
  }

  /**
   * Returns true if event loop lag is below the given threshold (in ms).
   */
  async isEventLoopHealthy(maxLagMs = 100): Promise<boolean> {
    const start = process.hrtime.bigint();
    await new Promise((resolve) => setImmediate(resolve));
    const end = process.hrtime.bigint();
    const lag = Number(end - start) / 1e6;
    return lag < maxLagMs;
  }
}

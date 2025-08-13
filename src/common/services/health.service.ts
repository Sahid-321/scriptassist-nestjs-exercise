import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { CacheService } from './cache.service';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  checks: {
    database: HealthCheck;
    cache: HealthCheck;
    memory: HealthCheck;
    redis?: HealthCheck;
  };
}

export interface HealthCheck {
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  error?: string;
  details?: Record<string, any>;
}

export interface Metrics {
  uptime: number;
  memory: {
    used: number;
    total: number;
    usage: number;
  };
  requests: {
    total: number;
    successful: number;
    failed: number;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
  };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private startTime = Date.now();
  private requestMetrics = {
    total: 0,
    successful: 0,
    failed: 0,
  };
  private cacheMetrics = {
    hits: 0,
    misses: 0,
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly cacheService: CacheService,
  ) {}

  async getHealthStatus(): Promise<HealthStatus> {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkCache(),
      this.checkMemory(),
    ]);

    const databaseCheck = checks[0].status === 'fulfilled' ? checks[0].value : this.createFailedCheck('Database connection failed');
    const cacheCheck = checks[1].status === 'fulfilled' ? checks[1].value : this.createFailedCheck('Cache check failed');
    const memoryCheck = checks[2].status === 'fulfilled' ? checks[2].value : this.createFailedCheck('Memory check failed');

    const allChecks = { database: databaseCheck, cache: cacheCheck, memory: memoryCheck };
    const overallStatus = this.determineOverallStatus(allChecks);

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      checks: allChecks,
    };
  }

  async getReadinessStatus() {
    const health = await this.getHealthStatus();
    const isReady = health.status === 'healthy' || health.status === 'degraded';
    
    return {
      ready: isReady,
      timestamp: new Date().toISOString(),
      checks: health.checks,
    };
  }

  getMetrics(): Metrics {
    const memoryUsage = process.memoryUsage();
    const uptime = Date.now() - this.startTime;

    return {
      uptime: Math.floor(uptime / 1000),
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        usage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
      },
      requests: { ...this.requestMetrics },
      cache: {
        hits: this.cacheMetrics.hits,
        misses: this.cacheMetrics.misses,
        hitRate: this.calculateHitRate(),
      },
    };
  }

  // Metrics tracking methods
  incrementRequestCount() {
    this.requestMetrics.total++;
  }

  incrementSuccessfulRequests() {
    this.requestMetrics.successful++;
  }

  incrementFailedRequests() {
    this.requestMetrics.failed++;
  }

  incrementCacheHit() {
    this.cacheMetrics.hits++;
  }

  incrementCacheMiss() {
    this.cacheMetrics.misses++;
  }

  private async checkDatabase(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      if (!this.dataSource.isInitialized) {
        throw new Error('Database not initialized');
      }

      await this.dataSource.query('SELECT 1');
      const responseTime = Date.now() - startTime;

      return {
        status: responseTime > 1000 ? 'degraded' : 'up',
        responseTime,
        details: {
          connected: true,
          responseTime: `${responseTime}ms`,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.logger.error('Database health check failed', error);
      
      return {
        status: 'down',
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown database error',
      };
    }
  }

  private async checkCache(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const testKey = 'health-check';
      const testValue = 'test';
      
      await this.cacheService.set(testKey, testValue, 10);
      const retrieved = await this.cacheService.get(testKey);
      await this.cacheService.delete(testKey);
      
      const responseTime = Date.now() - startTime;
      
      if (retrieved !== testValue) {
        throw new Error('Cache value mismatch');
      }

      return {
        status: responseTime > 500 ? 'degraded' : 'up',
        responseTime,
        details: {
          working: true,
          responseTime: `${responseTime}ms`,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.logger.error('Cache health check failed', error);
      
      return {
        status: 'down',
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown cache error',
      };
    }
  }

  private async checkMemory(): Promise<HealthCheck> {
    try {
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
      const usage = Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100);
      
      let status: 'up' | 'degraded' | 'down' = 'up';
      if (usage > 90) {
        status = 'down';
      } else if (usage > 75) {
        status = 'degraded';
      }

      return {
        status,
        details: {
          heapUsed: `${heapUsedMB}MB`,
          heapTotal: `${heapTotalMB}MB`,
          usage: `${usage}%`,
          rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        },
      };
    } catch (error) {
      this.logger.error('Memory health check failed', error);
      
      return {
        status: 'down',
        error: error instanceof Error ? error.message : 'Unknown memory error',
      };
    }
  }

  private createFailedCheck(error: string): HealthCheck {
    return {
      status: 'down',
      error,
    };
  }

  private determineOverallStatus(checks: Record<string, HealthCheck>): 'healthy' | 'unhealthy' | 'degraded' {
    const statuses = Object.values(checks).map(check => check.status);
    
    if (statuses.includes('down')) {
      return 'unhealthy';
    }
    
    if (statuses.includes('degraded')) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  private calculateHitRate(): number {
    const total = this.cacheMetrics.hits + this.cacheMetrics.misses;
    if (total === 0) return 0;
    return Math.round((this.cacheMetrics.hits / total) * 100);
  }
}

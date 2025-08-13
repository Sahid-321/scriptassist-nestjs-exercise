import { Injectable, Logger } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class DistributedHealthCheckService {
  private readonly logger = new Logger(DistributedHealthCheckService.name);
  private redis: RedisClientType;

  constructor() {
    this.redis = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: { reconnectStrategy: () => 1000 },
    });
    this.redis.connect().catch((err) => {
      this.logger.error('Redis connection failed', err);
    });
  }

  async setHealthStatus(instanceId: string, status: string) {
    try {
      await this.redis.hSet('health:instances', instanceId, status);
    } catch (err) {
      this.logger.error('Failed to set health status in Redis', err);
    }
  }

  async getClusterHealth(): Promise<Record<string, string>> {
    try {
      return await this.redis.hGetAll('health:instances');
    } catch (err) {
      this.logger.error('Failed to get cluster health from Redis', err);
      return {};
    }
  }

  async invalidateCache(key: string) {
    try {
      await this.redis.del(key);
    } catch (err) {
      this.logger.error('Failed to invalidate cache in Redis', err);
    }
  }

  async acquireLock(lockKey: string, ttl = 5000): Promise<boolean> {
    try {
      const result = await this.redis.set(lockKey, 'locked', { NX: true, PX: ttl });
      return result === 'OK';
    } catch (err) {
      this.logger.error('Failed to acquire distributed lock', err);
      return false;
    }
  }

  async releaseLock(lockKey: string) {
    try {
      await this.redis.del(lockKey);
    } catch (err) {
      this.logger.error('Failed to release distributed lock', err);
    }
  }
}

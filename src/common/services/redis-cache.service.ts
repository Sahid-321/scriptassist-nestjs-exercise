import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

import Redlock, { Lock } from 'redlock';
import IORedis from 'ioredis';

@Injectable()
export class RedisCacheService {
  private readonly logger = new Logger(RedisCacheService.name);
  private client: RedisClientType;
  private pubClient: RedisClientType;
  private subClient: RedisClientType;

  private redlock: Redlock;
  private ioRedis: IORedis;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get('REDIS_URL') || 'redis://localhost:6379';
    this.client = createClient({ url });
    this.client.on('error', (err) => this.logger.error('Redis error', err));
    this.client.connect().then(() => this.logger.log('Redis connected'));

    // Pub/sub clients for distributed invalidation
    this.pubClient = createClient({ url });
    this.subClient = createClient({ url });
    this.pubClient.on('error', (err) => this.logger.error('Redis pub error', err));
    this.subClient.on('error', (err) => this.logger.error('Redis sub error', err));
    this.pubClient.connect();
    this.subClient.connect();

    // Listen for invalidation events
    this.subClient.subscribe('cache-invalidate', (message) => {
      try {
        const { key } = JSON.parse(message);
        this.client.del(key);
        this.logger.log(`Cache invalidated via pub/sub for key: ${key}`);
      } catch (err) {
        this.logger.error('Failed to process cache-invalidate message', err);
      }
    });

    // Initialize ioredis for Redlock
    const ioRedisUrl = this.configService.get('REDIS_URL') || 'redis://localhost:6379';
    this.ioRedis = new IORedis(ioRedisUrl);
    // Initialize Redlock for distributed locking
    this.redlock = new Redlock(
      [this.ioRedis],
      {
        driftFactor: 0.01,
        retryCount: 5,
        retryDelay: 200,
        retryJitter: 200,
      },
    );
    this.redlock.on('error', (err: any) => this.logger.error('Redlock error', err));
  }
  /**
   * Acquire a distributed lock for a given resource key.
   * @param resource The resource key to lock (e.g., 'locks:my-resource')
   * @param ttlMs Time to live for the lock in milliseconds
   * @returns The acquired lock object, or null if not acquired
   */
  async acquireLock(resource: string, ttlMs = 10000): Promise<Lock | null> {
    try {
      const lock = await this.redlock.acquire([resource], ttlMs);
      this.logger.log(`Lock acquired for resource: ${resource}`);
      return lock;
    } catch (err) {
      this.logger.warn(`Failed to acquire lock for resource: ${resource}`);
      return null;
    }
  }

  /**
   * Release a previously acquired distributed lock.
   * @param lock The lock object returned by acquireLock
   */
  async releaseLock(lock: Lock): Promise<void> {
    try {
      await lock.release();
      this.logger.log('Lock released');
    } catch (err) {
      this.logger.error('Failed to release lock', err);
    }
  }

  async set(key: string, value: any, ttlSeconds = 300): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), { EX: ttlSeconds });
      // Publish invalidation event for this key
      await this.pubClient.publish('cache-invalidate', JSON.stringify({ key }));
    } catch (error) {
      this.logger.error(`Redis set error for key ${key}`, error);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.client.get(key);
      return data ? (JSON.parse(data) as T) : null;
    } catch (error) {
      this.logger.error(`Redis get error for key ${key}`, error);
      return null;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const result = await this.client.del(key);
      // Publish invalidation event for this key
      await this.pubClient.publish('cache-invalidate', JSON.stringify({ key }));
      return result > 0;
    } catch (error) {
      this.logger.error(`Redis delete error for key ${key}`, error);
      return false;
    }
  }

  async clear(): Promise<void> {
    try {
      await this.client.flushDb();
    } catch (error) {
      this.logger.error('Redis clear error', error);
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const exists = await this.client.exists(key);
      return exists === 1;
    } catch (error) {
      this.logger.error(`Redis exists error for key ${key}`, error);
      return false;
    }
  }
  
  // ...existing code...
}

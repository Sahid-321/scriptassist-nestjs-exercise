import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisCacheService {
  private readonly logger = new Logger(RedisCacheService.name);
  private client: RedisClientType;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get('REDIS_URL') || 'redis://localhost:6379';
    this.client = createClient({ url });
    this.client.on('error', (err) => this.logger.error('Redis error', err));
    this.client.connect().then(() => this.logger.log('Redis connected'));
  }

  async set(key: string, value: any, ttlSeconds = 300): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), { EX: ttlSeconds });
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
}

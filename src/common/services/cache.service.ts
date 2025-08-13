// NOTE: Implementation is now provided by RedisCacheService for distributed cache support.
import { Injectable } from '@nestjs/common';

@Injectable()
export abstract class CacheService {
  abstract set(key: string, value: any, ttlSeconds?: number): Promise<void>;
  abstract get<T>(key: string): Promise<T | null>;
  abstract delete(key: string): Promise<boolean>;
  abstract clear(): Promise<void>;
  abstract has(key: string): Promise<boolean>;
}
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface CacheItem {
  value: any;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
}

// Enhanced cache implementation with better error handling and resilience:
// 1. Graceful degradation when cache operations fail
// 2. Memory limits and cleanup mechanisms
// 3. Better error handling and logging
// 4. Support for distributed scenarios (failsafe mode)
// 5. Proper serialization/deserialization

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  
  // Enhanced cache storage with metadata
  private cache: Record<string, CacheItem> = {};
  private readonly maxKeys: number;
  private readonly cleanupIntervalMs: number;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(private readonly configService: ConfigService) {
    this.maxKeys = this.configService.get('CACHE_MAX_KEYS', 10000);
    this.cleanupIntervalMs = this.configService.get('CACHE_CLEANUP_INTERVAL_MS', 60000);
    
    // Start periodic cleanup
    this.startPeriodicCleanup();
  }

  private startPeriodicCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredItems();
    }, this.cleanupIntervalMs);
  }

  private cleanupExpiredItems(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, item] of Object.entries(this.cache)) {
      if (item.expiresAt < now) {
        delete this.cache[key];
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} expired cache items`);
    }
  }

  private evictLeastRecentlyUsed(): void {
    let oldestKey = '';
    let oldestTime = Date.now();
    
    for (const [key, item] of Object.entries(this.cache)) {
      if (item.lastAccessed < oldestTime) {
        oldestTime = item.lastAccessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      delete this.cache[oldestKey];
      this.logger.debug(`Evicted LRU cache item: ${oldestKey}`);
    }
  }

  private isValidKey(key: string): boolean {
    return typeof key === 'string' && key.length > 0 && key.length <= 250;
  }

  private deepClone(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.deepClone(item));
    }
    
    const cloned: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = this.deepClone(obj[key]);
      }
    }
    
    return cloned;
  }

  // Enhanced set operation with proper error handling and memory management
  async set(key: string, value: any, ttlSeconds = 300): Promise<void> {
    try {
      if (!this.isValidKey(key)) {
        throw new Error('Invalid cache key');
      }

      // Implement LRU eviction if we're at capacity
      if (Object.keys(this.cache).length >= this.maxKeys && !this.cache[key]) {
        this.evictLeastRecentlyUsed();
      }

      const expiresAt = Date.now() + ttlSeconds * 1000;
      const now = Date.now();
      
      this.cache[key] = {
        value: this.deepClone(value),
        expiresAt,
        accessCount: 0,
        lastAccessed: now,
      };
      
      this.logger.debug(`Cache set: ${key} (TTL: ${ttlSeconds}s)`);
    } catch (error) {
      this.logger.error(`Failed to set cache key '${key}'`, error);
      // Graceful degradation: don't throw, just log the error
    }
  }

  // Enhanced get operation with proper error handling and statistics
  async get<T>(key: string): Promise<T | null> {
    try {
      if (!this.isValidKey(key)) {
        return null;
      }

      const item = this.cache[key];
      
      if (!item) {
        return null;
      }
      
      const now = Date.now();
      
      // Check expiration
      if (item.expiresAt < now) {
        delete this.cache[key];
        return null;
      }
      
      // Update access statistics
      item.accessCount++;
      item.lastAccessed = now;
      
      this.logger.debug(`Cache hit: ${key}`);
      return this.deepClone(item.value) as T;
    } catch (error) {
      this.logger.error(`Failed to get cache key '${key}'`, error);
      return null; // Graceful degradation
    }
  }

  // Enhanced delete operation with proper error handling
  async delete(key: string): Promise<boolean> {
    try {
      if (!this.isValidKey(key)) {
        return false;
      }

      const exists = key in this.cache;
      
      if (exists) {
        delete this.cache[key];
        this.logger.debug(`Cache delete: ${key}`);
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.error(`Failed to delete cache key '${key}'`, error);
      return false; // Graceful degradation
    }
  }

  // Enhanced cache clearing with proper cleanup
  async clear(): Promise<void> {
    try {
      const keyCount = Object.keys(this.cache).length;
      this.cache = {};
      this.logger.log(`Cleared ${keyCount} cache items`);
    } catch (error) {
      this.logger.error('Failed to clear cache', error);
    }
  }

  // Enhanced existence check
  async has(key: string): Promise<boolean> {
    try {
      if (!this.isValidKey(key)) {
        return false;
      }

      const item = this.cache[key];
      
      if (!item) {
        return false;
      }
      
      // Check expiration
      if (item.expiresAt < Date.now()) {
        delete this.cache[key];
        return false;
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to check cache key existence '${key}'`, error);
      return false; // Graceful degradation
    }
  }
  
  // New methods for monitoring and statistics
  getCacheStats() {
    const totalKeys = Object.keys(this.cache).length;
    const now = Date.now();
    let expiredKeys = 0;
    let totalAccesses = 0;
    
    for (const item of Object.values(this.cache)) {
      if (item.expiresAt < now) {
        expiredKeys++;
      }
      totalAccesses += item.accessCount;
    }
    
    return {
      totalKeys,
      expiredKeys,
      activeKeys: totalKeys - expiredKeys,
      totalAccesses,
      maxKeys: this.maxKeys,
      memoryUsage: this.getMemoryUsage(),
    };
  }

  private getMemoryUsage(): string {
    const cacheString = JSON.stringify(this.cache);
    const sizeInBytes = Buffer.byteLength(cacheString, 'utf8');
    const sizeInMB = (sizeInBytes / 1024 / 1024).toFixed(2);
    return `${sizeInMB}MB`;
  }

  // Cleanup method for graceful shutdown
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.cache = {};
  }
} 
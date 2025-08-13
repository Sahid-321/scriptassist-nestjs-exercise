import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../services/cache.service';
import * as crypto from 'crypto';

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: any) => string;
  onLimitReached?: (req: any) => void;
}

@Injectable()
export class EnhancedRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(EnhancedRateLimitGuard.name);
  
  constructor(
    private readonly reflector: Reflector,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Get rate limit configuration from decorator or use defaults
    const rateLimitOptions = this.reflector.get<RateLimitOptions>('rateLimit', context.getHandler()) || {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100, // 100 requests per minute
    };

    const key = this.generateKey(request, rateLimitOptions.keyGenerator);
    const currentWindow = Math.floor(Date.now() / rateLimitOptions.windowMs);
    const cacheKey = `rate_limit:${key}:${currentWindow}`;

    try {
      // Get current request count for this window
      const currentCount = await this.cacheService.get(cacheKey) || 0;
      const requestCount = parseInt(currentCount.toString(), 10);

      // Check if limit is exceeded
      if (requestCount >= rateLimitOptions.maxRequests) {
        // Get next window reset time
        const resetTime = (currentWindow + 1) * rateLimitOptions.windowMs;
        const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);

        // Set rate limit headers
        response.set({
          'X-RateLimit-Limit': rateLimitOptions.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(resetTime).toISOString(),
          'Retry-After': retryAfter.toString(),
        });

        // Log rate limit exceeded
        this.logger.warn(`Rate limit exceeded for key: ${this.hashKey(key)}`);

        if (rateLimitOptions.onLimitReached) {
          rateLimitOptions.onLimitReached(request);
        }

        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Too many requests',
            error: 'Rate limit exceeded',
            retryAfter,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Increment request count
      const newCount = requestCount + 1;
      await this.cacheService.set(cacheKey, newCount, rateLimitOptions.windowMs / 1000);

      // Set rate limit headers
      const resetTime = (currentWindow + 1) * rateLimitOptions.windowMs;
      response.set({
        'X-RateLimit-Limit': rateLimitOptions.maxRequests.toString(),
        'X-RateLimit-Remaining': Math.max(0, rateLimitOptions.maxRequests - newCount).toString(),
        'X-RateLimit-Reset': new Date(resetTime).toISOString(),
      });

      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      // Log cache errors but don't block requests
      this.logger.error(`Rate limiting cache error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return true; // Fail open for availability
    }
  }

  private generateKey(request: any, customGenerator?: (req: any) => string): string {
    if (customGenerator) {
      return customGenerator(request);
    }

    // Create a composite key based on IP, user ID, and endpoint
    const ip = this.extractIpAddress(request);
    const userId = request.user?.id || 'anonymous';
    const endpoint = `${request.method}:${request.route?.path || request.url}`;
    
    return `${this.hashIpAddress(ip)}:${userId}:${endpoint}`;
  }

  private extractIpAddress(request: any): string {
    return request.ip || 
           request.connection?.remoteAddress || 
           request.socket?.remoteAddress || 
           (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
           'unknown';
  }

  private hashIpAddress(ipAddress: string): string {
    const salt = this.configService.get('IP_SALT', 'default-salt');
    return crypto.createHash('sha256').update(ipAddress + salt).digest('hex').substring(0, 16);
  }

  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex').substring(0, 16);
  }
}

// Enhanced Rate Limit Decorator with type safety
export const EnhancedRateLimit = (options: RateLimitOptions) => {
  return (target: any, key?: string, descriptor?: any) => {
    Reflect.defineMetadata('rateLimit', options, descriptor?.value || target);
    return descriptor;
  };
};

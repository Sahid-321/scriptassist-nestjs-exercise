import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// import { CacheService } from './services/cache.service';
import { EnhancedRateLimitGuard } from './guards/enhanced-rate-limit.guard';
import { EnhancedAuthorizationGuard } from './guards/enhanced-authorization.guard';
import { EnhancedValidationPipe } from './pipes/enhanced-validation.pipe';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { RedisCacheService } from './services/redis-cache.service';

@Global()
@Module({
  providers: [
    RedisCacheService,
    ConfigService,
    EnhancedRateLimitGuard,
    EnhancedAuthorizationGuard,
    EnhancedValidationPipe,
    HttpExceptionFilter,
  ],
  exports: [
    RedisCacheService,
    EnhancedRateLimitGuard,
    EnhancedAuthorizationGuard,
    EnhancedValidationPipe,
    HttpExceptionFilter,
  ],
})
export class SecurityModule {}

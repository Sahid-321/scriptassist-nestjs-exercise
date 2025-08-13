import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from './services/cache.service';
import { EnhancedRateLimitGuard } from './guards/enhanced-rate-limit.guard';
import { EnhancedAuthorizationGuard } from './guards/enhanced-authorization.guard';
import { EnhancedValidationPipe } from './pipes/enhanced-validation.pipe';
import { HttpExceptionFilter } from './filters/http-exception.filter';

@Global()
@Module({
  providers: [
    CacheService,
    ConfigService,
    EnhancedRateLimitGuard,
    EnhancedAuthorizationGuard,
    EnhancedValidationPipe,
    HttpExceptionFilter,
  ],
  exports: [
    CacheService,
    EnhancedRateLimitGuard,
    EnhancedAuthorizationGuard,
    EnhancedValidationPipe,
    HttpExceptionFilter,
  ],
})
export class SecurityModule {}

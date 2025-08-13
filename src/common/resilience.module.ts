import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthService } from './services/health.service';
import { ResilienceService } from './services/resilience.service';
import { HealthController } from './controllers/health.controller';
import { CacheService } from './services/cache.service';
import { RedisCacheService } from './services/redis-cache.service';

@Global()
@Module({
  controllers: [HealthController],
  providers: [
    HealthService,
    ResilienceService,
    {
      provide: CacheService,
      useClass: RedisCacheService,
    },
    RedisCacheService,
  ],
  exports: [
    HealthService,
    ResilienceService,
    CacheService,
    RedisCacheService,
  ],
})
export class ResilienceModule {}

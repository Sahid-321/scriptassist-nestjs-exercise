import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_FILTER, APP_PIPE } from '@nestjs/core';
import { UsersModule } from './modules/users/users.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { AuthModule } from './modules/auth/auth.module';
import { TaskProcessorModule } from './queues/task-processor/task-processor.module';
import { ScheduledTasksModule } from './queues/scheduled-tasks/scheduled-tasks.module';
import { SecurityModule } from './common/security.module';
import { ResilienceModule } from './common/resilience.module';
import { CqrsModule } from './common/cqrs.module';
import { EnhancedRateLimitGuard } from './common/guards/enhanced-rate-limit.guard';
import { EnhancedValidationPipe } from './common/pipes/enhanced-validation.pipe';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import bullConfig from './config/bull.config';
import { CacheService } from './common/services/cache.service';
import { RedisCacheService } from './common/services/redis-cache.service';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, bullConfig],
      envFilePath: ['.env.local', '.env'],
      validationOptions: {
        allowUnknown: false,
        abortEarly: true,
      },
    }),
    
    // Database with security considerations
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_DATABASE'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get('NODE_ENV') === 'development',
        logging: configService.get('NODE_ENV') === 'development' ? 'all' : ['error'],
        // Security settings
        extra: {
          ssl: configService.get('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false,
          connectionTimeoutMillis: 10000,
          idleTimeoutMillis: 30000,
          max: 20, // Maximum pool size
        },
        // Enable query logging in development only
        logNotifications: configService.get('NODE_ENV') === 'development',
      }),
    }),
    
    // Scheduling
    ScheduleModule.forRoot(),
    
    // Queue with Redis security
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST'),
          port: configService.get('REDIS_PORT'),
          password: configService.get('REDIS_PASSWORD'),
          // Redis security settings
          connectTimeout: 10000,
          maxRetriesPerRequest: 3,
          retryDelayOnFailover: 100,
        },
      }),
    }),
    
    // Enhanced rate limiting (legacy throttler for compatibility)
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ([
        {
          ttl: 60,
          limit: 50, // Reduced from 100 for security
        },
      ]),
    }),
    
    // Security infrastructure
    SecurityModule,
    
    // Resilience and observability infrastructure
    ResilienceModule,
    
    // CQRS Infrastructure
    CqrsModule,
    
    // Feature modules
    AuthModule, // Auth first for proper JWT setup
    UsersModule,
    TasksModule,
    
    // Queue processing modules
    TaskProcessorModule,
    ScheduledTasksModule,
  ],
  providers: [
    // Distributed cache provider for multi-instance/horizontally scaled deployments
    {
      provide: CacheService,
      useClass: RedisCacheService,
    },
    RedisCacheService,
    // Global security pipes and filters
    {
      provide: APP_PIPE,
      useClass: EnhancedValidationPipe,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: EnhancedRateLimitGuard,
    },
  ],
})
export class AppModule {} 
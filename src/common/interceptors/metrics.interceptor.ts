import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { HealthService } from '../services/health.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(MetricsInterceptor.name);

  constructor(private readonly healthService: HealthService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const startTime = Date.now();
    
    // Track request start
    this.healthService.incrementRequestCount();
    
    return next.handle().pipe(
      tap(() => {
        // Track successful request
        this.healthService.incrementSuccessfulRequests();
        const duration = Date.now() - startTime;
        this.logger.debug(`Request ${request.method} ${request.url} completed in ${duration}ms`);
      }),
      catchError((error) => {
        // Track failed request
        this.healthService.incrementFailedRequests();
        const duration = Date.now() - startTime;
        this.logger.error(`Request ${request.method} ${request.url} failed in ${duration}ms`, error);
        throw error;
      })
    );
  }
}

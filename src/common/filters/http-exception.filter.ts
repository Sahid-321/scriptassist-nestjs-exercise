import { 
  ExceptionFilter, 
  Catch, 
  ArgumentsHost, 
  HttpException, 
  Logger, 
  HttpStatus 
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

interface ErrorResponse {
  success: false;
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
  path: string;
  requestId: string;
  details?: any;
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  private readonly isProduction: boolean;
  private readonly sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];

  constructor(private readonly configService: ConfigService) {
    this.isProduction = this.configService.get('NODE_ENV') === 'production';
  }

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Generate unique request ID for tracking
    const requestId = crypto.randomUUID();

    // Sanitize request data for logging
    const sanitizedRequest = this.sanitizeRequest(request);

    // Create error context for logging
    const errorContext = {
      requestId,
      method: request.method,
      url: request.url,
      userAgent: request.get('User-Agent'),
      ip: this.hashIpAddress(request.ip || 'unknown'),
      userId: (request as any).user?.id || 'anonymous',
      headers: this.sanitizeHeaders(request.headers),
      body: sanitizedRequest.body,
      query: sanitizedRequest.query,
      params: request.params,
    };

    // Log based on error severity
    this.logError(exception, status, errorContext);

    // Create response based on environment and error type
    const errorResponse = this.createErrorResponse(
      exception,
      status,
      request.url,
      requestId,
      exceptionResponse
    );

    // Set security headers
    response.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'no-referrer',
    });

    response.status(status).json(errorResponse);
  }

  private logError(exception: HttpException, status: number, context: any): void {
    const message = exception.message;
    const stack = exception.stack;

    if (status >= 500) {
      // Server errors - log as error with full context
      this.logger.error(
        `Server Error: ${message}`,
        {
          ...context,
          stack: this.isProduction ? undefined : stack,
        }
      );
    } else if (status >= 400) {
      // Client errors - log as warning with limited context
      this.logger.warn(
        `Client Error: ${message}`,
        {
          requestId: context.requestId,
          method: context.method,
          url: context.url,
          ip: context.ip,
          userId: context.userId,
        }
      );
    } else {
      // Other status codes - log as debug
      this.logger.debug(`HTTP Exception: ${message}`, context);
    }
  }

  private createErrorResponse(
    exception: HttpException,
    status: number,
    path: string,
    requestId: string,
    exceptionResponse: any
  ): ErrorResponse {
    const baseResponse: ErrorResponse = {
      success: false,
      statusCode: status,
      message: this.getErrorMessage(exception, status),
      error: this.getErrorType(status),
      timestamp: new Date().toISOString(),
      path,
      requestId,
    };

    // In development, include more detailed error information
    if (!this.isProduction) {
      baseResponse.details = this.sanitizeErrorDetails(exceptionResponse);
    }

    return baseResponse;
  }

  private getErrorMessage(exception: HttpException, status: number): string {
    // Use generic messages for security-sensitive errors in production
    if (this.isProduction) {
      switch (status) {
        case HttpStatus.UNAUTHORIZED:
          return 'Authentication required';
        case HttpStatus.FORBIDDEN:
          return 'Access denied';
        case HttpStatus.NOT_FOUND:
          return 'Resource not found';
        case HttpStatus.TOO_MANY_REQUESTS:
          return 'Too many requests';
        case HttpStatus.INTERNAL_SERVER_ERROR:
          return 'Internal server error';
        case HttpStatus.BAD_REQUEST:
          return 'Invalid request';
        default:
          return 'An error occurred';
      }
    }

    // In development, use the actual exception message
    return exception.message || 'An error occurred';
  }

  private getErrorType(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'Bad Request';
      case HttpStatus.UNAUTHORIZED:
        return 'Unauthorized';
      case HttpStatus.FORBIDDEN:
        return 'Forbidden';
      case HttpStatus.NOT_FOUND:
        return 'Not Found';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'Too Many Requests';
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return 'Internal Server Error';
      default:
        return 'HTTP Exception';
    }
  }

  private sanitizeRequest(request: Request): { body: any; query: any } {
    return {
      body: this.sanitizeObject(request.body),
      query: this.sanitizeObject(request.query),
    };
  }

  private sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    
    // Remove sensitive headers
    delete sanitized.authorization;
    delete sanitized.cookie;
    delete sanitized['x-api-key'];
    
    return sanitized;
  }

  private sanitizeObject(obj: any): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const sanitized = { ...obj };
    
    for (const key of Object.keys(sanitized)) {
      if (this.isSensitiveField(key)) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = this.sanitizeObject(sanitized[key]);
      }
    }

    return sanitized;
  }

  private sanitizeErrorDetails(details: any): any {
    if (typeof details === 'string') {
      return details;
    }

    if (typeof details === 'object' && details !== null) {
      return this.sanitizeObject(details);
    }

    return details;
  }

  private isSensitiveField(fieldName: string): boolean {
    const lowerFieldName = fieldName.toLowerCase();
    return this.sensitiveFields.some(sensitive => lowerFieldName.includes(sensitive));
  }

  private hashIpAddress(ipAddress: string): string {
    const salt = this.configService.get('IP_SALT', 'default-salt');
    return crypto.createHash('sha256').update(ipAddress + salt).digest('hex').substring(0, 8);
  }
} 
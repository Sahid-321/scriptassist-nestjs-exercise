import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException, Logger } from '@nestjs/common';
import { validate, ValidationError } from 'class-validator';
import { plainToClass } from 'class-transformer';

@Injectable()
export class EnhancedValidationPipe implements PipeTransform<any> {
  private readonly logger = new Logger(EnhancedValidationPipe.name);

  async transform(value: any, { metatype }: ArgumentMetadata) {
    if (!metatype || !this.toValidate(metatype)) {
      return this.sanitizeInput(value);
    }

    // Sanitize input before validation
    const sanitizedValue = this.sanitizeInput(value);
    
    // Transform to class instance
    const object = plainToClass(metatype, sanitizedValue);
    
    // Validate using class-validator
    const errors = await validate(object, {
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are present
      transform: true, // Transform to appropriate types
      dismissDefaultMessages: false,
      validationError: {
        target: false, // Don't include target in error (can contain sensitive data)
        value: false, // Don't include value in error (can contain sensitive data)
      },
    });

    if (errors.length > 0) {
      const errorMessage = this.formatValidationErrors(errors);
      this.logger.warn(`Validation failed: ${errorMessage}`);
      throw new BadRequestException({
        message: 'Validation failed',
        errors: this.extractErrorMessages(errors),
      });
    }

    return object;
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  private sanitizeInput(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'string') {
      return this.sanitizeString(value);
    }

    if (Array.isArray(value)) {
      return value.map(item => this.sanitizeInput(item));
    }

    if (typeof value === 'object') {
      const sanitized: any = {};
      for (const key in value) {
        if (value.hasOwnProperty(key)) {
          // Sanitize the key as well
          const sanitizedKey = this.sanitizeString(key);
          sanitized[sanitizedKey] = this.sanitizeInput(value[key]);
        }
      }
      return sanitized;
    }

    return value;
  }

  private sanitizeString(input: string): string {
    if (typeof input !== 'string') {
      return input;
    }

    // Remove null bytes
    let sanitized = input.replace(/\0/g, '');
    
    // Basic HTML sanitization (remove common dangerous patterns)
    sanitized = sanitized
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
      .replace(/<object[^>]*>.*?<\/object>/gi, '')
      .replace(/<embed[^>]*>.*?<\/embed>/gi, '')
      .replace(/<link[^>]*>/gi, '')
      .replace(/<meta[^>]*>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/on\w+\s*=/gi, '');

    // SQL injection prevention (basic)
    sanitized = sanitized.replace(/[';\\]/g, '');
    
    // Remove potential XSS vectors
    sanitized = sanitized
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/')
      .replace(/&#x5C;/g, '\\')
      .replace(/&#96;/g, '`');

    // Limit string length to prevent DoS attacks
    const maxLength = 10000;
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }

    return sanitized.trim();
  }

  private formatValidationErrors(errors: ValidationError[]): string {
    return errors
      .map(error => {
        if (error.constraints) {
          return Object.values(error.constraints).join(', ');
        }
        return `${error.property} is invalid`;
      })
      .join('; ');
  }

  private extractErrorMessages(errors: ValidationError[]): any[] {
    return errors.map(error => ({
      property: error.property,
      constraints: error.constraints,
      children: error.children && error.children.length > 0 ? this.extractErrorMessages(error.children) : undefined,
    }));
  }
}

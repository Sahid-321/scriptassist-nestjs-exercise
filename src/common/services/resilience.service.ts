import { Injectable, Logger } from '@nestjs/common';

export interface RetryOptions {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: any) => boolean;
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
  monitoringPeriodMs: number;
}

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

@Injectable()
export class ResilienceService {
  private readonly logger = new Logger(ResilienceService.name);
  private circuitBreakers = new Map<string, CircuitBreakerState>();

  async withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions,
    operationName = 'unknown'
  ): Promise<T> {
    const { maxAttempts, delayMs, backoffMultiplier = 2, shouldRetry } = options;
    let lastError: any;
    let currentDelay = delayMs;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await operation();
        if (attempt > 1) {
          this.logger.log(`Operation '${operationName}' succeeded on attempt ${attempt}`);
        }
        return result;
      } catch (error) {
        lastError = error;
        
        if (attempt === maxAttempts) {
          this.logger.error(`Operation '${operationName}' failed after ${maxAttempts} attempts`, error);
          break;
        }

        if (shouldRetry && !shouldRetry(error)) {
          this.logger.warn(`Operation '${operationName}' failed with non-retryable error`, error);
          throw error;
        }

        this.logger.warn(`Operation '${operationName}' failed on attempt ${attempt}, retrying in ${currentDelay}ms`, error);
        
        await this.delay(currentDelay);
        currentDelay *= backoffMultiplier;
      }
    }

    throw lastError;
  }

  async withCircuitBreaker<T>(
    operation: () => Promise<T>,
    circuitName: string,
    options: CircuitBreakerOptions,
    fallback?: () => Promise<T>
  ): Promise<T> {
    const circuit = this.getOrCreateCircuit(circuitName, options);

    if (circuit.state === CircuitState.OPEN) {
      if (Date.now() - circuit.lastFailureTime < options.resetTimeoutMs) {
        this.logger.warn(`Circuit breaker '${circuitName}' is OPEN, using fallback`);
        if (fallback) {
          return fallback();
        }
        throw new Error(`Circuit breaker '${circuitName}' is OPEN`);
      } else {
        circuit.state = CircuitState.HALF_OPEN;
        this.logger.log(`Circuit breaker '${circuitName}' moved to HALF_OPEN`);
      }
    }

    try {
      const result = await operation();
      this.onCircuitSuccess(circuit, circuitName);
      return result;
    } catch (error) {
      this.onCircuitFailure(circuit, circuitName, options);
      
      if (fallback) {
        this.logger.warn(`Circuit breaker '${circuitName}' failed, using fallback`);
        return fallback();
      }
      
      throw error;
    }
  }

  async withGracefulDegradation<T>(
    primaryOperation: () => Promise<T>,
    fallbackOperation: () => Promise<T>,
    operationName = 'unknown'
  ): Promise<T> {
    try {
      return await primaryOperation();
    } catch (error) {
      this.logger.warn(`Primary operation '${operationName}' failed, using fallback`, error);
      try {
        return await fallbackOperation();
      } catch (fallbackError) {
        this.logger.error(`Both primary and fallback operations failed for '${operationName}'`, fallbackError);
        throw fallbackError;
      }
    }
  }

  private getOrCreateCircuit(name: string, options: CircuitBreakerOptions): CircuitBreakerState {
    if (!this.circuitBreakers.has(name)) {
      this.circuitBreakers.set(name, {
        state: CircuitState.CLOSED,
        failureCount: 0,
        lastFailureTime: 0,
        successCount: 0,
      });
    }
    return this.circuitBreakers.get(name)!;
  }

  private onCircuitSuccess(circuit: CircuitBreakerState, name: string): void {
    circuit.failureCount = 0;
    circuit.successCount++;
    
    if (circuit.state === CircuitState.HALF_OPEN) {
      circuit.state = CircuitState.CLOSED;
      this.logger.log(`Circuit breaker '${name}' moved to CLOSED`);
    }
  }

  private onCircuitFailure(
    circuit: CircuitBreakerState,
    name: string,
    options: CircuitBreakerOptions
  ): void {
    circuit.failureCount++;
    circuit.lastFailureTime = Date.now();

    if (circuit.failureCount >= options.failureThreshold) {
      circuit.state = CircuitState.OPEN;
      this.logger.error(`Circuit breaker '${name}' moved to OPEN after ${circuit.failureCount} failures`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Monitoring and metrics
  getCircuitBreakerStatus(name: string) {
    const circuit = this.circuitBreakers.get(name);
    if (!circuit) {
      return { exists: false };
    }

    return {
      exists: true,
      state: circuit.state,
      failureCount: circuit.failureCount,
      successCount: circuit.successCount,
      lastFailureTime: circuit.lastFailureTime,
    };
  }

  getAllCircuitBreakers() {
    const result: Record<string, any> = {};
    for (const [name, circuit] of this.circuitBreakers.entries()) {
      result[name] = {
        state: circuit.state,
        failureCount: circuit.failureCount,
        successCount: circuit.successCount,
        lastFailureTime: circuit.lastFailureTime,
      };
    }
    return result;
  }
}

interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: number;
  successCount: number;
}

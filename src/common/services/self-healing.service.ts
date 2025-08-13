import { Injectable, Logger } from '@nestjs/common';
import { CircuitBreakerService } from './circuit-breaker.service';

/**
 * SelfHealingService: Provides self-healing for external dependencies and critical services.
 * - Monitors circuit breaker state and attempts automated recovery.
 * - Can be extended to restart connections, clear caches, or trigger alerts.
 */
@Injectable()
export class SelfHealingService {
  private readonly logger = new Logger(SelfHealingService.name);

  constructor(private readonly circuitBreakerService: CircuitBreakerService) {}

  /**
   * Register a self-healing handler for a circuit breaker.
   * @param breakerKey The key used for the circuit breaker
   * @param onHeal Callback to attempt recovery (e.g., reconnect, refresh, etc)
   */
  registerSelfHealing(breakerKey: string, onHeal: () => Promise<void> | void) {
    const breaker = this.circuitBreakerService.getBreaker<any, any>(breakerKey, async () => {}, { allowWarmUp: true });
    breaker.on('open', async () => {
      this.logger.warn(`Self-healing triggered for breaker: ${breakerKey}`);
      try {
        await onHeal();
        this.logger.log(`Self-healing action completed for breaker: ${breakerKey}`);
      } catch (err) {
        this.logger.error(`Self-healing failed for breaker: ${breakerKey}`, err);
      }
    });
  }
}

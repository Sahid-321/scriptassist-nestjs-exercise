import { Controller, Get } from '@nestjs/common';
import { Response } from 'express';
import { Res } from '@nestjs/common';
import * as client from 'prom-client';
// Register default Prometheus metrics (only once)
client.collectDefaultMetrics();
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthService } from '../services/health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Get application health status' })
  @ApiResponse({ status: 200, description: 'Health check successful' })
  @ApiResponse({ status: 503, description: 'Service unavailable' })
  async getHealth() {
    return this.healthService.getHealthStatus();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Get application readiness status' })
  @ApiResponse({ status: 200, description: 'Application is ready' })
  @ApiResponse({ status: 503, description: 'Application not ready' })
  async getReadiness() {
    return this.healthService.getReadinessStatus();
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get application metrics' })
  @ApiResponse({ status: 200, description: 'Metrics retrieved successfully' })
  async getMetrics() {
    return this.healthService.getMetrics();
  }

  @Get('metrics/prometheus')
  @ApiOperation({ summary: 'Prometheus metrics' })
  @ApiResponse({ status: 200, description: 'Prometheus metrics' })
  async getPrometheusMetrics(@Res() res: Response) {
    res.set('Content-Type', client.register.contentType);
    res.send(await client.register.metrics());
  }
}

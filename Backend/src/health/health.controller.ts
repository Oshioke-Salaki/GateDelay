import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'gatedelay-backend-nest',
    };
  }

  @Get('details')
  details() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'gatedelay-backend-nest',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development',
    };
  }
}

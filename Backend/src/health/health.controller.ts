import { Controller, Get, Req, Res } from '@nestjs/common';
import * as healthCheckService from '../../services/healthCheck';

@Controller('health')
export class HealthController {
  @Get()
  async check(@Req() req: any, @Res() res: any) {
    const report = await healthCheckService.generateHealthReport();
    const statusCode = report.status === 'DOWN' ? 503 : 200;

    return res.status(statusCode).json({
      status: report.status,
      timestamp: report.timestamp,
      service: 'gatedelay-backend-nest',
      requestId: req.requestId,
    });
  }

  @Get('details')
  async details(@Req() req: any, @Res() res: any) {
    const report = await healthCheckService.generateHealthReport();
    const statusCode = report.status === 'DOWN' ? 503 : 200;

    return res.status(statusCode).json({
      ...report,
      service: 'gatedelay-backend-nest',
      requestId: req.requestId,
    });
  }

  @Get('live')
  live(@Req() req: any) {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'gatedelay-backend-nest',
      requestId: req.requestId,
    };
  }
}

import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  AuditQueryDto,
  CreateAuditLogDto,
  RetentionPolicyDto,
} from './dto/market-audit.dto';
import { MarketAuditService } from './market-audit.service';

@Controller('market-audit')
export class MarketAuditController {
  constructor(private readonly marketAuditService: MarketAuditService) {}

  @Post('logs')
  createLog(@Body() body: CreateAuditLogDto) {
    return this.marketAuditService.createLog(body);
  }

  // `AuditQueryDto` already coerced and bounded `limit`, so no re-parsing here.
  @Get('logs')
  getLogs(@Query() query: AuditQueryDto) {
    return this.marketAuditService.queryLogs(query);
  }

  @Post('retention')
  enforceRetention(@Body() body: RetentionPolicyDto) {
    if (body.retentionDays !== undefined) {
      this.marketAuditService.setRetentionPolicy(body.retentionDays);
    }
    return this.marketAuditService.enforceRetention();
  }

  @Get('reports/summary')
  getReport(@Query('from') from?: string, @Query('to') to?: string) {
    return this.marketAuditService.generateReport(from, to);
  }

  @Get('integrity')
  verifyIntegrity() {
    return this.marketAuditService.verifyIntegrity();
  }
}

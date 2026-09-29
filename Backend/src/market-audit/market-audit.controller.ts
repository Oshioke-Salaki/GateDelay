import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { IsISO8601, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimit } from '../rate-limiter/rate-limiter.decorator';
import {
  AuditQueryDto,
  CreateAuditLogDto,
  RetentionPolicyDto,
} from './dto/market-audit.dto';
import { MarketAuditService } from './market-audit.service';

class AuditReportQueryDto {
  @IsOptional()
  @IsISO8601(
    { strict: true },
    { message: 'from must be an ISO-8601 timestamp' },
  )
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'to must be an ISO-8601 timestamp' })
  to?: string;
}

/**
 * Security boundary for the append-only audit trail.
 *
 * Threat controls:
 * - JWT authentication prevents public log injection and audit-data disclosure.
 * - The standard rate-limit tier limits flooding and expensive integrity/report reads.
 * - DTO validation (global ValidationPipe) rejects mass assignment, malformed dates,
 *   control characters, CSV formulas, and credential-shaped details.
 * - Retention remains an authenticated operation and is deliberately not exposed as
 *   a GET endpoint, preventing accidental destructive requests from crawlers.
 */
@Controller('market-audit')
@UseGuards(JwtAuthGuard)
@RateLimit('standard')
export class MarketAuditController {
  constructor(private readonly marketAuditService: MarketAuditService) {}

  @Post('logs')
  createLog(@Body() body: CreateAuditLogDto) {
    return this.marketAuditService.createLog(body);
  }

  /**
   * GET /market-audit/logs
   *
   * Paged read of the append-only chain, newest entry first, with the shared
   * `meta` block (#916). `queryLogs()` still exists and still returns a bare
   * array for `generateReport()`; it is deliberately not the wire format here,
   * because a client paging a log needs to know how many records matched.
   */
  @Get('logs')
  getLogs(@Query() query: AuditQueryDto) {
    const { limit, page, ...filters } = query;
    const { logs, meta } = this.marketAuditService.queryLogsPage(
      filters,
      page,
      limit,
    );
    return { success: true, data: logs, meta };
  }

  @Post('retention')
  enforceRetention(@Body() body: RetentionPolicyDto) {
    if (body.retentionDays !== undefined) {
      this.marketAuditService.setRetentionPolicy(body.retentionDays);
    }
    return this.marketAuditService.enforceRetention();
  }

  @Get('reports/summary')
  getReport(@Query() query: AuditReportQueryDto) {
    return this.marketAuditService.generateReport(query.from, query.to);
  }

  @Get('integrity')
  verifyIntegrity() {
    return this.marketAuditService.verifyIntegrity();
  }
}

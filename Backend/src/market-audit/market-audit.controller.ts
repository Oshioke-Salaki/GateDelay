import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request as NestRequest,
  UseGuards,
} from '@nestjs/common';
import {
  AuditQueryDto,
  CreateAuditLogDto,
  RetentionPolicyDto,
} from './dto/market-audit.dto';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimit } from '../rate-limiter/rate-limiter.decorator';
import { MarketAuditAdminGuard } from './market-audit-admin.guard';
import { MarketAuditService } from './market-audit.service';

type AuthenticatedRequest = ExpressRequest & {
  user: { id: string };
};

@Controller('market-audit')
@UseGuards(JwtAuthGuard, MarketAuditAdminGuard)
@RateLimit('admin')
export class MarketAuditController {
  constructor(private readonly marketAuditService: MarketAuditService) {}

  @Post('logs')
  createLog(
    @NestRequest() req: AuthenticatedRequest,
    @Body() body: CreateAuditLogDto,
  ) {
    return this.marketAuditService.createLog({
      ...body,
      actor: req.user.id,
    });
  }

  @Get('logs')
  getLogs(@Query() query: AuditQueryDto) {
    return this.marketAuditService.queryLogs({
      ...query,
    });
  }

  @Post('retention')
  enforceRetention(@Body() body: RetentionPolicyDto) {
    if (body.retentionDays !== undefined) {
      this.marketAuditService.setRetentionPolicy(body.retentionDays);
    }
    return this.marketAuditService.enforceRetention();
  }

  @Get('reports/summary')
  getReport(@Query() query: AuditQueryDto) {
    return this.marketAuditService.generateReport(query.from, query.to);
  }

  @Get('integrity')
  verifyIntegrity() {
    return this.marketAuditService.verifyIntegrity();
  }
}

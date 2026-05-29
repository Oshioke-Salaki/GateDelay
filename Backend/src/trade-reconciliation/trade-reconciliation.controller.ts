import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  IngestSourceTradesDto,
  RunReconciliationDto,
} from './dto/trade-reconciliation.dto';
import { TradeReconciliationService } from './trade-reconciliation.service';

@Controller('trade-reconciliation')
export class TradeReconciliationController {
  constructor(
    private readonly tradeReconciliationService: TradeReconciliationService,
  ) {}

  @Post('sources/:source/trades')
  ingestTrades(
    @Param('source') source: string,
    @Body() body: IngestSourceTradesDto,
  ) {
    return this.tradeReconciliationService.ingestTrades(source, body.trades);
  }

  @Post('run')
  run(@Body() body: RunReconciliationDto) {
    return this.tradeReconciliationService.reconcile(body.sources);
  }

  @Get('discrepancies')
  getDiscrepancies(@Query('status') status?: 'OPEN' | 'RESOLVED') {
    return this.tradeReconciliationService.getDiscrepancies(status);
  }

  @Get('reports')
  getReports(@Query('limit') limit?: string) {
    return this.tradeReconciliationService.getReports(
      limit ? Number(limit) : undefined,
    );
  }
}

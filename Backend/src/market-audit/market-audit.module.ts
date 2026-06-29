import { Module } from '@nestjs/common';
import { MarketAuditController } from './market-audit.controller';
import { MarketAuditService } from './market-audit.service';

@Module({
  controllers: [MarketAuditController],
  providers: [MarketAuditService],
  exports: [MarketAuditService],
})
export class MarketAuditModule {}

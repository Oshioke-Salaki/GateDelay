import { Module } from '@nestjs/common';
import { MarketAuditController } from './market-audit.controller';
import { BETA_ACCESS_CHECKER, MarketAuditService } from './market-audit.service';

const betaAccess = require('../../../backend/services/betaAccess');

@Module({
  controllers: [MarketAuditController],
  providers: [
    MarketAuditService,
    { provide: BETA_ACCESS_CHECKER, useValue: betaAccess },
  ],
  exports: [MarketAuditService],
})
export class MarketAuditModule {}

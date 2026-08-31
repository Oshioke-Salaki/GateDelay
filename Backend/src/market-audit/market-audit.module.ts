import { Module } from '@nestjs/common';
import { createRequire } from 'module';
import { MarketAuditController } from './market-audit.controller';
import {
  BETA_ACCESS_CHECKER,
  MarketAuditService,
} from './market-audit.service';
import betaAccess from '../../../backend/services/betaAccess';
import { BETA_ACCESS_CHECKER, MarketAuditService } from './market-audit.service';

const nodeRequire = createRequire(__filename);
const betaAccess = nodeRequire('../../../backend/services/betaAccess');

@Module({
  controllers: [MarketAuditController],
  providers: [
    MarketAuditService,
    { provide: BETA_ACCESS_CHECKER, useValue: betaAccess },
  ],
  exports: [MarketAuditService],
})
export class MarketAuditModule {}

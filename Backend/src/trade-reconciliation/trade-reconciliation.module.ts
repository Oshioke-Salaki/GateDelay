import { Module } from '@nestjs/common';
import { TradeReconciliationController } from './trade-reconciliation.controller';
import { TradeReconciliationService } from './trade-reconciliation.service';

@Module({
  controllers: [TradeReconciliationController],
  providers: [TradeReconciliationService],
  exports: [TradeReconciliationService],
})
export class TradeReconciliationModule {}

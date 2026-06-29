import { Module } from '@nestjs/common';
import { LiquidityService } from './liquidity.service';
import { LiquidityController } from './liquidity.controller';
import { MarketsModule } from '../markets/markets.module';

@Module({
  imports: [MarketsModule],
  controllers: [LiquidityController],
  providers: [LiquidityService],
  exports: [LiquidityService],
})
export class LiquidityModule {}

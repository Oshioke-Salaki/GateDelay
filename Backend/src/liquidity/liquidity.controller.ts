import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { LiquidityService } from './liquidity.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('liquidity')
@UseGuards(JwtAuthGuard)
export class LiquidityController {
  constructor(private readonly liquidityService: LiquidityService) {}

  @Get('report')
  getReport() {
    return this.liquidityService.getReport();
  }

  @Get('depth')
  getDepth() {
    return this.liquidityService.getDepthAnalysis();
  }

  @Get('health')
  getHealth() {
    return this.liquidityService.getHealthIndicators();
  }

  @Get('markets/:id')
  getMarket(@Param('id') id: string) {
    return this.liquidityService.getMarketLiquidity(id);
  }
}

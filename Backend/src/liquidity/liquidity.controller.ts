import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { LiquidityService } from './liquidity.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  AddLiquidityDto,
  AutoManagePositionDto,
  RemoveLiquidityDto,
} from './dto/liquidity.dto';

@Controller('liquidity')
@UseGuards(JwtAuthGuard)
export class LiquidityController {
  constructor(private readonly liquidityService: LiquidityService) {}

  @Post('add')
  addLiquidity(
    @Request() req: { user: { id: string } },
    @Body() dto: AddLiquidityDto,
  ) {
    return this.liquidityService.addLiquidity(
      req.user.id,
      dto.marketId,
      dto.walletAddress,
      dto.amountEth,
      dto.autoManage,
      dto.targetYesRatio,
    );
  }

  @Post('remove')
  removeLiquidity(
    @Request() req: { user: { id: string } },
    @Body() dto: RemoveLiquidityDto,
  ) {
    return this.liquidityService.removeLiquidity(
      req.user.id,
      dto.marketId,
      dto.shareAmount,
    );
  }

  @Get('positions/mine')
  getMyPositions(@Request() req: { user: { id: string } }) {
    return this.liquidityService.getUserPositions(req.user.id);
  }

  @Get('analytics')
  getLpAnalytics() {
    return this.liquidityService.getLiquidityAnalytics();
  }

  @Post('automation/run')
  runAutomation(@Request() req: { user: { id: string } }) {
    return this.liquidityService.runAutomation(req.user.id);
  }

  @Patch('automation/config')
  configureAutomation(
    @Request() req: { user: { id: string } },
    @Body() dto: AutoManagePositionDto,
  ) {
    return this.liquidityService.configureAutomation(
      req.user.id,
      dto.marketId,
      dto.autoManage,
      dto.targetYesRatio,
    );
  }

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

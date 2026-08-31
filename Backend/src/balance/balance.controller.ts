import { Controller, Get, Param, Query } from '@nestjs/common';
import { BalanceService } from './balance.service';

@Controller('balances')
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Get(':userId')
  getBalances(
    @Param('userId') userId: string,
    @Query('asset') asset?: string,
  ) {
    return this.balanceService.getBalances(userId, asset);
  }

  @Get(':userId/:asset')
  getBalance(@Param('userId') userId: string, @Param('asset') asset: string) {
    return this.balanceService.getBalance(userId, asset);
  }
}

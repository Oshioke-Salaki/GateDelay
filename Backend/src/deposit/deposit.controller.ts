import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DepositService } from './deposit.service';
import { DepositMonitorService } from './deposit-monitor.service';
import { CreateDepositDto, GetDepositsDto } from './dto/deposit.dto';

@Controller('deposits')
export class DepositController {
  constructor(
    private readonly depositService: DepositService,
    private readonly depositMonitorService: DepositMonitorService,
  ) {}

  /**
   * Create a new deposit
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createDeposit(@Body() dto: CreateDepositDto) {
    return this.depositService.createDeposit(dto);
  }

  /**
   * Get all deposits with filters
   */
  @Get()
  async getDeposits(@Query() dto: GetDepositsDto) {
    return this.depositService.getDeposits(dto);
  }

  /**
   * Get deposit by ID
   */
  @Get(':id')
  async getDepositById(@Param('id') id: string) {
    return this.depositService.getDepositById(id);
  }

  /**
   * Get deposit by transaction hash
   */
  @Get('tx/:txHash')
  async getDepositByTxHash(@Param('txHash') txHash: string) {
    return this.depositService.getDepositByTxHash(txHash);
  }

  /**
   * Get deposit statistics
   */
  @Get('stats/summary')
  async getStatistics(@Query('userId') userId?: string) {
    return this.depositService.getStatistics(userId);
  }

  /**
   * Get monitor status
   */
  @Get('monitor/status')
  async getMonitorStatus() {
    return this.depositMonitorService.getStatus();
  }

  /**
   * Manually trigger deposit monitoring (for testing)
   */
  @Post('monitor/trigger')
  @HttpCode(HttpStatus.OK)
  async triggerMonitoring() {
    await this.depositMonitorService.monitorDeposits();
    return { message: 'Monitoring triggered successfully' };
  }
}

import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BridgeService } from './bridge.service';
import {
  InitiateBridgeDto,
  UpdateBridgeTxDto,
  GetBridgeTransactionsDto,
} from './dto/bridge.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('bridge')
@UseGuards(JwtAuthGuard)
export class BridgeController {
  constructor(private readonly bridgeService: BridgeService) {}

  /**
   * GET /bridge/protocols
   * Return supported bridge protocols with configuration details.
   */
  @Get('protocols')
  getProtocols() {
    return this.bridgeService.getProtocolInfo();
  }

  /**
   * GET /bridge/quotes
   * Return route quotes from all protocols for a given chain/token/amount combo.
   */
  @Get('quotes')
  getRouteQuotes(
    @Query('fromChainId') fromChainId: string,
    @Query('toChainId') toChainId: string,
    @Query('tokenSymbol') tokenSymbol: string,
    @Query('amount') amount: string,
  ) {
    return this.bridgeService.getRouteQuotes(
      parseInt(fromChainId, 10),
      parseInt(toChainId, 10),
      tokenSymbol,
      amount,
    );
  }

  /**
   * POST /bridge/transactions
   * Initiate a new bridge transaction.
   */
  @Post('transactions')
  @HttpCode(HttpStatus.CREATED)
  initiateTransaction(
    @Request() req: { user: { id: string } },
    @Body() dto: InitiateBridgeDto,
  ) {
    return this.bridgeService.initiateTransaction(req.user.id, dto);
  }

  /**
   * GET /bridge/transactions
   * List bridge transactions with optional filters.
   */
  @Get('transactions')
  getTransactions(@Query() dto: GetBridgeTransactionsDto) {
    return this.bridgeService.getTransactions(dto);
  }

  /**
   * GET /bridge/transactions/stale
   * Return transactions that have passed their estimated arrival time.
   */
  @Get('transactions/stale')
  getStaleTransactions() {
    return this.bridgeService.getStaleTransactions();
  }

  /**
   * GET /bridge/transactions/:id
   * Get a single bridge transaction by ID.
   */
  @Get('transactions/:id')
  getTransactionById(@Param('id') id: string) {
    return this.bridgeService.getTransactionById(id);
  }

  /**
   * GET /bridge/transactions/hash/:sourceTxHash
   * Look up a bridge transaction by its source chain transaction hash.
   */
  @Get('transactions/hash/:sourceTxHash')
  getTransactionBySourceHash(@Param('sourceTxHash') sourceTxHash: string) {
    return this.bridgeService.getTransactionBySourceHash(sourceTxHash);
  }

  /**
   * PATCH /bridge/transactions/:id
   * Update status, hashes, or confirmation counts on a bridge transaction.
   */
  @Patch('transactions/:id')
  updateTransaction(
    @Param('id') id: string,
    @Body() dto: UpdateBridgeTxDto,
  ) {
    return this.bridgeService.updateTransaction(id, dto);
  }

  /**
   * GET /bridge/analytics
   * Aggregate bridge analytics (volume, success rate, protocol breakdown).
   */
  @Get('analytics')
  getAnalytics(@Query('userId') userId?: string) {
    return this.bridgeService.getAnalytics(userId);
  }
}

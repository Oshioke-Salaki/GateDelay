import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { ReceiptService } from './receipt.service';

@Controller('receipts')
export class ReceiptController {
  constructor(private readonly receiptService: ReceiptService) {}

  @Post('generate')
  generateReceipt(
    @Body()
    body: {
      userId: string;
      transactionHash: string;
      marketId: string;
      amount: number;
      type: 'buy' | 'sell' | 'redeem';
    },
  ) {
    return this.receiptService.generateReceipt(
      body.userId,
      body.transactionHash,
      body.marketId,
      body.amount,
      body.type,
    );
  }

  @Post('confirm/:receiptId')
  confirmReceipt(
    @Param('receiptId') receiptId: string,
    @Body()
    body: {
      blockNumber: number;
      blockHash: string;
      gasUsed: number;
      gasPrice: number;
    },
  ) {
    return this.receiptService.confirmReceipt(
      receiptId,
      body.blockNumber,
      body.blockHash,
      body.gasUsed,
      body.gasPrice,
    );
  }

  @Post('fail/:receiptId')
  failReceipt(@Param('receiptId') receiptId: string) {
    return this.receiptService.failReceipt(receiptId);
  }

  @Get(':receiptId')
  getReceipt(@Param('receiptId') receiptId: string) {
    return this.receiptService.getReceipt(receiptId);
  }

  @Get('user/:userId')
  getUserReceipts(@Param('userId') userId: string) {
    return this.receiptService.getUserReceipts(userId);
  }

  @Get(':receiptId/blockchain-data')
  getReceiptWithBlockchainData(@Param('receiptId') receiptId: string) {
    return this.receiptService.getReceiptWithBlockchainData(receiptId);
  }

  @Get(':receiptId/export')
  exportReceipt(
    @Param('receiptId') receiptId: string,
    @Query('format') format: 'json' | 'csv' | 'pdf' = 'json',
  ) {
    return this.receiptService.exportReceipt(receiptId, format);
  }

  @Post(':receiptId/share')
  shareReceipt(@Param('receiptId') receiptId: string) {
    return this.receiptService.shareReceipt(receiptId);
  }

  @Get('search/:userId')
  searchReceipts(
    @Param('userId') userId: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.receiptService.searchReceipts(userId, {
      type,
      status,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }
}

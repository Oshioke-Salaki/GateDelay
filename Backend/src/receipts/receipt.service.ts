import { Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { TransactionReceipt, ReceiptData } from './receipt.entity';

@Injectable()
export class ReceiptService {
  private receipts = new Map<string, TransactionReceipt>();
  private receiptsByUser = new Map<string, string[]>();

  generateReceipt(
    userId: string,
    transactionHash: string,
    marketId: string,
    amount: number,
    type: 'buy' | 'sell' | 'redeem',
  ): TransactionReceipt {
    const receipt: TransactionReceipt = {
      id: uuidv4(),
      transactionHash,
      userId,
      marketId,
      amount,
      type,
      status: 'pending',
      timestamp: new Date(),
    };

    this.receipts.set(receipt.id, receipt);

    if (!this.receiptsByUser.has(userId)) {
      this.receiptsByUser.set(userId, []);
    }
    this.receiptsByUser.get(userId)!.push(receipt.id);

    return receipt;
  }

  confirmReceipt(
    receiptId: string,
    blockNumber: number,
    blockHash: string,
    gasUsed: number,
    gasPrice: number,
  ): TransactionReceipt {
    const receipt = this.receipts.get(receiptId);
    if (!receipt) {
      throw new NotFoundException('Receipt not found');
    }

    receipt.status = 'confirmed';
    receipt.blockNumber = blockNumber;
    receipt.blockHash = blockHash;
    receipt.gasUsed = gasUsed;
    receipt.gasPrice = gasPrice;
    receipt.confirmedAt = new Date();

    return receipt;
  }

  failReceipt(receiptId: string): TransactionReceipt {
    const receipt = this.receipts.get(receiptId);
    if (!receipt) {
      throw new NotFoundException('Receipt not found');
    }

    receipt.status = 'failed';
    return receipt;
  }

  getReceipt(receiptId: string): TransactionReceipt {
    const receipt = this.receipts.get(receiptId);
    if (!receipt) {
      throw new NotFoundException('Receipt not found');
    }
    return receipt;
  }

  getUserReceipts(userId: string): TransactionReceipt[] {
    const receiptIds = this.receiptsByUser.get(userId) || [];
    return receiptIds.map((id) => this.receipts.get(id)!).filter((r) => r);
  }

  getReceiptWithBlockchainData(receiptId: string): ReceiptData {
    const receipt = this.getReceipt(receiptId);

    const receiptData: ReceiptData = {
      receipt,
      blockchainData: {
        confirmations: receipt.status === 'confirmed' ? 12 : 0,
        gasUsed: receipt.gasUsed || 0,
        gasPrice: receipt.gasPrice ? receipt.gasPrice.toString() : '0',
        transactionFee:
          receipt.gasUsed && receipt.gasPrice
            ? (receipt.gasUsed * receipt.gasPrice).toString()
            : '0',
      },
    };

    return receiptData;
  }

  exportReceipt(
    receiptId: string,
    format: 'json' | 'csv' | 'pdf' = 'json',
  ): string {
    const receiptData = this.getReceiptWithBlockchainData(receiptId);

    if (format === 'json') {
      return JSON.stringify(receiptData, null, 2);
    }

    if (format === 'csv') {
      const headers = [
        'ID',
        'Transaction Hash',
        'User ID',
        'Market ID',
        'Amount',
        'Type',
        'Status',
        'Block Number',
        'Gas Used',
        'Timestamp',
      ];
      const values = [
        receiptData.receipt.id,
        receiptData.receipt.transactionHash,
        receiptData.receipt.userId,
        receiptData.receipt.marketId,
        receiptData.receipt.amount,
        receiptData.receipt.type,
        receiptData.receipt.status,
        receiptData.receipt.blockNumber || '-',
        receiptData.receipt.gasUsed || '-',
        receiptData.receipt.timestamp.toISOString(),
      ];
      return [headers, values]
        .map((row) => row.map((cell) => `"${cell}"`).join(','))
        .join('\n');
    }

    // PDF format - return placeholder
    return `PDF Receipt for ${receiptData.receipt.id}`;
  }

  shareReceipt(receiptId: string): { shareToken: string; expiresAt: Date } {
    const receipt = this.getReceipt(receiptId);
    const shareToken = Buffer.from(`${receiptId}:${Date.now()}`).toString(
      'base64',
    );
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    return { shareToken, expiresAt };
  }

  searchReceipts(
    userId: string,
    filters: {
      type?: string;
      status?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ): TransactionReceipt[] {
    let receipts = this.getUserReceipts(userId);

    if (filters.type) {
      receipts = receipts.filter((r) => r.type === filters.type);
    }
    if (filters.status) {
      receipts = receipts.filter((r) => r.status === filters.status);
    }
    if (filters.startDate) {
      receipts = receipts.filter((r) => r.timestamp >= filters.startDate!);
    }
    if (filters.endDate) {
      receipts = receipts.filter((r) => r.timestamp <= filters.endDate!);
    }

    return receipts;
  }
}

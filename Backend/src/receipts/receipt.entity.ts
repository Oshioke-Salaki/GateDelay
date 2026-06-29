export interface TransactionReceipt {
  id: string;
  transactionHash: string;
  userId: string;
  marketId: string;
  amount: number;
  type: 'buy' | 'sell' | 'redeem';
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  blockHash?: string;
  gasUsed?: number;
  gasPrice?: number;
  timestamp: Date;
  confirmedAt?: Date;
  exportFormats?: string[];
}

export interface ReceiptData {
  receipt: TransactionReceipt;
  blockchainData: {
    confirmations: number;
    gasUsed: number;
    gasPrice: string;
    transactionFee: string;
  };
}

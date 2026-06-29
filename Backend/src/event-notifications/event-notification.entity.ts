export type EventNotificationStatus = 'pending' | 'delivered' | 'failed';

export type BlockchainEventType =
  | 'TradeExecuted'
  | 'MarketCreated'
  | 'MarketResolved'
  | 'DepositConfirmed'
  | 'WithdrawalProcessed'
  | 'LiquidityAdded'
  | 'LiquidityRemoved'
  | 'PositionOpened'
  | 'PositionClosed';

export interface EventFilter {
  id: string;
  userId: string;
  eventTypes: BlockchainEventType[];
  contractAddress?: string;
  minAmount?: string;
  createdAt: Date;
}

export interface EventNotificationRecord {
  id: string;
  userId?: string;
  eventType: BlockchainEventType;
  contractAddress: string;
  txHash: string;
  blockNumber: number;
  payload: Record<string, unknown>;
  status: EventNotificationStatus;
  attempts: number;
  createdAt: Date;
  deliveredAt?: Date;
  error?: string;
}

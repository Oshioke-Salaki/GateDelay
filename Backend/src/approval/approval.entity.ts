export type ApprovalStatus = 'pending' | 'confirmed' | 'failed' | 'revoked';

export interface ApprovalRecord {
  id: string;
  userId: string;
  ownerAddress: string;
  spenderAddress: string;
  tokenAddress: string;
  amount: string;
  txHash?: string;
  status: ApprovalStatus;
  confirmations: number;
  blockNumber?: number;
  batchId?: string;
  createdAt: Date;
  confirmedAt?: Date;
  failureReason?: string;
}

export interface BatchApproval {
  id: string;
  userId: string;
  approvalIds: string[];
  status: 'pending' | 'partial' | 'complete' | 'failed';
  createdAt: Date;
  completedAt?: Date;
}

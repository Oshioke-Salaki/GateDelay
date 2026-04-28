export type WithdrawalStatus =
  | 'pending'
  | 'submitted'
  | 'confirmed'
  | 'failed'
  | 'cancelled';

export interface WithdrawalRecord {
  id: string;
  userId: string;
  fromAddress: string;
  toAddress: string;
  /** token address, or 'NATIVE' for ETH/native token */
  tokenAddress: string;
  /** amount in the smallest unit (wei for ETH, base units for ERC-20) */
  amount: string;
  txHash?: string;
  status: WithdrawalStatus;
  confirmations: number;
  requiredConfirmations: number;
  blockNumber?: number;
  /** present when multi-sig is enabled */
  multiSigId?: string;
  failureReason?: string;
  createdAt: Date;
  submittedAt?: Date;
  confirmedAt?: Date;
}

export interface MultiSigWithdrawal {
  id: string;
  withdrawalId: string;
  threshold: number;
  signers: string[]; // checksummed addresses
  signatures: Record<string, string>; // signer → signature
  status: 'pending' | 'ready' | 'executed' | 'rejected';
  createdAt: Date;
  executedAt?: Date;
}

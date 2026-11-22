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
  /**
   * EIP-155 chain id the withdrawal was created for.
   * Bound into multi-sig approval messages so a signature cannot be replayed
   * on a different chain.
   */
  chainId: number;
  /**
   * Unix timestamp (seconds) after which approval signatures are no longer
   * accepted.  Zero means no expiry (single-owner withdrawals).
   */
  expiry: number;
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

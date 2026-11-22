export type ResolutionStatus =
  | 'pending'
  | 'requested'
  | 'confirmed'
  | 'disputed'
  | 'resolved'
  | 'cancelled';

export type ResolutionOutcome = 'YES' | 'NO' | 'INVALID';

export type DisputeStatus = 'open' | 'under_review' | 'upheld' | 'rejected';

export interface MarketResolution {
  attempt: number;
  id: string;
  marketId: string;
  /** User who submitted the manual resolution request */
  requestedBy: string;
  outcome: ResolutionOutcome;
  status: ResolutionStatus;
  /** Optional on-chain tx hash confirming the resolution */
  txHash?: string;
  /** Evidence or notes provided with the request */
  evidence?: string;
  requestedAt: Date;
  confirmedAt?: Date;
  resolvedAt?: Date;
  cancelledAt?: Date;
}

export interface ResolutionDispute {
  attempt: number;
  priorStatus: 'requested' | 'confirmed';
  id: string;
  resolutionId: string;
  marketId: string;
  /** User raising the dispute */
  disputedBy: string;
  reason: string;
  status: DisputeStatus;
  /** Admin/reviewer notes */
  reviewNotes?: string;
  raisedAt: Date;
  reviewedAt?: Date;
  resolvedAt?: Date;
}

export interface ResolutionConfirmation {
  attempt: number;
  outcome: ResolutionOutcome;
  chainId: number;
  contractAddress: string;
  blockHash: string;
  logIndex: number;
  invalidatedAt?: Date;
  id: string;
  resolutionId: string;
  marketId: string;
  confirmedBy: string;
  txHash?: string;
  blockNumber?: number;
  confirmedAt: Date;
}

export interface ResolutionReport {
  marketId: string;
  resolution: MarketResolution | null;
  confirmations: ResolutionConfirmation[];
  disputes: ResolutionDispute[];
  totalDisputes: number;
  openDisputes: number;
  generatedAt: Date;
}

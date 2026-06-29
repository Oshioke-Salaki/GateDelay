export interface AuditLog {
  id: string;
  marketId: string;
  operation: string;
  actor: string;
  details: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  createdAt: string;
  previousHash: string;
  hash: string;
}

export interface AuditReport {
  totalLogs: number;
  marketsTouched: number;
  actors: number;
  bySeverity: Record<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', number>;
  byOperation: Record<string, number>;
  windowStart?: string;
  windowEnd?: string;
}

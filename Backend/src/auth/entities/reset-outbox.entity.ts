export interface ResetOutboxEntry {
  id: string;
  email: string;
  tokenHash: string;
  createdAt: Date;
  attempts: number;
  lastAttemptAt?: Date;
  sentAt?: Date;
  status: 'pending' | 'sent' | 'failed' | 'expired';
  error?: string;
}

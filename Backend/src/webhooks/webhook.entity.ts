export interface WebhookPayload {
  marketId: string;
  marketName: string;
  description: string;
  outcomes: string[];
  resolutionDate: Date;
  metadata?: Record<string, any>;
}

export interface WebhookEvent {
  id: string;
  payload: WebhookPayload;
  signature: string;
  timestamp: Date;
  status: 'pending' | 'processed' | 'failed';
  retryCount: number;
  lastError?: string;
}

export interface WebhookStatus {
  eventId: string;
  status: 'pending' | 'processed' | 'failed';
  marketId: string;
  timestamp: Date;
  message: string;
}

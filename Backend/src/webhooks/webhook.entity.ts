/**
 * Public-facing TypeScript interfaces for the webhook subsystem.
 *
 * These are the shapes returned by the service / controller.  The durable
 * storage types live in webhook.schema.ts (Mongoose documents).
 */

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

  /**
   * Provider-supplied stable event identifier (BE-018).
   * Used for idempotency: a second delivery with the same providerEventId
   * returns the original result without creating another market.
   */
  providerEventId: string;

  payload: WebhookPayload;

  /** Original raw request body bytes, kept for re-verification (BE-017). */
  rawBody: Buffer;

  signature: string;
  signedTimestamp: string;
  timestamp: Date;

  /** Monotonically increasing attempt count — never reset on retry (BE-019). */
  retryCount: number;

  /** Full attempt history for observability (BE-019). */
  attemptHistory: Array<{
    attemptNumber: number;
    attemptedAt: Date;
    outcome: 'success' | 'failure';
    error?: string;
  }>;

  status: 'pending' | 'processing' | 'processed' | 'failed' | 'dead_letter';
  maxRetries: number;
  lastError?: string;
  /** Present once a market was successfully created */
  resultMarketId?: string;
}

export interface WebhookAttemptRecord {
  eventId: string;
  attemptNumber: number;
  outcome: 'success' | 'failure';
  errorMessage?: string;
  errorName?: string;
  retryable?: boolean;
  createdMarketId?: string;
  attemptedAt: Date;
}

export interface WebhookStatus {
  eventId: string;
  providerEventId: string;
  status: 'pending' | 'processing' | 'processed' | 'failed' | 'dead_letter';
  marketId: string;
  resultMarketId?: string;
  timestamp: Date;
  message: string;
  attemptCount: number;
  maxAttempts: number;
}

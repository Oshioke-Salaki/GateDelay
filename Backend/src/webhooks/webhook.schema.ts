/**
 * Mongoose schemas for durable webhook storage.
 *
 * Two collections are used:
 *  - `webhook_events`   — one document per ingested event; the verified,
 *    immutable payload lives here so retries never need to re-validate
 *    the sender's original timestamp.
 *  - `webhook_attempts` — one document per processing attempt (initial +
 *    every retry); links back to the parent event by `eventId`.
 *
 * Retention guidance
 *  - Events: keep indefinitely (or archive after 90 days via a TTL index on
 *    `createdAt` if storage cost is a concern).
 *  - Attempts: keep for 30 days; add a TTL index on `attemptedAt` for
 *    automatic pruning.
 *
 * Access policies
 *  - The webhook service owns writes to both collections.
 *  - Operators read through `WebhookService.getWebhookEvent()`,
 *    `getWebhookAttempts()`, and the dead-letter endpoint on the controller.
 *  - Status lookup, deduplication, and retry all query by `eventId` (indexed).
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

// ─── WebhookAttempt ───────────────────────────────────────────────────────────

export type WebhookAttemptDocument = HydratedDocument<WebhookAttempt>;

@Schema({ collection: 'webhook_attempts', timestamps: false })
export class WebhookAttempt {
  /** FK to parent WebhookEvent.eventId */
  @Prop({ required: true, index: true })
  eventId: string;

  /** 1-based attempt number */
  @Prop({ required: true })
  attemptNumber: number;

  /** Outcome of this specific attempt */
  @Prop({ required: true, enum: ['success', 'failure'] })
  outcome: 'success' | 'failure';

  /** Human-readable error message, present only on failure */
  @Prop()
  errorMessage?: string;

  /** Error name / class (e.g. BadRequestException) */
  @Prop()
  errorName?: string;

  /** Whether this was a retryable error or a permanent one */
  @Prop()
  retryable?: boolean;

  /** Market ID returned by the creation service on success */
  @Prop()
  createdMarketId?: string;

  /** Wall-clock time this attempt ran */
  @Prop({ required: true, default: () => new Date() })
  attemptedAt: Date;
}

export const WebhookAttemptSchema = SchemaFactory.createForClass(WebhookAttempt);

// ─── WebhookEvent ─────────────────────────────────────────────────────────────

export type WebhookEventDocument = HydratedDocument<WebhookEventRecord>;

@Schema({ collection: 'webhook_events', timestamps: true })
export class WebhookEventRecord {
  /** Stable UUID assigned at ingress — also used as the public eventId */
  @Prop({ required: true, unique: true, index: true })
  eventId: string;

  /**
   * Deduplication key.
   * Derived as: `provider:${providerEventId}`.
   * Unique index prevents the same sender delivery from being ingested twice.
   */
  @Prop({ required: true, unique: true })
  deduplicationKey: string;

  /** Stable provider ID, retained across repeated deliveries and restarts. */
  @Prop()
  providerEventId?: string;

  /** The payload as it arrived — immutable after ingress */
  @Prop({ required: true, type: Object })
  payload: {
    marketId: string;
    marketName: string;
    description: string;
    outcomes: string[];
    resolutionDate: Date;
    metadata?: Record<string, unknown>;
  };

  /**
   * Set to true once signature + timestamp window checks pass on the *first*
   * delivery.  Internal retries skip re-validation and use this flag instead.
   */
  @Prop({ required: true, default: false })
  verified: boolean;

  /** Wall-clock time the event was accepted (after passing validation) */
  @Prop()
  verifiedAt?: Date;

  /** Current lifecycle status */
  @Prop({
    required: true,
    enum: ['pending', 'processing', 'processed', 'failed', 'dead_letter'],
    default: 'pending',
  })
  status: 'pending' | 'processing' | 'processed' | 'failed' | 'dead_letter';

  /** Total number of processing attempts made so far */
  @Prop({ required: true, default: 0 })
  attemptCount: number;

  /** Max attempts allowed before moving to dead_letter */
  @Prop({ required: true })
  maxAttempts: number;

  /** Most recent error, for quick operator inspection */
  @Prop()
  lastError?: string;

  /** Market ID produced by a successful creation, once known */
  @Prop()
  resultMarketId?: string;

  /** Earliest wall-clock time the next retry should run (for backoff) */
  @Prop()
  nextRetryAt?: Date;

  /** createdAt / updatedAt provided by `timestamps: true` */
  createdAt: Date;
  updatedAt: Date;
}

export const WebhookEventSchema = SchemaFactory.createForClass(WebhookEventRecord);

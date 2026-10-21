/**
 * WebhookService — durable, self-healing webhook ingestion.
 *
 * Four problems fixed from the original implementation:
 *
 * 1. TIMESTAMP / RETRY AUTH
 *    Signature + timestamp-window validation runs exactly once on ingress.
 *    A `verified: true` flag is persisted to the database.  Internal retries
 *    skip signature re-validation entirely — they operate on the stored,
 *    immutable payload and only check that flag.  An unverified or tampered
 *    event can never reach processing.
 *
 * 2. DURABLE QUEUE WITH EXPONENTIAL BACKOFF + DEAD-LETTER
 *    Failed events are scheduled for automatic retry using bounded exponential
 *    backoff with full jitter.  Attempts are capped at `maxAttempts`.  Once
 *    exhausted the event moves to `dead_letter` — an operator-visible terminal
 *    state exposed via `getDeadLetterEvents()`.  A `@Cron` runner picks up
 *    due retries every 30 seconds so no manual trigger is needed.
 *
 * 3. REAL MARKET CREATION
 *    `createMarketFromWebhook` now calls `MarketResolverService.registerMarket()`
 *    and returns the resulting market ID.  A success response only carries that
 *    ID after the service's own success boundary has been crossed.
 *
 * 4. DURABLE STORAGE
 *    Events and attempts are persisted to MongoDB (`webhook_events` +
 *    `webhook_attempts`).  Status lookup, deduplication, and retry all work
 *    across restarts and instances.
 */
import {
  Injectable,
  OnModuleInit,
  BadRequestException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';

import { WebhookPayload, WebhookStatus } from './webhook.entity';
import {
  WebhookEventRecord,
  WebhookEventDocument,
  WebhookAttempt,
  WebhookAttemptDocument,
} from './webhook.schema';
import { MarketResolverService } from '../markets/market-resolver.service';
import type { Market } from '../markets/market-resolver.service';

// ─── Backoff helpers ──────────────────────────────────────────────────────────

/**
 * Full-jitter exponential backoff.
 *
 * delay = random(0 … min(cap, base * factor^(attempt-1)))
 * Spreads retries to avoid thundering-herd against downstream services.
 */
function computeBackoffMs(
  attempt: number,
  opts: { base: number; factor: number; cap: number },
): number {
  const raw = opts.base * opts.factor ** Math.max(0, attempt - 1);
  const capped = Math.min(raw, opts.cap);
  return Math.round(Math.random() * capped);
}

/** Returns true for transient errors; false for permanent ones. */
function isRetryable(err: unknown): boolean {
  if (err instanceof BadRequestException) return false;   // validation errors are permanent
  if (err instanceof ConflictException) return false;     // duplicate market — permanent
  return true;                                             // everything else is transient
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class WebhookService implements OnModuleInit {
  private readonly logger = new Logger(WebhookService.name);

  private readonly acceptedSecrets: string[];

  private readonly allowedTimestampDriftMs = Number(
    process.env.WEBHOOK_TIMESTAMP_WINDOW_MS ?? 5 * 60 * 1000,
  );

  private readonly maxAttempts = Number(
    process.env.WEBHOOK_MAX_ATTEMPTS ?? 5,
  );

  // Backoff configuration (all values in ms)
  private readonly backoff = {
    base: Number(process.env.WEBHOOK_RETRY_BASE_MS ?? 2_000),
    factor: Number(process.env.WEBHOOK_RETRY_FACTOR ?? 2),
    cap: Number(process.env.WEBHOOK_RETRY_CAP_MS ?? 60_000),
  };

  constructor(
    @InjectModel(WebhookEventRecord.name)
    private readonly eventModel: Model<WebhookEventDocument>,
    @InjectModel(WebhookAttempt.name)
    private readonly attemptModel: Model<WebhookAttemptDocument>,
    private readonly marketResolver: MarketResolverService,
    private readonly config: ConfigService,
  ) {
    const primary = this.config.get<string>('WEBHOOK_SECRET') ?? '';
    const rotation = (this.config.get<string>('WEBHOOK_SECRET_ROTATION') ?? '')
      .split(',').map((secret) => secret.trim()).filter(Boolean);
    this.acceptedSecrets = [primary, ...rotation];
  }

  onModuleInit(): void {
    const nodeEnv = this.config.get<string>('NODE_ENV') ?? 'development';

    if (!this.acceptedSecrets[0]) {
      throw new Error(
        '[WebhookService] WEBHOOK_SECRET is not configured. ' +
          'Set a strong secret before starting the server.',
      );
    }

    const primarySecret = this.acceptedSecrets[0];

    if (this.acceptedSecrets.some((secret) => !secret || secret === 'default-secret')) {
      throw new Error(
        '[WebhookService] Webhook secrets must not contain placeholder values.',
      );
    }

    if (nodeEnv === 'production' || nodeEnv === 'staging') {
      if (primarySecret.length < 32) {
        throw new Error(
          '[WebhookService] WEBHOOK_SECRET must be at least 32 characters ' +
            'in production/staging environments.',
        );
      }
    }

    if (this.acceptedSecrets.length > 1) {
      this.logger.log(
        `Webhook secret rotation active: ${this.acceptedSecrets.length} accepted secrets.`,
      );
    }
  }



  // ─── Ingress ────────────────────────────────────────────────────────────────

  /**
   * Validate, deduplicate, and enqueue a new webhook event.
   *
   * Signature + timestamp window is checked here — exactly once.  After this
   * method returns the event carries `verified: true` in the database.
   * Subsequent retries never touch the original timestamp.
   */
  async processWebhook(
    rawBody: Buffer,
    signature: string,
    timestamp: string,
    providerEventId: string,
  ): Promise<WebhookStatus> {
    if (!providerEventId?.trim()) {
      throw new BadRequestException('Missing provider event ID');
    }

    // ── 1. Validate authenticity (ingress-only) ──────────────────────────────
    if (!this.validateWebhookSignature(rawBody, signature, timestamp)) {
      throw new BadRequestException(
        'Invalid webhook signature or timestamp outside allowed window',
      );
    }

    let payload: WebhookPayload;
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as WebhookPayload;
    } catch {
      throw new BadRequestException('Webhook body is not valid JSON');
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException('Invalid webhook payload');
    }

    // ── 2. Deduplication ─────────────────────────────────────────────────────
    const deduplicationKey = `provider:${providerEventId}`;
    const existing = await this.eventModel
      .findOne({ deduplicationKey })
      .lean()
      .exec();

    if (existing) {
      this.logger.warn(
        `Duplicate webhook delivery rejected: deduplicationKey=${deduplicationKey}`,
      );
      // Return the current status rather than an error so the sender can see
      // the event was already accepted.
      return this.buildStatus(existing as WebhookEventRecord & { _id: unknown });
    }

    // ── 3. Persist a verified, immutable event ───────────────────────────────
    const eventId = randomUUID();
    const doc = await this.eventModel.create({
      eventId,
      deduplicationKey,
      providerEventId,
      payload,
      verified: true,
      verifiedAt: new Date(),
      status: 'pending',
      attemptCount: 0,
      maxAttempts: this.maxAttempts,
    });

    // ── 4. Attempt first processing pass immediately ─────────────────────────
    await this.runAttempt(doc);

    const updated = await this.eventModel.findOne({ eventId }).lean().exec();
    return this.buildStatus(updated as WebhookEventRecord);
  }

  // ─── Automatic retry cron ───────────────────────────────────────────────────

  /**
   * Every 30 s: pick up events that are due for a retry and process them.
   *
   * An event is due when:
   *   status === 'pending'  AND  (nextRetryAt is unset OR nextRetryAt <= now)
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async runPendingRetries(): Promise<void> {
    const now = new Date();
    const due = await this.eventModel
      .find({
        status: 'pending',
        $or: [
          { nextRetryAt: { $exists: false } },
          { nextRetryAt: null },
          { nextRetryAt: { $lte: now } },
        ],
      })
      .exec();

    if (!due.length) return;

    this.logger.log(`Retry cron: ${due.length} event(s) due for retry`);
    await Promise.all(due.map((doc) => this.runAttempt(doc)));
  }

  // ─── Manual operator retry ──────────────────────────────────────────────────

  /**
   * Operator-triggered retry.
   *
   * Works across restarts — the event is loaded from the database, not from
   * an in-memory map.  The original sender timestamp is NOT re-validated;
   * only the persisted `verified` flag is checked.
   */
  async retryWebhook(eventId: string): Promise<WebhookStatus> {
    const doc = await this.eventModel.findOne({ eventId }).exec();
    if (!doc) {
      throw new BadRequestException(`Webhook event not found: ${eventId}`);
    }
    if (!doc.verified) {
      // Should never happen, but defensive check.
      throw new BadRequestException(
        'Event was never successfully verified and cannot be retried',
      );
    }
    if (doc.status === 'dead_letter' || doc.attemptCount >= doc.maxAttempts) {
      throw new BadRequestException('Webhook attempt limit reached');
    }
    if (doc.status === 'processed') {
      return this.buildStatus(doc);
    }

    await this.runAttempt(doc);
    const updated = await this.eventModel.findOne({ eventId }).lean().exec();
    return this.buildStatus(updated as WebhookEventRecord);
  }

  // ─── Status / inspection ────────────────────────────────────────────────────

  async getWebhookStatus(eventId: string): Promise<WebhookStatus | undefined> {
    const doc = await this.eventModel.findOne({ eventId }).lean().exec();
    if (!doc) return undefined;
    return this.buildStatus(doc as WebhookEventRecord);
  }

  async getAllWebhookStatuses(): Promise<WebhookStatus[]> {
    const docs = await this.eventModel
      .find()
      .sort({ createdAt: -1 })
      .limit(200)
      .lean()
      .exec();
    return docs.map((d) => this.buildStatus(d as WebhookEventRecord));
  }

  async getWebhookAttempts(eventId: string) {
    return this.attemptModel
      .find({ eventId })
      .sort({ attemptNumber: 1 })
      .lean()
      .exec();
  }

  async getDeadLetterEvents(): Promise<WebhookStatus[]> {
    const docs = await this.eventModel
      .find({ status: 'dead_letter' })
      .sort({ updatedAt: -1 })
      .lean()
      .exec();
    return docs.map((d) => this.buildStatus(d as WebhookEventRecord));
  }

  // ─── Core processing ────────────────────────────────────────────────────────

  /**
   * Run a single processing attempt for `doc`.
   *
   * This is the authoritative path for both first-delivery and retries.
   * It NEVER re-validates the original sender signature — it only requires
   * `doc.verified === true`, which was set once at ingress.
   */
  private async runAttempt(doc: WebhookEventDocument): Promise<void> {
    if (!doc.verified) {
      this.logger.error(
        `runAttempt called on unverified event ${doc.eventId} — skipping`,
      );
      return;
    }

    doc.status = 'processing';
    doc.attemptCount += 1;
    await doc.save();

    const attemptNumber = doc.attemptCount;

    try {
      const createdMarketId = await this.createMarketFromWebhook(doc.payload);

      doc.status = 'processed';
      doc.resultMarketId = createdMarketId;
      doc.nextRetryAt = undefined;
      await doc.save();

      await this.attemptModel.create({
        eventId: doc.eventId,
        attemptNumber,
        outcome: 'success',
        createdMarketId,
        attemptedAt: new Date(),
      });

      this.logger.log(
        `Webhook ${doc.eventId} processed successfully; market=${createdMarketId}`,
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : String(err);
      const errorName =
        err instanceof Error ? err.constructor.name : 'Error';
      const retryable = isRetryable(err);

      await this.attemptModel.create({
        eventId: doc.eventId,
        attemptNumber,
        outcome: 'failure',
        errorMessage,
        errorName,
        retryable,
        attemptedAt: new Date(),
      });

      if (!retryable || doc.attemptCount >= doc.maxAttempts) {
        doc.status = 'dead_letter';
        doc.lastError = errorMessage;
        doc.nextRetryAt = undefined;
        await doc.save();

        this.logger.error(
          `Webhook ${doc.eventId} dead-lettered after ${doc.attemptCount} attempt(s): ${errorMessage}`,
        );
      } else {
        const delayMs = computeBackoffMs(doc.attemptCount, this.backoff);
        doc.status = 'pending';
        doc.lastError = errorMessage;
        doc.nextRetryAt = new Date(Date.now() + delayMs);
        await doc.save();

        this.logger.warn(
          `Webhook ${doc.eventId} attempt ${attemptNumber}/${doc.maxAttempts} failed (${errorMessage}); ` +
            `retrying in ${delayMs}ms`,
        );
      }
    }
  }

  // ─── Market creation ────────────────────────────────────────────────────────

  /**
   * Translate a verified webhook payload into a live market.
   *
   * Calls the authoritative `MarketResolverService.registerMarket()` and
   * returns the resulting market ID.  A success response is only produced
   * after the service's own success boundary has been crossed — no more
   * "Market created successfully" on a console.log stub.
   */
  private async createMarketFromWebhook(
    payload: WebhookPayload,
  ): Promise<string> {
    if (
      !payload.marketId ||
      !payload.marketName ||
      !payload.outcomes ||
      payload.outcomes.length < 2
    ) {
      throw new BadRequestException('Invalid market payload');
    }

    const resolutionDate =
      payload.resolutionDate instanceof Date
        ? payload.resolutionDate
        : new Date(payload.resolutionDate);

    if (isNaN(resolutionDate.getTime())) {
      throw new BadRequestException(
        `Invalid resolutionDate: ${payload.resolutionDate}`,
      );
    }

    const market: Market = {
      id: payload.marketId,
      title: payload.marketName,
      deadline: resolutionDate,
      totalYesStake: 0n,
      totalNoStake: 0n,
      status: 'active',
    };

    // registerMarket is synchronous and throws on structural errors.
    // Any exception propagates to runAttempt which decides retry vs. dead-letter.
    this.marketResolver.registerMarket(market, 'webhook');

    // Verify the market actually landed in the registry before declaring success.
    const stored = this.marketResolver.getMarket(payload.marketId);
    if (!stored) {
      throw new Error(
        `Market ${payload.marketId} was not found in the registry after registration`,
      );
    }

    return stored.id;
  }

  // ─── Signature validation ────────────────────────────────────────────────────

  /**
   * Validates HMAC-SHA256 signature AND sender timestamp window.
   *
   * Called exactly once per event — at ingress in processWebhook().
   * Internal retries (runAttempt, retryWebhook) do NOT call this.
   */
  validateWebhookSignature(
    rawBody: Buffer,
    signature: string,
    timestamp: string,
    now = Date.now(),
  ): boolean {
    const timestampMs = Number(timestamp);
    if (
      !Number.isFinite(timestampMs) ||
      Math.abs(now - timestampMs) > this.allowedTimestampDriftMs
    ) {
      return false;
    }

    if (!/^[0-9a-fA-F]{64}$/.test(signature)) return false;
    const actual = Buffer.from(signature, 'hex');

    for (const secret of this.acceptedSecrets) {
      const hash = createHmac('sha256', secret)
        .update(`${timestamp}.`)
        .update(rawBody)
        .digest('hex');

      const expected = Buffer.from(hash, 'hex');

      if (
        expected.length === actual.length &&
        timingSafeEqual(expected, actual)
      ) {
        return true;
      }
    }

    return false;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private buildStatus(doc: WebhookEventRecord): WebhookStatus {
    return {
      eventId: doc.eventId,
      providerEventId: doc.providerEventId ?? doc.deduplicationKey,
      status: doc.status,
      marketId: doc.payload.marketId,
      resultMarketId: doc.resultMarketId,
      timestamp: doc.verifiedAt ?? (doc as any).createdAt ?? new Date(),
      message: this.statusMessage(doc),
      attemptCount: doc.attemptCount,
      maxAttempts: doc.maxAttempts,
    };
  }

  private statusMessage(doc: WebhookEventRecord): string {
    switch (doc.status) {
      case 'processed':
        return `Market created successfully (id=${doc.resultMarketId})`;
      case 'dead_letter':
        return `Exhausted ${doc.attemptCount}/${doc.maxAttempts} attempts: ${doc.lastError ?? 'unknown error'}`;
      case 'pending':
        return doc.attemptCount === 0
          ? 'Queued for first processing'
          : `Queued for retry (attempt ${doc.attemptCount}/${doc.maxAttempts}): ${doc.lastError ?? ''}`;
      case 'processing':
        return `Attempt ${doc.attemptCount} in progress`;
      case 'failed':
        return `Failed after ${doc.attemptCount} attempt(s): ${doc.lastError ?? 'unknown error'}`;
      default:
        return doc.status;
    }
  }
}

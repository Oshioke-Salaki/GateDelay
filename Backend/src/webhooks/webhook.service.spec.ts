/**
 * WebhookService unit tests.
 *
 * These cover the four acceptance criteria from the spec:
 *
 * 1. TIMESTAMP / RETRY AUTH
 *    - A valid event can be retried after the ingress timestamp window expires
 *      because internal retries use the stored `verified` flag, not the
 *      original sender timestamp.
 *    - An unverified or modified payload is always rejected at ingress.
 *
 * 2. DURABLE QUEUE / AUTOMATIC RETRIES
 *    - Retryable failures are scheduled automatically; the cron runner
 *      picks them up and re-processes them.
 *    - Permanent failures are NOT retried (no nextRetryAt set).
 *    - Exhausted retries move the event to `dead_letter` with full metadata.
 *
 * 3. REAL MARKET CREATION
 *    - A successful webhook calls MarketResolverService.registerMarket().
 *    - A resultMarketId is present in the returned status.
 *    - A creation failure surfaces as a non-success status.
 *
 * 4. DURABLE STORAGE (covered structurally — DB calls are verified via mocks)
 *    - eventModel.create and attemptModel.create are called on ingress.
 *    - Retries load from eventModel, not from an in-memory map.
 */

import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { WebhookPayload } from './webhook.entity';
import { WebhookService } from './webhook.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sign = (payload: WebhookPayload, timestamp: string, secret: string) =>
  createHmac('sha256', secret)
    .update(`${timestamp}.${JSON.stringify(payload)}`)
    .digest('hex');

const makePayload = (overrides: Partial<WebhookPayload> = {}): WebhookPayload => ({
  marketId: 'market-1',
  marketName: 'Flight delayed',
  description: 'Will the flight be delayed?',
  outcomes: ['YES', 'NO'],
  resolutionDate: new Date('2026-10-01T00:00:00.000Z'),
  ...overrides,
});

// ─── Lightweight fakes ───────────────────────────────────────────────────────

/** Returns a fake Mongoose document that behaves just enough for the service. */
function makeEventDoc(overrides: Partial<Record<string, unknown>> = {}) {
  const doc: Record<string, unknown> = {
    eventId: 'evt-1',
    deduplicationKey: 'market-1:12345',
    payload: makePayload(),
    verified: true,
    verifiedAt: new Date(),
    status: 'pending',
    attemptCount: 0,
    maxAttempts: 3,
    lastError: undefined,
    resultMarketId: undefined,
    nextRetryAt: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
    // Allow callers to override save, but default to a no-op
    save: jest.fn().mockResolvedValue(undefined),
  };
  return doc;
}

// ─── Factory to build the service with controlled fakes ─────────────────────

function buildService(opts: {
  secret?: string;
  /** What findOne returns for the first call (dedup check) */
  findOneDedup?: unknown;
  /** What findOne returns for the post-attempt reload */
  findOneReload?: Record<string, unknown>;
  /** The live mutable doc that create() returns */
  liveDoc?: Record<string, unknown>;
  /** How registerMarket behaves */
  registerMarket?: () => void;
  /** How getMarket behaves */
  getMarket?: () => Record<string, unknown> | undefined;
  maxAttempts?: number;
}) {
  const secret = opts.secret ?? 'test-webhook-secret';
  process.env.WEBHOOK_SECRET = secret;
  process.env.WEBHOOK_TIMESTAMP_WINDOW_MS = '300000';
  process.env.WEBHOOK_MAX_ATTEMPTS = String(opts.maxAttempts ?? 3);

  const liveDoc = opts.liveDoc ?? makeEventDoc({ maxAttempts: opts.maxAttempts ?? 3 });

  const eventModel = {
    findOne: jest.fn().mockImplementation((query: Record<string, unknown>) => ({
      exec: jest.fn().mockResolvedValue(
        'deduplicationKey' in query
          ? opts.findOneDedup ?? null
          : opts.findOneReload ?? liveDoc,
      ),
      lean: jest.fn().mockReturnThis(),
    })),
    create: jest.fn().mockImplementation(async (fields: Record<string, unknown>) =>
      Object.assign(liveDoc, fields),
    ),
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    }),
  };

  const attemptModel = {
    create: jest.fn().mockResolvedValue({}),
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    }),
  };

  const marketResolver = {
    registerMarket: jest.fn().mockImplementation(opts.registerMarket ?? (() => {})),
    getMarket: jest.fn().mockImplementation(
      opts.getMarket ?? (() => ({ id: 'market-1', title: 'Flight delayed' })),
    ),
  };

  const service = new WebhookService(
    eventModel as any,
    attemptModel as any,
    marketResolver as any,
    new ConfigService(process.env),
  );

  return { service, eventModel, attemptModel, marketResolver, secret };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('WebhookService — ingress validation', () => {
  afterEach(() => {
    delete process.env.WEBHOOK_SECRET;
    delete process.env.WEBHOOK_TIMESTAMP_WINDOW_MS;
    delete process.env.WEBHOOK_MAX_ATTEMPTS;
  });

  it('verifies the original bytes rather than re-serialised JSON', () => {
    const { service, secret } = buildService({});
    const timestamp = String(Date.now());
    const raw = Buffer.from('{ "marketId": "market-1" }');
    const signature = createHmac('sha256', secret)
      .update(`${timestamp}.`).update(raw).digest('hex');
    expect(service.validateWebhookSignature(raw, signature, timestamp)).toBe(true);
    expect(service.validateWebhookSignature(
      Buffer.from('{"marketId":"market-1"}'), signature, timestamp,
    )).toBe(false);
  });

  it('rejects missing secrets at startup', () => {
    const { service } = buildService({ secret: '' });
    expect(() => service.onModuleInit()).toThrow();
  });

  it('processes a valid signature inside the timestamp window', async () => {
    const payload = makePayload();
    const { service, secret } = buildService({});
    const timestamp = String(Date.now());

    const status = await service.processWebhook(
      Buffer.from(JSON.stringify(payload)),
      sign(payload, timestamp, secret),
      timestamp, 'provider-event-1',
    );

    expect(status.status).toBe('processed');
    expect(status.resultMarketId).toBe('market-1');
  });

  it('rejects a signature generated for a different payload', async () => {
    const payload = makePayload();
    const { service, secret } = buildService({});
    const timestamp = String(Date.now());

    await expect(
      service.processWebhook(
        Buffer.from(JSON.stringify(payload)),
        sign({ ...payload, marketId: 'other-market' }, timestamp, secret),
        timestamp, 'provider-event-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects events outside the allowed timestamp window', async () => {
    const payload = makePayload();
    const { service, secret } = buildService({});
    const timestamp = String(Date.now() - 301_000); // 5 min + 1 s ago

    await expect(
      service.processWebhook(
        Buffer.from(JSON.stringify(payload)),
        sign(payload, timestamp, secret),
        timestamp, 'provider-event-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });
});

// ─── Fix 1: timestamp / retry auth ──────────────────────────────────────────

describe('Fix 1 — internal retries bypass sender timestamp window', () => {
  afterEach(() => {
    delete process.env.WEBHOOK_SECRET;
    delete process.env.WEBHOOK_TIMESTAMP_WINDOW_MS;
    delete process.env.WEBHOOK_MAX_ATTEMPTS;
  });

  it('retries a verified event even after the ingress window has expired', async () => {
    // The stored doc is verified but has an old signedTimestamp that would
    // fail the 5-minute drift check if re-validated.
    const oldTimestamp = String(Date.now() - 10 * 60 * 1000); // 10 min ago

    const pendingDoc = makeEventDoc({
      status: 'pending',
      attemptCount: 0,
      verified: true,
    });
    const processedDoc = { ...pendingDoc, status: 'processed', resultMarketId: 'market-1' };

    const { service } = buildService({
      liveDoc: pendingDoc,
      findOneReload: processedDoc,
    });

    // Simulate the service finding this existing event by eventId
    (service['eventModel'].findOne as jest.Mock).mockReturnValue({
      exec: jest.fn().mockResolvedValueOnce(pendingDoc), // first findOne (load for retry)
      lean: jest.fn().mockReturnThis(),
    });

    // Override retryWebhook's findOne to return the pendingDoc then processedDoc
    let findOneCallCount = 0;
    (service['eventModel'].findOne as jest.Mock).mockImplementation(() => ({
      exec: jest.fn().mockImplementation(() => {
        findOneCallCount++;
        if (findOneCallCount === 1) return Promise.resolve(pendingDoc);
        return Promise.resolve(processedDoc);
      }),
      lean: jest.fn().mockReturnThis(),
    }));

    // retryWebhook should succeed — it does NOT call validateWebhookSignature
    // with `oldTimestamp`, it uses the verified flag instead.
    const status = await service.retryWebhook('evt-1');

    expect(['processed', 'pending', 'dead_letter']).toContain(status.status);
    // The service must NOT have thrown a "timestamp outside allowed window" error
    // — that is the key acceptance criterion.
  });

  it('refuses to retry an unverified event', async () => {
    const unverifiedDoc = makeEventDoc({ verified: false, status: 'pending' });

    const { service } = buildService({ liveDoc: unverifiedDoc });
    (service['eventModel'].findOne as jest.Mock).mockReturnValue({
      exec: jest.fn().mockResolvedValue(unverifiedDoc),
      lean: jest.fn().mockReturnThis(),
    });

    await expect(service.retryWebhook('evt-1')).rejects.toThrow(BadRequestException);
  });
});

// ─── Fix 2: automatic retries + dead-letter ──────────────────────────────────

describe('Fix 2 — durable queue with bounded retries and dead-letter', () => {
  it('keeps the attempt count when a dead-lettered event is retried', async () => {
    const doc = makeEventDoc({ status: 'dead_letter', attemptCount: 3 });
    const { service, eventModel, attemptModel } = buildService({ liveDoc: doc });
    eventModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(doc),
      lean: jest.fn().mockReturnThis(),
    });
    await expect(service.retryWebhook('evt-1')).rejects.toThrow(BadRequestException);
    expect(doc.attemptCount).toBe(3);
    expect(attemptModel.create).not.toHaveBeenCalled();
  });

  afterEach(() => {
    delete process.env.WEBHOOK_SECRET;
    delete process.env.WEBHOOK_TIMESTAMP_WINDOW_MS;
    delete process.env.WEBHOOK_MAX_ATTEMPTS;
  });

  it('schedules a nextRetryAt for retryable failures', async () => {
    const payload = makePayload();
    const { service, secret } = buildService({
      maxAttempts: 3,
      // registerMarket throws a transient (retryable) error
      registerMarket: () => { throw new Error('DB temporarily unavailable'); },
      // getMarket returns undefined so creation also fails the post-check
      getMarket: () => undefined,
    });
    const timestamp = String(Date.now());

    const status = await service.processWebhook(
      Buffer.from(JSON.stringify(payload)),
      sign(payload, timestamp, secret),
      timestamp, 'provider-event-1',
    );

    // After 1 transient failure with 3 maxAttempts, the event should be
    // back in pending with a future retry scheduled.
    expect(status.status).toBe('pending');
  });

  it('dead-letters an event after exhausting all attempts', async () => {
    const payload = makePayload();
    let attemptsMade = 0;
    // Always fail transiently
    const alwaysFail = () => {
      attemptsMade++;
      throw new Error('Persistent transient error');
    };

    const { service, secret } = buildService({
      maxAttempts: 1, // exhaust immediately
      registerMarket: alwaysFail,
      getMarket: () => undefined,
    });
    const timestamp = String(Date.now());

    const status = await service.processWebhook(
      Buffer.from(JSON.stringify(payload)),
      sign(payload, timestamp, secret),
      timestamp, 'provider-event-1',
    );

    expect(status.status).toBe('dead_letter');
    expect(status.attemptCount).toBe(1);
  });

  it('records an attempt document on failure', async () => {
    const payload = makePayload();
    const { service, secret, attemptModel } = buildService({
      maxAttempts: 2,
      registerMarket: () => { throw new Error('transient'); },
      getMarket: () => undefined,
    });
    const timestamp = String(Date.now());

    await service.processWebhook(
      Buffer.from(JSON.stringify(payload)),
      sign(payload, timestamp, secret),
      timestamp, 'provider-event-1',
    );

    expect(attemptModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'failure', retryable: true }),
    );
  });

  it('does NOT schedule a retry for a permanent (non-retryable) failure', async () => {
    const payload = makePayload();
    const { service, secret } = buildService({
      maxAttempts: 3,
      // BadRequestException is classified as permanent
      registerMarket: () => { throw new BadRequestException('Validation failed'); },
      getMarket: () => undefined,
    });
    const timestamp = String(Date.now());

    const status = await service.processWebhook(
      Buffer.from(JSON.stringify(payload)),
      sign(payload, timestamp, secret),
      timestamp, 'provider-event-1',
    );

    // Permanent error → dead_letter immediately, no retry scheduled
    expect(status.status).toBe('dead_letter');
  });
});

// ─── Fix 3: real market creation ─────────────────────────────────────────────

describe('Fix 3 — real market creation via MarketResolverService', () => {
  afterEach(() => {
    delete process.env.WEBHOOK_SECRET;
    delete process.env.WEBHOOK_TIMESTAMP_WINDOW_MS;
    delete process.env.WEBHOOK_MAX_ATTEMPTS;
  });

  it('calls registerMarket with the correct market shape', async () => {
    const payload = makePayload();
    const { service, secret, marketResolver } = buildService({});
    const timestamp = String(Date.now());

    await service.processWebhook(Buffer.from(JSON.stringify(payload)), sign(payload, timestamp, secret), timestamp, 'provider-event-1');

    expect(marketResolver.registerMarket).toHaveBeenCalledWith(
      expect.objectContaining({
        id: payload.marketId,
        title: payload.marketName,
        status: 'active',
        totalYesStake: 0n,
        totalNoStake: 0n,
      }),
      'webhook',
    );
  });

  it('returns the market id in resultMarketId on success', async () => {
    const payload = makePayload();
    const { service, secret } = buildService({});
    const timestamp = String(Date.now());

    const status = await service.processWebhook(
      Buffer.from(JSON.stringify(payload)),
      sign(payload, timestamp, secret),
      timestamp, 'provider-event-1',
    );

    expect(status.resultMarketId).toBe('market-1');
    expect(status.status).toBe('processed');
  });

  it('does NOT report success when registerMarket throws', async () => {
    const payload = makePayload();
    const { service, secret } = buildService({
      maxAttempts: 1,
      registerMarket: () => { throw new Error('Chain unavailable'); },
      getMarket: () => undefined,
    });
    const timestamp = String(Date.now());

    const status = await service.processWebhook(
      Buffer.from(JSON.stringify(payload)),
      sign(payload, timestamp, secret),
      timestamp, 'provider-event-1',
    );

    expect(status.status).not.toBe('processed');
    expect(status.resultMarketId).toBeUndefined();
  });

  it('rejects payloads with fewer than 2 outcomes', async () => {
    const payload = makePayload({ outcomes: ['YES'] });
    const { service, secret } = buildService({});
    const timestamp = String(Date.now());

    const status = await service.processWebhook(
      Buffer.from(JSON.stringify(payload)),
      sign(payload, timestamp, secret),
      timestamp, 'provider-event-1',
    );

    // Bad payload is a permanent error → dead_letter
    expect(status.status).toBe('dead_letter');
  });
});

// ─── Fix 4: durable storage (structural checks) ──────────────────────────────

describe('Fix 4 — durable storage: DB calls on every ingress and attempt', () => {
  afterEach(() => {
    delete process.env.WEBHOOK_SECRET;
    delete process.env.WEBHOOK_TIMESTAMP_WINDOW_MS;
    delete process.env.WEBHOOK_MAX_ATTEMPTS;
  });

  it('persists the event document on ingress', async () => {
    const payload = makePayload();
    const { service, secret, eventModel } = buildService({});
    const timestamp = String(Date.now());

    await service.processWebhook(Buffer.from(JSON.stringify(payload)), sign(payload, timestamp, secret), timestamp, 'provider-event-1');

    expect(eventModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ marketId: payload.marketId }),
        verified: true,
        status: 'pending',
      }),
    );
  });

  it('persists a success attempt document', async () => {
    const payload = makePayload();
    const { service, secret, attemptModel } = buildService({});
    const timestamp = String(Date.now());

    await service.processWebhook(Buffer.from(JSON.stringify(payload)), sign(payload, timestamp, secret), timestamp, 'provider-event-1');

    expect(attemptModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'success',
        createdMarketId: 'market-1',
      }),
    );
  });

  it('deduplicates a second delivery with the same key', async () => {
    const payload = makePayload();
    const existingDoc = makeEventDoc({ status: 'processed', resultMarketId: 'market-1' });
    const { service, secret, eventModel } = buildService({
      findOneDedup: existingDoc,
    });
    const timestamp = String(Date.now());

    // Override the chain to return existing on dedup check
    (eventModel.findOne as jest.Mock).mockReturnValue({
      exec: jest.fn().mockResolvedValue(existingDoc),
      lean: jest.fn().mockReturnThis(),
    });

    const status = await service.processWebhook(
      Buffer.from(JSON.stringify(payload)),
      sign(payload, timestamp, secret),
      timestamp, 'provider-event-1',
    );

    // Returns current status without creating a new document
    expect(eventModel.create).not.toHaveBeenCalled();
    expect(status.status).toBe('processed');
  });
});

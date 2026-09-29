import { BadRequestException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { WebhookPayload } from './webhook.entity';
import { WebhookService } from './webhook.service';

const sign = (payload: WebhookPayload, timestamp: string, secret: string) =>
  createHmac('sha256', secret)
    .update(`${timestamp}.${JSON.stringify(payload)}`)
    .digest('hex');

describe('WebhookService', () => {
  const secret = 'test-webhook-secret';
  const payload: WebhookPayload = {
    marketId: 'market-1',
    marketName: 'Flight delayed',
    description: 'Will the flight be delayed?',
    outcomes: ['YES', 'NO'],
    resolutionDate: new Date('2026-10-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    process.env.WEBHOOK_SECRET = secret;
    process.env.WEBHOOK_TIMESTAMP_WINDOW_MS = '300000';
  });

  afterEach(() => {
    delete process.env.WEBHOOK_SECRET;
    delete process.env.WEBHOOK_TIMESTAMP_WINDOW_MS;
  });

  it('processes a valid signature inside the timestamp window', async () => {
    const service = new WebhookService();
    const timestamp = String(Date.now());

    const status = await service.processWebhook(
      payload,
      sign(payload, timestamp, secret),
      timestamp,
    );

    expect(status.status).toBe('processed');
    expect(status.marketId).toBe(payload.marketId);
  });

  it('rejects a signature generated for a different payload', async () => {
    const service = new WebhookService();
    const timestamp = String(Date.now());

    await expect(
      service.processWebhook(
        payload,
        sign({ ...payload, marketId: 'other-market' }, timestamp, secret),
        timestamp,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects events outside the allowed timestamp window', async () => {
    const service = new WebhookService();
    const timestamp = String(Date.now() - 301000);

    await expect(
      service.processWebhook(payload, sign(payload, timestamp, secret), timestamp),
    ).rejects.toThrow('timestamp outside allowed window');
  });
});

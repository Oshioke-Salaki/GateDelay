import { Injectable, BadRequestException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { WebhookPayload, WebhookEvent, WebhookStatus } from './webhook.entity';

@Injectable()
export class WebhookService {
  private webhookEvents = new Map<string, WebhookEvent>();
  private webhookStatuses = new Map<string, WebhookStatus>();
  private readonly webhookSecret =
    process.env.WEBHOOK_SECRET || 'default-secret';
  private readonly maxRetries = 3;
  private readonly allowedTimestampDriftMs = Number(
    process.env.WEBHOOK_TIMESTAMP_WINDOW_MS ?? 5 * 60 * 1000,
  );

  validateWebhookSignature(
    payload: string,
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

    const hash = createHmac('sha256', this.webhookSecret)
      .update(`${timestamp}.${payload}`)
      .digest('hex');
    const expected = Buffer.from(hash, 'hex');
    const actual = Buffer.from(signature, 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  async processWebhook(
    payload: WebhookPayload,
    signature: string,
    timestamp: string,
  ): Promise<WebhookStatus> {
    const payloadString = JSON.stringify(payload);

    if (!this.validateWebhookSignature(payloadString, signature, timestamp)) {
      throw new BadRequestException(
        'Invalid webhook signature or timestamp outside allowed window',
      );
    }

    const eventId = uuidv4();
    const event: WebhookEvent = {
      id: eventId,
      payload,
      signature,
      signedTimestamp: timestamp,
      timestamp: new Date(),
      status: 'pending',
      retryCount: 0,
    };

    this.webhookEvents.set(eventId, event);

    try {
      await this.createMarketFromWebhook(payload);
      event.status = 'processed';

      const status: WebhookStatus = {
        eventId,
        status: 'processed',
        marketId: payload.marketId,
        timestamp: new Date(),
        message: 'Market created successfully',
      };

      this.webhookStatuses.set(eventId, status);
      return status;
    } catch (error) {
      return this.handleWebhookError(event, error);
    }
  }

  private async createMarketFromWebhook(
    payload: WebhookPayload,
  ): Promise<void> {
    // Validate payload
    if (
      !payload.marketId ||
      !payload.marketName ||
      !payload.outcomes ||
      payload.outcomes.length < 2
    ) {
      throw new BadRequestException('Invalid market payload');
    }

    // Simulate market creation
    // In production, this would call the actual market creation service
    console.log(
      `Creating market: ${payload.marketName} with outcomes: ${payload.outcomes.join(', ')}`,
    );
  }

  private handleWebhookError(event: WebhookEvent, error: any): WebhookStatus {
    event.lastError = error.message;
    event.retryCount++;

    if (event.retryCount < this.maxRetries) {
      event.status = 'pending';
      // In production, schedule retry
    } else {
      event.status = 'failed';
    }

    const status: WebhookStatus = {
      eventId: event.id,
      status: event.status,
      marketId: event.payload.marketId,
      timestamp: new Date(),
      message: `Webhook processing failed: ${error.message}. Retry count: ${event.retryCount}/${this.maxRetries}`,
    };

    this.webhookStatuses.set(event.id, status);
    return status;
  }

  getWebhookStatus(eventId: string): WebhookStatus | undefined {
    return this.webhookStatuses.get(eventId);
  }

  getWebhookEvent(eventId: string): WebhookEvent | undefined {
    return this.webhookEvents.get(eventId);
  }

  getAllWebhookStatuses(): WebhookStatus[] {
    return Array.from(this.webhookStatuses.values());
  }

  async retryWebhook(eventId: string): Promise<WebhookStatus> {
    const event = this.webhookEvents.get(eventId);
    if (!event) {
      throw new BadRequestException('Webhook event not found');
    }

    if (event.retryCount >= this.maxRetries) {
      throw new BadRequestException('Max retries exceeded');
    }

    return this.processWebhook(
      event.payload,
      event.signature,
      event.signedTimestamp,
    );
  }
}

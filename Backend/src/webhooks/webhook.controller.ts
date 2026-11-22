import {
  Controller,
  Post,
  Get,
  Param,
  Req,
  BadRequestException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { WebhookService } from './webhook.service';

/**
 * BE-017: Signature verification uses the original raw request bytes, not
 * re-serialised JSON. Nest captures the original bytes on req.rawBody when
 * the application starts with rawBody: true.
 */
@ApiTags('webhooks')
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  /**
   * POST /api/webhooks/market-creation
   *
   * Preferred: pass signature, timestamp, and providerEventId via headers:
   *   x-webhook-signature  — hex HMAC-SHA256 of `"${timestamp}.${rawBody}"`
   *   x-webhook-timestamp  — Unix milliseconds (string)
   *   x-provider-event-id  — stable provider-side event identifier (BE-018)
   *
   * Fallback: include them as top-level fields in the JSON body alongside
   * the WebhookPayload fields (for providers that don't support custom headers).
   */
  @Post('market-creation')
  async handleMarketCreationWebhook(@Req() req: RawBodyRequest<Request>) {
    // BE-017: use the original bytes captured by Nest's body parser.
    const rawBody: Buffer | undefined = req.rawBody;

    const signature: string =
      (req.headers['x-webhook-signature'] as string) ||
      (req.body as any)?.signature ||
      '';

    const timestamp: string =
      (req.headers['x-webhook-timestamp'] as string) ||
      (req.body as any)?.timestamp ||
      '';

    // BE-018: stable provider event identifier required
    const providerEventId: string =
      (req.headers['x-provider-event-id'] as string) ||
      (req.body as any)?.providerEventId ||
      '';

    if (!signature || !timestamp || !providerEventId) {
      throw new BadRequestException(
        'Missing required fields: signature, timestamp, and providerEventId ' +
          'must be supplied via headers (x-webhook-signature, x-webhook-timestamp, ' +
          'x-provider-event-id) or body fields.',
      );
    }

    if (!rawBody || rawBody.length === 0) {
      throw new BadRequestException('Raw webhook body is required');
    }

    return this.webhookService.processWebhook(
      rawBody,
      signature,
      timestamp,
      providerEventId,
    );
  }

  /**
   * Look up the current status of a previously received event.
   * Works across restarts — status is loaded from the database.
   */
  @Get('status/:eventId')
  @ApiOperation({ summary: 'Get status of a webhook event' })
  @ApiResponse({ status: 200, description: 'Event status' })
  @ApiResponse({ status: 400, description: 'Event not found' })
  async getWebhookStatus(@Param('eventId') eventId: string) {
    const status = await this.webhookService.getWebhookStatus(eventId);
    if (!status) {
      throw new BadRequestException('Webhook event not found');
    }
    return status;
  }

  /** List statuses for the 200 most recently received events. */
  @Get('statuses')
  @ApiOperation({ summary: 'List recent webhook event statuses' })
  getAllWebhookStatuses() {
    return this.webhookService.getAllWebhookStatuses();
  }

  /**
   * List all attempts for a specific event.
   *
   * Each attempt record carries its outcome, error details, and whether the
   * error was considered retryable.  Full history is preserved across restarts.
   */
  @Get('attempts/:eventId')
  @ApiOperation({ summary: 'List processing attempts for a webhook event' })
  getWebhookAttempts(@Param('eventId') eventId: string) {
    return this.webhookService.getWebhookAttempts(eventId);
  }

  /**
   * Operator-triggered retry.
   *
   * Bypasses the original sender timestamp — the stored verified payload is
   * used directly.  The event must carry `verified: true` to be retried.
   * Dead-lettered events retain their attempt counts and cannot be re-queued.
   */
  @Post('retry/:eventId')
  @ApiOperation({ summary: 'Manually retry a webhook event' })
  @ApiResponse({ status: 200, description: 'Retry triggered' })
  @ApiResponse({ status: 400, description: 'Event not found or unverified' })
  retryWebhook(@Param('eventId') eventId: string) {
    return this.webhookService.retryWebhook(eventId);
  }

  /**
   * Dead-letter queue — events that exhausted all retry attempts.
   * Operator-visible terminal state for investigation and manual re-queue.
   */
  @Get('dead-letters')
  @ApiOperation({ summary: 'List dead-lettered webhook events' })
  getDeadLetters() {
    return this.webhookService.getDeadLetterEvents();
  }
}

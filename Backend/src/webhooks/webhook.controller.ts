import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { WebhookPayload } from './webhook.entity';

@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('market-creation')
  async handleMarketCreationWebhook(
    @Body() body: { payload: WebhookPayload; signature: string },
  ) {
    if (!body.payload || !body.signature) {
      throw new BadRequestException('Missing payload or signature');
    }
    return this.webhookService.processWebhook(body.payload, body.signature);
  }

  @Get('status/:eventId')
  getWebhookStatus(@Param('eventId') eventId: string) {
    const status = this.webhookService.getWebhookStatus(eventId);
    if (!status) {
      throw new BadRequestException('Webhook event not found');
    }
    return status;
  }

  @Get('statuses')
  getAllWebhookStatuses() {
    return this.webhookService.getAllWebhookStatuses();
  }

  @Post('retry/:eventId')
  retryWebhook(@Param('eventId') eventId: string) {
    return this.webhookService.retryWebhook(eventId);
  }
}

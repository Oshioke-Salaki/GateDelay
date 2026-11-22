import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { WebhookService } from './webhook.service';
import { WebhookController } from './webhook.controller';
import {
  WebhookEventRecord,
  WebhookEventSchema,
  WebhookAttempt,
  WebhookAttemptSchema,
} from './webhook.schema';
import { MarketsModule } from '../markets/markets.module';

@Module({
  imports: [
    ConfigModule,
    // Durable event + attempt storage (fixes in-memory-only persistence).
    // webhook_events  — one document per accepted delivery
    // webhook_attempts — one document per processing attempt
    MongooseModule.forFeature([
      { name: WebhookEventRecord.name, schema: WebhookEventSchema },
      { name: WebhookAttempt.name, schema: WebhookAttemptSchema },
    ]),
    // Exposes MarketResolverService so createMarketFromWebhook can call
    // registerMarket() instead of just logging.
    MarketsModule,
  ],
  controllers: [WebhookController],
  providers: [WebhookService],
  exports: [WebhookService],
})
export class WebhooksModule {}

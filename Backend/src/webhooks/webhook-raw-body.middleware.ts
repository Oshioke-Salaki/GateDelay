import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * BE-017: Captures the raw request bytes for the webhook endpoint BEFORE
 * the global JSON body-parser has a chance to consume and discard them.
 *
 * The raw bytes are stored on `req.rawBody` (a Buffer) so that
 * WebhookController can pass them directly to WebhookService for HMAC
 * verification without any re-serialisation.
 *
 * Scope: only applied to POST /webhooks/market-creation via WebhooksModule.
 */
@Injectable()
export class WebhookRawBodyMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      (req as any).rawBody = Buffer.concat(chunks);
      next();
    });

    req.on('error', (err) => {
      next(err);
    });
  }
}

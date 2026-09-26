import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpErrorEnvelopeFilter } from './common/http-error-envelope.filter';
import { expressCorrelationMiddleware, log } from '../utils/correlation';

// API protection middlewares (Backend/API_PROTECTION_README.md)
// CommonJS modules under Backend/middleware — required to boot under both NestJS and legacy Express
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ddosGuard } = require('../middleware/ddosGuard');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { throttle } = require('../middleware/throttle');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { versionMiddleware } = require('../middleware/version');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { backwardCompatMiddleware } = require('../middleware/backwardCompat');
// Rate-limit tables + startup validation (Backend/config/rateLimitsValidation.js)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const rateLimitConfig = require('../config/rateLimits');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { assertValidRateLimits } = require('../config/rateLimitsValidation');

async function bootstrap() {
  // Fail the boot on an unsafe rate-limit configuration before the app starts
  // listening — an invalid table that boots is a limiter that silently does
  // nothing. Throws RateLimitConfigError on failure.
  const rateLimitReport = assertValidRateLimits(rateLimitConfig) as {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
  for (const warning of rateLimitReport.warnings) {
    console.warn(`[main] ${warning}`);
  }

  const app = await NestFactory.create(AppModule);

  app.enableCors({ origin: process.env.FRONTEND_URL || '*' });
  app.use(expressCorrelationMiddleware);

  // Apply API protection globally (see API_PROTECTION_README.md)
  // Order: DDoS → throttle → versioning → backward-compat
  try {
    app.use(ddosGuard({ whitelist: ['127.0.0.1'] }));
  } catch (e) {
    console.warn('[main] ddosGuard failed to init:', (e as Error).message);
  }
  try {
    app.use(throttle());
  } catch (e) {
    console.warn('[main] throttle failed to init:', (e as Error).message);
  }
  try {
    app.use(
      versionMiddleware({
        defaultVersion: 'v2',
        supportedVersions: ['v1', 'v2'],
        deprecatedVersions: ['v1'],
      }),
    );
  } catch (e) {
    console.warn(
      '[main] versionMiddleware failed to init:',
      (e as Error).message,
    );
  }
  try {
    app.use(
      backwardCompatMiddleware({ warnDeprecated: true, logUsage: false }),
    );
  } catch (e) {
    console.warn('[main] backwardCompat failed to init:', (e as Error).message);
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: { target: false, value: false },
    }),
  );
  app.useGlobalFilters(new HttpErrorEnvelopeFilter());

  app.setGlobalPrefix('api');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('GateDelay API')
    .setDescription(
      'Flight prediction market API including NFT / Soroban endpoints',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  log('info', 'GateDelay Nest backend started', {
    service: 'gatedelay-backend-nest',
    port,
  });
}
void bootstrap();

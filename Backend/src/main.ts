import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpErrorEnvelopeFilter } from './common/http-error-envelope.filter';
import { expressCorrelationMiddleware, log } from '../utils/correlation';
import marketMigrationGuardModule from '../middleware/marketMigrationGuard';
import marketMigrationValidatorModule from '../services/marketMigrationValidator';

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
const { assertValidMarketMigrations } = marketMigrationValidatorModule;
const { marketMigrationGuard } = marketMigrationGuardModule;

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

  // Fail the boot if required market database migrations are missing or unapplied
  try {
    const migrationReport = await assertValidMarketMigrations();
    log(
      'info',
      `[main] Market migration check passed (${migrationReport.appliedCount}/${migrationReport.totalCount} applied)`,
    );
  } catch (err) {
    console.error(
      '[main] FATAL: Market migration check failed before server startup:',
    );
    console.error((err as Error).message);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }

  const app = await NestFactory.create(AppModule);

  app.enableCors({ origin: process.env.FRONTEND_URL || '*' });
  app.use(expressCorrelationMiddleware);
  app.use(marketMigrationGuard());

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

  const legacyPaths = {
    '/api/aml/screen': {
      post: {
        tags: ['aml'],
        summary: 'Screen a user against AML watchlists',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'AML screening result' },
          '401': { description: 'Missing or invalid JWT' },
        },
      },
    },
    '/api/blacklist/add': {
      post: {
        tags: ['blacklist'],
        summary: 'Add an identifier to the blacklist',
        security: [{ bearerAuth: [] }],
        responses: {
          '201': { description: 'Blacklist entry created' },
          '401': { description: 'Missing or invalid JWT' },
          '403': { description: 'Insufficient authorization' },
        },
      },
    },
    '/api/markets/archive': {
      get: {
        tags: ['markets'],
        summary: 'List archived market records',
        description:
          'Returns resolved or cancelled markets with archive metadata consumed by the archive page.',
        parameters: [
          {
            in: 'query',
            name: 'category',
            schema: { type: 'string' },
            required: false,
            description: 'Category slug filter',
          },
          {
            in: 'query',
            name: 'outcome',
            schema: { type: 'string', enum: ['yes', 'no', 'cancelled'] },
            required: false,
            description: 'Outcome filter',
          },
          {
            in: 'query',
            name: 'from',
            schema: { type: 'string', format: 'date-time' },
            required: false,
            description: 'Lower bound for resolution timestamp',
          },
          {
            in: 'query',
            name: 'to',
            schema: { type: 'string', format: 'date-time' },
            required: false,
            description: 'Upper bound for resolution timestamp',
          },
          {
            in: 'query',
            name: 'limit',
            schema: { type: 'integer', minimum: 1, maximum: 500 },
            required: false,
            description: 'Result limit',
          },
          {
            in: 'query',
            name: 'page',
            schema: { type: 'integer', minimum: 1 },
            required: false,
            description: 'Page index starting at 1',
          },
        ],
        responses: {
          '200': {
            description: 'Archived market list',
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    { type: 'array', items: { $ref: '#/components/schemas/ArchivedMarket' } },
                    {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean' },
                        data: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/ArchivedMarket' },
                        },
                        meta: {
                          type: 'object',
                          properties: {
                            page: { type: 'integer' },
                            limit: { type: 'integer' },
                            total: { type: 'integer' },
                            totalPages: { type: 'integer' },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
  };

  if (!document.paths) {
    document.paths = {};
  }
  Object.assign(document.paths, legacyPaths);

  const archivedMarketSchema = {
    type: 'object',
    required: ['id', 'title', 'description', 'category', 'resolvedOutcome', 'resolutionDate', 'volume', 'participants'],
    properties: {
      id: { type: 'string', example: 'mkt_01' },
      title: { type: 'string', example: 'BTC / USD' },
      description: { type: 'string', example: 'Bitcoin settlement market' },
      category: { type: 'string', example: 'crypto' },
      resolvedOutcome: { type: 'string', enum: ['yes', 'no', 'cancelled'] },
      resolutionDate: { type: 'string', format: 'date-time' },
      volume: { type: 'number', example: 1250 },
      participants: { type: 'number', example: 42 },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
      endDate: { type: 'string', format: 'date-time', nullable: true },
      finalPrice: { type: 'number', nullable: true },
    },
  };

  if (!document.components) {
    document.components = {} as Record<string, unknown>;
  }
  document.components = {
    ...document.components,
    schemas: { ...(document.components as any).schemas, ArchivedMarket: archivedMarketSchema },
  } as any;

  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 4000;

  // Enable NestJS shutdown hooks for signal lifecycle handling
  app.enableShutdownHooks();

  // Register NestJS resources with the central GracefulShutdownManager
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const gracefulShutdownManager = require('../services/gracefulShutdown');
  gracefulShutdownManager.registerIngress(
    'NestJS HTTP Server',
    () =>
      new Promise<void>((resolve) => {
        const server = app.getHttpServer();
        if (server && typeof server.close === 'function') {
          server.close(() => resolve());
        } else {
          resolve();
        }
      }),
  );

  gracefulShutdownManager.registerDatabase('NestJS App Teardown', async () => {
    await app.close();
  });

  if (process.env.NODE_ENV !== 'test') {
    gracefulShutdownManager.attachSignalListeners();
  }

  await app.listen(port);
  log('info', 'GateDelay Nest backend started', {
    service: 'gatedelay-backend-nest',
    port,
  });
}
void bootstrap();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

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

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({ origin: process.env.FRONTEND_URL || '*' });

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
    console.warn('[main] versionMiddleware failed to init:', (e as Error).message);
  }
  try {
    app.use(backwardCompatMiddleware({ warnDeprecated: true, logUsage: false }));
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

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

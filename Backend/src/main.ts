/**
 * @file src/main.ts
 * @description NestJS application entry point for GateDelay Backend.
 *
 * ─── STATUS ──────────────────────────────────────────────────────────────────
 * Phase 1 (active): The Express layer (`server.js`) is the currently runnable
 * entry point. Run it with:
 *   npm start          → node server.js  (production)
 *   npm run dev        → node --watch server.js  (development)
 *
 * Phase 2 (in progress): This file is the NestJS entry point. It requires
 * the NestJS dependency set to be installed before it can be compiled or run.
 * See "Phase 2 – NestJS Boot Path" in README.md for the full install steps.
 *
 * ─── BOOT DEPENDENCIES ───────────────────────────────────────────────────────
 * Runtime dependencies (must be added to package.json before use):
 *   @nestjs/core            – NestFactory, application lifecycle
 *   @nestjs/common          – ValidationPipe, decorators, guards
 *   @nestjs/platform-express– default HTTP adapter (Express under the hood)
 *   reflect-metadata        – required for decorator metadata emission
 *
 * Feature-module dependencies (imported via app.module.ts):
 *   @nestjs/config          – ConfigModule / ConfigService (env vars)
 *   @nestjs/mongoose        – MongooseModule (MongoDB ODM)
 *   @nestjs/cache-manager   – CacheModule with Redis store
 *   @nestjs/schedule        – ScheduleModule (cron jobs)
 *   @nestjs/throttler       – ThrottlerModule (rate limiting)
 *   @nestjs/jwt             – JWT auth (AuthModule)
 *   @nestjs/passport        – passport strategies (AuthModule)
 *   @keyv/redis             – Redis Keyv adapter for CacheModule
 *
 * Dev / build toolchain (devDependencies):
 *   typescript              – TS compiler (tsc)
 *   @nestjs/cli             – nest build / nest start commands
 *   @nestjs/schematics      – code generation
 *   ts-node                 – run TS directly during development
 *   @types/node             – Node.js type definitions
 *
 * ─── ENVIRONMENT VARIABLES ───────────────────────────────────────────────────
 * Copy .env.example → .env and populate before starting:
 *   PORT             (default 3000)  – HTTP listen port
 *   FRONTEND_URL                     – allowed CORS origin; defaults to '*'
 *   MONGODB_URI      (default mongodb://localhost:27017/gatedelay)
 *   REDIS_HOST       (default localhost)
 *   REDIS_PORT       (default 6379)
 *   JWT_SECRET       – required for AuthModule
 *   JWT_REFRESH_SECRET
 *   … see .env.example for the full list
 *
 * ─── EXTERNAL SERVICES ───────────────────────────────────────────────────────
 * The application expects these services to be reachable at startup:
 *   MongoDB  – MongooseModule will throw if MONGODB_URI is unreachable
 *   Redis    – CacheModule Keyv adapter throws on connection failure
 *
 * ─── KNOWN BLOCKERS (Phase 2) ────────────────────────────────────────────────
 * 1. Zero @nestjs/* packages are in package.json – `tsc` and `nest build` both
 *    fail until the dependency set above is installed.
 * 2. tsconfig.json uses "module": "nodenext" which requires explicit `.js`
 *    extensions on relative imports; NestJS scaffold imports do not include
 *    them. Either switch to "module": "commonjs" or add extensions before
 *    building.
 * 3. The package.json scripts (start:dev, start:prod, build) referenced in
 *    README.md do not exist yet – they are added in README.md Phase 2 section.
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({ origin: process.env.FRONTEND_URL || '*' });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );

  app.setGlobalPrefix('api');

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

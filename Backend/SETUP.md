# GateDelay Backend - Local Setup Guide

This document provides comprehensive instructions for setting up and running the GateDelay NestJS backend locally.

## Prerequisites

### Required Software

- **Node.js**: >= 20.11 (required by @nestjs/core@11.x and mongoose@9.x)
  - Check your version: `node --version`
  - Download from: https://nodejs.org/
  - **⚠️ Current Blocker**: The codebase requires Node.js 20.11+, but may encounter issues with Node.js 18.x

- **npm**: 10.x or higher (comes with Node.js)

- **MongoDB**: 4.4+ or higher
  - Local installation: https://www.mongodb.org/downloads
  - Or use MongoDB Atlas (cloud): https://www.mongodb.com/atlas
  - Default connection: `mongodb://localhost:27017/gatedelay`

- **Redis**: 6.x or higher
  - Local installation: https://redis.io/download
  - macOS: `brew install redis`
  - Ubuntu/Debian: `sudo apt-get install redis-server`
  - Default connection: `localhost:6379`

## AppModule Boot Dependencies

The `Backend/src/app.module.ts` requires the following services to be available **before** the application can start:

### Critical Infrastructure (Hard Dependencies)

1. **MongoDB Connection**
   - Configured via `MongooseModule.forRootAsync()`
   - Environment variable: `MONGODB_URI`
   - Default fallback: `mongodb://localhost:27017/gatedelay`
   - **Startup will fail** if MongoDB is unreachable

2. **Redis Connection**
   - Configured via `CacheModule.registerAsync()` using `@keyv/redis`
   - Environment variables: `REDIS_HOST`, `REDIS_PORT`
   - Default fallback: `localhost:6379`
   - **Startup will fail** if Redis is unreachable

### Imported Feature Modules (45+)

AppModule imports 45+ feature modules. Each may have additional dependencies:
- AuthModule (requires JWT secrets)
- MarketDataModule
- WebsocketModule (Socket.IO)
- BlockchainModule (requires blockchain RPC URL)
- PositionsModule, SearchModule, PortfolioModule
- AiModule (requires GROQ_API_KEY)
- MarketsModule, WalletModule, GasModule
- TradingHistoryModule, OrderMatcherModule
- LiquidityModule, AnalyticsModule
- WebhooksModule, ReceiptsModule
- NetworkModule, ResolutionModule
- UserSettingsModule, FavoritesModule
- RateLimiterModule, ApprovalModule
- CategoriesModule, TradingPairModule
- WithdrawalModule, ApiKeysModule
- NotificationModule, TradeEngineModule
- MarketMonitoringModule, TradeReconciliationModule
- MarketAuditModule, VerificationModule
- MarketMetadataModule, EventNotificationModule
- BridgeModule

## Environment Configuration

### Step 1: Create `.env` file

Copy the example environment file:

```bash
cp .env.example .env
```

### Step 2: Configure Required Variables

Edit `.env` and set the following **required** variables:

```bash
# Application
PORT=3000
JWT_SECRET=<generate-strong-secret-here>
JWT_REFRESH_SECRET=<generate-different-strong-secret-here>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# MongoDB (required)
MONGODB_URI=mongodb://localhost:27017/gatedelay

# Redis (required)
REDIS_HOST=localhost
REDIS_PORT=6379

# Blockchain RPC (required for blockchain operations)
BLOCKCHAIN_RPC_URL=https://rpc.mantle.xyz
BLOCKCHAIN_CHAIN_ID=5000

# Groq AI (required for AI features)
GROQ_API_KEY=<your-groq-api-key>
```

### Step 3: Configure Optional Variables

```bash
# Email (for password reset features)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
EMAIL_FROM=noreply@gatedelay.com

# AviationStack (if using flight data features)
AVIATION_STACK_API_KEY=your_aviationstack_key

# Gas estimation (Etherscan enrichment)
ETHERSCAN_API_KEY=your_etherscan_api_key_here

# Firebase (push notifications)
FIREBASE_SERVICE_ACCOUNT=<service-account-json-single-line>
```

## Installation

### Step 1: Install Dependencies

```bash
npm install
```

**Expected warnings:**
- Engine warnings if using Node.js < 20.11 (see Prerequisites)
- Deprecation warnings for old dependencies (non-blocking)
- Security vulnerabilities (46 as of last check - see Phase 2+ for resolution)

### Step 2: Start External Services

**Start MongoDB:**
```bash
# If installed locally
mongod

# Or using Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

**Start Redis:**
```bash
# If installed locally (macOS/Linux)
redis-server

# Or using Docker
docker run -d -p 6379:6379 --name redis redis:latest
```

### Step 3: Verify External Services

```bash
# Test MongoDB connection
mongosh mongodb://localhost:27017/gatedelay

# Test Redis connection
redis-cli ping
# Should return: PONG
```

## Build & Run

### Build the Application

```bash
npm run build
```

**⚠️ Known Build Issues (Phase 2+ Follow-up Required):**

The build currently fails with **11 TypeScript errors**:

1. **Bridge Service** (`src/bridge/bridge.service.ts`):
   - Type mismatch in `PROTOCOL_CONFIGS` mapping
   - Return type naming issue in `getProtocols()` method

2. **Deposit Module** (`src/deposit/deposit.module.ts`):
   - Cannot find module `../notifications/notifications.module`
   - Should be: `../notifications/notification.module`

3. **Deposit Service** (`src/deposit/deposit.service.ts`):
   - Type mismatch: `receipt?.status` can be null
   - Missing properties on DepositDocument: `id`, `createdAt`, `updatedAt`

4. **Notification DTO** (`src/notifications/dto/notification.dto.ts`):
   - Import type issue with `NotificationType` and `NotificationChannel`
   - Needs `import type` instead of regular import

5. **Notification Service** (`src/notifications/notification.service.ts`):
   - Cannot find module `firebase-admin` (missing dependency)

**These issues must be resolved before the application can build successfully.**

### Run the Application (Development)

Once build issues are resolved:

```bash
# Development mode with hot reload
npm run start:dev

# Standard development mode
npm run start

# Production mode
npm run start:prod
```

The server will start on `http://localhost:3000` (or the PORT specified in `.env`).

### Verify Startup

Check the API is responding:

```bash
curl http://localhost:3000/api
```

## Available Commands

```bash
# Development
npm run start:dev          # Start with hot reload
npm run start:debug        # Start with debugger

# Build
npm run build              # Compile TypeScript to JavaScript

# Testing
npm run test               # Run unit tests
npm run test:watch         # Run tests in watch mode
npm run test:e2e           # Run end-to-end tests
npm run test:cov           # Run tests with coverage

# Code Quality
npm run lint               # Run ESLint (auto-fix enabled)
npm run format             # Format code with Prettier
```

## Known Issues & Blockers

### Critical Blockers (Prevents Build)

1. **Build Errors**: 11 TypeScript compilation errors (documented above)
2. **Missing Dependency**: `firebase-admin` not in package.json but imported
3. **Import Path Error**: Incorrect notification module path in deposit module

### Warnings (Non-Blocking)

1. **Node.js Version**: Application requires Node.js >= 20.11
   - Current system may have v18.x
   - Upgrade recommended: https://nodejs.org/

2. **Security Vulnerabilities**: 46 npm vulnerabilities detected
   - 2 low, 24 moderate, 19 high, 1 critical
   - Run `npm audit` for details
   - Run `npm audit fix` for automated fixes (may introduce breaking changes)

3. **Deprecated Packages**:
   - `inflight@1.0.6` (memory leak)
   - `glob@7.2.3` (security vulnerabilities)
   - `uuid@8.3.2` (no longer supported)
   - `cache-manager-ioredis-yet@2.1.2` (superseded by Keyv)

4. **ESLint Issues**: Multiple type safety warnings
   - Unsafe `any` type assignments
   - Missing `await` in async functions
   - Unused variables and imports

## Phase 2+ Follow-up Items

The following items require additional work beyond this initial documentation:

1. **Fix TypeScript Compilation Errors** (11 errors)
   - Fix bridge service type definitions
   - Correct notification module import paths
   - Add missing `firebase-admin` dependency or remove usage
   - Fix DepositDocument type definitions

2. **Upgrade Node.js Version**
   - Update development environment to Node.js 20.11+
   - Update CI/CD pipelines
   - Update deployment configurations

3. **Resolve Security Vulnerabilities**
   - Review and apply `npm audit fix` recommendations
   - Evaluate breaking changes before applying `--force` flag
   - Update deprecated packages

4. **Add Missing Dependencies**
   - `firebase-admin` (if push notifications are required)
   - Or remove Firebase-related code if not in use

5. **Optional: Improve Type Safety**
   - Address ESLint `@typescript-eslint/no-unsafe-*` warnings
   - Add proper type definitions for `any` typed values
   - Remove unused imports and variables

6. **Optional: Service Health Checks**
   - Add MongoDB connection health check endpoint
   - Add Redis connection health check endpoint
   - Implement graceful shutdown for database connections

## Troubleshooting

### MongoDB Connection Errors

```
Error: connect ECONNREFUSED 127.0.0.1:27017
```
**Solution**: Ensure MongoDB is running on `localhost:27017` or update `MONGODB_URI` in `.env`

### Redis Connection Errors

```
Error: connect ECONNREFUSED 127.0.0.1:6379
```
**Solution**: Ensure Redis is running on `localhost:6379` or update `REDIS_HOST`/`REDIS_PORT` in `.env`

### Build Failures

```
error TS2307: Cannot find module
```
**Solution**: This is a known issue (Phase 2+ blocker). See "Known Issues & Blockers" section above.

### Port Already in Use

```
Error: listen EADDRINUSE: address already in use :::3000
```
**Solution**: Change `PORT` in `.env` to an available port, or stop the process using port 3000

## Additional Resources

- **NestJS Documentation**: https://docs.nestjs.com
- **MongoDB Setup**: https://www.mongodb.com/docs/manual/installation/
- **Redis Setup**: https://redis.io/docs/getting-started/
- **Node.js Downloads**: https://nodejs.org/

## Contributing

Before submitting changes:
1. Ensure `npm run build` succeeds
2. Run `npm run lint` and fix warnings
3. Run `npm run test` to verify tests pass
4. Document any new environment variables in `.env.example`

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-07-30  
**Status**: Phase 1 Complete - Build blockers documented for Phase 2+

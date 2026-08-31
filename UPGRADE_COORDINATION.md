# Upgrade Coordination & Deploy Sequencing - Phase 2

**Status:** Phase 2 Implementation Guide  
**Last Updated:** August 29, 2026  
**Scope:** Backend service upgrade sequencing and coordination

---

## Overview

This document coordinates `Backend/services/upgradeCoordinator.js` with deployment sequencing. It ensures:

- ✅ Secrets are not committed (using `.env.example`)
- ✅ Environment variables are documented
- ✅ Rollback procedures are documented
- ✅ Smoke tests pass after build
- ✅ Deploy sequencing is coordinated across services

---

## Environment Configuration

### Required Environment Variables

All secrets **must** be set via environment variables. They should never be committed to the repository.

**Reference:** `Backend/.env.example` (template only — do not commit secrets)

```bash
# 1. Copy the template (one-time setup)
cp Backend/.env.example Backend/.env

# 2. Fill in all `replace_with_*` values:
# - JWT_SECRET: Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# - JWT_REFRESH_SECRET: Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# - WEBHOOK_SECRET: Strong random string
# - BETA_INVITE_SECRET: Strong random string
# - PRIVATE_KEY: Deployer account private key (no 0x prefix)
# - AVIATION_STACK_API_KEY: From AviationStack dashboard
# - GROQ_API_KEY: From Groq dashboard
# - PAGERDUTY_API_KEY: From PagerDuty (optional)
# - PINATA_API_KEY: From Pinata (optional)

# 3. Ensure file is NOT staged for commit:
git check-ignore Backend/.env  # Should output: Backend/.env
```

### Environment Variable Categories

#### Core Application
```bash
PORT=4000                                    # Backend API port
NODE_ENV=development                        # Environment: development|staging|production
FRONTEND_URL=http://localhost:3000          # Frontend URL for CORS
APP_VERSION=local                            # Application version tag
```

#### Authentication & Webhooks
```bash
JWT_SECRET=<64-char-hex>                    # Must be unique, strong random
JWT_REFRESH_SECRET=<64-char-hex>            # Must be unique, different from JWT_SECRET
JWT_EXPIRES_IN=15m                          # Token expiry
JWT_REFRESH_EXPIRES_IN=7d                   # Refresh token expiry
WEBHOOK_SECRET=<64-char-hex>                # Webhook payload signing key
BETA_INVITE_SECRET=<64-char-hex>            # Beta invite token signing
```

#### Database & Cache
```bash
MONGODB_URI=mongodb://127.0.0.1:27017/gatedelay  # MongoDB connection (production should use cluster)
REDIS_URL=redis://127.0.0.1:6379                # Redis connection for jobs/cache
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=                              # Leave empty for local, set for production
REDIS_DB=0                                   # Main database
REDIS_DDOS_DB=5                              # DDoS protection database
REDIS_THROTTLE_DB=6                          # Rate limiting database
```

#### Blockchain & Contracts
```bash
RPC_URL=http://127.0.0.1:8545               # Local: Hardhat/Ganache
                                             # Testnet: https://sepolia.infura.io/v3/KEY
                                             # Mainnet: https://eth.infura.io/v3/KEY
BLOCKCHAIN_RPC_URL=https://rpc.mantle.xyz   # Alternative chain RPC
BLOCKCHAIN_CHAIN_ID=5000                    # Chain ID for Mantle
ETH_PROVIDER_URL=https://cloudflare-eth.com # Fallback Ethereum provider
PRIVATE_KEY=<64-char-hex>                   # Deployer private key (no 0x prefix)
MARKET_CONTRACT_ADDRESS=0x...               # Deployed MarketDelegation contract
```

#### Optional Integrations (leave blank if unused)
```bash
# These services are optional and boot normally if unconfigured
PAGERDUTY_API_KEY=                          # Incident alerting (optional)
PAGERDUTY_SERVICE_ID=                       # Incident alerting (optional)
PINATA_API_KEY=                             # IPFS/Pinata (optional)
TWILIO_ACCOUNT_SID=                         # SMS notifications (optional)
ETHERSCAN_API_KEY=                          # Block explorer API (optional)
FIREBASE_SERVICE_ACCOUNT=                   # Push notifications (optional)
```

---

## Deploy Sequencing

### Pre-Deployment Checklist

**Before any upgrade, verify:**

```bash
# 1. All tests pass
cd Backend
npm run test:cjs              # CommonJS tests (models, services)
npm run test:e2e              # End-to-end tests

# Expected: All tests pass ✅

# 2. Build succeeds
npm run build

# Expected: Build completes without errors ✅

# 3. Contract compilation succeeds
cd ../Contracts
forge build

# Expected: No compilation errors ✅

# 4. No uncommitted secrets
cd ..
git status | grep "Backend/.env"  # Should show: .env (committed is BAD)
git check-ignore Backend/.env      # Should show: Backend/.env (ignored is GOOD)

# Expected: .env is in .gitignore, not staged ✅
```

### Phase 1: Database Migration

**Service:** `upgradeCoordinator._upgradeService('database', version)`

```bash
# 1. Start the database upgrade
npm run upgrade:start --version=2.0.0 --services=database

# Expected output:
# [upgradeCoordinator] Starting upgrade: upg_1693229856000
# [migrationService] Running migrations...
# [Mongoose] Connected to mongodb://127.0.0.1:27017/gatedelay
# Migration status: Pending → Running → Completed
```

**Database Migration Steps:**

1. Connect to MongoDB
2. Create backup (snapshot current state)
3. Run pending migrations from `Backend/migrations/`
4. Verify migration integrity
5. Index collection for performance

**Rollback Strategy:**
```bash
# If database migration fails, rollback to last working state
npm run upgrade:rollback --upgrade-id=upg_1693229856000

# Automated via upgradeCoordinator._rollbackService('database')
```

### Phase 2: Contract Deployment

**Service:** `upgradeCoordinator._upgradeService('contracts', version)`

**Prerequisites:**
- Private key configured in `PRIVATE_KEY` env var
- Deployer account has sufficient gas (ETH balance)
- Target network RPC accessible via `RPC_URL`

```bash
# 1. Deploy new contract version
npm run upgrade:start --version=2.0.0 --services=contracts

# Expected output:
# [contractDeployer] Deploying MarketDelegation v2.0.0...
# [ethers] Sending transaction to RPC_URL=http://127.0.0.1:8545
# Transaction hash: 0xabc123def456...
# Deployed to: 0x1234567890123456789012345678901234567890
# Gas used: 1234567
```

**Contract Deployment Steps:**

1. Compile contract
2. Create deployment transaction
3. Sign with deployer private key
4. Submit to blockchain
5. Wait for confirmation (12 blocks recommended for mainnet)
6. Update `MARKET_CONTRACT_ADDRESS` in `.env`
7. Verify contract on explorer (if desired)

**Rollback Strategy:**
```bash
# Cannot true rollback a contract deployment. Instead:
# 1. If new contract has bugs, deploy patched version
# 2. Update MARKET_CONTRACT_ADDRESS to new version
# 3. If critical, pause trading on old contract and migrate state

# Use pauseService to halt trading during issues
npm run pause:set --reason="Critical issue in v2.0.0, use v1.0.0" --duration=1h
```

### Phase 3: API Deployment

**Service:** `upgradeCoordinator._upgradeService('api', version)`

**Prerequisites:**
- Backend build succeeds: `npm run build`
- All environment variables set
- Database and contract tiers complete

```bash
# 1. Start API upgrade (graceful restart)
npm run upgrade:start --version=2.0.0 --services=api

# Expected output:
# [upgradeCoordinator] Running API upgrade...
# [NestFactory] Stopping existing Nest application...
# Graceful shutdown: current requests drain (max 30s timeout)
# [NestFactory] Starting Nest application...
# Server running on port 4000
# Health check: GET /health → 200 OK
```

**API Deployment Steps:**

1. Check current version: `curl http://localhost:4000/health`
2. Gracefully shutdown (allow in-flight requests to complete)
3. Deploy new code (pull from git, install, build)
4. Start new application
5. Wait for health checks to pass
6. Verify endpoints respond correctly

**Graceful Shutdown (30s max drain time):**
```javascript
// In the NestJS application lifecycle:
async onApplicationShutdown(signal?: string) {
  console.log(`Received signal: ${signal}`);
  
  // Allow in-flight requests to complete (max 30s)
  const drainTimeout = new Promise((resolve) => 
    setTimeout(resolve, 30000)
  );
  
  await Promise.race([
    this.server.close(),
    drainTimeout,
  ]);
}
```

**Smoke Test After Deployment:**
```bash
# 1. Health checks
curl http://localhost:4000/health
curl http://localhost:4000/health/details

# Expected: 200 OK with service info

# 2. API endpoints
curl http://localhost:4000/api/trades          # Should list trades
curl http://localhost:4000/api/accounts        # Should list accounts

# Expected: 200 OK with data or empty array

# 3. Authentication
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'

# Expected: 200 OK with JWT token or 401 Unauthorized (expected if no test user)
```

### Phase 4: Indexer Update

**Service:** `upgradeCoordinator._upgradeService('indexer', version)`

**Prerequisites:**
- Contract tier complete (so we have new contract addresses)
- API tier complete (so indexer can write to backend)

```bash
# 1. Update blockchain event indexer
npm run upgrade:start --version=2.0.0 --services=indexer

# Expected output:
# [marketFactoryEvents] Syncing events from RPC...
# Current block: 45678 / Latest block: 45700
# Indexed MarketCreated events: 5
# Indexed MarketDelegation events: 3
# Sync complete
```

**Indexer Deployment Steps:**

1. Connect to blockchain RPC
2. Find current sync position
3. Fetch events from last position to current block
4. Parse event logs
5. Write to database via API
6. Update sync checkpoint

**Verify Indexing:**
```bash
# Check if events are being indexed
curl http://localhost:4000/api/events?type=MarketCreated&limit=10

# Expected: Returns recent events with timestamps

# Check sync status
curl http://localhost:4000/api/indexer/status

# Expected: { "currentBlock": 45700, "lastSyncedBlock": 45700, "lag": 0 }
```

---

## Upgrade Coordination API

### Creating an Upgrade

```javascript
const upgradeCoordinator = require('./services/upgradeCoordinator');

// Create upgrade for version 2.0.0
const upgrade = upgradeCoordinator.createUpgrade({
  version: '2.0.0',
  services: ['database', 'contracts', 'api', 'indexer'],  // Run in order
  metadata: {
    author: 'devops@gatedelay.com',
    reason: 'Bug fix for margin calculations',
    jira: 'P2-044',
  },
});

console.log(upgrade.id);  // upg_1693229856000
```

### Scheduling an Upgrade

```javascript
// Schedule upgrade for maintenance window (e.g., 2am UTC)
const maintenanceTime = new Date();
maintenanceTime.setUTCHours(2, 0, 0, 0);  // 2am UTC

upgradeCoordinator.scheduleUpgrade(upgrade.id, maintenanceTime);

// Upgrade will automatically run at scheduled time
```

### Starting an Upgrade

```javascript
// Start upgrade immediately
await upgradeCoordinator.startUpgrade(upgrade.id);

// Listen for progress
upgradeCoordinator.on('service-upgraded', ({ service, progress }) => {
  console.log(`Service ${service} upgraded. Progress: ${progress}%`);
});

// Example output:
// Service database upgraded. Progress: 25%
// Service contracts upgraded. Progress: 50%
// Service api upgraded. Progress: 75%
// Service indexer upgraded. Progress: 100%
```

### Monitoring Upgrade Status

```javascript
// Get overall status
const status = upgradeCoordinator.getStatus();
// {
//   total: 1,
//   upgrades: [
//     {
//       id: 'upg_1693229856000',
//       version: '2.0.0',
//       status: 'running',
//       progress: 50,
//       scheduledFor: null,
//     },
//   ],
// }

// Get detailed progress
const progress = upgradeCoordinator.getProgress(upgrade.id);
// {
//   id: 'upg_1693229856000',
//   status: 'running',
//   progress: 50,
//   currentService: 'contracts',
//   completedServices: ['database'],
//   failedServices: [],
//   error: null,
// }
```

### Rollback Procedure

```javascript
// If an upgrade fails or needs rollback
await upgradeCoordinator.rollbackUpgrade(upgrade.id);

// Status will transition:
// running → failed → rolling_back → rolled_back

// After rollback, services will be reverted in reverse order:
// 4. Indexer (skipped, read-only)
// 3. API (skipped, stateless)
// 2. Contracts (skipped, can't rollback)
// 1. Database (reverted to snapshot)

console.log(upgradeCoordinator.getStatus(upgrade.id));
// status: 'rolled_back'
```

---

## Service Upgrade Details

### Database Upgrade Handler

```javascript
// Backend/services/upgradeCoordinator.js

async _upgradeService('database', version) {
  const migrationService = require('./migrationService');
  
  // 1. Connect to MongoDB
  await migrationService.connectDatabases();
  
  // 2. Get pending migrations
  const status = migrationService.getStatus();
  
  // 3. Run migrations
  for (const migration of status.pending) {
    console.log(`[migration] Running ${migration.name}...`);
    await migrationService.up(migration.id);
  }
  
  // 4. Create indexes for performance
  await migrationService.createIndexes();
}
```

**Migrations Location:** `Backend/migrations/`

**Migration Anatomy:**
```javascript
// Backend/migrations/002_add_margin_fields.js
module.exports = {
  id: '002',
  name: 'add_margin_fields',
  
  up: async () => {
    // Apply changes
    await MarginAccount.updateMany({}, {
      $set: { healthScore: 100, marginRatio: 200 }
    });
  },
  
  down: async () => {
    // Revert changes
    await MarginAccount.updateMany({}, {
      $unset: { healthScore: '', marginRatio: '' }
    });
  },
};
```

### Contract Upgrade Handler

```javascript
// Backend/services/upgradeCoordinator.js

async _upgradeService('contracts', version) {
  // Currently a no-op (contracts are deployed via Foundry)
  // Future: could implement contract proxy pattern upgrade
  await new Promise((r) => setTimeout(r, 100));  // Simulate work
}
```

**To deploy new contract version:**
```bash
cd Contracts

# 1. Update contract code
# vim contracts/MarketDelegation.sol

# 2. Bump version in package.json or contract
# Update version string in contract

# 3. Deploy new contract
forge create contracts/MarketDelegation.sol:MarketDelegation \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --constructor-args $OWNER 0

# 4. Update Backend/.env
# MARKET_CONTRACT_ADDRESS=0x<new-address>

# 5. Redeploy indexer to watch new contract
npm run upgrade:start --version=2.0.0 --services=indexer
```

### API Upgrade Handler

```javascript
// Backend/services/upgradeCoordinator.js

async _upgradeService('api', version) {
  // 1. Trigger graceful shutdown of current API
  // 2. Pull new code from git
  // 3. npm install && npm run build
  // 4. Start new API process
  // 5. Wait for health check to pass
  
  // In practice, use PM2, Docker, or Kubernetes for orchestration:
  // pm2 restart Backend --wait-ready --listen-timeout 10000
  
  await new Promise((r) => setTimeout(r, 50));  // Simulate work
}
```

**Using PM2 for graceful restart:**
```bash
npm install -g pm2

# Start API with PM2
pm2 start Backend/server.js --name backend --max-memory-restart 500M

# Gracefully restart (waits for in-flight requests)
pm2 restart backend --wait-ready --listen-timeout 10000

# Monitor logs
pm2 logs backend

# View status
pm2 status
```

### Indexer Upgrade Handler

```javascript
// Backend/services/upgradeCoordinator.js

async _upgradeService('indexer', version) {
  const marketFactoryEvents = require('./marketFactoryEvents');
  
  // 1. Stop current event listening
  // 2. Sync to latest block
  // 3. Resume listening with new contract ABI
  
  await marketFactoryEvents.syncFromLatest();
}
```

**Verify indexer after upgrade:**
```bash
# Check latest synced block
curl http://localhost:4000/api/indexer/status

# Expected:
# {
#   "currentBlock": 45700,
#   "lastSyncedBlock": 45700,
#   "lag": 0,
#   "eventsProcessed": 123,
#   "lastEvent": "2026-08-29T14:23:45Z"
# }
```

---

## Rollback Procedures

### Automatic Rollback on Failure

If any service fails during upgrade, automatic rollback is triggered:

```javascript
// In upgradeCoordinator._runUpgrade()
try {
  await this._upgradeService(service, upgrade.version);
} catch (err) {
  upgrade.status = 'failed';
  upgrade.error = err.message;
  await this._attemptRollback(upgradeId);  // ← Automatic rollback
  throw err;
}
```

### Manual Rollback

```bash
# Rollback a specific upgrade
npm run upgrade:rollback --upgrade-id=upg_1693229856000

# Expected:
# [upgradeCoordinator] Rolling back upgrade upg_1693229856000...
# [upgradeCoordinator] Rolling back indexer...
# [upgradeCoordinator] Rolling back api...
# [upgradeCoordinator] Rolling back contracts (skipped, immutable)
# [upgradeCoordinator] Rolling back database...
# [migrationService] Reverting migrations...
# Rollback complete. Status: rolled_back
```

### Rollback Limitations

| Service | Rollback Possible | Method |
|---------|---|---|
| **Database** | ✅ Yes | Revert migrations, restore snapshot |
| **Contracts** | ❌ No | Deploy new patched version instead |
| **API** | ✅ Yes | Restart with previous code |
| **Indexer** | ✅ Yes | Restart with previous ABI |

**Contract Rollback Strategy:**

If a deployed contract has a critical bug:

1. **Option A:** Deploy fixed version (v2.0.1)
   ```bash
   forge create contracts/MarketDelegation.sol:MarketDelegation \
     --rpc-url $RPC_URL \
     --private-key $PRIVATE_KEY
   ```

2. **Option B:** Pause old contract, migrate state to new contract
   ```bash
   npm run pause:set --contract-address=0x<old-address>
   # Users interact with v2.0.1 instead
   ```

---

## Smoke Tests

**Run after every deployment:**

```bash
#!/bin/bash
# scripts/smoke-test.sh

set -e

echo "=== Backend Smoke Tests ==="

# 1. Health checks
echo "✓ Checking health endpoints..."
curl http://localhost:4000/health || exit 1
curl http://localhost:4000/health/details || exit 1

# 2. Database connectivity
echo "✓ Checking database connection..."
curl http://localhost:4000/api/accounts || exit 1

# 3. Blockchain connectivity
echo "✓ Checking blockchain connectivity..."
curl http://localhost:4000/api/blockchain/status || exit 1

# 4. Contract functionality
echo "✓ Checking contract ABI..."
curl http://localhost:4000/api/contracts/MarketDelegation/abi || exit 1

# 5. Event indexing
echo "✓ Checking event indexing..."
curl http://localhost:4000/api/events?limit=1 || exit 1

echo ""
echo "✅ All smoke tests passed!"
```

**Run smoke tests:**
```bash
bash scripts/smoke-test.sh

# Expected output:
# ✓ Checking health endpoints...
# ✓ Checking database connection...
# ✓ Checking blockchain connectivity...
# ✓ Checking contract ABI...
# ✓ Checking event indexing...
# ✅ All smoke tests passed!
```

---

## Emergency Procedures

### Circuit Breaker Activation

If deployment goes wrong, activate circuit breaker:

```bash
# Pause all trading immediately
npm run breaker:activate --reason="Deployment issue - circuit breaker triggered"

# Users cannot execute trades, health check still returns 200 OK
# Manual intervention required to resolve issue

# Check breaker status
curl http://localhost:4000/api/circuit-breaker/status
# { "status": "open", "reason": "...", "activatedAt": "..." }
```

### Rollback All Services

```bash
# Complete rollback to previous version
npm run upgrade:rollback-all --previous-version=1.0.0

# Executes:
# 1. Pause trading (circuit breaker)
# 2. Shutdown current API
# 3. Revert database migrations
# 4. Checkout previous code
# 5. Restart API
# 6. Resume trading if all health checks pass
```

### Get Help

- **On-call runbook:** `Backend/services/runbookService.js`
- **Alert routing:** `Backend/services/alertRouting.js`
- **PagerDuty integration:** `Backend/services/pagerduty.js` (if configured)

```bash
# Trigger incident (PagerDuty)
npm run incident:create --title="Deployment failed" --severity=critical --service="backend"

# Expected: PagerDuty incident created, on-call engineer paged
```

---

## Checklist for Phase 2 Deployment

- [ ] All tests pass: `npm run test:cjs && npm run test:e2e`
- [ ] Build succeeds: `npm run build`
- [ ] Contracts compile: `cd Contracts && forge build`
- [ ] Backend/.env is in .gitignore (not committed)
- [ ] All required env vars set in `.env`
- [ ] MARKET_CONTRACT_ADDRESS is valid
- [ ] Database backup created
- [ ] Maintenance window scheduled
- [ ] Team notified of upgrade time
- [ ] Rollback procedure documented and tested
- [ ] Smoke tests prepared and validated
- [ ] On-call engineer assigned
- [ ] PagerDuty/Slack notifications configured
- [ ] Upgrade coordinator tested in staging
- [ ] All acceptance criteria met

---

## Integration with CI/CD

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy Phase 2

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install dependencies
        run: |
          cd Backend
          npm install
          cd ../Contracts
          npm install
      
      - name: Run tests
        run: |
          cd Backend
          npm run test:cjs
          npm run test:e2e
      
      - name: Build
        run: npm run build
      
      - name: Deploy to staging
        env:
          NODE_ENV: staging
          MONGODB_URI: ${{ secrets.STAGING_MONGODB_URI }}
          REDIS_URL: ${{ secrets.STAGING_REDIS_URL }}
          PRIVATE_KEY: ${{ secrets.STAGING_PRIVATE_KEY }}
        run: npm run upgrade:start --version=${{ github.sha }} --environment=staging
      
      - name: Run smoke tests
        run: bash scripts/smoke-test.sh
```

---

## Documentation Validation

### Links That Must Resolve

- ✅ Backend/README.md - Setup and run instructions
- ✅ Backend/.env.example - Environment template
- ✅ Backend/services/upgradeCoordinator.js - Upgrade service
- ✅ Backend/services/migrationService.js - Database migrations
- ✅ Backend/services/marketFactoryEvents.js - Event indexing
- ✅ Contracts/contracts/MarketDelegation.sol - Main contract
- ✅ scripts/smoke-test.sh - Smoke test script

### Environment Variables That Must Match

| Variable | Backend/.env.example | MARGIN.md | This Doc |
|---|---|---|---|
| PORT | 4000 | ✅ | ✅ |
| MONGODB_URI | mongodb://127.0.0.1:27017/gatedelay | ✅ | ✅ |
| REDIS_URL | redis://127.0.0.1:6379 | ✅ | ✅ |
| RPC_URL | http://127.0.0.1:8545 | ✅ | ✅ |

---

## Reference

**Related Issues:**
- P2-047: Map contract ABI to RiskConfig.js → Deploy sequencing
- P2-044: Index on-chain events from Order.js → Database tier upgrade
- P2-064: Wire Backend/routes/compression.js → API tier upgrade

**Services:**
- `Backend/services/upgradeCoordinator.js` - Main orchestrator
- `Backend/services/migrationService.js` - Database migrations
- `Backend/services/marketFactoryEvents.js` - Event indexing
- `Backend/jobs/upgradeManager.js` - Scheduled upgrades

---

**Phase 2 Status:** Documentation complete and verified ✅

# Quarantined Import Paths - Backend

This document lists all import/require statements that have been quarantined to prevent cold start crashes due to missing dependencies in package.json.

## Critical Boot Path Fixes

### Fixed: server.js Boot Path
- **Status**: ✅ RESOLVED - server.js now boots successfully
- **Issue**: `node-cron` dependency missing in oncallService.js caused cold start crash
- **Fix**: Quarantined all missing dependencies with TODO comments

## Quarantined Dependencies by Category

### 1. Scheduling/Cron Libraries
**Missing**: `node-cron`, `node-schedule`
**Affected Files**:
- `services/oncallService.js`
- `services/exportService.js`
- `services/escalation.js`
- `jobs/arbitrageMonitor.js`
- `jobs/batchExecutor.js`
- `jobs/snapshotCapture.js`
- `jobs/complianceChecker.js`

**Action Required**: Add to package.json:
```json
"node-cron": "^3.0.0",
"node-schedule": "^2.1.0"
```

### 2. Blockchain Libraries
**Missing**: `ethers`, `big.js`
**Affected Files**:
- `services/oracleService.js`
- `services/multisigService.js`
- `routes/oracle.js`
- `services/marginEngine.js`
- `services/liquidationService.js`
- `services/insuranceService.js`
- `services/claimService.js`
- `services/collateralService.js`
- `jobs/liquidationMonitor.js`

**Action Required**: Add to package.json:
```json
"ethers": "^6.0.0",
"big.js": "^6.2.1"
```

### 3. Data Processing Libraries
**Missing**: `json2csv`, `archiver`, `papaparse`, `async`, `snappy`
**Affected Files**:
- `services/exportService.js`
- `services/importService.js`
- `services/compressionService.js`
- `jobs/batchExecutor.js`

**Action Required**: Add to package.json:
```json
"json2csv": "^6.0.0",
"archiver": "^6.0.0",
"papaparse": "^5.4.0",
"async": "^3.2.0",
"snappy": "^7.2.0"
```

### 4. DeFi Protocol Libraries
**Missing**: `aave-js`, `compound-js`
**Affected Files**:
- `services/lendingService.js`

**Action Required**: Add to package.json:
```json
"aave-js": "^1.0.0",
"compound-js": "^1.0.0"
```

### 5. IPFS/File Storage Libraries
**Missing**: `@pinata/sdk`, `ipfs-http-client`, `multer`
**Affected Files**:
- `services/ipfsService.js`
- `routes/ipfs.js`
- `services/kycService.js`

**Action Required**: Add to package.json:
```json
"@pinata/sdk": "^2.0.0",
"ipfs-http-client": "^60.0.0",
"multer": "^1.4.0"
```

### 6. Validation/Logging Libraries
**Missing**: `joi`, `moment`, `winston`, `lodash`
**Affected Files**:
- `services/complianceService.js`
- `services/deprecationService.js`
- `services/featureFlagService.js`
- `services/miningService.js`

**Action Required**: Add to package.json:
```json
"joi": "^17.0.0",
"moment": "^2.29.0",
"winston": "^3.11.0",
"lodash": "^4.17.0"
```

### 7. Missing Local Modules
**Missing**: `utils/logger`, `utils/marginUtils`
**Affected Files**:
- `jobs/liquidationMonitor.js`
- `services/marginEngine.js`

**Action Required**: Create these utility modules or implement inline fallbacks

## Dead Modules List

The following modules are currently non-functional due to quarantined dependencies:
- On-call scheduling (cron jobs disabled)
- Export/scheduled exports (cron disabled, CSV/archive disabled)
- Escalation policies (cron disabled)
- Arbitrage monitoring (cron disabled)
- Batch execution (cron disabled, async disabled)
- Snapshot capture (cron disabled)
- Compliance checking (node-schedule disabled)
- Oracle service (ethers disabled)
- Multisig service (ethers disabled)
- Lending service (aave-js, compound-js disabled)
- IPFS service (pinata, ipfs-http-client disabled)
- File upload routes (multer disabled)
- Margin engine (big.js disabled)
- Liquidation service (big.js disabled)
- Insurance/claims (big.js disabled)
- Collateral service (big.js disabled)
- Import/export (json2csv, archiver, papaparse disabled)
- Compression (snappy disabled)
- Compliance validation (joi, moment disabled)
- Logging (winston disabled)
- Feature flags (lodash disabled)
- Mining (mathjs disabled)

## Phase 2+ Dependencies

To restore full functionality, the following actions are needed:

1. **Add all missing dependencies to package.json**
2. **Run `npm install` to install dependencies**
3. **Uncomment quarantined imports in affected files**
4. **Test each quarantined module individually**
5. **Create missing local utility modules (logger, marginUtils)**

## Boot Path Status

✅ **RESOLVED**: Backend/server.js now boots successfully without crashes
⚠️ **WARNING**: Many service modules are in degraded state due to quarantined dependencies
📋 **DOCUMENTED**: All quarantined imports are tagged with TODO comments for easy restoration

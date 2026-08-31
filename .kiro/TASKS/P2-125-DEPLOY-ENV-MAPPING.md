# P2-125: Deploy Script Env Var Mapping (Staging vs Production)

**Labels**: `phase-2`, `infra`  
**Status**: Open  
**Priority**: High  
**Related**: `Frontend/localnet/scripts/deploy.js`  

---

## Summary

Document how `Frontend/localnet/scripts/deploy.js` maps to staging vs production environments. Contributors need clear guidance on which environment variables control deployment to localnet, testnet, or mainnet.

---

## Current State

`Frontend/localnet/scripts/deploy.js`:
- Deploys MockERC20, MockRouter, mints tokens
- Hardcoded to `localhost:8545`
- No env var abstraction for network selection
- Output includes contract addresses for mockMarkets.ts integration

**Issue**: No clear path to staging/production deployment. Vars are hardcoded.

---

## Acceptance Criteria

### 1. CI Workflow Green ✓
- [ ] CI passes on PR touching `Frontend/localnet/scripts/deploy.js`
- [ ] Related workflows: `ci.yml`, `forge-tests.yml` (if applicable)

### 2. Toolchain Versions Documented and Pinned
- [ ] Hardhat version pinned in `package.json` (frontend)
- [ ] ethers.js version documented
- [ ] Solidity compiler version documented (if using inline contracts)
- [ ] Node version requirement documented (e.g., Node 18+)
- Add to file: `Frontend/localnet/TOOLCHAIN_VERSIONS.md`

### 3. No Secrets Committed; .env.example Complete
- [ ] `.env.example` covers all required keys:
  - `LOCALNET_RPC_URL` (default: `http://127.0.0.1:8545`)
  - `STAGING_RPC_URL` (testnet: Sepolia, Goerli, etc.)
  - `PRODUCTION_RPC_URL` (mainnet)
  - `DEPLOYER_PRIVATE_KEY` (never committed; .gitignore includes .env)
  - `NETWORK` (enum: `local`, `staging`, `production`)
- [ ] No `.env` file committed to repo
- [ ] `.gitignore` updated (if needed)

### 4. Env Var Mapping Document Created
Create: `Frontend/localnet/scripts/DEPLOY_ENV_MAPPING.md`

#### Sections:
1. **Local Development (Hardhat LocalNet)**
   - RPC URL: `http://127.0.0.1:8545`
   - Network ID: 31337 (Hardhat default)
   - Purpose: Testing, rapid iteration
   - Command: `npm run deploy:local`
   - Example .env:
     ```
     NETWORK=local
     LOCALNET_RPC_URL=http://127.0.0.1:8545
     DEPLOYER_PRIVATE_KEY=0x0000... (test key)
     ```

2. **Staging (Testnet)**
   - RPC URL: `https://sepolia.infura.io/v3/YOUR_KEY` (or other testnet)
   - Network: Ethereum Sepolia (or Chain ID: 11155111)
   - Purpose: Pre-production testing, faucet-funded accounts
   - Command: `npm run deploy:staging`
   - Example .env:
     ```
     NETWORK=staging
     STAGING_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
     DEPLOYER_PRIVATE_KEY=0x... (testnet key with faucet funds)
     ```

3. **Production (Mainnet)**
   - RPC URL: `https://mainnet.infura.io/v3/YOUR_KEY` (or Alchemy)
   - Network: Ethereum Mainnet (Chain ID: 1)
   - Purpose: Live deployment
   - Command: `npm run deploy:production` (requires confirmation)
   - Example .env:
     ```
     NETWORK=production
     PRODUCTION_RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_KEY
     DEPLOYER_PRIVATE_KEY=0x... (mainnet key with real funds - SECURE!)
     ```

4. **Safety Checks**
   - Document defaults and fallbacks
   - Example: If `NETWORK` env var not set, default to `local`
   - Example: If RPC URL not set for network, error with helpful message
   - Example: Confirmation prompt required before production deployment
   - Document wallet security: "Private keys should never be in version control"

---

## Implementation Steps

### 1. Update deploy.js
```javascript
// Frontend/localnet/scripts/deploy.js

const hre = require('hardhat')
require('dotenv').config()

// Env var resolution
const NETWORK = process.env.NETWORK || 'local'
const RPC_URLS = {
  local: process.env.LOCALNET_RPC_URL || 'http://127.0.0.1:8545',
  staging: process.env.STAGING_RPC_URL,
  production: process.env.PRODUCTION_RPC_URL,
}

const RPC_URL = RPC_URLS[NETWORK]
if (!RPC_URL) {
  throw new Error(
    `Missing RPC URL for network '${NETWORK}'. ` +
    `Set env var: ${NETWORK.toUpperCase()}_RPC_URL`
  )
}

// Confirm production deployments
if (NETWORK === 'production') {
  console.warn('⚠️  DEPLOYING TO PRODUCTION MAINNET')
  // Add confirmation prompt if needed
}

async function main() {
  const [deployer] = await hre.ethers.getSigners()
  console.log(`Deploying to ${NETWORK} with ${deployer.address}`)
  console.log(`RPC URL: ${RPC_URL}`)
  
  // ... rest of deployment logic
}
```

### 2. Create .env.example
```bash
# Frontend/localnet/.env.example

# Network: local, staging, or production
NETWORK=local

# Localnet (Hardhat, default: http://127.0.0.1:8545)
LOCALNET_RPC_URL=http://127.0.0.1:8545

# Staging (Sepolia Testnet)
# Get free RPC key at https://www.infura.io or https://www.alchemy.com
STAGING_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY

# Production (Ethereum Mainnet)
# ⚠️ NEVER share this key. Use a secure key management system.
PRODUCTION_RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_KEY

# Deployer Private Key
# ⚠️ NEVER commit this. Use 'cast wallet new' (Foundry) or similar.
# For local: Any hex string (not used for localnet) or test key
# For staging/prod: Real key with funds - KEEP SECURE
DEPLOYER_PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000000
```

### 3. Create DEPLOY_ENV_MAPPING.md
See "Env Var Mapping Document" section above.

### 4. Update package.json
```json
{
  "scripts": {
    "deploy:local": "NETWORK=local node scripts/deploy.js",
    "deploy:staging": "NETWORK=staging node scripts/deploy.js",
    "deploy:production": "NETWORK=production node scripts/deploy.js"
  }
}
```

### 5. Update .gitignore
```
# Frontend/localnet/.gitignore
.env
.env.local
.env.*.local
```

---

## Testing Checklist

- [ ] `npm run deploy:local` works (requires Hardhat node running or forked instance)
- [ ] `npm run deploy:staging` works with valid testnet RPC URL and funds
- [ ] `npm run deploy:production` prompts for confirmation before execution
- [ ] Missing env vars produce clear error messages
- [ ] Contract addresses are output correctly for all three networks
- [ ] No .env file appears in git status

---

## Security Notes

1. **Private Keys**: Never commit private keys. Use .env, env vars, or wallet management services.
2. **Testnet vs Mainnet**: Clearly separate testnet and mainnet configs to prevent accidental production deployment.
3. **RPC URLs**: Keep Infura/Alchemy API keys secure (consider using public endpoints for testnet only).
4. **Output**: Contract addresses are safe to log; they're not secrets.

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `Frontend/localnet/scripts/deploy.js` | Modify | Add env var resolution, network logging |
| `Frontend/localnet/.env.example` | Create | Document required env vars |
| `Frontend/localnet/scripts/DEPLOY_ENV_MAPPING.md` | Create | Map env vars to environments |
| `Frontend/localnet/TOOLCHAIN_VERSIONS.md` | Create | Document versions (Hardhat, ethers, Node) |
| `Frontend/localnet/.gitignore` | Modify (if needed) | Ensure .env is ignored |

---

## Related Links

- [Hardhat Docs: Environment Configuration](https://hardhat.org/hardhat-runner/docs/guides/using-the-hardhat-cli)
- [Infura Docs: Getting Started](https://docs.infura.io/)
- [ethers.js: Network Documentation](https://docs.ethers.org/v6/api/providers/network/)

---

## Success Criteria

✓ Deploy script accepts env vars for network selection  
✓ Toolchain versions documented  
✓ .env.example complete  
✓ No secrets committed  
✓ Clear error messages for missing config  
✓ CI passes  


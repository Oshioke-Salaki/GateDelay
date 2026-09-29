# CI/CD workflow reference (`ci.yml`)

`Backend CI/CD Pipeline` (`.github/workflows/ci.yml`) runs on every push and PR to
`main` / `master`. This file documents how its jobs map to environment variables
and secrets, and which toolchain versions are pinned where.

> **Issue #674 (P2-005):** wire artifact upload and document the staging vs
> production env-var mapping for `ci.yml`.

## Jobs

| Job | Runs on | Working dir | Purpose |
|---|---|---|---|
| `contracts` | every push/PR | `Contracts/` | `forge build` + `forge test` for `MarketCap.sol`, `RoleManager.sol` |
| `lint` | every push/PR | `Backend/` | `npm run lint` (ESLint) |
| `test` | every push/PR (needs `lint`) | `Backend/` | `npm run test` (Jest) + uploads CI reference artifacts |
| `localnet` | every push/PR | `Frontend/localnet/` | localnet lint + tests |
| `deploy-staging` | **every push/PR** (needs `test`, `contracts`) | `Backend/` | `node scripts/deploy.js staging <sha> --dry-run`; uploads `deploy-log-staging` |
| `deploy` | **push to `main`/`master` only** (needs `test`, `contracts`) | `Backend/` | `node scripts/deploy.js production <sha> --dry-run`; uploads `deploy-log-production` |

## Pinned toolchain versions

Keep these in sync — the workflow comment header, this table, and the source of
truth must match.

| Tool | Version | Source of truth |
|---|---|---|
| Node.js | `20.19.0` | `actions/setup-node` in the `lint` / `test` / `deploy` jobs; `Backend/package.json` `engines` |
| Node.js (localnet) | `20.11.0` | `localnet` job only — intentionally the minimum supported runtime |
| Foundry / `forge` | `v1.1.0` | `foundry-rs/foundry-toolchain` step; `Contracts/foundry.toml` `[toolchain] forge` |
| Solidity | `0.8.28` | `Contracts/foundry.toml` `[profile.default] solc` |
| TypeScript | see `Backend/package.json` → `devDependencies.typescript` | `Backend/package.json` |

## Environment / secret mapping: staging vs production

The `deploy-staging` and `deploy` jobs each call
`Backend/scripts/deploy.js <environment> <version> --dry-run`. `<environment>`
selects everything downstream:

| Input | `staging` (`deploy-staging` job) | `production` (`deploy` job) |
|---|---|---|
| `deploy.js` arg | `staging` | `production` |
| `NODE_ENV` | `staging` | `production` (set in the step `env:`) |
| `APP_VERSION` | `${{ github.sha }}` | `${{ github.sha }}` |
| Kubernetes namespace | `staging` | `prod` |
| Config file | `Backend/config/deploy.staging.json` | `Backend/config/deploy.production.json` |
| Image | `registry.example.com/gatedelay-backend:<sha>` | same |
| Deploy-log artifact | `deploy-log-staging` | `deploy-log-production` |
| When it runs | every push/PR | push to `main` / `master` only |

Both jobs are `--dry-run`: `deploy.js` simulates the docker build/push and
`kubectl` rollout (no `docker`/`kubectl` needed) and always writes
`Backend/logs/deploy-<env>-<sha>.log`, which the job then uploads. `APP_VERSION`
overrides the version arg if set; otherwise the git SHA is used.

The `deploy.*.json` config files hold **only non-secret** values (registry host,
image name, k8s namespace/deployment/container names). `deploy.js` merges them
over its built-in defaults; a missing file is not an error.

### Secrets

- **No secrets are committed.** The dry-run `deploy` job needs none. A real
  deployment reads `docker`/`kubectl` credentials and the container registry
  token from **GitHub Actions repository/environment secrets**, never from the
  repo.
- Required application keys for running the Backend locally or in a real
  environment are enumerated in **`Backend/.env.example`** (`NODE_ENV`,
  `MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `RPC_URL` /
  `BLOCKCHAIN_RPC_URL`, `PRIVATE_KEY`, `RATE_LIMIT_WHITELIST`, …). Copy it to
  `.env` and fill placeholders; CI itself does not consume `.env`.

## Artifacts

All artifacts use 30-day retention and are downloadable from the GitHub Actions
run page.

| Artifact | Uploaded by | Contents |
|---|---|---|
| `backend-tsconfig` | `test` | `Backend/tsconfig.json` + `.github/workflows/README.md` (this doc) — pins the compiler options and env-var mapping for the commit |
| `deploy-log-staging` | `deploy-staging` | `Backend/logs/deploy-staging-<sha>.log` from the staging dry-run |
| `deploy-log-production` | `deploy` | `Backend/logs/deploy-production-<sha>.log` from the production dry-run |

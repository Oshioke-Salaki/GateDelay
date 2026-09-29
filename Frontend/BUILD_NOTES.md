# GateDelay Frontend Build Notes

This document captures build metadata, known warnings, and other non-blocking technical debt for the GateDelay frontend.

## Baseline Build Status

- **TypeScript compilation**: Clean (Zero errors with `npx tsc --noEmit`).
- **Production Build (`npm run build`)**: Clean (`Compiled successfully` in all route segments).

---

## Toolchain pins

| Tool | Version | Where pinned |
|------|---------|--------------|
| Node.js | `>=20` (Docker/CI use 22) | `Frontend/package.json` `engines`, `Frontend/Dockerfile` |
| npm | `>=10` | `Frontend/package.json` `engines` |
| Next.js | `16.2.4` | `Frontend/package.json` |

Do not let these float in deploy pipelines. Rebuild the Docker image when any pin changes.

---

## `Frontend/package-lock.json` — install, rollback, and smoke verification

The lockfile is the reproducibility contract for every `npm ci` in CI, Docker, and local
installs. Treat a mismatch between `package.json` and `package-lock.json` as a **hard
stop**, not a transient error.

### Install (expected path)

```bash
cd Frontend
npm ci          # fails loudly if lockfile is out of sync — this is intentional
npm run build
npm test
```

The Docker deps stage runs the same command:

```dockerfile
COPY package.json package-lock.json .npmrc ./
RUN npm ci
```

Layers cache on the lockfile hash, so a retry after a transient registry error resumes
at the failed step. A lockfile mismatch is **not** transient — regenerate locally with
`npm install`, commit the updated lockfile in its own PR, then retry.

### Rollback when a build/deploy fails

| Failure | Rollback / retry |
|---------|------------------|
| `npm ci` lockfile mismatch | Regenerate lockfile (`npm install`), commit, re-run — do **not** retry blindly |
| `npm ci` transient registry error | Safe to retry; Docker layer cache helps |
| `npm run build` fails after deps installed | Fix the build error, rebuild image — no lockfile rollback needed |
| Deployed image bad | Re-point traffic to previous tag (see below) |

**Production rollback** (no migration to unwind):

```bash
# 1. Restore previous image tag
docker service update --image gatedelay-frontend:$PREVIOUS_SHA gatedelay_frontend
#    or: kubectl rollout undo deployment/gatedelay-frontend

# 2. Smoke-test the restored image before declaring success
npm run docker:smoke   # wraps Frontend/scripts/smoke-test.sh

# 3. Then unwind backend tiers if needed (see docs/DEPLOY_FRONTEND_DOCKER.md)
```

Full sequencing against `backend/services/upgradeCoordinator.js`:
[`docs/DEPLOY_FRONTEND_DOCKER.md`](../docs/DEPLOY_FRONTEND_DOCKER.md).

### Smoke verification after build

Run smoke checks **after every production build** that touched `package-lock.json`:

```bash
cd Frontend
npm run docker:build
npm run docker:smoke
```

`scripts/smoke-test.sh` asserts, in order:

1. `/api/ping` responds within `BOOT_TIMEOUT` (default 60s)
2. `/api/ping` returns `"ok": true`
3. `/` and `/audit` return 200 with the root layout `<body>` class
4. `/api/market-audit?limit=1` returns JSON (200 or structured error)

Raise `BOOT_TIMEOUT` on cold hosts; do not loop the script on a container that has
already exited.

## Known Non-Blocking Warnings & Technical Debt

### 1. ESLint Version & Subpath Export Incompatibility
- **Symptom**: Running `npm run lint` raises:
  ```
  Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: Package subpath './v4/core' is not defined by "exports" in .../zod/package.json
  ```
- **Context**: The package `zod-validation-error@4.0.2` (used within `eslint-plugin-react-hooks`) resolves `zod/package.json` with an older schema expectation. `zod` is duplicated and has conflicting nested requirements between `viem` and eslint plugins.
- **Resolution/Mitigation**: The core Next.js application compiles cleanly and builds successfully under production settings, but full local linting via the nested eslint config may require manually alignment of ESLint packages or a future patch of `eslint-plugin-react-hooks`.

### 2. Monorepo Lockfile Warning
- **Symptom**: Next.js logs the following warning during build:
  ```
  ⚠ Warning: Next.js inferred your workspace root, but it may not be correct.
  We detected multiple lockfiles and selected the directory of /app/package-lock.json as the root directory.
  ```
- **Context**: Multiple nested lockfiles are present in the parent repo `/app` and `/app/Frontend`.
- **Resolution/Mitigation**: Safe to ignore or can be silenced by configuring `turbopack.root` in `next.config.ts`. Always run `npm ci` from `Frontend/` so the correct `Frontend/package-lock.json` is used.

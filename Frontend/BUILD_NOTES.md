# GateDelay Frontend Build Notes

This document captures build metadata, known warnings, and other non-blocking technical debt for the GateDelay frontend.

## Baseline Build Status

- **TypeScript compilation**: Clean (Zero errors with `npx tsc --noEmit`).
- **Production Build (`npm run build`)**: Clean (`Compiled successfully` in all route segments).

---

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
- **Resolution/Mitigation**: Safe to ignore or can be silenced by configuring `turbopack.root` in `next.config.ts`.

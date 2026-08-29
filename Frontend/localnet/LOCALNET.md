# Frontend / localnet — Cache Strategy

> **Issue #587** — Document cache strategy for `Frontend/localnet/package.json`
> so collaborators can build and run GateDelay without critical broken paths.

---

## Overview

The `localnet` package spins up a local Hardhat node and deploys mock contracts
(`MockERC20`, `MockRouter`) against it, giving frontend developers a zero-cost
sandbox that mirrors the on-chain environment.

---

## Dependency cache (`node_modules`)

| Layer | Cache key | Location |
|-------|-----------|----------|
| npm global cache | `package-lock.json` hash | `~/.npm` |
| installed modules | same lock file | `Frontend/localnet/node_modules/` |

**Install:**

```bash
cd Frontend/localnet
npm ci          # reproducible install — respects package-lock.json exactly
```

`npm ci` is preferred over `npm install` in CI/CD and for clean checkouts
because it:
- uses the lock file verbatim (no version drift)
- reuses `~/.npm` across runs (GitHub Actions `cache: 'npm'` covers this)
- is ~2× faster than `npm install` on cache hit

---

## Hardhat compilation cache

Hardhat writes two cache directories inside `Frontend/localnet/`:

| Directory | Purpose | Git-ignored? |
|-----------|---------|-------------|
| `cache/` | Solidity compilation metadata, avoids recompiling unchanged files | ✅ yes |
| `artifacts/` | Compiled contract JSON (ABI + bytecode) | ✅ yes |

Both are already listed in the root `.gitignore` (`cache/`, `artifacts/`).

**Cache hit behaviour:** Hardhat compares the source hash of each `.sol` file
against the entries in `cache/solidity-files-cache.json`.  Only changed or new
contracts are recompiled.

**Force a clean compile:**

```bash
npm run clean          # removes cache/ and artifacts/ via `hardhat clean`
# or, if the npm clean script is unavailable:
npx hardhat clean
```

---

## CI/CD cache configuration

In GitHub Actions the `node_modules` cache is handled by the `setup-node`
action.  Add the following to any workflow job that uses this package:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'
    cache-dependency-path: Frontend/localnet/package-lock.json
```

The Hardhat `cache/` and `artifacts/` directories should **not** be persisted
in CI — a clean compile on every run avoids stale-artefact issues.

---

## Local development workflow

```bash
# Terminal 1 — start local node (keeps running)
npm run node

# Terminal 2 — deploy mock contracts to the local node
npm run deploy

# After any Solidity change — recompile
npm run compile

# Full reset (wipe Hardhat cache + node_modules if needed)
npm run clean:cache
npm ci
```

---

## Phase 2 dependency note

When real GateDelay contracts are deployed to testnet/mainnet the `deploy`
script will need to be updated with the correct network entry in
`hardhat.config.js`.  The cache strategy remains identical; only the
`--network` flag changes.

# Contributing to GateDelay

Quickstart for new collaborators: install dependencies, configure environment variables, run each surface locally, and run tests.

## Prerequisites

| Tool | Version | Used for |
|------|---------|----------|
| [Node.js](https://nodejs.org/) | 20.11.1 (see `.nvmrc`) | Backend, Frontend |
| npm | 10.2.4 (`packageManager` in package manifests) | Backend, Frontend |
| [Foundry](https://getfoundry.sh/) (`forge`, `cast`) | CI toolchain action / current stable | Smart contracts under `Contracts/` |
| [Git](https://git-scm.com/) | any recent | clone / branch workflow |

Optional but commonly needed for full backend features:

- **Redis** — caching, rate limiting, WebSocket session state (`REDIS_HOST` / `REDIS_PORT`)
- **MongoDB** — persistence (`MONGODB_URI`)

---

## Repository layout

| Path | Surface |
|------|---------|
| `Backend/` | NestJS API (`npm run start:dev`) and legacy Express `server.js` |
| `Frontend/` | Next.js 16 app |
| `Contracts/` | Foundry project (Solidity sources in `src/` and `contracts/`, tests in `test/`) |

---

## 1. Backend (NestJS)

```bash
cd Backend
npm ci
cp .env.example .env   # Windows: copy .env.example .env
```

Edit `.env` using [`Backend/.env.example`](Backend/.env.example) as the template. Minimum variables to boot locally:

- `PORT` (default `3000`)
- `JWT_SECRET`, `JWT_REFRESH_SECRET`
- `REDIS_HOST`, `REDIS_PORT`
- `MONGODB_URI`

Additional keys (`AVIATION_STACK_API_KEY`, `BLOCKCHAIN_RPC_URL`, `GROQ_API_KEY`, etc.) unlock specific modules; the server may start without them but related endpoints will fail at runtime.

### Run

```bash
npm run start:dev    # watch mode (recommended)
# or
npm run start        # single run
```

Health check: `GET http://localhost:3000/api` (global prefix is `api` — see `Backend/src/main.ts`).

### Lint & test

```bash
npm run lint
npm run test
```

CI runs these from `Backend/` on every pull request (see `.github/workflows/ci.yml`).

---

## 2. Frontend (Next.js)

```bash
cd Frontend
npm ci
```

Create `Frontend/.env.local` (not committed). Start from this template:

```env
# API
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000

# Particle Network ConnectKit (wallet)
NEXT_PUBLIC_PROJECT_ID=
NEXT_PUBLIC_CLIENT_KEY=
NEXT_PUBLIC_APP_ID=
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=

# Optional — live contract / feature flags
NEXT_PUBLIC_MARKET_MAKER_ADDRESS=
NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=
```

Without Particle env vars the app may still render, but wallet connection flows need valid ConnectKit credentials.

### Run

```bash
npm run dev      # http://localhost:3000 (or next available port)
npm run build    # production build check
npm run lint     # ESLint
```

Point `NEXT_PUBLIC_API_URL` at the Backend NestJS instance when testing API-integrated pages.

---

## 3. Smart contracts (Foundry)

All Forge commands run from **`Contracts/`**:

```bash
cd Contracts
forge build
forge test
```

Run a single test file:

```bash
forge test --match-path test/LMSR.t.sol -vv
```

Format check (matches CI in `Contracts/.github/workflows/test.yml`):

```bash
forge fmt --check
```

Sources live in `Contracts/src/` (e.g. `LMSR`, `MarketMaker`, `Trading`) and `Contracts/contracts/` (e.g. `OrderBook`). Tests live in `Contracts/test/`.

> **Note:** There is a legacy `test/` directory at the repository root with older Foundry tests. Prefer `Contracts/test/` for the current contract tree.

---

## Common failure modes

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `npm run lint` / `npm run test` fails in CI locally | Wrong directory | Run from `Backend/`, not repo root |
| Backend exits on Redis/Mongo connection | Services not running | Start Redis/Mongo or point env vars at running instances |
| `EADDRINUSE` on port 3000 | Backend and Frontend both default to 3000 | Set `PORT` in Backend `.env` or run Frontend on another port (`npm run dev -- -p 3001`) |
| `forge: command not found` | Foundry not installed | `curl -L https://foundry.paradigm.xyz \| bash` then `foundryup` |
| `forge build` import errors | Wrong working directory | `cd Contracts` before `forge build` |
| Wallet modal empty / connection errors | Missing Particle env vars | Fill `NEXT_PUBLIC_PROJECT_ID`, `NEXT_PUBLIC_CLIENT_KEY`, `NEXT_PUBLIC_APP_ID` in `.env.local` |
| Frontend API 404 / CORS | Backend not running or wrong URL | Start `npm run start:dev` in `Backend/`; set `NEXT_PUBLIC_API_URL` |
| `npm ci` fails | Lockfile out of sync | Run `npm ci` in the affected package and commit lockfile updates separately |

---

## Pull requests

1. Branch from `main`.
2. Keep changes focused; run the relevant checks above before opening a PR.
3. Link the GitHub issue in the PR body (`Closes #NNN`).

For phase planning and architecture notes see [`PHASES.md`](PHASES.md) when present on your branch.

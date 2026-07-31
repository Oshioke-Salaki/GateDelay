# GateDelay — Phase roadmap & issue index

High-level sequencing for collaborators. Each phase file contains **≥200** GitHub-ready issues.

## Current snapshot

| Area | Status |
|------|--------|
| **Trading model** | **Ambiguous** — LMSR (`Contracts/src/MarketMaker.sol`, `Contracts/src/Trading.sol`) and CLOB (`Contracts/contracts/OrderBook.sol`) both exist; see [ADR 0001](docs/adr/0001-lmsr-vs-clob-ambiguity.md). **Phase 2 decides.** |
| Backends | NestJS modules under `Backend/src/` plus legacy Express `Backend/server.js` — single runtime path unified in **Phase 1** |
| Frontend | Next.js app under `Frontend/`; some market/trade UI still mock-driven — **Phase 3** completes surfaces |
| Contracts | Foundry project under `Contracts/` — wired end-to-end in **Phase 2**, hardened in **Phase 4** |

## Phase map

| Phase | File | Theme | Issues |
|-------|------|-------|--------|
| 1 | [PHASE_1.md](PHASE_1.md) | Stabilize foundations | ≥200 |
| 2 | [PHASE_2.md](PHASE_2.md) | Core market wiring | ≥200 |
| 3 | [PHASE_3.md](PHASE_3.md) | Product complete | ≥200 |
| 4 | [PHASE_4.md](PHASE_4.md) | Hardening | ≥200 |
| 5 | [PHASE_5.md](PHASE_5.md) | Deployment & shipping | ≥200 |

## Area distribution

Each phase file balances issues across **six area labels** (minimum ~15% per area, adjusted by phase focus):

| Area label | Typical paths | Phase emphasis |
|------------|---------------|----------------|
| `frontend` | `Frontend/app/`, components, hooks, wallet UI | P3 product surfaces; P2 wiring |
| `backend` | `Backend/src/` Nest modules, `Backend/server.js` | P2 market engine; P1 boot stability |
| `contracts` | `Contracts/src/`, `Contracts/test/`, root `test/*.t.sol` | P2 on-chain wiring; P4 fuzz/guards |
| `docs` | `README.md`, `PHASES.md`, implementation MDs, ADRs | P1 onboarding; P3 feature docs |
| `infra` | `.github/workflows/`, `package.json`, `.env.example`, deploy | P1 CI; P5 staging/prod deploy |
| `security` | rate limiter, auth, circuit breaker, beta access, audits | P4 hardening; cross-cutting in all phases |

Regenerate with `bun _gen_phases.js` — the generator interleaves areas within each phase file.

## Phase dependencies

```text
Phase 1 (foundations)
    ↓
Phase 2 (core market wiring)
    ↓
Phase 3 (product complete)
    ↓
Phase 4 (hardening)
    ↓
Phase 5 (deployment & shipping)
```

- **Phase 1** must land before market wiring: broken boot paths block all later work.
- **Phase 2** depends on stable Backend/Contracts build; resolves LMSR vs CLOB (ADR 0001).
- **Phase 3** depends on live market data from Phase 2; replaces mocks in `Frontend/data/mockMarkets.ts`.
- **Phase 4** runs in parallel with late Phase 3 but must gate **Phase 5** production deploy.
- **Phase 5** assumes CI green, security sign-off, and staging validation from Phases 1–4.

## Labels

Apply these GitHub labels when filing issues from phase files:

| Label | Use for |
|-------|---------|
| `phase-1` … `phase-5` | Phase ownership (required) |
| `frontend` | `Frontend/` Next.js UI, hooks, components |
| `backend` | `Backend/` NestJS, Express, workers, migrations |
| `contracts` | `Contracts/`, `test/*.t.sol` Foundry |
| `docs` | README, ADRs, contributor docs |
| `infra` | CI/CD, Docker, env, deploy, monitoring |
| `security` | Auth, rate limiting, circuit breaker, audits |
| `foundations` | Phase 1 umbrella (optional) |
| `markets` | Phase 2 umbrella (optional) |
| `product` | Phase 3 umbrella (optional) |
| `hardening` | Phase 4 umbrella (optional) |
| `deployment` | Phase 5 umbrella (optional) |

## Filing GitHub issues

1. Pick a phase file ([PHASE_1.md](PHASE_1.md) … [PHASE_5.md](PHASE_5.md)).
2. Copy one issue block (from `### PN-XXX` through `**Related:**`).
3. Create a new GitHub issue; paste the block as the body.
4. Set the title to the `###` heading text (e.g. `P2-042: Wire MarketFactory to MarketFactory.sol`).
5. Add labels from `**Labels:**` (at minimum `phase-N` plus area label).
6. Link related PRs to the `**Related:**` path.

**Issue template format:**

```markdown
### PN-XXX: Title
**Labels:** `phase-N`, `<area>`
**Description:** …
**Acceptance criteria:**
- [ ] …
**Related:** `path`
```

## Architecture decisions

| ADR | Title | Status |
|-----|-------|--------|
| [0001](docs/adr/0001-lmsr-vs-clob-ambiguity.md) | LMSR vs CLOB / OrderBook ambiguity | Proposed — decision deferred to Phase 2 |

## Regenerating phase files

```bash
bun _gen_phases.js
```

On Windows without Bun: `powershell -ExecutionPolicy Bypass -File _gen_phases.ps1` (delegates to this script when Bun is available).

Generator scans `Backend/`, `Frontend/`, `Contracts/`, `test/`, `.github/`, and root docs for real paths, then allocates ≥15% of each phase to every area label.

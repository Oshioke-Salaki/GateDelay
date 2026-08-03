# GateDelay â€” Phase roadmap & issue index

High-level sequencing for collaborators. Each phase file contains **â‰¥200** GitHub-ready issues.

## Current snapshot

| Area | Status |
|------|--------|
| **Trading model** | **Ambiguous** â€” LMSR (`Contracts/src/MarketMaker.sol`, `Contracts/src/Trading.sol`) and CLOB (`Contracts/contracts/OrderBook.sol`) both exist; see [ADR 0001](docs/adr/0001-lmsr-vs-clob-ambiguity.md). **Phase 2 decides.** |
| Backends | NestJS modules under `Backend/src/` plus legacy Express `Backend/server.js` â€” single runtime path unified in **Phase 1** |
| Frontend | Next.js app under `Frontend/`; some market/trade UI still mock-driven â€” **Phase 3** completes surfaces |
| Contracts | Foundry project under `Contracts/` â€” wired end-to-end in **Phase 2**, hardened in **Phase 4** |

## Phase map

| Phase | File | Theme | Issues |
|-------|------|-------|--------|
| 1 | [PHASE_1.md](PHASE_1.md) | Stabilize foundations | â‰¥200 |
| 2 | [PHASE_2.md](PHASE_2.md) | Core market wiring | â‰¥200 |
| 3 | [PHASE_3.md](PHASE_3.md) | Product complete | â‰¥200 |
| 4 | [PHASE_4.md](PHASE_4.md) | Hardening | â‰¥200 |
| 5 | [PHASE_5.md](PHASE_5.md) | Deployment & shipping | â‰¥200 |

## Phase dependencies

```text
Phase 1 (foundations)
    â†“
Phase 2 (core market wiring)
    â†“
Phase 3 (product complete)
    â†“
Phase 4 (hardening)
    â†“
Phase 5 (deployment & shipping)
```

- **Phase 1** must land before market wiring: broken boot paths block all later work.
- **Phase 2** depends on stable Backend/Contracts build; resolves LMSR vs CLOB (ADR 0001).
- **Phase 3** depends on live market data from Phase 2; replaces mocks in `Frontend/data/mockMarkets.ts`.
- **Phase 4** runs in parallel with late Phase 3 but must gate **Phase 5** production deploy.
- **Phase 5** assumes CI green, security sign-off, and staging validation from Phases 1â€“4.

## Labels

Apply these GitHub labels when filing issues from phase files:

| Label | Use for |
|-------|---------|
| `phase-1` â€¦ `phase-5` | Phase ownership (required) |
| `backend` | `Backend/` NestJS, Express, workers, migrations |
| `frontend` | `Frontend/` Next.js UI, hooks, components |
| `contracts` | `Contracts/`, `test/*.t.sol` Foundry |
| `docs` | README, ADRs, contributor docs |
| `ci` | GitHub Actions, build pipelines |
| `security` | Auth, access control, audits |
| `testing` | Unit, integration, e2e, fuzz |
| `infra` | Deploy, Docker, env, monitoring |
| `api` | REST/WebSocket public surfaces |
| `db` | Persistence, migrations, schemas |
| `foundations` | Phase 1 umbrella (optional) |
| `markets` | Phase 2 umbrella (optional) |
| `product` | Phase 3 umbrella (optional) |
| `hardening` | Phase 4 umbrella (optional) |
| `deployment` | Phase 5 umbrella (optional) |

## Filing GitHub issues

1. Pick a phase file ([PHASE_1.md](PHASE_1.md) â€¦ [PHASE_5.md](PHASE_5.md)).
2. Copy one issue block (from `### PN-XXX` through `**Related:**`).
3. Create a new GitHub issue; paste the block as the body.
4. Set the title to the `###` heading text (e.g. `P2-042: Wire MarketFactory to LMSR.sol`).
5. Add labels from `**Labels:**` (at minimum `phase-N` plus area label).
6. Link related PRs to the `**Related:**` path.

**Issue template format:**

```markdown
### PN-XXX: Title
**Labels:** `phase-N`, `<area>`
**Description:** â€¦
**Acceptance criteria:**
- [ ] â€¦
**Related:** `path`
```

## Architecture decisions

| ADR | Title | Status |
|-----|-------|--------|
| [0001](docs/adr/0001-lmsr-vs-clob-ambiguity.md) | LMSR vs CLOB / OrderBook ambiguity | Proposed â€” decision deferred to Phase 2 |

## Regenerating phase files

```bash
node _gen_phases.js
```

On Windows without Node: `powershell -ExecutionPolicy Bypass -File _gen_phases.ps1`

Generator scans `Backend/`, `Frontend/`, `Contracts/`, `test/`, and `docs/` for real paths.

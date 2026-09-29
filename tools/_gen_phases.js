#!/usr/bin/env node
/**
 * Generates PHASES.md and PHASE_1.md … PHASE_5.md with ≥200 GitHub-ready issues each.
 * Run: node _gen_phases.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const ISSUES_PER_PHASE = 210;

const PHASE_META = [
  {
    num: 1,
    theme: 'Stabilize foundations',
    summary:
      'Docs, build/run reproducibility, unify Backend runtime paths, fix critical boot/blocker bugs, and establish contributor onboarding.',
    labels: ['phase-1', 'foundations'],
    verbs: [
      'Document setup for',
      'Fix broken import in',
      'Unify Express/Nest path for',
      'Add smoke test for',
      'Validate env vars for',
      'Remove dead code in',
      'Align README with',
      'Add health check for',
      'Stabilize boot sequence of',
      'Resolve TypeScript errors in',
      'Add missing module export in',
      'Consolidate duplicate logic in',
      'Add CONTRIBUTING note for',
      'Fix lint violations in',
      'Ensure package scripts cover',
      'Add startup logging to',
      'Verify dependency versions in',
      'Add .env.example entry for',
      'Fix path alias in',
      'Add basic integration test for',
    ],
    descTemplates: [
      'Foundations work: ensure {path} is documented, buildable, and free of critical boot errors blocking local development.',
      'Phase 1 stabilizes the repo; {path} must be verified against the canonical build/run path described in README.',
      'Contributors report friction around {path}; reduce setup time and eliminate silent failures on first run.',
      'Unify legacy Express (`Backend/server.js`) and NestJS (`Backend/src/`) concerns touching {path}.',
      'Add minimal verification so CI can detect regressions in {path} before Phase 2 market wiring begins.',
    ],
    acTemplates: [
      'Local dev server starts without errors involving this path',
      'README or inline docs reference this path accurately',
      'No critical console errors on boot',
      'npm/forge scripts succeed for this area',
      'Change is covered by at least a smoke test or manual checklist item',
    ],
  },
  {
    num: 2,
    theme: 'Core market wiring',
    summary:
      'End-to-end wiring for MarketFactory, MarketMaker, LMSR, Trading, OrderBook/CLOB decision, resolution, and backend trade engine.',
    labels: ['phase-2', 'markets'],
    verbs: [
      'Wire MarketFactory to',
      'Connect LMSR pricing in',
      'Integrate Trading.sol with',
      'Resolve LMSR vs CLOB for',
      'Index on-chain events from',
      'Sync market state via',
      'Expose REST endpoint for',
      'Map contract ABI to',
      'Add WebSocket feed for',
      'Implement settlement hook in',
      'Bridge frontend trade UI to',
      'Add resolution pipeline in',
      'Deploy script update for',
      'Add Foundry test covering',
      'Emit events from',
      'Decode logs in',
      'Add market lifecycle state to',
      'Connect AviationStack data to',
      'Wire position tracking in',
      'Add order placement through',
    ],
    descTemplates: [
      'Phase 2 connects on-chain markets to backend and frontend; {path} is part of the core trading path.',
      'ADR 0001 (LMSR vs CLOB) affects {path}; implement the chosen model consistently across layers.',
      'Market data must flow from contracts through Backend services to Frontend components via {path}.',
      'End-to-end trade: create market → place order → settle → resolve, touching {path}.',
      'Wire {path} so mock data (`Frontend/data/mockMarkets.ts`) can be replaced with live API/chain reads.',
    ],
    acTemplates: [
      'On-chain action reflected in backend within acceptable latency',
      'Frontend displays live data instead of mocks where applicable',
      'Foundry/integration test proves happy path',
      'Event indexing or polling documented',
      'Error states surfaced to UI',
    ],
  },
  {
    num: 3,
    theme: 'Product complete',
    summary:
      'Complete user-facing surfaces: wallet, trade, portfolio, market discovery, notifications, settings, and polish for beta users.',
    labels: ['phase-3', 'product'],
    verbs: [
      'Polish UX for',
      'Complete feature gap in',
      'Add empty-state UI to',
      'Implement responsive layout for',
      'Add loading skeleton to',
      'Wire notifications for',
      'Add accessibility pass on',
      'Implement dark mode in',
      'Add error boundary around',
      'Complete form validation in',
      'Add analytics event to',
      'Implement search/filter in',
      'Add pagination to',
      'Connect settings panel to',
      'Add onboarding flow for',
      'Implement share/export in',
      'Add tooltips/help to',
      'Complete mobile layout for',
      'Add optimistic updates in',
      'Finish referral/reward UI in',
    ],
    descTemplates: [
      'Product completeness: {path} should meet beta-ready UX standards with real data and clear error handling.',
      'Users expect a polished experience; audit {path} for missing states, a11y, and mobile layout.',
      'Replace placeholder or partial implementations in {path} with production-quality UI logic.',
      'Feature parity checklist item for {path} — ensure all acceptance paths work without mock fallbacks.',
      'Beta users will interact with {path} daily; reduce friction and clarify outcomes.',
    ],
    acTemplates: [
      'Happy path works on desktop and mobile',
      'Empty, loading, and error states implemented',
      'Keyboard navigation and ARIA labels present',
      'No mock data in production code path',
      'QA sign-off recorded',
    ],
  },
  {
    num: 4,
    theme: 'Hardening',
    summary:
      'Security review, rate limiting, circuit breakers, test coverage, monitoring, fuzzing, and operational resilience.',
    labels: ['phase-4', 'hardening'],
    verbs: [
      'Security audit',
      'Add rate limit to',
      'Fuzz test',
      'Add reentrancy guard review for',
      'Expand unit tests in',
      'Add e2e test for',
      'Harden auth on',
      'Add input validation to',
      'Review access control in',
      'Add monitoring metric for',
      'Add alert rule for',
      'Stress test',
      'Add circuit breaker to',
      'Review oracle trust in',
      'Add slippage bounds to',
      'Pen-test endpoint',
      'Add audit log for',
      'Review gas limits in',
      'Add chaos test for',
      'Document threat model for',
    ],
    descTemplates: [
      'Hardening pass on {path}: identify abuse vectors, add limits, tests, and monitoring before public launch.',
      'Security and reliability requirement for {path} per Phase 4 checklist.',
      'Expand test coverage and add negative-path cases for {path}.',
      'Rate limiter (`Backend/src/rate-limiter/`) and contract guards must cover flows involving {path}.',
      'Operational readiness: metrics, alerts, and runbooks for failures in {path}.',
    ],
    acTemplates: [
      'Security review completed with no critical findings',
      'Negative-path tests added and passing',
      'Rate limits or guards verified under load',
      'Monitoring/alerting configured',
      'Documented rollback procedure',
    ],
  },
  {
    num: 5,
    theme: 'Deployment & shipping',
    summary:
      'CI/CD pipelines, staging/prod deploys, contract upgrades, release notes, beta gating, and production cutover.',
    labels: ['phase-5', 'deployment'],
    verbs: [
      'Add CI job for',
      'Configure staging deploy of',
      'Add production deploy for',
      'Version bump',
      'Add release checklist for',
      'Configure secrets for',
      'Add Docker image for',
      'Add migration runbook for',
      'Add rollback procedure for',
      'Publish npm package for',
      'Add contract verify step for',
      'Configure CDN for',
      'Add smoke test post-deploy for',
      'Document infra for',
      'Add beta access gate to',
      'Ship release notes for',
      'Add upgrade coordinator step for',
      'Configure monitoring dashboard for',
      'Add canary deploy for',
      'Finalize env matrix for',
    ],
    descTemplates: [
      'Deployment & shipping: {path} must be included in automated CI/CD and release process.',
      'Production cutover requires {path} to be deployable, verifiable, and rollback-safe.',
      'Beta launch gate: ensure {path} is configured for staging and production environments.',
      'Release engineering task for {path} — document, automate, and verify deploy path.',
      'Coordinate with `Backend/services/upgradeCoordinator.js` and migration routes for {path}.',
    ],
    acTemplates: [
      'CI pipeline green including this component',
      'Staging deploy verified with smoke tests',
      'Production deploy runbook documented',
      'Rollback tested successfully',
      'Release notes updated',
    ],
  },
];

const LABEL_AREAS = [
  'backend',
  'frontend',
  'contracts',
  'docs',
  'ci',
  'security',
  'testing',
  'infra',
  'api',
  'db',
];

function collectPaths() {
  const paths = [];
  const skipDirs = new Set([
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    'coverage',
    'out',
    'cache',
    'artifacts',
    'typechain-types',
  ]);

  function walk(dir, prefix) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (skipDirs.has(e.name)) continue;
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full, rel);
      } else if (/\.(ts|tsx|js|jsx|sol|json|md|mts|mjs)$/.test(e.name)) {
        paths.push(rel.replace(/\\/g, '/'));
      }
    }
  }

  walk(path.join(ROOT, 'Backend'), 'Backend');
  walk(path.join(ROOT, 'Frontend'), 'Frontend');
  walk(path.join(ROOT, 'Contracts'), 'Contracts');
  walk(path.join(ROOT, 'test'), 'test');
  if (fs.existsSync(path.join(ROOT, 'docs'))) {
    walk(path.join(ROOT, 'docs'), 'docs');
  }

  // Ensure high-value paths are present even if walk missed them
  const seed = [
    'Backend/server.js',
    'Backend/package.json',
    'Backend/src/trade-engine/trade-engine.service.ts',
    'Backend/src/rate-limiter/rate-limiter.service.ts',
    'Backend/src/websocket/price.gateway.ts',
    'Backend/src/resolution/resolution.service.ts',
    'Backend/routes/beta.js',
    'Backend/services/upgradeCoordinator.js',
    'Frontend/components/wallet/ConnectModal.tsx',
    'Frontend/components/market/MarketCard.tsx',
    'Frontend/data/mockMarkets.ts',
    'Frontend/lib/walletDetection.ts',
    'Contracts/src/LMSR.sol',
    'Contracts/src/MarketMaker.sol',
    'Contracts/src/MarketFactory.sol',
    'Contracts/src/Trading.sol',
    'Contracts/contracts/OrderBook.sol',
    'Contracts/src/Resolution.sol',
    'Contracts/src/RateLimiter.sol',
    'test/MintingPausable.t.sol',
    'README.md',
    'docs/adr/0001-lmsr-vs-clob-ambiguity.md',
  ];
  const set = new Set([...paths, ...seed]);
  return [...set].sort();
}

function areaForPath(p) {
  if (p.startsWith('Backend/')) return 'backend';
  if (p.startsWith('Frontend/')) return 'frontend';
  if (p.startsWith('Contracts/') || p.startsWith('test/')) return 'contracts';
  if (p.startsWith('docs/')) return 'docs';
  return 'infra';
}

function pick(arr, i) {
  return arr[i % arr.length];
}

function basename(p) {
  return path.basename(p);
}

function issueBlock(phase, index, filePath) {
  const meta = PHASE_META[phase - 1];
  const id = String(index).padStart(3, '0');
  const area = areaForPath(filePath);
  const verb = pick(meta.verbs, index);
  const title = `${verb} ${basename(filePath)}`;
  const desc = pick(meta.descTemplates, index).replace('{path}', filePath);
  const ac1 = pick(meta.acTemplates, index);
  const ac2 = pick(meta.acTemplates, index + 1);
  const ac3 = pick(meta.acTemplates, index + 2);

  return [
    `### P${phase}-${id}: ${title}`,
    `**Labels:** \`phase-${phase}\`, \`${area}\``,
    `**Description:** ${desc}`,
    `**Acceptance criteria:**`,
    `- [ ] ${ac1}`,
    `- [ ] ${ac2}`,
    `- [ ] ${ac3}`,
    `**Related:** \`${filePath}\``,
    '',
  ].join('\n');
}

function generatePhaseFile(phaseNum, allPaths) {
  const meta = PHASE_META[phaseNum - 1];
  const lines = [
    `# Phase ${phaseNum}: ${meta.theme}`,
    '',
    `> **Theme:** ${meta.theme}`,
    `> **Goal:** ${meta.summary}`,
    '',
    `Parent index: [PHASES.md](PHASES.md)`,
    '',
    `---`,
    '',
    `## Issues (${ISSUES_PER_PHASE} tracked)`,
    '',
    `Copy any issue below into GitHub using the template in [PHASES.md](PHASES.md#filing-github-issues).`,
    '',
  ];

  for (let i = 1; i <= ISSUES_PER_PHASE; i++) {
    const filePath = allPaths[(i - 1) % allPaths.length];
    lines.push(issueBlock(phaseNum, i, filePath));
  }

  return lines.join('\n');
}

function generatePhasesIndex() {
  return [
    '# GateDelay — Phase roadmap & issue index',
    '',
    'High-level sequencing for collaborators. Each phase file contains **≥200** GitHub-ready issues.',
    '',
    '## Current snapshot',
    '',
    '| Area | Status |',
    '|------|--------|',
    '| **Trading model** | **Ambiguous** — LMSR (`Contracts/src/MarketMaker.sol`, `Contracts/src/Trading.sol`) and CLOB (`Contracts/contracts/OrderBook.sol`) both exist; see [ADR 0001](docs/adr/0001-lmsr-vs-clob-ambiguity.md). **Phase 2 decides.** |',
    '| Backends | NestJS modules under `Backend/src/` plus legacy Express `Backend/server.js` — single runtime path unified in **Phase 1** |',
    '| Frontend | Next.js app under `Frontend/`; some market/trade UI still mock-driven — **Phase 3** completes surfaces |',
    '| Contracts | Foundry project under `Contracts/` — wired end-to-end in **Phase 2**, hardened in **Phase 4** |',
    '',
    '## Phase map',
    '',
    '| Phase | File | Theme | Issues |',
    '|-------|------|-------|--------|',
    '| 1 | [PHASE_1.md](PHASE_1.md) | Stabilize foundations | ≥200 |',
    '| 2 | [PHASE_2.md](PHASE_2.md) | Core market wiring | ≥200 |',
    '| 3 | [PHASE_3.md](PHASE_3.md) | Product complete | ≥200 |',
    '| 4 | [PHASE_4.md](PHASE_4.md) | Hardening | ≥200 |',
    '| 5 | [PHASE_5.md](PHASE_5.md) | Deployment & shipping | ≥200 |',
    '',
    '## Phase dependencies',
    '',
    '```text',
    'Phase 1 (foundations)',
    '    ↓',
    'Phase 2 (core market wiring)',
    '    ↓',
    'Phase 3 (product complete)',
    '    ↓',
    'Phase 4 (hardening)',
    '    ↓',
    'Phase 5 (deployment & shipping)',
    '```',
    '',
    '- **Phase 1** must land before market wiring: broken boot paths block all later work.',
    '- **Phase 2** depends on stable Backend/Contracts build; resolves LMSR vs CLOB (ADR 0001).',
    '- **Phase 3** depends on live market data from Phase 2; replaces mocks in `Frontend/data/mockMarkets.ts`.',
    '- **Phase 4** runs in parallel with late Phase 3 but must gate **Phase 5** production deploy.',
    '- **Phase 5** assumes CI green, security sign-off, and staging validation from Phases 1–4.',
    '',
    '## Labels',
    '',
    'Apply these GitHub labels when filing issues from phase files:',
    '',
    '| Label | Use for |',
    '|-------|---------|',
    '| `phase-1` … `phase-5` | Phase ownership (required) |',
    '| `backend` | `Backend/` NestJS, Express, workers, migrations |',
    '| `frontend` | `Frontend/` Next.js UI, hooks, components |',
    '| `contracts` | `Contracts/`, `test/*.t.sol` Foundry |',
    '| `docs` | README, ADRs, contributor docs |',
    '| `ci` | GitHub Actions, build pipelines |',
    '| `security` | Auth, access control, audits |',
    '| `testing` | Unit, integration, e2e, fuzz |',
    '| `infra` | Deploy, Docker, env, monitoring |',
    '| `api` | REST/WebSocket public surfaces |',
    '| `db` | Persistence, migrations, schemas |',
    '| `foundations` | Phase 1 umbrella (optional) |',
    '| `markets` | Phase 2 umbrella (optional) |',
    '| `product` | Phase 3 umbrella (optional) |',
    '| `hardening` | Phase 4 umbrella (optional) |',
    '| `deployment` | Phase 5 umbrella (optional) |',
    '',
    '## Filing GitHub issues',
    '',
    '1. Pick a phase file ([PHASE_1.md](PHASE_1.md) … [PHASE_5.md](PHASE_5.md)).',
    '2. Copy one issue block (from `### PN-XXX` through `**Related:**`).',
    '3. Create a new GitHub issue; paste the block as the body.',
    '4. Set the title to the `###` heading text (e.g. `P2-042: Wire MarketFactory to LMSR.sol`).',
    '5. Add labels from `**Labels:**` (at minimum `phase-N` plus area label).',
    '6. Link related PRs to the `**Related:**` path.',
    '',
    '**Issue template format:**',
    '',
    '```markdown',
    '### PN-XXX: Title',
    '**Labels:** `phase-N`, `<area>`',
    '**Description:** …',
    '**Acceptance criteria:**',
    '- [ ] …',
    '**Related:** `path`',
    '```',
    '',
    '## Architecture decisions',
    '',
    '| ADR | Title | Status |',
    '|-----|-------|--------|',
    '| [0001](docs/adr/0001-lmsr-vs-clob-ambiguity.md) | LMSR vs CLOB / OrderBook ambiguity | Proposed — decision deferred to Phase 2 |',
    '',
    '## Regenerating phase files',
    '',
    '```bash',
    'node _gen_phases.js',
    '```',
    '',
    'Generator scans `Backend/`, `Frontend/`, `Contracts/`, `test/`, and `docs/` for real paths.',
    '',
  ].join('\n');
}

function main() {
  const allPaths = collectPaths();
  console.log(`Collected ${allPaths.length} repo paths`);

  fs.writeFileSync(path.join(ROOT, 'PHASES.md'), generatePhasesIndex(), 'utf8');
  console.log('Wrote PHASES.md');

  for (let p = 1; p <= 5; p++) {
    const fname = `PHASE_${p}.md`;
    fs.writeFileSync(path.join(ROOT, fname), generatePhaseFile(p, allPaths), 'utf8');
    console.log(`Wrote ${fname}`);
  }
}

main();

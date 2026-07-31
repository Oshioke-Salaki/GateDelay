#!/usr/bin/env bun
/**
 * Generates PHASES.md and PHASE_1.md … PHASE_5.md with ≥200 GitHub-ready issues each.
 * Issues are balanced across frontend, backend, contracts, docs, infra, and security.
 * Run: bun _gen_phases.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const ISSUES_PER_PHASE = 210;
const MIN_AREA_PCT = 0.15;

const AREAS = ['frontend', 'backend', 'contracts', 'docs', 'infra', 'security'];

/** Per-phase area weights (must sum to 1.0; each ≥ MIN_AREA_PCT). */
const PHASE_AREA_WEIGHTS = {
  1: { docs: 0.2, infra: 0.2, backend: 0.18, frontend: 0.15, contracts: 0.15, security: 0.12 },
  2: { contracts: 0.22, backend: 0.22, frontend: 0.2, docs: 0.12, infra: 0.12, security: 0.12 },
  3: { frontend: 0.25, backend: 0.22, docs: 0.18, contracts: 0.12, infra: 0.12, security: 0.11 },
  4: { security: 0.22, backend: 0.18, frontend: 0.18, contracts: 0.18, docs: 0.12, infra: 0.12 },
  5: { infra: 0.28, backend: 0.18, frontend: 0.15, contracts: 0.15, docs: 0.12, security: 0.12 },
};

const PHASE_META = [
  {
    num: 1,
    theme: 'Stabilize foundations',
    summary:
      'Docs, build/run reproducibility, unify Backend runtime paths, fix critical boot/blocker bugs, and establish contributor onboarding across all layers.',
  },
  {
    num: 2,
    theme: 'Core market wiring',
    summary:
      'End-to-end wiring for MarketFactory, MarketMaker, LMSR, Trading, OrderBook/CLOB decision, resolution, and backend trade engine.',
  },
  {
    num: 3,
    theme: 'Product complete',
    summary:
      'Complete user-facing surfaces: wallet, trade, portfolio, market discovery, notifications, settings, and polish for beta users.',
  },
  {
    num: 4,
    theme: 'Hardening',
    summary:
      'Security review, rate limiting, circuit breakers, test coverage, monitoring, fuzzing, and operational resilience.',
  },
  {
    num: 5,
    theme: 'Deployment & shipping',
    summary:
      'CI/CD pipelines, staging/prod deploys, contract upgrades, release notes, beta gating, and production cutover.',
  },
];

/** Area-specific task templates keyed by phase theme emphasis. */
const AREA_TEMPLATES = {
  frontend: {
    verbs: [
      'Fix Next.js boot error in',
      'Add loading skeleton to',
      'Wire wallet connect flow in',
      'Replace mock data in',
      'Add error boundary around',
      'Validate env usage in',
      'Align route layout for',
      'Add smoke test for',
      'Fix TypeScript path alias in',
      'Document component props in',
      'Stabilize hydration in',
      'Add empty state to',
      'Connect WebSocket hook in',
      'Fix responsive layout in',
      'Add vitest coverage for',
    ],
    desc: [
      'Frontend foundations: ensure `{path}` builds under `Frontend/` Next.js app without runtime errors.',
      'Phase 1 requires `{path}` to match README quickstart — wallet, routes, and API base URL must work on first run.',
      'Contributors hit friction in `{path}`; reduce setup steps and surface clear errors instead of blank screens.',
      'Unify mock vs live data paths touching `{path}` before Phase 2 market wiring replaces `Frontend/data/mockMarkets.ts`.',
      'Add minimal UI verification so CI can catch regressions in `{path}` before beta.',
    ],
    ac: [
      '`npm run dev` in `Frontend/` renders pages using this file without console errors',
      'README or `Frontend/README.md` documents how `{path}` fits the app shell',
      'Wallet connect and navigation work on first load',
      'Vitest or manual checklist covers the happy path',
      'No hard-coded localhost URLs left in production path',
    ],
  },
  backend: {
    verbs: [
      'Document setup for',
      'Fix broken import in',
      'Unify Express/Nest path for',
      'Add smoke test for',
      'Validate env vars for',
      'Remove dead code in',
      'Add health check for',
      'Stabilize boot sequence of',
      'Resolve TypeScript errors in',
      'Add missing module export in',
      'Consolidate duplicate logic in',
      'Fix lint violations in',
      'Ensure package scripts cover',
      'Add startup logging to',
      'Add integration test for',
    ],
    desc: [
      'Backend foundations: ensure `{path}` boots under both NestJS (`Backend/src/`) and legacy Express (`Backend/server.js`) where applicable.',
      'Phase 1 stabilizes the repo; `{path}` must match the canonical run path in README.',
      'Contributors report friction around `{path}`; eliminate silent failures on `npm run start:dev`.',
      'Unify legacy Express routes and Nest modules touching `{path}`.',
      'Add minimal verification so CI (`/.github/workflows/ci.yml`) catches regressions in `{path}`.',
    ],
    ac: [
      'Local dev server starts without errors involving `{path}`',
      'README documents env vars and scripts for this module',
      'No critical console errors on boot',
      '`npm test` or smoke script succeeds for this area',
      'Change covered by test or documented manual checklist',
    ],
  },
  contracts: {
    verbs: [
      'Verify forge build for',
      'Add Foundry test for',
      'Document NatSpec in',
      'Fix compiler warning in',
      'Align ABI export for',
      'Add deployment script for',
      'Pin dependency version in',
      'Add invariant test for',
      'Resolve import path in',
      'Add fuzz harness for',
      'Verify remappings for',
      'Add gas snapshot for',
      'Cross-check LMSR/CLOB usage in',
      'Add event coverage test for',
      'Stabilize `forge test` for',
    ],
    desc: [
      'Contracts foundations: `{path}` must compile and pass `forge test` in `Contracts/` before market wiring.',
      'Phase 1 ensures `{path}` is buildable; ADR 0001 (LMSR vs CLOB) may affect interfaces here.',
      'Foundry CI (`Contracts/.github/workflows/test.yml`) should gate changes to `{path}`.',
      'Document deploy order and constructor args for `{path}` in README or contract comments.',
      'Eliminate flaky or skipped tests involving `{path}`.',
    ],
    ac: [
      '`forge build` succeeds with `{path}`',
      '`forge test` passes for tests covering this contract',
      'NatSpec or README notes constructor/deploy requirements',
      'ABI artifacts generated and referenced by Backend if applicable',
      'No critical compiler warnings in `{path}`',
    ],
  },
  docs: {
    verbs: [
      'Update setup section in',
      'Add troubleshooting for',
      'Cross-link ADR in',
      'Align README with',
      'Add CONTRIBUTING note for',
      'Document env matrix in',
      'Add architecture diagram for',
      'Refresh stale claims in',
      'Add phase checklist to',
      'Document API contract in',
      'Add onboarding step to',
      'Fix broken links in',
      'Add runbook section to',
      'Summarize implementation status in',
      'Add glossary entry in',
    ],
    desc: [
      'Documentation: `{path}` must accurately describe current build/run steps for GateDelay contributors.',
      'Phase 1 docs pass — verify `{path}` matches `Backend/`, `Frontend/`, and `Contracts/` reality.',
      'Reduce onboarding time: `{path}` should answer "how do I run wallet + trade flow locally?"',
      'Link `{path}` to ADR 0001 and phase roadmap in `PHASES.md` where relevant.',
      'Remove outdated implementation claims in `{path}` that contradict the codebase.',
    ],
    ac: [
      'Commands in `{path}` verified on a clean checkout',
      'Links resolve and point to existing files',
      'Env vars and ports match `.env.example` files',
      'Phase ownership noted where applicable',
      'Reviewed by a contributor unfamiliar with the repo',
    ],
  },
  infra: {
    verbs: [
      'Add CI job for',
      'Pin toolchain version in',
      'Add cache step for',
      'Configure env matrix in',
      'Add Docker build for',
      'Document deploy path for',
      'Add smoke test post-build for',
      'Wire artifact upload for',
      'Add branch protection rule for',
      'Configure secrets mapping for',
      'Add health probe for',
      'Stabilize pipeline for',
      'Add parallel job for',
      'Document rollback for',
      'Add monitoring hook for',
    ],
    desc: [
      'Infra: `{path}` must be part of reproducible local and CI builds for GateDelay.',
      'Phase 1 CI — ensure `{path}` gates merges on lint/test for its area (Backend, Frontend, or Contracts).',
      'Document how `{path}` maps to staging vs production env vars.',
      'Add smoke verification after build steps involving `{path}`.',
      'Coordinate `{path}` with `Backend/services/upgradeCoordinator.js` for deploy sequencing.',
    ],
    ac: [
      'CI workflow green on PR touching related code',
      'Toolchain versions documented and pinned',
      'Secrets not committed; `.env.example` covers required keys',
      'Rollback or retry documented for deploy steps',
      'Smoke test passes after build',
    ],
  },
  security: {
    verbs: [
      'Audit access control in',
      'Review rate limits for',
      'Add input validation to',
      'Document threat model for',
      'Review reentrancy surface in',
      'Harden auth flow in',
      'Add circuit breaker check for',
      'Pen-test endpoint behind',
      'Review secrets exposure in',
      'Add audit log for',
      'Fuzz abuse path in',
      'Review oracle trust in',
      'Add slippage bounds in',
      'Review CORS policy for',
      'Add beta gate check in',
    ],
    desc: [
      'Security: review `{path}` for auth bypass, injection, rate-limit gaps, and secret leakage before public beta.',
      'Phase 1 security baseline — `{path}` must not expose admin routes or keys without guards.',
      'Align `{path}` with `Backend/src/rate-limiter/` and `Contracts/src/RateLimiter.sol` policies.',
      'Document trust assumptions for `{path}` (oracles, multisig, beta access).',
      'Add negative-path tests for abuse scenarios involving `{path}`.',
    ],
    ac: [
      'Security review completed with no critical findings',
      'Rate limits or access guards verified',
      'No secrets or private keys in `{path}`',
      'Negative-path test or checklist item added',
      'Threat notes recorded in docs or inline comments',
    ],
  },
};

/** Phase-specific verb/desc/ac overrides layered on area templates. */
const PHASE_AREA_OVERRIDES = {
  2: {
    frontend: {
      verbs: [
        'Wire trade UI to API in',
        'Replace mock market data in',
        'Connect WebSocket prices in',
        'Map contract events to UI in',
        'Bridge order placement in',
        'Display live order book in',
        'Sync position state in',
        'Add resolution status to',
        'Connect wallet signing in',
        'Surface trade errors in',
      ],
      desc: [
        'Phase 2 wiring: `{path}` must consume live backend/chain data instead of `Frontend/data/mockMarkets.ts`.',
      ],
    },
    backend: {
      verbs: [
        'Wire MarketFactory events to',
        'Index on-chain logs in',
        'Expose REST endpoint in',
        'Add WebSocket feed in',
        'Sync market state in',
        'Map contract ABI in',
        'Implement settlement hook in',
        'Decode Trading events in',
        'Connect AviationStack to',
        'Add order placement through',
      ],
    },
    contracts: {
      verbs: [
        'Wire MarketFactory to',
        'Connect LMSR pricing in',
        'Integrate Trading.sol with',
        'Resolve LMSR vs CLOB in',
        'Emit settlement events from',
        'Add Foundry integration test for',
        'Deploy script update for',
        'Add market lifecycle to',
        'Bridge PositionTracker in',
        'Verify Resolution flow in',
      ],
    },
  },
  3: {
    frontend: {
      verbs: [
        'Polish UX in',
        'Add empty-state UI to',
        'Implement responsive layout for',
        'Add loading skeleton to',
        'Wire notifications in',
        'Add accessibility pass on',
        'Complete form validation in',
        'Implement search/filter in',
        'Add pagination to',
        'Finish referral UI in',
      ],
    },
  },
  4: {
    security: {
      verbs: [
        'Fuzz test',
        'Add reentrancy review for',
        'Stress test rate limiter in',
        'Expand negative tests in',
        'Add chaos scenario for',
        'Review gas griefing in',
        'Add monitoring alert for',
        'Pen-test auth on',
        'Review multisig policy in',
        'Add circuit breaker test for',
      ],
    },
  },
  5: {
    infra: {
      verbs: [
        'Configure staging deploy for',
        'Add production deploy for',
        'Add contract verify step for',
        'Configure CDN for',
        'Add canary deploy for',
        'Finalize env matrix for',
        'Add migration runbook for',
        'Configure monitoring dashboard for',
        'Add beta access gate to',
        'Ship release notes for',
      ],
    },
  },
};

const SKIP_DIRS = new Set([
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

const DOC_EXT = /\.(md|txt)$/i;
const CODE_EXT = /\.(ts|tsx|js|jsx|sol|json|mts|mjs|yml|yaml)$/i;

function walk(dir, prefix, out) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      walk(full, rel, out);
    } else if (DOC_EXT.test(e.name) || CODE_EXT.test(e.name)) {
      out.push(rel.replace(/\\/g, '/'));
    }
  }
}

function isSecurityPath(p) {
  return /(?:rate[-_]?limit|circuit[-_]?breaker|auth|access[-_]?control|pausable|multisig|whitelist|blacklist|flash[-_]?loan|beta[-_]?access|guard|security|audit|emergency|role[-_]?manager|verification)/i.test(
    p,
  );
}

function isInfraPath(p) {
  return (
    p.startsWith('.github/') ||
    /(?:Dockerfile|docker-compose|\.env\.example|deploy|ci\.yml|workflows\/|package\.json|package-lock\.json|tsconfig|foundry\.toml|hardhat\.config)/i.test(
      p,
    )
  );
}

function isDocPath(p) {
  return DOC_EXT.test(p) && !p.includes('node_modules');
}

function collectPathsByArea() {
  const all = [];
  walk(path.join(ROOT, 'Backend'), 'Backend', all);
  walk(path.join(ROOT, 'Frontend'), 'Frontend', all);
  walk(path.join(ROOT, 'Contracts'), 'Contracts', all);
  walk(path.join(ROOT, 'test'), 'test', all);
  if (fs.existsSync(path.join(ROOT, '.github'))) {
    walk(path.join(ROOT, '.github'), '.github', all);
  }
  if (fs.existsSync(path.join(ROOT, 'docs'))) {
    walk(path.join(ROOT, 'docs'), 'docs', all);
  }

  // Root-level docs and infra
  for (const name of fs.readdirSync(ROOT)) {
    const full = path.join(ROOT, name);
    if (!fs.statSync(full).isFile()) continue;
    if (DOC_EXT.test(name) || CODE_EXT.test(name)) {
      all.push(name.replace(/\\/g, '/'));
    }
  }

  const seed = [
    'Backend/server.js',
    'Backend/package.json',
    'Backend/.env.example',
    'Backend/src/trade-engine/trade-engine.service.ts',
    'Backend/src/rate-limiter/rate-limiter.service.ts',
    'Backend/src/websocket/price.gateway.ts',
    'Backend/src/resolution/resolution.service.ts',
    'Backend/routes/beta.js',
    'Backend/services/upgradeCoordinator.js',
    'Backend/services/betaAccess.js',
    'Frontend/components/wallet/ConnectModal.tsx',
    'Frontend/components/market/MarketCard.tsx',
    'Frontend/data/mockMarkets.ts',
    'Frontend/lib/walletDetection.ts',
    'Frontend/app/trade/[id]/page.tsx',
    'Frontend/hooks/useWebSocket.ts',
    'Contracts/src/LMSR.sol',
    'Contracts/src/MarketMaker.sol',
    'Contracts/src/MarketFactory.sol',
    'Contracts/src/Trading.sol',
    'Contracts/contracts/OrderBook.sol',
    'Contracts/src/Resolution.sol',
    'Contracts/src/RateLimiter.sol',
    'Contracts/foundry.toml',
    'test/MintingPausable.t.sol',
    'test/CircuitBreaker.t.sol',
    'test/RateLimiter.t.sol',
    'README.md',
    'PHASES.md',
    'MINTING_PAUSABLE_IMPLEMENTATION.md',
    'RATE_LIMITER_IMPLEMENTATION.md',
    'docs/adr/0001-lmsr-vs-clob-ambiguity.md',
    '.github/workflows/ci.yml',
    'Contracts/.github/workflows/test.yml',
  ];

  const set = new Set([...all, ...seed]);
  const paths = [...set].sort();

  const buckets = {
    frontend: [],
    backend: [],
    contracts: [],
    docs: [],
    infra: [],
    security: [],
  };

  for (const p of paths) {
    if (p.startsWith('Frontend/')) buckets.frontend.push(p);
    else if (p.startsWith('Backend/')) buckets.backend.push(p);
    else if (p.startsWith('Contracts/') || p.startsWith('test/')) buckets.contracts.push(p);
    else if (isDocPath(p) || p.startsWith('docs/')) buckets.docs.push(p);
    else if (isInfraPath(p)) buckets.infra.push(p);

    if (isSecurityPath(p)) buckets.security.push(p);
  }

  // Ensure security/infra/docs buckets have enough entries
  const securityFallback = [
    'Backend/src/rate-limiter/rate-limiter.service.ts',
    'Backend/routes/beta.js',
    'Backend/services/betaAccess.js',
    'Contracts/src/RateLimiter.sol',
    'Contracts/RoleManager.sol',
    'Contracts/FlashLoanProtection.sol',
    'test/CircuitBreaker.t.sol',
    'test/RateLimiter.t.sol',
    'test/FlashLoanProtection.t.sol',
    'Frontend/components/api/RateLimiter.tsx',
    'Frontend/components/wallet/EmergencyWithdrawal.tsx',
  ];
  const infraFallback = [
    '.github/workflows/ci.yml',
    'Contracts/.github/workflows/test.yml',
    'Backend/package.json',
    'Frontend/package.json',
    'Backend/.env.example',
    'Contracts/foundry.toml',
    'Backend/services/upgradeCoordinator.js',
    'Backend/jobs/upgradeManager.js',
  ];
  const docsFallback = [
    'README.md',
    'PHASES.md',
    'RELEASE_NOTES.md',
    'RATE_LIMITER_IMPLEMENTATION.md',
    'MINTING_PAUSABLE_IMPLEMENTATION.md',
    'Frontend/README.md',
    'docs/adr/0001-lmsr-vs-clob-ambiguity.md',
  ];

  for (const p of securityFallback) {
    if (!buckets.security.includes(p)) buckets.security.push(p);
  }
  for (const p of infraFallback) {
    if (!buckets.infra.includes(p)) buckets.infra.push(p);
  }
  for (const p of docsFallback) {
    if (!buckets.docs.includes(p)) buckets.docs.push(p);
  }

  // Backfill thin buckets from related areas
  for (const area of AREAS) {
    buckets[area].sort();
    if (buckets[area].length < 40) {
      const donor =
        area === 'docs'
          ? paths.filter(isDocPath)
          : area === 'infra'
            ? paths.filter(isInfraPath)
            : area === 'security'
              ? paths.filter(isSecurityPath)
              : paths.filter((p) => p.startsWith(area === 'contracts' ? 'Contracts' : area === 'frontend' ? 'Frontend' : 'Backend'));
      for (const p of donor) {
        if (!buckets[area].includes(p)) buckets[area].push(p);
      }
      buckets[area].sort();
    }
  }

  return buckets;
}

function allocateAreaCounts(phaseNum, total) {
  const weights = PHASE_AREA_WEIGHTS[phaseNum];
  const minEach = Math.ceil(total * MIN_AREA_PCT);
  const counts = {};
  let assigned = 0;

  for (const area of AREAS) {
    counts[area] = minEach;
    assigned += minEach;
  }

  let remaining = total - assigned;
  const extraWeights = AREAS.map((a) => ({ area: a, w: Math.max(0, weights[a] - MIN_AREA_PCT) }));
  const weightSum = extraWeights.reduce((s, x) => s + x.w, 0) || 1;

  for (const { area, w } of extraWeights) {
    const extra = Math.floor(remaining * (w / weightSum));
    counts[area] += extra;
  }

  assigned = AREAS.reduce((s, a) => s + counts[a], 0);
  let i = 0;
  while (assigned < total) {
    const area = AREAS[i % AREAS.length];
    counts[area]++;
    assigned++;
    i++;
  }

  return counts;
}

function pick(arr, i) {
  return arr[i % arr.length];
}

function basename(p) {
  return path.basename(p);
}

function templatesFor(phase, area) {
  const base = AREA_TEMPLATES[area];
  const override = PHASE_AREA_OVERRIDES[phase]?.[area] || {};
  return {
    verbs: override.verbs ? [...override.verbs, ...base.verbs] : base.verbs,
    desc: override.desc ? [...override.desc, ...base.desc] : base.desc,
    ac: base.ac,
  };
}

function issueBlock(phase, index, area, filePath) {
  const id = String(index).padStart(3, '0');
  const tpl = templatesFor(phase, area);
  const verb = pick(tpl.verbs, index + phase);
  const title = `${verb} ${basename(filePath)}`;
  const desc = pick(tpl.desc, index + phase)
    .replace(/\{path\}/g, filePath)
    .replace('Phase 1', `Phase ${phase}`);
  const ac1 = pick(tpl.ac, index).replace(/\{path\}/g, filePath);
  const ac2 = pick(tpl.ac, index + 1).replace(/\{path\}/g, filePath);
  const ac3 = pick(tpl.ac, index + 2).replace(/\{path\}/g, filePath);

  const phaseContext =
    phase === 1
      ? 'stabilize foundations'
      : phase === 2
        ? 'core market wiring'
        : phase === 3
          ? 'product complete'
          : phase === 4
            ? 'hardening'
            : 'deployment & shipping';

  return [
    `### P${phase}-${id}: ${title}`,
    `**Labels:** \`phase-${phase}\`, \`${area}\``,
    `**Description:** ${desc} _(Phase ${phase}: ${phaseContext}.)_`,
    `**Acceptance criteria:**`,
    `- [ ] ${ac1}`,
    `- [ ] ${ac2}`,
    `- [ ] ${ac3}`,
    `**Related:** \`${filePath}\``,
    '',
  ].join('\n');
}

function buildIssueList(phaseNum, buckets) {
  const counts = allocateAreaCounts(phaseNum, ISSUES_PER_PHASE);
  const issues = [];

  for (const area of AREAS) {
    const pool = buckets[area];
    const n = counts[area];
    for (let j = 0; j < n; j++) {
      const filePath = pool[j % pool.length];
      issues.push({ area, filePath, sortKey: j * AREAS.length + AREAS.indexOf(area) });
    }
  }

  // Interleave areas so the file reads balanced (not all backend then all frontend)
  issues.sort((a, b) => a.sortKey - b.sortKey);

  return { issues, counts };
}

function generatePhaseFile(phaseNum, buckets) {
  const meta = PHASE_META[phaseNum - 1];
  const { issues, counts } = buildIssueList(phaseNum, buckets);

  const distLine = AREAS.map((a) => `${a} ${counts[a]}`).join(', ');

  const lines = [
    `# Phase ${phaseNum}: ${meta.theme}`,
    '',
    `> **Theme:** ${meta.theme}`,
    `> **Goal:** ${meta.summary}`,
    '',
    `> **Area distribution:** ${distLine} (${issues.length} issues)`,
    '',
    `Parent index: [PHASES.md](PHASES.md)`,
    '',
    `---`,
    '',
    `## Issues (${issues.length} tracked)`,
    '',
    `Copy any issue below into GitHub using the template in [PHASES.md](PHASES.md#filing-github-issues).`,
    'Issues span frontend, backend, contracts, docs, infra, and security within this phase theme.',
    '',
  ];

  issues.forEach((item, idx) => {
    lines.push(issueBlock(phaseNum, idx + 1, item.area, item.filePath));
  });

  return { content: lines.join('\n'), counts };
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
    '## Area distribution',
    '',
    'Each phase file balances issues across **six area labels** (minimum ~15% per area, adjusted by phase focus):',
    '',
    '| Area label | Typical paths | Phase emphasis |',
    '|------------|---------------|----------------|',
    '| `frontend` | `Frontend/app/`, components, hooks, wallet UI | P3 product surfaces; P2 wiring |',
    '| `backend` | `Backend/src/` Nest modules, `Backend/server.js` | P2 market engine; P1 boot stability |',
    '| `contracts` | `Contracts/src/`, `Contracts/test/`, root `test/*.t.sol` | P2 on-chain wiring; P4 fuzz/guards |',
    '| `docs` | `README.md`, `PHASES.md`, implementation MDs, ADRs | P1 onboarding; P3 feature docs |',
    '| `infra` | `.github/workflows/`, `package.json`, `.env.example`, deploy | P1 CI; P5 staging/prod deploy |',
    '| `security` | rate limiter, auth, circuit breaker, beta access, audits | P4 hardening; cross-cutting in all phases |',
    '',
    'Regenerate with `bun _gen_phases.js` — the generator interleaves areas within each phase file.',
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
    '| `frontend` | `Frontend/` Next.js UI, hooks, components |',
    '| `backend` | `Backend/` NestJS, Express, workers, migrations |',
    '| `contracts` | `Contracts/`, `test/*.t.sol` Foundry |',
    '| `docs` | README, ADRs, contributor docs |',
    '| `infra` | CI/CD, Docker, env, deploy, monitoring |',
    '| `security` | Auth, rate limiting, circuit breaker, audits |',
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
    '4. Set the title to the `###` heading text (e.g. `P2-042: Wire MarketFactory to MarketFactory.sol`).',
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
    'bun _gen_phases.js',
    '```',
    '',
    'On Windows without Bun: `powershell -ExecutionPolicy Bypass -File _gen_phases.ps1` (delegates to this script when Bun is available).',
    '',
    'Generator scans `Backend/`, `Frontend/`, `Contracts/`, `test/`, `.github/`, and root docs for real paths, then allocates ≥15% of each phase to every area label.',
    '',
  ].join('\n');
}

function countLabelsInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const stats = { issues: 0 };
  for (const area of AREAS) stats[area] = 0;
  stats.issues = (content.match(/### P\d+-\d+/g) || []).length;
  for (const area of AREAS) {
    stats[area] = (content.match(new RegExp('`' + area + '`', 'g')) || []).length;
  }
  return stats;
}

function main() {
  const buckets = collectPathsByArea();
  console.log('Path pools by area:');
  for (const area of AREAS) {
    console.log(`  ${area}: ${buckets[area].length} paths`);
  }

  fs.writeFileSync(path.join(ROOT, 'PHASES.md'), generatePhasesIndex(), 'utf8');
  console.log('Wrote PHASES.md');

  const allStats = {};
  for (let p = 1; p <= 5; p++) {
    const fname = `PHASE_${p}.md`;
    const { content, counts } = generatePhaseFile(p, buckets);
    fs.writeFileSync(path.join(ROOT, fname), content, 'utf8');
    allStats[p] = { allocated: counts, actual: countLabelsInFile(path.join(ROOT, fname)) };
    console.log(`Wrote ${fname} — ${JSON.stringify(counts)}`);
  }

  console.log('\nLabel distribution (actual):');
  for (let p = 1; p <= 5; p++) {
    const s = allStats[p].actual;
    console.log(
      `  P${p}: total=${s.issues} ` +
        AREAS.map((a) => `${a}=${s[a]} (${((s[a] / s.issues) * 100).toFixed(1)}%)`).join(' '),
    );
  }
}

main();

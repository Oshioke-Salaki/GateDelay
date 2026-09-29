# Repository structure

GateDelay is organized as a three-part application:

- `Contracts/` contains the Foundry Solidity project. Its source files live in `Contracts/src`, with tests in `Contracts/test` and CI-focused tests in `Contracts/test-ci`.
- `Backend/` contains the Node backend. The current primary app is NestJS under `Backend/src`; legacy Express-style routes and services remain at package root until they are migrated or retired.
- `Frontend/` contains the Next.js app. The main route tree lives under `Frontend/app`; `Frontend/pages` should be treated as legacy unless a page explicitly needs the Pages Router.

Root-level files are reserved for repo orchestration, shared documentation, and cross-package configuration.

## Supporting folders

- `docs/` stores durable documentation and architecture notes.
- `docs/reports/` stores generated implementation reports, verification notes, phase files, and delivery summaries that should not crowd the project root.
- `tools/` stores repository maintenance scripts.

## Common commands

Run package commands from the repository root:

```sh
npm run backend:test
npm run frontend:typecheck
npm run contracts:test
```

Run package-specific commands inside their package folders when working on one subsystem:

```sh
cd Backend && npm test
cd Frontend && npm run build
cd Contracts && forge test
```

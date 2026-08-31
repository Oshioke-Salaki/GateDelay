# GateDelay Localnet (Hardhat)

Reproducible local dev + CI network for GateDelay. Everything lives under
`Frontend/localnet`: the Hardhat configuration, mock contracts, and deploy
scripts.

## Requirements

- Node.js `>= 20.11.0`, npm `>= 10.8.2` (see `package.json`)
- No external RPC, wallet, or DB needed — the Hardhat node is local.

## Local runbook

```bash
cd Frontend/localnet
npm install

# Terminal 1 — start the local chain on http://127.0.0.1:8545
npm run node

# Terminal 2 — deploy the mock contracts onto the running node
npm run deploy

# Terminal 3 — probe node liveness against the URL in hardhat.config.js
npm run health
```

`npm run health` runs the `health-check` Hardhat task
(`Frontend/localnet/hardhat.config.js`). It prints the reachable chainId and
latest block, and exits non-zero when the node is down:

```bash
[health-check] http://127.0.0.1:8545 reachable (chainId=31337, block=5)
```

The same probe is available as a plain Node script
(`scripts/healthCheck.js`) that does not require Hardhat:

```bash
node scripts/healthCheck.js
node scripts/healthCheck.js http://127.0.0.1:8546
```

## CI reproducibility

The `localnet` job in `.github/workflows/ci.yml` runs:

```bash
npm run lint   # hardhat compile
npm test       # hardhat test  (includes test/health.test.js)
```

`test/health.test.js` is the post-build smoke suite. It asserts the
`localhost` network URL is the documented `http://127.0.0.1:8545`, that the
in-process provider answers chain probes, and that the mock contracts boot
after a build — with no external node required, so the check is green in CI.

Run the smoke suite locally with:

```bash
npm run test:smoke
```

## Deploy retry and rollback

The deploy target is an in-memory Hardhat node, so state resets when the node
is restarted. There is nothing on-chain to keep or migrate.

- **Retry**: if `npm run deploy` fails, confirm the node is up with
  `npm run health`, then re-run `npm run deploy`. Deploys are idempotent to a
  freshly started node; on a long-lived node, restart it first so the
  nonce/address space is clean. The deploy script prints a sample `markets.json`
  snippet to copy into the frontend mocks, so a re-run just regenerates that.
- **Rollback**: stop the node (`Ctrl+C` on `npm run node`), start it again,
  and re-run `npm run deploy`. Because addresses are derived from the deployer
  nonce, restarting the node returns the exact same contract addresses,
  making the local environment fully reproducible.
- **Health gate**: run `npm run health` between deploy steps. If it reports
  `UNREACHABLE`, do not proceed — start the node first.

## Related files

- `hardhat.config.js` — compiler version, `localhost` network URL, `health-check` task
- `contracts/MockERC20.sol`, `contracts/MockRouter.sol` — mock contracts
- `scripts/deploy.js` — deploy routine used by `npm run deploy`
- `scripts/healthCheck.js` — standalone RPC probe
- `test/health.test.js` — post-build smoke tests (`npm run test:smoke`)
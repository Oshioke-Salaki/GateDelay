# GateDelay Contracts

Foundry project for GateDelay smart contracts.

## Layout (single source of truth)

| Path | Purpose |
|------|---------|
| `src/` | **All production contracts** (Foundry `src` root) |
| `test/` | Forge tests |
| `script/` | Deploy scripts |
| `lib/` | Dependencies (OpenZeppelin, forge-std, prb-math) |

Former `Contracts/contracts/`, root-level `contracts/` (Burnable, FlashLoanProtection, Liquidation, MarketMinter, RoleManager), and any `Contracts/*.sol` at the package root were consolidated into `src/`. Do not add new production contracts outside `src/`.

## Documentation

https://book.getfoundry.sh/

## Usage

### Build

```shell
$ forge build
```

### FeeHandler build notes

The `FeeHandler` contract at `src/FeeHandler.sol` was verified with the current Foundry toolchain in this repository:

- Verified Foundry version: `forge 1.1.0` (pinned in `foundry.toml` and CI)
- Compiler configuration: `solc = "0.8.28"` in `foundry.toml`
- Contract target: `src/FeeHandler.sol`
- Verified build command from the `Contracts/` directory:

```shell
$ forge build src/FeeHandler.sol
```

**Constructor and deploy requirements**

- Constructor takes **no arguments**; `Ownable(msg.sender)` makes the deployer the owner.
- Register fee structures with `setFeeStructure(bytes32 id, uint256 feeBps, FeeRecipient[] recipients)` after deployment. Recipients must sum to 10_000 bps.
- Requires `PRIVATE_KEY` when deploying via Foundry script. No Backend ABI wiring exists yet (Phase 2).

### Deploy scripts (Phase 2 core market wiring)

Production contracts live under `src/`. Copy `.env.example` to `.env` and set
real values before broadcasting. `PRIVATE_KEY` must be a funded deployer key;
never commit `.env` or paste production secrets into logs.

| Deploy | Script | Constructor args / setup | Required env vars |
|--------|--------|--------------------------|-------------------|
| `RoleManager` | `script/DeployRoleManager.s.sol:DeployRoleManager` | None; deployer receives `DEFAULT_ADMIN_ROLE` | `PRIVATE_KEY` |
| `FeeHandler` | `script/DeployFeeHandler.s.sol:DeployFeeHandler` | None; deployer becomes owner | `PRIVATE_KEY` |
| `CircuitBreaker` | `script/DeployCircuitBreaker.s.sol:DeployCircuitBreaker` | None; deployer receives admin, breaker, and monitor roles | `PRIVATE_KEY` |
| `PositionToken` + `MarketFactory` | `script/DeployMarketFactory.s.sol:DeployMarketFactory` | Script predicts the factory CREATE address to bind the token to its factory | `PRIVATE_KEY` |
| `MarketMaker` + `Trading` | `script/DeployCoreMarket.s.sol:DeployCoreMarket` | Collateral address; fee/rebate basis points; commission recipient | `PRIVATE_KEY`, `COLLATERAL_TOKEN_ADDRESS`, `TRADING_FEE_BPS`, `TRADING_REBATE_BPS`, `COMMISSION_RECIPIENT` |
| `MarketCap` | `script/DeployMarketCap.s.sol:DeployMarketCap` | None | `PRIVATE_KEY` |
| `MarketMinter` | `script/DeployMarketMinter.s.sol:DeployMarketMinter` | Existing token address | `PRIVATE_KEY`, `TOKEN_ADDRESS` |

Run from `Contracts/` in PowerShell after setting the environment from `.env`:

```powershell
$env:PRIVATE_KEY = "0xYOUR_FUNDED_DEPLOYER_KEY"
$env:RPC_URL = "https://YOUR_NETWORK_RPC_URL"
$env:COLLATERAL_TOKEN_ADDRESS = "0xYOUR_COLLATERAL_TOKEN_ADDRESS"
$env:TRADING_FEE_BPS = "30"
$env:TRADING_REBATE_BPS = "0"
$env:COMMISSION_RECIPIENT = "0xYOUR_COMMISSION_RECIPIENT_ADDRESS"

forge script script/DeployRoleManager.s.sol:DeployRoleManager --rpc-url $env:RPC_URL --broadcast
forge script script/DeployFeeHandler.s.sol:DeployFeeHandler --rpc-url $env:RPC_URL --broadcast
forge script script/DeployCircuitBreaker.s.sol:DeployCircuitBreaker --rpc-url $env:RPC_URL --broadcast
forge script script/DeployMarketFactory.s.sol:DeployMarketFactory --rpc-url $env:RPC_URL --broadcast
forge script script/DeployCoreMarket.s.sol:DeployCoreMarket --rpc-url $env:RPC_URL --broadcast
forge script script/DeployMarketCap.s.sol:DeployMarketCap --rpc-url $env:RPC_URL --broadcast
$env:TOKEN_ADDRESS = "0xYOUR_TOKEN_ADDRESS"
forge script script/DeployMarketMinter.s.sol:DeployMarketMinter --rpc-url $env:RPC_URL --broadcast
```

Each script logs deployed addresses and constructor configuration. With
`--broadcast`, Foundry writes transaction and deployment-address records to
`broadcast/<ScriptName>.s.sol/<chain-id>/run-latest.json`; compiled ABI and
bytecode artifacts are written to `out/<Contract>.sol/<Contract>.json`. Retain
the chain-specific broadcast record as the deployment output; do not rely on
console output alone.

`DeployMarketFactory` deploys `PositionToken` first, then `MarketFactory` at
the predicted next deployer nonce because the constructors bind to each
other's addresses. Do not insert another deploy transaction into that script
without updating the nonce prediction. `DeployCoreMarket` expects an already
deployed ERC-20 collateral token. `LMSR` is a library linked into
`MarketMaker`; it is not separately deployed. `Trading.executeSell` currently
uses a buy-cost proxy for proceeds, so do not use that wrapper for production
sells until the contract logic is corrected and tested.

The `PositionToken`/`MarketFactory` pair is a separate market-registry stack;
it does not currently create or configure markets in the LMSR
`MarketMaker`/`Trading` stack. Deploying both does not connect their state.

The Backend reads deployed addresses from its own configuration (for example,
`MARKET_CONTRACT_ADDRESS` and chain-specific `*_MARKET_ADDRESS` entries); copy
the confirmed addresses from the broadcast record only after deployment.

> **Import paths:** all production sources import via Foundry remappings (`@openzeppelin/contracts`, `@prb/math`, `forge-std`). Do not add new contracts outside `src/`; legacy `contracts/` paths in older docs are stale.

Dependencies are pulled from the repository's Foundry library remappings (`@openzeppelin/contracts`, `forge-std`, and `@prb/math`). When they are missing, `forge build` will prompt to install them; no additional contract behavior changes were required.

Known blocker: the repository currently has unrelated Solidity parsing issues in other contracts/tests, so a full `forge build` is not a reliable signal for the `FeeHandler` path. For this Phase 1 stabilization work, the verified build path for `FeeHandler` is the targeted command above.

### RoleManager build and deploy notes

`src/RoleManager.sol` is registry-backed access control on top of OpenZeppelin
`AccessControlEnumerable` (v5.x, `lib/openzeppelin-contracts`).

Verify with:

```shell
$ ./verify_rolemanager.sh
```

Verified with `forge 1.7.1` / `solc 0.8.28`: build succeeds, `forge fmt --check`
is clean, and `test/RoleManager.t.sol` passes 27 tests (25 unit + 2 fuzz cases at
256 runs each).

Why a script rather than a bare `forge test`: as noted for `FeeHandler` above,
Foundry compiles the entire tree before running anything, and roughly two dozen
unrelated files in `src/` and `test/` currently have parse and type errors. That
makes a repo-wide `forge build` or `forge test --match-contract` fail regardless
of the state of this contract. `verify_rolemanager.sh` copies
`src/RoleManager.sol` and `test/RoleManager.t.sol` into a temporary workspace
with the same solc settings and the repo's own `lib/`, so a pass is a real
signal for this contract. Requires submodules:
`git submodule update --init --recursive`.

**Constructor and deploy requirements**

- The constructor takes **no arguments** and grants `DEFAULT_ADMIN_ROLE` to
  `msg.sender`. The deploying account is therefore the sole admin. Deploying from
  a script or factory makes *that contract* the admin, not the EOA behind it —
  hand admin over explicitly if that is not what you want.
- `DEFAULT_ADMIN_ROLE` is registered in the role set at construction, so a
  co-admin can be appointed with `assignRole(0x00, newAdmin)`. Do that **before**
  any admin renounces; there is no other recovery path and no timelock.
- A role must be registered with `createRole` before `assignRole` will hand it
  out. This is deliberate: an unregistered (e.g. mistyped) `bytes32` can never
  become a live privileged role.
- `grantRole` is disabled and always reverts with `RoleManager: use assignRole`.
  Integrators written against stock `AccessControl` must be updated. `revokeRole`
  keeps its usual signature but is gated on `DEFAULT_ADMIN_ROLE`.
- `renounceRole` behaves as OpenZeppelin defines it and keeps `getRoles` in sync.

Full API notes live in the NatSpec on the contract itself.

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy

```shell
$ forge script script/<DeployScript>.s.sol --rpc-url <your_rpc_url> --private-key <your_private_key>
```

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```

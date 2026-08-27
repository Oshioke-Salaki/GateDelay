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

### Deploy order (Phase 2 core market wiring)

Production contracts live under `src/`. Deploy in dependency order when wiring a fresh stack:

| Order | Contract | Script | Constructor args | Env vars |
|-------|----------|--------|------------------|----------|
| 1 | `RoleManager` | manual / custom | none — admin is `msg.sender` | `PRIVATE_KEY` |
| 2 | `FeeHandler` | manual / custom | none — owner is `msg.sender` | `PRIVATE_KEY` |
| 3 | `MarketCap` | `script/DeployMarketCap.s.sol` | none — owner is `msg.sender` | `PRIVATE_KEY` |
| 4 | `MarketMinter` | `script/DeployMarketMinter.s.sol` | `address tokenAddress` | `PRIVATE_KEY`, `TOKEN_ADDRESS` |
| 5 | `CircuitBreaker` | manual / custom | none — admin/breaker/monitor granted to `msg.sender` | `PRIVATE_KEY` |

Run from `Contracts/`:

```shell
$ export PRIVATE_KEY=0x...
$ export TOKEN_ADDRESS=0x...   # MarketMinter only
$ forge script script/DeployMarketCap.s.sol:DeployMarketCap --rpc-url $RPC_URL --broadcast
$ forge script script/DeployMarketMinter.s.sol:DeployMarketMinter --rpc-url $RPC_URL --broadcast
```

ABI artifacts land in `Contracts/out/<Contract>.sol/<Contract>.json`. The Backend reads deployed addresses from `Backend/.env.example` keys such as `MARKET_CONTRACT_ADDRESS` and chain-specific `*_MARKET_ADDRESS` entries — wire those after broadcast, not before.

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

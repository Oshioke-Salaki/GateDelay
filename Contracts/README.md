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

The `FeeHandler` contract at `contracts/FeeHandler.sol` was verified with the current Foundry toolchain in this repository:

- Verified Foundry version: `forge 1.7.1`
- Compiler configuration: `solc = "0.8.28"` in `foundry.toml`
- Contract target: `contracts/FeeHandler.sol`
- Verified build command from the `Contracts/` directory:

```shell
$ forge build contracts/FeeHandler.sol
```

Dependencies are pulled from the repository's Foundry library remappings (`@openzeppelin/contracts`, `forge-std`, and `@prb/math`). When they are missing, `forge build` will prompt to install them; no additional contract behavior changes were required.

Known blocker: the repository currently has unrelated Solidity parsing issues in other contracts/tests, so a full `forge build` is not a reliable signal for the `FeeHandler` path. For this Phase 1 stabilization work, the verified build path for `FeeHandler` is the targeted command above.

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

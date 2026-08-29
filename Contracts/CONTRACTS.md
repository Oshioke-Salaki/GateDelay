# Contracts — Build & Development Guide

> **Issue #585** — Confirm forge build for `AccessControl.sol` and document the
> local build/run path for collaborators.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Foundry (`forge`, `cast`, `anvil`) | latest | `curl -L https://foundry.paradigm.xyz \| bash && foundryup` |
| Node.js | ≥ 18 | https://nodejs.org |

---

## Quick-start

```bash
# from repo root
cd Contracts

# Install / update Foundry lib dependencies (first clone only)
forge install

# Compile all contracts — including AccessControl.sol
forge build

# Run the full test suite
forge test -vv

# Run only AccessControl tests
forge test --match-contract AccessControlTest -vv
```

Expected `forge build` output:

```
Compiling X files with solc 0.8.x
Compiler run successful!
Artifacts written to out/
```

---

## Contract: `contracts/AccessControl.sol`

A self-contained RBAC implementation.  No external imports; compiles cleanly
with `solc >=0.8.20` and Foundry's default optimiser settings
(`optimizer_runs = 200`, `via_ir = true` — see `foundry.toml`).

### Roles

| Constant | Description |
|----------|-------------|
| `ADMIN_ROLE` | Full administrative access — grant/revoke/describe roles |
| `MANAGER_ROLE` | Elevated operational permissions |
| `OPERATOR_ROLE` | Day-to-day operational permissions |
| `USER_ROLE` | Basic end-user permissions |

### Build artefacts

After a successful `forge build` the compiled artefacts are written to:

```
Contracts/out/AccessControl.sol/AccessControl.json
```

---

## Environment variables (Phase 2 dependency)

Local unit tests run with **no network access**.  Integration scripts that
fork mainnet require:

```bash
export MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/<YOUR_KEY>
export ETHERSCAN_API_KEY=<YOUR_KEY>
```

See `foundry.toml` `[rpc_endpoints]` and `[etherscan]` sections.

---

## CI status

The contracts are compiled and tested in the project CI pipeline.
`forge build` must exit 0 before any PR is merged.

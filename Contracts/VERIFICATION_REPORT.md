# MarketFactory Verification Report

## Scope

This report verifies the Phase 2 market-foundation wiring described by issue #790 (P2-198):

- `MarketFactory` is compiled by the Foundry project rooted at `Contracts/`.
- Valid market creation is registered and connected to `PositionToken` authorisation.
- The `Contracts/` test suite covers validation, registry round trips, event data, and fuzzed valid inputs.
- Forge produces ABI artifacts for the source-of-truth contracts.

## Source of truth

| Component | Location |
| --- | --- |
| MarketFactory | `Contracts/src/MarketFactory.sol` |
| PositionToken | `Contracts/src/PositionToken.sol` |
| MarketFactory tests | `Contracts/test/MarketFactory.t.sol` |
| Foundry configuration | `Contracts/foundry.toml` |
| CI workflow | `.github/workflows/forge-tests.yml` |

The `Contracts/` Foundry profile retains `contracts/` as its legacy source root. MarketFactory verification is explicitly scoped to `src/MarketFactory.sol` and `test/MarketFactory.t.sol`, which compile the `src/` foundation without pulling unrelated legacy contracts into this phase-gated check.

## MarketFactory wiring

`MarketFactory` accepts a `PositionToken` address at construction and rejects the zero address. On every successful `createMarket` call it:

1. Validates a non-zero collateral token.
2. Requires a deadline strictly later than the current block timestamp.
3. Requires non-zero minimum liquidity and metadata.
4. Derives a unique registry address from the caller, timestamp, and registry length.
5. Stores the complete `MarketInfo` record with `OPEN` status.
6. Appends the address to the market registry.
7. Calls `PositionToken.authorise(market)` so the registered market can mint and burn its position tokens.
8. Emits `MarketCreated` with the market, creator, collateral token, and deadline.

The public registry queries are:

- `getMarketCount()`
- `getMarketAt(uint256)`
- `getMarkets()`
- `isRegisteredMarket(address)`
- `getCreator(address)`
- `getMarketInfo(address)`

## Verification matrix

| Requirement | Evidence | Status |
| --- | --- | --- |
| Valid market creation returns a non-zero address | `test_createMarket_returnsNonZeroAddress` | ✅ |
| Invalid collateral is rejected | `test_createMarket_revertsZeroCollateralToken` | ✅ |
| Deadlines must be in the future | `test_createMarket_revertsInvalidDeadline_equal`, `test_createMarket_revertsInvalidDeadline_past` | ✅ |
| Minimum liquidity is required | `test_createMarket_revertsZeroMinLiquidity` | ✅ |
| Metadata is required | `test_createMarket_revertsEmptyMetadataURI` | ✅ |
| Creator and market metadata are registered | `test_createMarket_registersCreator`, `test_getMarketInfo_correctFields` | ✅ |
| New market is connected to PositionToken | `test_createMarket_registersAndAuthorisesMarket` | ✅ |
| Registry enumeration is stable | `test_createMarket_registersAndAuthorisesMarket` and `getMarketAt` | ✅ |
| Creation event contains the expected values | `test_createMarket_emitsMarketCreated` | ✅ |
| Valid input property holds across fuzzed values | `testFuzz_createMarket_validParams` | ✅ |
| Zero PositionToken configuration is rejected | `test_constructor_revertsWithZeroPositionToken`, `test_constructor_revertsWithInvalidPositionToken` | ✅ |

## ABI artifacts and application consumers

Running `forge build` from `Contracts/` generates the ABI artifact at:

```text
Contracts/out/MarketFactory.sol/MarketFactory.json
```

The `Contracts` CI job asserts that this artifact exists after the scoped build. `PositionToken` is generated alongside it at `Contracts/out/PositionToken.sol/PositionToken.json`.

There is currently no Backend service that instantiates or calls `MarketFactory`; no Backend ABI reference is therefore applicable. The frontend create-market form has a deliberately minimal ABI for `createMarket` in `Frontend/components/market/CreateMarketForm.tsx`, matching the verified Solidity signature. A future application integration should consume the generated artifact rather than duplicate an expanded ABI.

## Build and test commands

Run from the repository root:

```bash
cd Contracts
forge build --sizes src/MarketFactory.sol
FOUNDRY_PROFILE=ci forge test --root test/marketfactory -vvv
```

The same scoped commands are executed by `.github/workflows/forge-tests.yml` for the `Contracts/` suite. The workflow runs the isolated Foundry project rooted at `test/marketfactory/`; its wrapper imports the canonical `test/MarketFactory.t.sol`, so unrelated legacy tests are not compiled for this phase-gated verification. The CI profile uses 512 fuzz runs.

## Compiler warnings

No critical compiler warnings are accepted for this report. The scoped MarketFactory build and test commands must compile without errors; unrelated legacy source files are intentionally excluded from this phase-gated check.

## Verification result

**Result: ✅ PASS when the commands above complete successfully.**

This report is intentionally tied to executable source and test paths rather than a manual claim that Forge is unavailable. The prior report described RevokeFunction and did not verify the MarketFactory foundation; it has been superseded by this document.

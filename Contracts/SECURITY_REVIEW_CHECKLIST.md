# Smart Contract Security Review Checklist

Use this checklist before each audit, deployment, or significant code change.
Each section maps to a category of on-chain risk. Mark each item **✅ Pass**,
**❌ Fail**, or **⚠ N/A** and add notes where needed.

---

## 1. Privileged Roles

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1.1 | Every privileged role (`DEFAULT_ADMIN_ROLE`, `MARKET_ADMIN`, `ORACLE_ROLE`, `PAUSER_ROLE`, …) is registered via `RoleManager.createRole` before it is assigned | | |
| 1.2 | No role is live that was granted through `AccessControl.grantRole` (which `RoleManager` disables) | | |
| 1.3 | `DEFAULT_ADMIN_ROLE` is held by a multisig or timelock, **not** a bare EOA in production | | |
| 1.4 | There is at least one co-admin before the deployer renounces `DEFAULT_ADMIN_ROLE` | | |
| 1.5 | `getRoles(deployer)` returns the expected set after deployment; no unintended residual roles | | |
| 1.6 | Role assignment events (`RoleAssigned`, `RoleCreated`) are indexed and monitored | | |
| 1.7 | `revokeRole` / `renounceRole` paths keep the per-account role index consistent (covered by `RoleManager._revokeRole` override) | | |
| 1.8 | Contract upgradeability (if any) requires at least two role-holders to approve | | |

---

## 2. Oracle Trust

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 2.1 | Price/data feed contracts (`PriceOracle`, `AutomatedResolver`) validate that reported values are non-zero and within expected bounds | | |
| 2.2 | Stale data detection is implemented: timestamps are checked and a maximum staleness window is enforced | | |
| 2.3 | Oracle updates require a minimum quorum (multi-oracle aggregation or a circuit breaker threshold) | | |
| 2.4 | An oracle-provided value cannot directly move funds in a single transaction without a timelock or dispute window | | |
| 2.5 | Flash-loan manipulation is mitigated: price oracles use TWAPs or are sourced from off-chain aggregators (AviationStack / Chainlink) | | |
| 2.6 | The `ORACLE_ROLE` holder is documented and monitored; key rotation procedure is defined | | |
| 2.7 | Fallback behaviour on oracle failure is explicit: circuit-breaker trips, market pauses, or uses a secondary feed | | |
| 2.8 | `staleOracleData` tests pass (see `Backend/test/staleOracleData.test.js`) | | |

---

## 3. Upgrade Keys and Proxy Authority

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 3.1 | Upgradeable contracts use the UUPS or Transparent proxy pattern from OpenZeppelin; no custom proxy | | |
| 3.2 | `_authorizeUpgrade` is gated on `DEFAULT_ADMIN_ROLE` or an explicit `UPGRADER_ROLE` | | |
| 3.3 | Upgrade transactions go through a timelock with a minimum delay (recommend ≥ 48 hours for production) | | |
| 3.4 | Storage layout is verified across upgrade boundaries: new implementation slots do not collide with existing ones | | |
| 3.5 | Initializer functions use `initializer` / `reinitializer` guards; re-entrancy into `initialize` is blocked | | |
| 3.6 | An upgrade dry-run on a fork is required before mainnet deployment | | |
| 3.7 | `UUPSUpgradeable.t.sol` and `UpgradeAuthorizationFuzz.t.sol` pass without skips | | |
| 3.8 | The upgrade key (multisig address) is recorded in the deployment registry and matches on-chain state | | |

---

## 4. Emergency Controls

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 4.1 | `EmergencyStop` / `CircuitBreaker` / `PausableMarket` contracts are deployed and wired to critical entry points | | |
| 4.2 | The `PAUSER_ROLE` is assigned to an address that can act within minutes (ops automation or on-call account) | | |
| 4.3 | Pausing blocks all fund movement (buy, sell, redeem, withdraw) but **not** read-only views | | |
| 4.4 | A tested runbook exists for activating and deactivating the circuit breaker (`Backend/RUNBOOK.md`) | | |
| 4.5 | `CircuitBreaker` thresholds (volume limits, price-drop %) are documented and tuned for expected liquidity | | |
| 4.6 | Emergency stop events (`EmergencyActivated`, `Paused`) are monitored and trigger an on-call alert | | |
| 4.7 | Recovery from an emergency state restores full functionality without redeployment | | |
| 4.8 | `EmergencyStop.t.sol`, `EmergencyStopFuzz.t.sol`, and `CircuitBreaker.t.sol` pass | | |

---

## 5. External Calls and Reentrancy

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 5.1 | Every function that transfers ERC-20 tokens applies the **checks-effects-interactions** pattern | | |
| 5.2 | All external calls to untrusted contracts are wrapped in a reentrancy guard (`ReentrancyGuard`) or use a mutex | | |
| 5.3 | `FlashBorrow` / `FlashLoanProtection` paths revert if the balance post-call is less than pre-call | | |
| 5.4 | Cross-chain relay calls (`MarketRelay`, `BridgeConnector`, `CrossChainHandler`) validate the source chain ID and caller | | |
| 5.5 | Return values of low-level `.call{value:…}` are checked; unchecked returns are absent | | |
| 5.6 | No unbounded loops over user-controlled arrays exist in state-changing functions | | |
| 5.7 | `ReentrancyCoverage.t.sol` and `FlashLoanProtectionExtended.t.sol` pass | | |

---

## 6. Value Movement and Accounting

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 6.1 | All ERC-20 `transferFrom` calls check the return value or use `SafeERC20` | | |
| 6.2 | Arithmetic uses checked math (Solidity ≥ 0.8) or PRBMath; no explicit `unchecked` block covers financial calculations | | |
| 6.3 | LMSR cost computation (`LMSR.cost`) cannot overflow given the maximum liquidity parameter `b` in use | | |
| 6.4 | Withdrawal logic enforces per-user share balances and global liquidity limits (`WithdrawalLimit`, `WithdrawalQueue`) | | |
| 6.5 | Fee calculations round in favour of the protocol (floor), not the user (ceiling) | | |
| 6.6 | Market settlement distributes exactly the collateral collected; no dust is locked permanently | | |
| 6.7 | `DepositLogic.t.sol`, `ShareRedemption.t.sol`, `MarketPayout.t.sol`, and `FeeHandler.t.sol` pass | | |
| 6.8 | GAS_OPTIMIZATION_REPORT.md is reviewed; high-gas paths are profiled and bounded | | |

---

## Sign-off

| Reviewer | Date | Scope | Outcome |
|----------|------|-------|---------|
| | | Full audit | |
| | | Targeted re-review | |

**Template version:** 1.0  
**Reference issues:** #976  
**Related documents:** `docs/THREAT_MODEL_MARKET_AUDIT.md`, `Contracts/MARKET_RELAY_SECURITY_ANALYSIS.md`

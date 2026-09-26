// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/CircuitBreaker.sol";

/// @notice Deploy CircuitBreaker, optionally delegate roles and tune configuration
///         parameters, then write a JSON artifact.
///
/// # Minimal deploy (deployer holds all three roles, default config)
///   forge script script/DeployCircuitBreaker.s.sol:DeployCircuitBreaker \
///     --rpc-url $RPC_URL --broadcast --sig "run()"
///
/// # Deploy + delegate roles + tune config in one broadcast
///   forge script script/DeployCircuitBreaker.s.sol:DeployCircuitBreakerWithSetup \
///     --rpc-url $RPC_URL --broadcast
///
/// # Read-only verification
///   forge script script/DeployCircuitBreaker.s.sol:VerifyCircuitBreaker \
///     --rpc-url $RPC_URL --sig "run()"
///
/// # Required env vars
///   PRIVATE_KEY                     – deployer private key (hex, 0x-prefixed)
///
/// # Optional env vars (DeployCircuitBreakerWithSetup)
///   CB_BREAKER_ADDRESS              – address to grant BREAKER_ROLE (besides deployer)
///   CB_MONITOR_ADDRESS              – address to grant MONITOR_ROLE (besides deployer)
///   CB_REVOKE_DEPLOYER_BREAKER      – "true" to revoke BREAKER_ROLE from deployer after grant
///   CB_REVOKE_DEPLOYER_MONITOR      – "true" to revoke MONITOR_ROLE from deployer after grant
///   CB_FAILURE_THRESHOLD            – absolute failure count before tripping (default: 5)
///   CB_FAILURE_RATE_THRESHOLD       – failure-rate % before tripping, 1-100 (default: 50)
///   CB_RECOVERY_TIMEOUT             – seconds before a recovery attempt is allowed (default: 3600)
///   CB_HEALTH_CHECK_WINDOW          – health-check window in seconds (default: 86400)
///
/// # Verification env vars
///   CIRCUIT_BREAKER_ADDRESS         – deployed CircuitBreaker to verify
contract DeployCircuitBreaker is Script {
    function run() external returns (CircuitBreaker circuitBreaker) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);
        circuitBreaker = new CircuitBreaker();
        vm.stopBroadcast();

        console.log("--- CircuitBreaker Deployment ---");
        console.log("Address                  :", address(circuitBreaker));
        console.log("Admin / Breaker / Monitor:", deployer);
        console.log("Chain ID                 :", block.chainid);
        console.log("Failure threshold        :", circuitBreaker.failureThreshold());
        console.log("Failure rate threshold % :", circuitBreaker.failureRateThreshold());
        console.log("Recovery timeout (s)     :", circuitBreaker.recoveryTimeout());
        console.log("Health check window (s)  :", circuitBreaker.healthCheckWindow());

        _writeArtifact(circuitBreaker, deployer);
    }

    function _writeArtifact(CircuitBreaker cb, address admin) internal {
        string memory json = string.concat(
            '{"contractName":"CircuitBreaker"',
            ',"address":"',              vm.toString(address(cb)), '"',
            ',"admin":"',                vm.toString(admin),       '"',
            ',"chainId":',               vm.toString(block.chainid),
            ',"failureThreshold":',      vm.toString(cb.failureThreshold()),
            ',"failureRateThreshold":', vm.toString(cb.failureRateThreshold()),
            ',"recoveryTimeout":',       vm.toString(cb.recoveryTimeout()),
            ',"healthCheckWindow":',     vm.toString(cb.healthCheckWindow()),
            '}'
        );
        string memory path = string.concat(
            "deployments/",
            vm.toString(block.chainid),
            "/CircuitBreaker.json"
        );
        vm.writeFile(path, json);
        console.log("Artifact                 :", path);
    }
}

/// @notice Extended deploy: deploys CircuitBreaker, delegates BREAKER_ROLE and
///         MONITOR_ROLE to specified addresses, optionally strips those roles from
///         the deployer, and tunes all four configuration parameters — all inside
///         a single broadcast.
///
///         Role-separation model:
///           • BREAKER_ROLE  – accounts that can call triggerBreak() / attemptRecovery()
///           • MONITOR_ROLE  – accounts (backend health monitors) that call recordSuccess()
///                             / recordFailure()
///           • DEFAULT_ADMIN_ROLE – accounts that can grant/revoke roles and change config
///
///         By default, the deployer holds all three after construction. Set
///         CB_REVOKE_DEPLOYER_BREAKER / CB_REVOKE_DEPLOYER_MONITOR to "true" to
///         hand those operational roles exclusively to the specified service accounts.
contract DeployCircuitBreakerWithSetup is Script {
    function run() external returns (CircuitBreaker circuitBreaker) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // ── Role delegation config ────────────────────────────────────────────
        address breakerAccount = vm.envOr("CB_BREAKER_ADDRESS", address(0));
        address monitorAccount = vm.envOr("CB_MONITOR_ADDRESS", address(0));
        bool revokeDeployerBreaker = vm.envOr("CB_REVOKE_DEPLOYER_BREAKER", false);
        bool revokeDeployerMonitor = vm.envOr("CB_REVOKE_DEPLOYER_MONITOR", false);

        // ── Configuration tuning ─────────────────────────────────────────────
        // Defaults mirror the CircuitBreaker constructor defaults.
        uint256 failureThreshold     = vm.envOr("CB_FAILURE_THRESHOLD",      uint256(5));
        uint256 failureRateThreshold = vm.envOr("CB_FAILURE_RATE_THRESHOLD",  uint256(50));
        uint256 recoveryTimeout      = vm.envOr("CB_RECOVERY_TIMEOUT",        uint256(1 hours));
        uint256 healthCheckWindow    = vm.envOr("CB_HEALTH_CHECK_WINDOW",     uint256(24 hours));

        // ── Input validation (pre-flight) ────────────────────────────────────
        require(failureThreshold > 0,
            "DeployCircuitBreaker: CB_FAILURE_THRESHOLD must be > 0");
        require(failureRateThreshold > 0 && failureRateThreshold <= 100,
            "DeployCircuitBreaker: CB_FAILURE_RATE_THRESHOLD must be 1-100");
        require(recoveryTimeout > 0,
            "DeployCircuitBreaker: CB_RECOVERY_TIMEOUT must be > 0");
        require(healthCheckWindow > 0,
            "DeployCircuitBreaker: CB_HEALTH_CHECK_WINDOW must be > 0");

        // Revoking the deployer's operational role only makes sense when a
        // dedicated account is also being granted that role.
        require(
            !revokeDeployerBreaker || breakerAccount != address(0),
            "DeployCircuitBreaker: cannot revoke deployer BREAKER_ROLE without CB_BREAKER_ADDRESS"
        );
        require(
            !revokeDeployerMonitor || monitorAccount != address(0),
            "DeployCircuitBreaker: cannot revoke deployer MONITOR_ROLE without CB_MONITOR_ADDRESS"
        );

        // ── Broadcast ─────────────────────────────────────────────────────────
        vm.startBroadcast(deployerPrivateKey);

        circuitBreaker = new CircuitBreaker();

        // Delegate BREAKER_ROLE
        if (breakerAccount != address(0)) {
            circuitBreaker.grantBreakerRole(breakerAccount);
        }
        if (revokeDeployerBreaker) {
            circuitBreaker.revokeBreakerRole(deployer);
        }

        // Delegate MONITOR_ROLE
        if (monitorAccount != address(0)) {
            circuitBreaker.grantMonitorRole(monitorAccount);
        }
        if (revokeDeployerMonitor) {
            circuitBreaker.revokeMonitorRole(deployer);
        }

        // Tune configuration — only call setters when the value differs from
        // the constructor default to avoid unnecessary gas + events.
        if (failureThreshold != 5) {
            circuitBreaker.setFailureThreshold(failureThreshold);
        }
        if (failureRateThreshold != 50) {
            circuitBreaker.setFailureRateThreshold(failureRateThreshold);
        }
        if (recoveryTimeout != 1 hours) {
            circuitBreaker.setRecoveryTimeout(recoveryTimeout);
        }
        if (healthCheckWindow != 24 hours) {
            circuitBreaker.setHealthCheckWindow(healthCheckWindow);
        }

        vm.stopBroadcast();

        // ── Logging ───────────────────────────────────────────────────────────
        console.log("--- CircuitBreaker Deployment (with setup) ---");
        console.log("Address                  :", address(circuitBreaker));
        console.log("Admin                    :", deployer);
        console.log("Chain ID                 :", block.chainid);

        if (breakerAccount != address(0)) {
            console.log("Breaker account          :", breakerAccount);
        }
        console.log("Deployer keeps BREAKER   :", !revokeDeployerBreaker);

        if (monitorAccount != address(0)) {
            console.log("Monitor account          :", monitorAccount);
        }
        console.log("Deployer keeps MONITOR   :", !revokeDeployerMonitor);

        console.log("Failure threshold        :", circuitBreaker.failureThreshold());
        console.log("Failure rate threshold % :", circuitBreaker.failureRateThreshold());
        console.log("Recovery timeout (s)     :", circuitBreaker.recoveryTimeout());
        console.log("Health check window (s)  :", circuitBreaker.healthCheckWindow());

        // ── Artifact ──────────────────────────────────────────────────────────
        string memory breakerJson = breakerAccount == address(0)
            ? "null"
            : string.concat('"', vm.toString(breakerAccount), '"');
        string memory monitorJson = monitorAccount == address(0)
            ? "null"
            : string.concat('"', vm.toString(monitorAccount), '"');

        string memory json = string.concat(
            '{"contractName":"CircuitBreaker"',
            ',"address":"',               vm.toString(address(circuitBreaker)), '"',
            ',"admin":"',                 vm.toString(deployer),                '"',
            ',"chainId":',                vm.toString(block.chainid),
            ',"breakerAccount":',         breakerJson,
            ',"monitorAccount":',         monitorJson,
            ',"deployerKeepsBreaker":',   revokeDeployerBreaker ? "false" : "true",
            ',"deployerKeepsMonitor":',   revokeDeployerMonitor ? "false" : "true",
            ',"failureThreshold":',       vm.toString(circuitBreaker.failureThreshold()),
            ',"failureRateThreshold":',  vm.toString(circuitBreaker.failureRateThreshold()),
            ',"recoveryTimeout":',        vm.toString(circuitBreaker.recoveryTimeout()),
            ',"healthCheckWindow":',      vm.toString(circuitBreaker.healthCheckWindow()),
            '}'
        );
        string memory path = string.concat(
            "deployments/",
            vm.toString(block.chainid),
            "/CircuitBreaker.json"
        );
        vm.writeFile(path, json);
        console.log("Artifact                 :", path);
    }
}

/// @notice Read-only verification — no broadcast.
///         Prints the full role and configuration state of a deployed CircuitBreaker.
contract VerifyCircuitBreaker is Script {
    function run() external view {
        address addr = vm.envAddress("CIRCUIT_BREAKER_ADDRESS");
        CircuitBreaker cb = CircuitBreaker(addr);

        (
            CircuitBreaker.State state,
            uint256 failures,
            uint256 successes,
            uint256 totalOps,
            uint256 healthPct,
            bool isHealthy
        ) = cb.getStatus();

        console.log("--- CircuitBreaker Verification ---");
        console.log("Address                  :", addr);
        console.log("Chain ID                 :", block.chainid);

        // State
        if (state == CircuitBreaker.State.Closed)   console.log("State                    : Closed");
        if (state == CircuitBreaker.State.Open)      console.log("State                    : Open");
        if (state == CircuitBreaker.State.HalfOpen)  console.log("State                    : HalfOpen");

        console.log("Is healthy               :", isHealthy);
        console.log("Health %                 :", healthPct);
        console.log("Total operations         :", totalOps);
        console.log("Failures                 :", failures);
        console.log("Successes                :", successes);

        // Config
        console.log("Failure threshold        :", cb.failureThreshold());
        console.log("Failure rate threshold % :", cb.failureRateThreshold());
        console.log("Recovery timeout (s)     :", cb.recoveryTimeout());
        console.log("Health check window (s)  :", cb.healthCheckWindow());

        // Role holders
        bytes32 adminRole   = cb.DEFAULT_ADMIN_ROLE();
        bytes32 breakerRole = cb.BREAKER_ROLE();
        bytes32 monitorRole = cb.MONITOR_ROLE();

        uint256 adminCount   = cb.getRoleMemberCount(adminRole);
        uint256 breakerCount = cb.getRoleMemberCount(breakerRole);
        uint256 monitorCount = cb.getRoleMemberCount(monitorRole);

        console.log("DEFAULT_ADMIN_ROLE members:", adminCount);
        for (uint256 i; i < adminCount; ++i) {
            console.log("  admin[", i, "]  :", cb.getRoleMember(adminRole, i));
        }
        console.log("BREAKER_ROLE members      :", breakerCount);
        for (uint256 i; i < breakerCount; ++i) {
            console.log("  breaker[", i, "]:", cb.getRoleMember(breakerRole, i));
        }
        console.log("MONITOR_ROLE members      :", monitorCount);
        for (uint256 i; i < monitorCount; ++i) {
            console.log("  monitor[", i, "]:", cb.getRoleMember(monitorRole, i));
        }
    }
}

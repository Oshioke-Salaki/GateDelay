// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/RoleManager.sol";
import "../src/FeeHandler.sol";
import "../src/CircuitBreaker.sol";
import "../src/MarketMaker.sol";
import "../src/Trading.sol";

/// @notice Deploy the complete protocol stack — RoleManager, FeeHandler,
///         CircuitBreaker, MarketMaker, and Trading — in a single broadcast.
///
///         Deployment order:
///           1. RoleManager       – access control registry
///           2. FeeHandler        – fee collection / distribution
///           3. CircuitBreaker    – operational safety switch
///           4. MarketMaker       – LMSR liquidity pools
///           5. Trading           – fee + rebate wrapper over MarketMaker
///
///         Post-deploy wiring (all inside the same broadcast):
///           • FeeHandler: registers a TRADING fee structure (if recipients configured)
///           • RoleManager: creates standard protocol roles and assigns them
///           • CircuitBreaker: grants BREAKER_ROLE / MONITOR_ROLE to service accounts
///           • CircuitBreaker: tunes configuration parameters when overrides are set
///
/// # Usage
///   forge script script/DeployFullStack.s.sol:DeployFullStack \
///     --rpc-url $RPC_URL --broadcast
///
/// # Verify the output of a prior full-stack deploy
///   forge script script/DeployFullStack.s.sol:VerifyFullStack \
///     --rpc-url $RPC_URL --sig "run()"
///
/// ─────────────────────────────────────────────────────────────────────────────
/// REQUIRED ENV VARS
/// ─────────────────────────────────────────────────────────────────────────────
///   PRIVATE_KEY                   deployer private key (hex, 0x-prefixed)
///   COLLATERAL_TOKEN_ADDRESS      deployed ERC-20 collateral token
///   COMMISSION_RECIPIENT          address that receives the Trading commission
///
/// ─────────────────────────────────────────────────────────────────────────────
/// OPTIONAL ENV VARS
/// ─────────────────────────────────────────────────────────────────────────────
/// Trading
///   TRADING_FEE_BPS               total fee in bps, max 1000          (default: 30)
///   TRADING_REBATE_BPS            referrer rebate portion, ≤ fee       (default: 0)
///
/// FeeHandler initial structure
///   FEE_BPS                       FeeHandler structure rate, max 1000  (default: TRADING_FEE_BPS)
///   FEE_RECIPIENT_1               first recipient; omit → deployer gets 100 %
///   FEE_RECIPIENT_1_SHARE_BPS     share in bps for recipient 1
///   FEE_RECIPIENT_2               second recipient (optional)
///   FEE_RECIPIENT_2_SHARE_BPS     share in bps for recipient 2
///   FEE_RECIPIENT_3               third recipient (optional)
///   FEE_RECIPIENT_3_SHARE_BPS     share in bps for recipient 3
///
/// RoleManager standard roles
///   ROLE_MARKET_ADMIN             set to "true" to create MARKET_ADMIN role
///   ROLE_RESOLVER                 set to "true" to create RESOLVER role
///   ROLE_OPERATOR                 set to "true" to create OPERATOR role
///   ROLE_PAUSER                   set to "true" to create PAUSER role
///   ROLE_MARKET_ADMIN_ASSIGNEE    address to receive MARKET_ADMIN
///   ROLE_RESOLVER_ASSIGNEE        address to receive RESOLVER
///   ROLE_OPERATOR_ASSIGNEE        address to receive OPERATOR
///   ROLE_PAUSER_ASSIGNEE          address to receive PAUSER
///
/// CircuitBreaker role delegation
///   CB_BREAKER_ADDRESS            address to grant BREAKER_ROLE
///   CB_MONITOR_ADDRESS            address to grant MONITOR_ROLE
///   CB_REVOKE_DEPLOYER_BREAKER    "true" → strip BREAKER_ROLE from deployer after grant
///   CB_REVOKE_DEPLOYER_MONITOR    "true" → strip MONITOR_ROLE from deployer after grant
///
/// CircuitBreaker configuration
///   CB_FAILURE_THRESHOLD          absolute failure count before trip    (default: 5)
///   CB_FAILURE_RATE_THRESHOLD     failure-rate % before trip, 1-100     (default: 50)
///   CB_RECOVERY_TIMEOUT           seconds before recovery allowed        (default: 3600)
///   CB_HEALTH_CHECK_WINDOW        health-check window in seconds         (default: 86400)
///
/// ─────────────────────────────────────────────────────────────────────────────
/// VERIFICATION ENV VARS
/// ─────────────────────────────────────────────────────────────────────────────
///   ROLE_MANAGER_ADDRESS
///   FEE_HANDLER_ADDRESS
///   CIRCUIT_BREAKER_ADDRESS
///   MARKET_MAKER_ADDRESS
///   TRADING_ADDRESS
contract DeployFullStack is Script {
    // ── Well-known role identifiers ───────────────────────────────────────────
    bytes32 constant MARKET_ADMIN       = keccak256("MARKET_ADMIN");
    bytes32 constant RESOLVER           = keccak256("RESOLVER");
    bytes32 constant OPERATOR           = keccak256("OPERATOR");
    bytes32 constant PAUSER             = keccak256("PAUSER");
    bytes32 constant TRADING_STRUCTURE  = keccak256("TRADING");

    uint256 constant BPS_DENOMINATOR    = 10_000;

    // ── Return bundle (useful for tests that call run() directly) ─────────────
    struct Deployment {
        RoleManager    roleManager;
        FeeHandler     feeHandler;
        CircuitBreaker circuitBreaker;
        MarketMaker    marketMaker;
        Trading        trading;
    }

    function run() external returns (Deployment memory d) {
        uint256 deployerPrivateKey  = vm.envUint("PRIVATE_KEY");
        address deployer            = vm.addr(deployerPrivateKey);

        // ── Required args ─────────────────────────────────────────────────────
        address collateralToken     = vm.envAddress("COLLATERAL_TOKEN_ADDRESS");
        address commissionRecipient = vm.envAddress("COMMISSION_RECIPIENT");

        // ── Trading params ────────────────────────────────────────────────────
        uint256 tradingFeeBps   = vm.envOr("TRADING_FEE_BPS",    uint256(30));
        uint256 rebateBps       = vm.envOr("TRADING_REBATE_BPS", uint256(0));

        // ── Pre-flight validation ─────────────────────────────────────────────
        require(collateralToken != address(0),
            "DeployFullStack: COLLATERAL_TOKEN_ADDRESS not set");
        require(collateralToken.code.length > 0,
            "DeployFullStack: COLLATERAL_TOKEN_ADDRESS has no code");
        require(commissionRecipient != address(0),
            "DeployFullStack: COMMISSION_RECIPIENT not set");
        require(tradingFeeBps <= 1_000,
            "DeployFullStack: TRADING_FEE_BPS exceeds 10% ceiling");
        require(rebateBps <= tradingFeeBps,
            "DeployFullStack: TRADING_REBATE_BPS exceeds fee");

        // ── FeeHandler config ─────────────────────────────────────────────────
        uint256 handlerFeeBps = vm.envOr("FEE_BPS", tradingFeeBps);
        require(handlerFeeBps <= 1_000,
            "DeployFullStack: FEE_BPS exceeds 10% ceiling");
        FeeHandler.FeeRecipient[] memory feeRecipients = _buildFeeRecipients(deployer);

        // ── RoleManager config ────────────────────────────────────────────────
        bool createMarketAdmin = vm.envOr("ROLE_MARKET_ADMIN", false);
        bool createResolver    = vm.envOr("ROLE_RESOLVER",     false);
        bool createOperator    = vm.envOr("ROLE_OPERATOR",     false);
        bool createPauser      = vm.envOr("ROLE_PAUSER",       false);

        address marketAdminAssignee = vm.envOr("ROLE_MARKET_ADMIN_ASSIGNEE", address(0));
        address resolverAssignee    = vm.envOr("ROLE_RESOLVER_ASSIGNEE",     address(0));
        address operatorAssignee    = vm.envOr("ROLE_OPERATOR_ASSIGNEE",     address(0));
        address pauserAssignee      = vm.envOr("ROLE_PAUSER_ASSIGNEE",       address(0));

        // ── CircuitBreaker config ─────────────────────────────────────────────
        address breakerAccount       = vm.envOr("CB_BREAKER_ADDRESS",         address(0));
        address monitorAccount       = vm.envOr("CB_MONITOR_ADDRESS",         address(0));
        bool revokeDeployerBreaker   = vm.envOr("CB_REVOKE_DEPLOYER_BREAKER", false);
        bool revokeDeployerMonitor   = vm.envOr("CB_REVOKE_DEPLOYER_MONITOR", false);
        uint256 cbFailureThreshold   = vm.envOr("CB_FAILURE_THRESHOLD",       uint256(5));
        uint256 cbFailureRatePct     = vm.envOr("CB_FAILURE_RATE_THRESHOLD",  uint256(50));
        uint256 cbRecoveryTimeout    = vm.envOr("CB_RECOVERY_TIMEOUT",        uint256(1 hours));
        uint256 cbHealthCheckWindow  = vm.envOr("CB_HEALTH_CHECK_WINDOW",     uint256(24 hours));

        require(cbFailureThreshold > 0,
            "DeployFullStack: CB_FAILURE_THRESHOLD must be > 0");
        require(cbFailureRatePct > 0 && cbFailureRatePct <= 100,
            "DeployFullStack: CB_FAILURE_RATE_THRESHOLD must be 1-100");
        require(cbRecoveryTimeout > 0,
            "DeployFullStack: CB_RECOVERY_TIMEOUT must be > 0");
        require(cbHealthCheckWindow > 0,
            "DeployFullStack: CB_HEALTH_CHECK_WINDOW must be > 0");
        require(!revokeDeployerBreaker || breakerAccount != address(0),
            "DeployFullStack: cannot revoke deployer BREAKER_ROLE without CB_BREAKER_ADDRESS");
        require(!revokeDeployerMonitor || monitorAccount != address(0),
            "DeployFullStack: cannot revoke deployer MONITOR_ROLE without CB_MONITOR_ADDRESS");

        // ═════════════════════════════════════════════════════════════════════
        // BROADCAST
        // ═════════════════════════════════════════════════════════════════════
        vm.startBroadcast(deployerPrivateKey);

        // 1. RoleManager ──────────────────────────────────────────────────────
        d.roleManager = new RoleManager();

        if (createMarketAdmin) {
            d.roleManager.createRole(MARKET_ADMIN);
            if (marketAdminAssignee != address(0))
                d.roleManager.assignRole(MARKET_ADMIN, marketAdminAssignee);
        }
        if (createResolver) {
            d.roleManager.createRole(RESOLVER);
            if (resolverAssignee != address(0))
                d.roleManager.assignRole(RESOLVER, resolverAssignee);
        }
        if (createOperator) {
            d.roleManager.createRole(OPERATOR);
            if (operatorAssignee != address(0))
                d.roleManager.assignRole(OPERATOR, operatorAssignee);
        }
        if (createPauser) {
            d.roleManager.createRole(PAUSER);
            if (pauserAssignee != address(0))
                d.roleManager.assignRole(PAUSER, pauserAssignee);
        }

        // 2. FeeHandler ───────────────────────────────────────────────────────
        d.feeHandler = new FeeHandler();
        d.feeHandler.setFeeStructure(TRADING_STRUCTURE, handlerFeeBps, feeRecipients);

        // 3. CircuitBreaker ───────────────────────────────────────────────────
        d.circuitBreaker = new CircuitBreaker();

        if (breakerAccount != address(0))
            d.circuitBreaker.grantBreakerRole(breakerAccount);
        if (revokeDeployerBreaker)
            d.circuitBreaker.revokeBreakerRole(deployer);

        if (monitorAccount != address(0))
            d.circuitBreaker.grantMonitorRole(monitorAccount);
        if (revokeDeployerMonitor)
            d.circuitBreaker.revokeMonitorRole(deployer);

        if (cbFailureThreshold  != 5)          d.circuitBreaker.setFailureThreshold(cbFailureThreshold);
        if (cbFailureRatePct    != 50)         d.circuitBreaker.setFailureRateThreshold(cbFailureRatePct);
        if (cbRecoveryTimeout   != 1 hours)    d.circuitBreaker.setRecoveryTimeout(cbRecoveryTimeout);
        if (cbHealthCheckWindow != 24 hours)   d.circuitBreaker.setHealthCheckWindow(cbHealthCheckWindow);

        // 4. MarketMaker + 5. Trading ─────────────────────────────────────────
        d.marketMaker = new MarketMaker(collateralToken);
        d.trading = new Trading(
            address(d.marketMaker),
            tradingFeeBps,
            rebateBps,
            commissionRecipient
        );

        vm.stopBroadcast();

        // ── Logging ───────────────────────────────────────────────────────────
        _log(deployer, d, tradingFeeBps, rebateBps, handlerFeeBps, feeRecipients.length);

        // ── Artifact ──────────────────────────────────────────────────────────
        _writeArtifact(deployer, d, tradingFeeBps, rebateBps, handlerFeeBps);
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    function _buildFeeRecipients(address deployer)
        internal
        view
        returns (FeeHandler.FeeRecipient[] memory recipients)
    {
        address r1      = vm.envOr("FEE_RECIPIENT_1",           address(0));
        uint256 r1Share = vm.envOr("FEE_RECIPIENT_1_SHARE_BPS", uint256(0));
        address r2      = vm.envOr("FEE_RECIPIENT_2",           address(0));
        uint256 r2Share = vm.envOr("FEE_RECIPIENT_2_SHARE_BPS", uint256(0));
        address r3      = vm.envOr("FEE_RECIPIENT_3",           address(0));
        uint256 r3Share = vm.envOr("FEE_RECIPIENT_3_SHARE_BPS", uint256(0));

        if (r1 == address(0)) {
            recipients = new FeeHandler.FeeRecipient[](1);
            recipients[0] = FeeHandler.FeeRecipient({account: deployer, shareBps: BPS_DENOMINATOR});
        } else if (r2 == address(0)) {
            require(r1Share == BPS_DENOMINATOR,
                "DeployFullStack: single FeeHandler recipient share must be 10000");
            recipients = new FeeHandler.FeeRecipient[](1);
            recipients[0] = FeeHandler.FeeRecipient({account: r1, shareBps: r1Share});
        } else if (r3 == address(0)) {
            require(r1Share + r2Share == BPS_DENOMINATOR,
                "DeployFullStack: two FeeHandler recipient shares must sum to 10000");
            recipients = new FeeHandler.FeeRecipient[](2);
            recipients[0] = FeeHandler.FeeRecipient({account: r1, shareBps: r1Share});
            recipients[1] = FeeHandler.FeeRecipient({account: r2, shareBps: r2Share});
        } else {
            require(r1Share + r2Share + r3Share == BPS_DENOMINATOR,
                "DeployFullStack: three FeeHandler recipient shares must sum to 10000");
            recipients = new FeeHandler.FeeRecipient[](3);
            recipients[0] = FeeHandler.FeeRecipient({account: r1, shareBps: r1Share});
            recipients[1] = FeeHandler.FeeRecipient({account: r2, shareBps: r2Share});
            recipients[2] = FeeHandler.FeeRecipient({account: r3, shareBps: r3Share});
        }
    }

    function _log(
        address deployer,
        Deployment memory d,
        uint256 tradingFeeBps,
        uint256 rebateBps,
        uint256 handlerFeeBps,
        uint256 recipientCount
    ) internal view {
        console.log("========== Full-Stack Deployment ==========");
        console.log("Chain ID             :", block.chainid);
        console.log("Deployer             :", deployer);
        console.log("");
        console.log("RoleManager          :", address(d.roleManager));
        bytes32[] memory roles = d.roleManager.getCreatedRoles();
        console.log("  Registered roles   :", roles.length);
        for (uint256 i; i < roles.length; ++i) {
            console.logBytes32(roles[i]);
        }
        console.log("");
        console.log("FeeHandler           :", address(d.feeHandler));
        console.log("  Structure (TRADING):", vm.toString(TRADING_STRUCTURE));
        console.log("  Fee (bps)          :", handlerFeeBps);
        console.log("  Recipients         :", recipientCount);
        console.log("");
        console.log("CircuitBreaker       :", address(d.circuitBreaker));
        console.log("  Failure threshold  :", d.circuitBreaker.failureThreshold());
        console.log("  Rate threshold %   :", d.circuitBreaker.failureRateThreshold());
        console.log("  Recovery timeout   :", d.circuitBreaker.recoveryTimeout());
        console.log("  Health window      :", d.circuitBreaker.healthCheckWindow());
        console.log("");
        console.log("MarketMaker          :", address(d.marketMaker));
        console.log("  Collateral         :", address(d.marketMaker.collateral()));
        console.log("");
        console.log("Trading              :", address(d.trading));
        console.log("  Fee (bps)          :", tradingFeeBps);
        console.log("  Rebate (bps)       :", rebateBps);
        console.log("  Commission (bps)   :", tradingFeeBps - rebateBps);
        console.log("  Commission recv    :", d.trading.commissionRecipient());
        console.log("===========================================");
    }

    function _writeArtifact(
        address deployer,
        Deployment memory d,
        uint256 tradingFeeBps,
        uint256 rebateBps,
        uint256 handlerFeeBps
    ) internal {
        string memory json = string.concat(
            '{"contractName":"FullStack"',
            ',"chainId":',              vm.toString(block.chainid),
            ',"deployer":"',            vm.toString(deployer),                          '"',
            ',"roleManager":"',         vm.toString(address(d.roleManager)),            '"',
            ',"feeHandler":"',          vm.toString(address(d.feeHandler)),             '"',
            ',"feeHandlerStructure":"', vm.toString(TRADING_STRUCTURE),                '"',
            ',"feeHandlerFeeBps":',     vm.toString(handlerFeeBps),
            ',"circuitBreaker":"',      vm.toString(address(d.circuitBreaker)),         '"',
            ',"failureThreshold":',     vm.toString(d.circuitBreaker.failureThreshold()),
            ',"failureRateThreshold":', vm.toString(d.circuitBreaker.failureRateThreshold()),
            ',"recoveryTimeout":',      vm.toString(d.circuitBreaker.recoveryTimeout()),
            ',"healthCheckWindow":',    vm.toString(d.circuitBreaker.healthCheckWindow()),
            ',"marketMaker":"',         vm.toString(address(d.marketMaker)),            '"',
            ',"collateralToken":"',     vm.toString(address(d.marketMaker.collateral())), '"',
            ',"trading":"',             vm.toString(address(d.trading)),                '"',
            ',"tradingFeeBps":',        vm.toString(tradingFeeBps),
            ',"rebateBps":',            vm.toString(rebateBps),
            ',"commissionBps":',        vm.toString(tradingFeeBps - rebateBps),
            ',"commissionRecipient":"', vm.toString(d.trading.commissionRecipient()),   '"',
            '}'
        );
        string memory path = string.concat(
            "deployments/",
            vm.toString(block.chainid),
            "/FullStack.json"
        );
        vm.writeFile(path, json);
        console.log("Artifact             :", path);
    }
}

/// @notice Read-only verification of a prior full-stack deployment — no broadcast.
///         Reads the five contract addresses from env and prints a full status report.
contract VerifyFullStack is Script {
    function run() external view {
        RoleManager    roleManager    = RoleManager(vm.envAddress("ROLE_MANAGER_ADDRESS"));
        FeeHandler     feeHandler     = FeeHandler(vm.envAddress("FEE_HANDLER_ADDRESS"));
        CircuitBreaker circuitBreaker = CircuitBreaker(vm.envAddress("CIRCUIT_BREAKER_ADDRESS"));
        MarketMaker    marketMaker    = MarketMaker(vm.envAddress("MARKET_MAKER_ADDRESS"));
        Trading        trading        = Trading(vm.envAddress("TRADING_ADDRESS"));

        console.log("========== Full-Stack Verification ==========");
        console.log("Chain ID                  :", block.chainid);

        // RoleManager
        console.log("");
        console.log("RoleManager               :", address(roleManager));
        bytes32[] memory roles = roleManager.getCreatedRoles();
        console.log("  Registered roles        :", roles.length);
        for (uint256 i; i < roles.length; ++i) {
            bytes32 role = roles[i];
            uint256 count = roleManager.getRoleMemberCount(role);
            console.log("  role                    :", vm.toString(role));
            console.log("  members                 :", count);
            for (uint256 j; j < count; ++j) {
                console.log("    member                :", roleManager.getRoleMember(role, j));
            }
        }

        // FeeHandler
        bytes32 tradingStructure = keccak256("TRADING");
        (uint256 feeBps, bool active, FeeHandler.FeeRecipient[] memory recipients) =
            feeHandler.getFeeStructure(tradingStructure);
        console.log("");
        console.log("FeeHandler                :", address(feeHandler));
        console.log("  TRADING structure active:", active);
        console.log("  Fee (bps)               :", feeBps);
        console.log("  Recipients              :", recipients.length);
        for (uint256 i; i < recipients.length; ++i) {
            console.log("    account               :", recipients[i].account);
            console.log("    share (bps)           :", recipients[i].shareBps);
        }

        // CircuitBreaker
        (
            CircuitBreaker.State cbState,
            uint256 failures,
            uint256 successes,
            uint256 totalOps,
            uint256 healthPct,
            bool isHealthy
        ) = circuitBreaker.getStatus();
        console.log("");
        console.log("CircuitBreaker            :", address(circuitBreaker));
        if (cbState == CircuitBreaker.State.Closed)  console.log("  State                   : Closed");
        if (cbState == CircuitBreaker.State.Open)    console.log("  State                   : Open");
        if (cbState == CircuitBreaker.State.HalfOpen) console.log("  State                  : HalfOpen");
        console.log("  isHealthy               :", isHealthy);
        console.log("  Health %                :", healthPct);
        console.log("  Total ops               :", totalOps);
        console.log("  Failures                :", failures);
        console.log("  Successes               :", successes);
        console.log("  Failure threshold       :", circuitBreaker.failureThreshold());
        console.log("  Rate threshold %        :", circuitBreaker.failureRateThreshold());
        console.log("  Recovery timeout (s)    :", circuitBreaker.recoveryTimeout());
        console.log("  Health window (s)       :", circuitBreaker.healthCheckWindow());

        // MarketMaker
        console.log("");
        console.log("MarketMaker               :", address(marketMaker));
        console.log("  owner                   :", marketMaker.owner());
        console.log("  collateral              :", address(marketMaker.collateral()));
        console.log("  market count            :", marketMaker.marketCount());

        // Trading
        console.log("");
        console.log("Trading                   :", address(trading));
        console.log("  owner                   :", trading.owner());
        console.log("  marketMaker             :", address(trading.marketMaker()));
        console.log("  collateral              :", address(trading.collateral()));
        console.log("  feeBps                  :", trading.feeBps());
        console.log("  rebateBps               :", trading.rebateBps());
        console.log("  commissionBps           :", trading.commissionBps());
        console.log("  commissionRecipient     :", trading.commissionRecipient());
        console.log("=============================================");
    }
}

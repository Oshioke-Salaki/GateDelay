// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/RoleManager.sol";

/// @notice Deploy RoleManager, optionally bootstrap standard roles, and write a
///         JSON artifact with all deployed addresses and the registered role set.
///
/// # Minimal deploy (no role bootstrapping)
///   forge script script/DeployRoleManager.s.sol:DeployRoleManager \
///     --rpc-url $RPC_URL --broadcast --sig "run()"
///
/// # Full deploy with standard roles pre-created
///   forge script script/DeployRoleManager.s.sol:DeployRoleManagerWithSetup \
///     --rpc-url $RPC_URL --broadcast
///
/// # Read-only verification against an already-deployed contract
///   forge script script/DeployRoleManager.s.sol:VerifyRoleManager \
///     --rpc-url $RPC_URL --sig "run()"
///
/// # Required env vars
///   PRIVATE_KEY                – deployer private key (hex, 0x-prefixed)
///
/// # Optional env vars (DeployRoleManagerWithSetup / DeployRoleManagerAndAssign)
///   ROLE_MARKET_ADMIN          – if set, creates a MARKET_ADMIN role
///   ROLE_RESOLVER              – if set, creates a RESOLVER role
///   ROLE_OPERATOR              – if set, creates an OPERATOR role
///   ROLE_PAUSER                – if set, creates a PAUSER role
///   ROLE_MARKET_ADMIN_ASSIGNEE – address to receive MARKET_ADMIN role (optional)
///   ROLE_RESOLVER_ASSIGNEE     – address to receive RESOLVER role (optional)
///   ROLE_OPERATOR_ASSIGNEE     – address to receive OPERATOR role (optional)
///   ROLE_PAUSER_ASSIGNEE       – address to receive PAUSER role (optional)
///
/// # Verification env vars
///   ROLE_MANAGER_ADDRESS       – deployed RoleManager to verify
contract DeployRoleManager is Script {
    function run() external returns (RoleManager roleManager) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);
        roleManager = new RoleManager();
        vm.stopBroadcast();

        console.log("--- RoleManager Deployment ---");
        console.log("Address  :", address(roleManager));
        console.log("Admin    :", deployer);
        console.log("Chain ID :", block.chainid);

        _writeArtifact(address(roleManager), deployer);
    }

    function _writeArtifact(address roleManager, address admin) internal {
        string memory json = string.concat(
            '{"contractName":"RoleManager"',
            ',"address":"', vm.toString(roleManager), '"',
            ',"admin":"',   vm.toString(admin),       '"',
            ',"chainId":',  vm.toString(block.chainid),
            '}'
        );
        string memory path = string.concat(
            "deployments/",
            vm.toString(block.chainid),
            "/RoleManager.json"
        );
        vm.writeFile(path, json);
        console.log("Artifact :", path);
    }
}

/// @notice Extended deploy that creates the four standard protocol roles and,
///         when assignee addresses are provided, grants them inside the same broadcast.
contract DeployRoleManagerWithSetup is Script {
    bytes32 public constant MARKET_ADMIN = keccak256("MARKET_ADMIN");
    bytes32 public constant RESOLVER     = keccak256("RESOLVER");
    bytes32 public constant OPERATOR     = keccak256("OPERATOR");
    bytes32 public constant PAUSER       = keccak256("PAUSER");

    struct RoleConfig {
        bytes32 role;
        string  name;
        string  assigneeEnvKey;
    }

    function run() external returns (RoleManager roleManager) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Build config for each standard role using env flags.
        // A role is only created when the corresponding env var is present (any value).
        bool createMarketAdmin = vm.envOr("ROLE_MARKET_ADMIN",  false);
        bool createResolver    = vm.envOr("ROLE_RESOLVER",      false);
        bool createOperator    = vm.envOr("ROLE_OPERATOR",      false);
        bool createPauser      = vm.envOr("ROLE_PAUSER",        false);

        address marketAdminAssignee = vm.envOr("ROLE_MARKET_ADMIN_ASSIGNEE", address(0));
        address resolverAssignee    = vm.envOr("ROLE_RESOLVER_ASSIGNEE",     address(0));
        address operatorAssignee    = vm.envOr("ROLE_OPERATOR_ASSIGNEE",     address(0));
        address pauserAssignee      = vm.envOr("ROLE_PAUSER_ASSIGNEE",       address(0));

        vm.startBroadcast(deployerPrivateKey);

        roleManager = new RoleManager();

        if (createMarketAdmin) {
            roleManager.createRole(MARKET_ADMIN);
            if (marketAdminAssignee != address(0)) {
                roleManager.assignRole(MARKET_ADMIN, marketAdminAssignee);
            }
        }
        if (createResolver) {
            roleManager.createRole(RESOLVER);
            if (resolverAssignee != address(0)) {
                roleManager.assignRole(RESOLVER, resolverAssignee);
            }
        }
        if (createOperator) {
            roleManager.createRole(OPERATOR);
            if (operatorAssignee != address(0)) {
                roleManager.assignRole(OPERATOR, operatorAssignee);
            }
        }
        if (createPauser) {
            roleManager.createRole(PAUSER);
            if (pauserAssignee != address(0)) {
                roleManager.assignRole(PAUSER, pauserAssignee);
            }
        }

        vm.stopBroadcast();

        // ── Logging ───────────────────────────────────────────────────────────
        console.log("--- RoleManager Deployment (with setup) ---");
        console.log("Address      :", address(roleManager));
        console.log("Admin        :", deployer);
        console.log("Chain ID     :", block.chainid);

        bytes32[] memory created = roleManager.getCreatedRoles();
        console.log("Created roles:", created.length);
        for (uint256 i; i < created.length; ++i) {
            console.logBytes32(created[i]);
        }

        // ── Artifact ──────────────────────────────────────────────────────────
        string memory rolesJson = "[";
        for (uint256 i; i < created.length; ++i) {
            if (i > 0) rolesJson = string.concat(rolesJson, ",");
            rolesJson = string.concat(rolesJson, '"', vm.toString(created[i]), '"');
        }
        rolesJson = string.concat(rolesJson, "]");

        string memory json = string.concat(
            '{"contractName":"RoleManager"',
            ',"address":"',      vm.toString(address(roleManager)), '"',
            ',"admin":"',        vm.toString(deployer),             '"',
            ',"chainId":',       vm.toString(block.chainid),
            ',"createdRoles":',  rolesJson,
            '}'
        );
        string memory path = string.concat(
            "deployments/",
            vm.toString(block.chainid),
            "/RoleManager.json"
        );
        vm.writeFile(path, json);
        console.log("Artifact     :", path);
    }
}

/// @notice Read-only verification script — no broadcast.
///         Reads ROLE_MANAGER_ADDRESS and prints all registered roles and their
///         current member count.
contract VerifyRoleManager is Script {
    function run() external view {
        address addr = vm.envAddress("ROLE_MANAGER_ADDRESS");
        RoleManager roleManager = RoleManager(addr);

        console.log("--- RoleManager Verification ---");
        console.log("Address       :", addr);
        console.log("Chain ID      :", block.chainid);

        bytes32[] memory created = roleManager.getCreatedRoles();
        console.log("Registered roles:", created.length);

        for (uint256 i; i < created.length; ++i) {
            bytes32 role = created[i];
            uint256 count = roleManager.getRoleMemberCount(role);
            console.log("  role        :", vm.toString(role));
            console.log("  members     :", count);
            for (uint256 j; j < count; ++j) {
                console.log("    member[", j, "]:", roleManager.getRoleMember(role, j));
            }
        }
    }
}

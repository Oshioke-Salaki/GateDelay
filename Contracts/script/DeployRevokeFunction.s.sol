// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/RevokeFunction.sol";
import "../contracts/RevokeFunctionExample.sol";

/// @title DeployRevokeFunction
/// @notice Deployment script for RevokeFunction and RevokeFunctionExample contracts
/// @dev Run with: forge script script/DeployRevokeFunction.s.sol:DeployRevokeFunction --rpc-url <RPC_URL> --broadcast
contract DeployRevokeFunction is Script {
    
    function run() external {
        // Get deployer private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy RevokeFunction contract
        console.log("Deploying RevokeFunction...");
        RevokeFunction revokeFunction = new RevokeFunction();
        console.log("RevokeFunction deployed at:", address(revokeFunction));
        
        // Deploy RevokeFunctionExample contract
        console.log("Deploying RevokeFunctionExample...");
        RevokeFunctionExample example = new RevokeFunctionExample(address(revokeFunction));
        console.log("RevokeFunctionExample deployed at:", address(example));
        
        // Stop broadcasting
        vm.stopBroadcast();
        
        // Log deployment summary
        console.log("\n=== Deployment Summary ===");
        console.log("RevokeFunction:", address(revokeFunction));
        console.log("RevokeFunctionExample:", address(example));
        console.log("Deployer:", vm.addr(deployerPrivateKey));
        console.log("========================\n");
    }
}

/// @title DeployRevokeFunctionWithSetup
/// @notice Deployment script with initial permission setup
/// @dev Run with: forge script script/DeployRevokeFunction.s.sol:DeployRevokeFunctionWithSetup --rpc-url <RPC_URL> --broadcast
contract DeployRevokeFunctionWithSetup is Script {
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy contracts
        console.log("Deploying RevokeFunction...");
        RevokeFunction revokeFunction = new RevokeFunction();
        console.log("RevokeFunction deployed at:", address(revokeFunction));
        
        console.log("Deploying RevokeFunctionExample...");
        RevokeFunctionExample example = new RevokeFunctionExample(address(revokeFunction));
        console.log("RevokeFunctionExample deployed at:", address(example));
        
        // Setup initial permissions for deployer
        console.log("\nSetting up initial permissions...");
        
        bytes32[] memory deployerPerms = new bytes32[](5);
        deployerPerms[0] = revokeFunction.EXECUTE_PERMISSION();
        deployerPerms[1] = revokeFunction.TRANSFER_PERMISSION();
        deployerPerms[2] = revokeFunction.MINT_PERMISSION();
        deployerPerms[3] = revokeFunction.BURN_PERMISSION();
        deployerPerms[4] = revokeFunction.ADMIN_PERMISSION();
        
        revokeFunction.grantPermissions(deployer, deployerPerms);
        console.log("Granted all permissions to deployer");
        
        // Set custom permission descriptions
        revokeFunction.setPermissionDescription(
            revokeFunction.EXECUTE_PERMISSION(),
            "Permission to execute contract functions"
        );
        revokeFunction.setPermissionDescription(
            revokeFunction.TRANSFER_PERMISSION(),
            "Permission to transfer tokens between accounts"
        );
        revokeFunction.setPermissionDescription(
            revokeFunction.MINT_PERMISSION(),
            "Permission to mint new tokens"
        );
        revokeFunction.setPermissionDescription(
            revokeFunction.BURN_PERMISSION(),
            "Permission to burn existing tokens"
        );
        revokeFunction.setPermissionDescription(
            revokeFunction.ADMIN_PERMISSION(),
            "Full administrative access to all functions"
        );
        
        console.log("Updated permission descriptions");
        
        vm.stopBroadcast();
        
        // Log deployment summary
        console.log("\n=== Deployment Summary ===");
        console.log("RevokeFunction:", address(revokeFunction));
        console.log("RevokeFunctionExample:", address(example));
        console.log("Deployer:", deployer);
        console.log("Deployer Permissions: ALL (5)");
        console.log("========================\n");
        
        // Verification commands
        console.log("=== Verification Commands ===");
        console.log("Verify RevokeFunction:");
        console.log("forge verify-contract", address(revokeFunction), "contracts/RevokeFunction.sol:RevokeFunction");
        console.log("\nVerify RevokeFunctionExample:");
        console.log("forge verify-contract", address(example), "contracts/RevokeFunctionExample.sol:RevokeFunctionExample --constructor-args $(cast abi-encode 'constructor(address)' ", address(revokeFunction), ")");
        console.log("============================\n");
    }
}

/// @title DeployRevokeFunctionTestnet
/// @notice Deployment script for testnet with demo users
/// @dev Run with: forge script script/DeployRevokeFunction.s.sol:DeployRevokeFunctionTestnet --rpc-url <RPC_URL> --broadcast
contract DeployRevokeFunctionTestnet is Script {
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Demo user addresses (replace with actual addresses for your testnet)
        address demoAdmin = vm.envOr("DEMO_ADMIN", address(0x1111111111111111111111111111111111111111));
        address demoUser1 = vm.envOr("DEMO_USER1", address(0x2222222222222222222222222222222222222222));
        address demoUser2 = vm.envOr("DEMO_USER2", address(0x3333333333333333333333333333333333333333));
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy contracts
        console.log("Deploying to testnet...");
        RevokeFunction revokeFunction = new RevokeFunction();
        RevokeFunctionExample example = new RevokeFunctionExample(address(revokeFunction));
        
        console.log("RevokeFunction deployed at:", address(revokeFunction));
        console.log("RevokeFunctionExample deployed at:", address(example));
        
        // Setup demo admin with all permissions
        console.log("\nSetting up demo admin...");
        bytes32[] memory adminPerms = new bytes32[](5);
        adminPerms[0] = revokeFunction.EXECUTE_PERMISSION();
        adminPerms[1] = revokeFunction.TRANSFER_PERMISSION();
        adminPerms[2] = revokeFunction.MINT_PERMISSION();
        adminPerms[3] = revokeFunction.BURN_PERMISSION();
        adminPerms[4] = revokeFunction.ADMIN_PERMISSION();
        
        revokeFunction.grantPermissions(demoAdmin, adminPerms);
        console.log("Granted all permissions to demo admin:", demoAdmin);
        
        // Setup demo user 1 with execute and transfer
        console.log("\nSetting up demo user 1...");
        bytes32[] memory user1Perms = new bytes32[](2);
        user1Perms[0] = revokeFunction.EXECUTE_PERMISSION();
        user1Perms[1] = revokeFunction.TRANSFER_PERMISSION();
        
        revokeFunction.grantPermissions(demoUser1, user1Perms);
        console.log("Granted execute and transfer permissions to demo user 1:", demoUser1);
        
        // Setup demo user 2 with only execute
        console.log("\nSetting up demo user 2...");
        revokeFunction.grantPermission(demoUser2, revokeFunction.EXECUTE_PERMISSION());
        console.log("Granted execute permission to demo user 2:", demoUser2);
        
        // Mint some demo tokens
        console.log("\nMinting demo tokens...");
        example.mint(demoUser1, 1000 ether);
        example.mint(demoUser2, 500 ether);
        console.log("Minted 1000 tokens to demo user 1");
        console.log("Minted 500 tokens to demo user 2");
        
        vm.stopBroadcast();
        
        // Log deployment summary
        console.log("\n=== Testnet Deployment Summary ===");
        console.log("RevokeFunction:", address(revokeFunction));
        console.log("RevokeFunctionExample:", address(example));
        console.log("Deployer:", deployer);
        console.log("\nDemo Accounts:");
        console.log("Admin:", demoAdmin, "- Permissions: ALL (5)");
        console.log("User 1:", demoUser1, "- Permissions: EXECUTE, TRANSFER (2)");
        console.log("User 2:", demoUser2, "- Permissions: EXECUTE (1)");
        console.log("\nToken Balances:");
        console.log("User 1:", 1000, "tokens");
        console.log("User 2:", 500, "tokens");
        console.log("==================================\n");
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/RoleManager.sol";

contract DeployRoleManager is Script {
    function run() external returns (RoleManager roleManager) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);
        roleManager = new RoleManager();
        vm.stopBroadcast();

        console.log("RoleManager deployed at:", address(roleManager));
        console.log("Admin:", vm.addr(deployerPrivateKey));
    }
}
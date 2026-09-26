// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/FeeHandler.sol";

contract DeployFeeHandler is Script {
    function run() external returns (FeeHandler feeHandler) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);
        feeHandler = new FeeHandler();
        vm.stopBroadcast();

        console.log("FeeHandler deployed at:", address(feeHandler));
        console.log("Owner:", vm.addr(deployerPrivateKey));
    }
}
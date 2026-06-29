// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/MarketCap.sol";

/// @title DeployMarketCap
/// @notice Deployment script for MarketCap contract
contract DeployMarketCap is Script {
    function run() external returns (MarketCap) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        MarketCap marketCap = new MarketCap();
        
        console.log("MarketCap deployed at:", address(marketCap));
        
        vm.stopBroadcast();
        
        return marketCap;
    }
}

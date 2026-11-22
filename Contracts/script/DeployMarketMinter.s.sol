// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MarketMinter.sol";

/// @title DeployMarketMinter
/// @notice Deployment script for MarketMinter contract.
///         Reads TOKEN_ADDRESS from the environment; the deployer private key
///         is read by vm.startBroadcast().
contract DeployMarketMinter is Script {
    function run() external returns (MarketMinter) {
        address tokenAddress = vm.envAddress("TOKEN_ADDRESS");
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        MarketMinter minter = new MarketMinter(tokenAddress);

        console.log("MarketMinter deployed at:", address(minter));
        console.log("Token address:", tokenAddress);

        vm.stopBroadcast();

        return minter;
    }
}

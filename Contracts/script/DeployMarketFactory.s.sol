// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MarketFactory.sol";
import "../src/PositionToken.sol";

/// @notice Deploy PositionToken and MarketFactory with their circular address binding.
contract DeployMarketFactory is Script {
    function run()
        external
        returns (PositionToken positionToken, MarketFactory marketFactory)
    {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        uint256 factoryNonce = vm.getNonce(deployer) + 1;
        address predictedFactory = vm.computeCreateAddress(deployer, factoryNonce);

        vm.startBroadcast(deployerPrivateKey);
        positionToken = new PositionToken(predictedFactory);
        marketFactory = new MarketFactory(address(positionToken));
        vm.stopBroadcast();

        require(address(marketFactory) == predictedFactory, "factory address mismatch");
        console.log("PositionToken deployed at:", address(positionToken));
        console.log("MarketFactory deployed at:", address(marketFactory));
        console.log("PositionToken factory binding:", positionToken.factory());
        console.log("Deployer:", deployer);
    }
}
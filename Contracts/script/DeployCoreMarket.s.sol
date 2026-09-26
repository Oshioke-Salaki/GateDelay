// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MarketMaker.sol";
import "../src/Trading.sol";

/// @notice Deploy the canonical LMSR MarketMaker and its fee/rebate wrapper.
contract DeployCoreMarket is Script {
    error InvalidCollateralToken(address collateralToken);

    function run() external returns (MarketMaker marketMaker, Trading trading) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address collateralToken = vm.envAddress("COLLATERAL_TOKEN_ADDRESS");
        uint256 feeBps = vm.envUint("TRADING_FEE_BPS");
        uint256 rebateBps = vm.envUint("TRADING_REBATE_BPS");
        address commissionRecipient = vm.envAddress("COMMISSION_RECIPIENT");

        if (collateralToken.code.length == 0) {
            revert InvalidCollateralToken(collateralToken);
        }

        vm.startBroadcast(deployerPrivateKey);
        marketMaker = new MarketMaker(collateralToken);
        trading = new Trading(
            address(marketMaker),
            feeBps,
            rebateBps,
            commissionRecipient
        );
        vm.stopBroadcast();

        console.log("MarketMaker deployed at:", address(marketMaker));
        console.log("Collateral token:", collateralToken);
        console.log("Trading deployed at:", address(trading));
        console.log("Trading fee (bps):", feeBps);
        console.log("Trading rebate (bps):", rebateBps);
        console.log("Commission recipient:", commissionRecipient);
        console.log("Deployer:", vm.addr(deployerPrivateKey));
    }
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {DeploymentRegistry} from "../src/DeploymentRegistry.sol";

/// @notice Write a deployment registry JSON file from environment variables.
/// @dev Output path defaults to `deployments/registry.json` (gitignored).
///      Required: REGISTRY_CHAIN_ID, REGISTRY_ABI_VERSION, and at least one address.
///      Optional addresses: TRADING_ADDRESS, MARKET_SETTLEMENT_ADDRESS, RESOLUTION_ADDRESS,
///      MARKET_BRIDGE_ADDRESS, MARKET_MINTER_ADDRESS, MARKET_WITHDRAW_ADDRESS.
contract WriteDeploymentRegistry is Script {
    error NoDeployedAddresses();

    function run() external {
        string memory outPath = vm.envOr("DEPLOYMENT_REGISTRY_OUT", string("deployments/registry.json"));
        uint256 chainId = vm.envUint("REGISTRY_CHAIN_ID");
        string memory abiVersion = vm.envString("REGISTRY_ABI_VERSION");

        string[6] memory names = [
            "Trading",
            "MarketSettlement",
            "Resolution",
            "MarketBridge",
            "MarketMinter",
            "MarketWithdraw"
        ];
        string[6] memory keys = [
            "TRADING_ADDRESS",
            "MARKET_SETTLEMENT_ADDRESS",
            "RESOLUTION_ADDRESS",
            "MARKET_BRIDGE_ADDRESS",
            "MARKET_MINTER_ADDRESS",
            "MARKET_WITHDRAW_ADDRESS"
        ];

        DeploymentRegistry.Entry[] memory staged = new DeploymentRegistry.Entry[](names.length);
        uint256 count;
        for (uint256 i; i < names.length; ++i) {
            address deployed = vm.envOr(keys[i], address(0));
            if (deployed == address(0)) continue;
            staged[count] = DeploymentRegistry.Entry({
                name: names[i],
                deployed: deployed,
                chainId: chainId,
                abiVersion: abiVersion
            });
            count++;
        }
        if (count == 0) revert NoDeployedAddresses();

        DeploymentRegistry.Entry[] memory entries = new DeploymentRegistry.Entry[](count);
        for (uint256 i; i < count; ++i) {
            entries[i] = staged[i];
        }

        string memory json = DeploymentRegistry.encode(entries);
        vm.writeFile(outPath, json);
        console2.log("Wrote deployment registry:", outPath);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {DeploymentRegistry} from "../src/DeploymentRegistry.sol";

contract DeploymentRegistryHarness {
    function encode(DeploymentRegistry.Entry[] memory entries) external pure returns (string memory) {
        return DeploymentRegistry.encode(entries);
    }
}

contract DeploymentRegistryTest is Test {
    DeploymentRegistryHarness internal harness = new DeploymentRegistryHarness();
    function test_encode_includesNameChainAddressAndAbiVersion() public pure {
        DeploymentRegistry.Entry[] memory entries = new DeploymentRegistry.Entry[](2);
        entries[0] = DeploymentRegistry.Entry({
            name: "MarketBridge",
            deployed: address(0xBEEF),
            chainId: 1,
            abiVersion: "1.0.0"
        });
        entries[1] = DeploymentRegistry.Entry({
            name: "MarketWithdraw",
            deployed: address(0xCAFE),
            chainId: 1,
            abiVersion: "1.0.0"
        });

        string memory json = DeploymentRegistry.encode(entries);
        assertEq(
            json,
            string.concat(
                '{"contracts":[',
                '{"name":"MarketBridge","address":"0x000000000000000000000000000000000000beef","chainId":1,"abiVersion":"1.0.0"},',
                '{"name":"MarketWithdraw","address":"0x000000000000000000000000000000000000cafe","chainId":1,"abiVersion":"1.0.0"}',
                "]}"
            )
        );
    }

    function test_encode_emptyList() public pure {
        DeploymentRegistry.Entry[] memory entries = new DeploymentRegistry.Entry[](0);
        assertEq(DeploymentRegistry.encode(entries), '{"contracts":[]}');
    }

    function test_encode_revertsOnZeroAddress() public {
        DeploymentRegistry.Entry[] memory entries = new DeploymentRegistry.Entry[](1);
        entries[0] = DeploymentRegistry.Entry({
            name: "Trading",
            deployed: address(0),
            chainId: 31337,
            abiVersion: "1.0.0"
        });
        vm.expectRevert(DeploymentRegistry.ZeroAddress.selector);
        harness.encode(entries);
    }

    function test_encode_revertsOnEmptyNameOrAbiVersion() public {
        DeploymentRegistry.Entry[] memory entries = new DeploymentRegistry.Entry[](1);
        entries[0] = DeploymentRegistry.Entry({
            name: "",
            deployed: address(1),
            chainId: 1,
            abiVersion: "1.0.0"
        });
        vm.expectRevert(DeploymentRegistry.EmptyName.selector);
        harness.encode(entries);

        entries[0].name = "Resolution";
        entries[0].abiVersion = "";
        vm.expectRevert(DeploymentRegistry.EmptyAbiVersion.selector);
        harness.encode(entries);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/UpgradeableMarket.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @notice Pins the slots documented in docs/UPGRADEABLE_MARKET_STORAGE_LAYOUT.md (#960).
contract UpgradeableMarketStorageLayoutTest is Test {
    bytes32 internal constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    bytes32 internal constant INITIALIZABLE_SLOT = 0xf0c57e16840df040f15088dc2f81fe391c3923bec73e23a9662efc9c229c6a00;

    UpgradeableMarket internal implementation;
    address internal proxy;

    function setUp() public {
        implementation = new UpgradeableMarket();
        proxy = address(new ERC1967Proxy(address(implementation), abi.encodeCall(UpgradeableMarket.initialize, ())));
    }

    function _slot(uint256 index) internal view returns (bytes32) {
        return vm.load(proxy, bytes32(index));
    }

    function test_VersionIsInSlot1() public view {
        assertEq(uint256(_slot(1)), UpgradeableMarket(proxy).getVersion());
    }

    function test_UpgradeHistoryIsInSlot2() public view {
        address[] memory history = UpgradeableMarket(proxy).getUpgradeHistory();
        assertEq(uint256(_slot(2)), history.length);
        bytes32 first = vm.load(proxy, keccak256(abi.encode(uint256(2))));
        assertEq(address(uint160(uint256(first))), history[0]);
    }

    function test_UpgradeTimestampsAreInSlot3() public {
        UpgradeableMarket next = new UpgradeableMarket();
        vm.prank(UpgradeableMarket(proxy).owner());
        UpgradeableMarket(proxy).upgradeToAndCall(address(next), "");

        bytes32 value = vm.load(proxy, keccak256(abi.encode(address(next), uint256(3))));
        assertEq(uint256(value), UpgradeableMarket(proxy).getUpgradeTimestamp(address(next)));
        assertGt(uint256(value), 0);
    }

    function test_UpgradeLockedIsTheFirstByteOfSlot4() public {
        assertEq(uint256(_slot(4)), 0);
        vm.prank(UpgradeableMarket(proxy).owner());
        UpgradeableMarket(proxy).lockUpgrades();
        assertEq(uint256(_slot(4)), 1);
    }

    function test_OwnerIsInSlot0() public view {
        assertEq(address(uint160(uint256(_slot(0)))), UpgradeableMarket(proxy).owner());
    }

    function test_ImplementationIsInTheEip1967Slot() public view {
        assertEq(address(uint160(uint256(vm.load(proxy, IMPLEMENTATION_SLOT)))), address(implementation));
    }

    function test_InitializableStateIsInItsNamespacedSlot() public view {
        // _initialized (uint64) is the low 8 bytes; initialize() sets it to 1.
        assertEq(uint64(uint256(vm.load(proxy, INITIALIZABLE_SLOT))), 1);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/UpgradeableMarket.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {UUPSUpgradeable as OZUUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

/// @dev A second implementation, to prove the new logic is live after an upgrade.
contract UpgradeableMarketV2 is UpgradeableMarket {
    function v2Marker() external pure returns (string memory) {
        return "v2";
    }
}

/// @notice Upgrade authorization and state preservation for UpgradeableMarket
///         behind a real ERC1967 proxy (#959).
contract UpgradeableMarketUpgradeAuthTest is Test {
    UpgradeableMarket internal market;
    UpgradeableMarket internal implementation;

    address internal owner = address(0xA11CE);
    address internal attacker = address(0xBAD);
    address internal newOwner = address(0xC0FFEE);

    function setUp() public {
        vm.startPrank(owner);
        implementation = new UpgradeableMarket();
        market = UpgradeableMarket(
            address(new ERC1967Proxy(address(implementation), abi.encodeCall(UpgradeableMarket.initialize, ())))
        );
        vm.stopPrank();
    }

    // --- Authorization ---------------------------------------------------

    function test_DeployerOwnsTheProxy() public view {
        assertEq(market.owner(), owner);
    }

    function test_OwnerCanUpgrade() public {
        UpgradeableMarketV2 v2 = new UpgradeableMarketV2();
        vm.prank(owner);
        market.upgradeToAndCall(address(v2), "");

        assertEq(market.getImplementation(), address(v2));
        assertEq(UpgradeableMarketV2(address(market)).v2Marker(), "v2");
    }

    function test_NonOwnerCannotUpgrade() public {
        UpgradeableMarketV2 v2 = new UpgradeableMarketV2();
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        market.upgradeToAndCall(address(v2), "");

        assertEq(market.getImplementation(), address(implementation));
    }

    function test_NewOwnerCanUpgradeAndPreviousOwnerCannot() public {
        vm.prank(owner);
        market.transferOwnership(newOwner);

        UpgradeableMarketV2 v2 = new UpgradeableMarketV2();
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, owner));
        market.upgradeToAndCall(address(v2), "");

        vm.prank(newOwner);
        market.upgradeToAndCall(address(v2), "");
        assertEq(market.getImplementation(), address(v2));
    }

    function test_RenouncedOwnershipBlocksUpgrades() public {
        vm.prank(owner);
        market.renounceOwnership();

        UpgradeableMarketV2 v2 = new UpgradeableMarketV2();
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, owner));
        market.upgradeToAndCall(address(v2), "");
    }

    function test_LockedUpgradesRejectEvenTheOwner() public {
        vm.prank(owner);
        market.lockUpgrades();

        UpgradeableMarketV2 v2 = new UpgradeableMarketV2();
        vm.prank(owner);
        vm.expectRevert("Upgrade locked");
        market.upgradeToAndCall(address(v2), "");
    }

    function test_UpgradeToANonContractIsRejected() public {
        vm.prank(owner);
        vm.expectRevert("New implementation not a contract");
        market.upgradeToAndCall(address(0x1234), "");
    }

    // --- The implementation itself --------------------------------------

    function test_ImplementationCannotBeInitialized() public {
        vm.prank(attacker);
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        implementation.initialize();
    }

    function test_ImplementationCannotBeUpgradedDirectly() public {
        UpgradeableMarketV2 v2 = new UpgradeableMarketV2();
        vm.prank(attacker);
        vm.expectRevert(OZUUPSUpgradeable.UUPSUnauthorizedCallContext.selector);
        implementation.upgradeToAndCall(address(v2), "");
    }

    function test_ProxyCannotBeInitializedTwice() public {
        vm.prank(attacker);
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        market.initialize();
        assertEq(market.owner(), owner);
    }

    // --- State preservation ----------------------------------------------

    function test_StateIsPreservedAcrossAnUpgrade() public {
        UpgradeableMarket first = new UpgradeableMarket();
        vm.prank(owner);
        market.upgradeToAndCall(address(first), "");
        uint256 firstUpgradedAt = market.getUpgradeTimestamp(address(first));

        vm.warp(block.timestamp + 1 days);
        UpgradeableMarketV2 v2 = new UpgradeableMarketV2();
        vm.prank(owner);
        market.upgradeToAndCall(address(v2), "");

        UpgradeableMarketV2 upgraded = UpgradeableMarketV2(address(market));
        assertEq(upgraded.owner(), owner);
        assertEq(upgraded.getVersion(), 3);
        assertEq(upgraded.getUpgradeTimestamp(address(first)), firstUpgradedAt);
        assertFalse(upgraded.isUpgradeLocked());

        address[] memory history = upgraded.getUpgradeHistory();
        assertEq(history.length, 3);
        assertEq(history[0], address(market));
        assertEq(history[1], address(first));
        assertEq(history[2], address(v2));
    }

    function test_LockSurvivesAnUpgradeAndStillBindsTheNewLogic() public {
        UpgradeableMarketV2 v2 = new UpgradeableMarketV2();
        vm.prank(owner);
        market.upgradeToAndCall(address(v2), "");
        vm.prank(owner);
        market.lockUpgrades();

        UpgradeableMarket v3 = new UpgradeableMarket();
        vm.prank(owner);
        vm.expectRevert("Upgrade locked");
        market.upgradeToAndCall(address(v3), "");
        assertEq(market.getImplementation(), address(v2));
    }
}

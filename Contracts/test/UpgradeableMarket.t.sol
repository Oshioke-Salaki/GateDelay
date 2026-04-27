// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/UpgradeableMarket.sol";

contract UpgradeableMarketTest is Test {
    UpgradeableMarket internal market;
    UpgradeableMarket internal newImplementation;
    
    address internal owner = address(0xA11CE);
    address internal user = address(0xB0B);

    function setUp() public {
        vm.prank(owner);
        market = new UpgradeableMarket();
        
        vm.prank(owner);
        market.initialize();
    }

    // -------------------------------------------------------------------------
    // Initialization Tests
    // -------------------------------------------------------------------------

    function test_InitialVersion() public {
        assertEq(market.getVersion(), 1);
    }

    function test_InitialUpgradeHistory() public {
        address[] memory history = market.getUpgradeHistory();
        assertEq(history.length, 1);
    }

    function test_InitiallyNotLocked() public {
        assertFalse(market.isUpgradeLocked());
    }

    // -------------------------------------------------------------------------
    // Upgrade Authorization Tests
    // -------------------------------------------------------------------------

    function test_AuthorizeUpgrade() public {
        newImplementation = new UpgradeableMarket();
        
        vm.prank(owner);
        vm.expectEmit(true, true, false, false);
        emit UpgradeableMarket.UpgradeAuthorized(address(newImplementation), owner);
        market.authorizeUpgrade(address(newImplementation));
    }

    function test_AuthorizeUpgradeRejectsZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert("Invalid implementation");
        market.authorizeUpgrade(address(0));
    }

    function test_AuthorizeUpgradeRejectsSameImplementation() public {
        vm.prank(owner);
        vm.expectRevert("Same implementation");
        market.authorizeUpgrade(market.getImplementation());
    }

    function test_AuthorizeUpgradeRejectsNonOwner() public {
        newImplementation = new UpgradeableMarket();
        
        vm.prank(user);
        vm.expectRevert();
        market.authorizeUpgrade(address(newImplementation));
    }

    function test_AuthorizeUpgradeRejectsWhenLocked() public {
        newImplementation = new UpgradeableMarket();
        
        vm.prank(owner);
        market.lockUpgrades();
        
        vm.prank(owner);
        vm.expectRevert("Upgrade locked");
        market.authorizeUpgrade(address(newImplementation));
    }

    // -------------------------------------------------------------------------
    // Upgrade Execution Tests
    // -------------------------------------------------------------------------

    function test_UpgradeToAndCall() public {
        newImplementation = new UpgradeableMarket();
        
        vm.prank(owner);
        market.upgradeToAndCall(address(newImplementation), "");
        
        assertEq(market.getVersion(), 2);
    }

    function test_UpgradeToAndCallEmitsEvent() public {
        newImplementation = new UpgradeableMarket();
        address oldImpl = market.getImplementation();
        
        vm.prank(owner);
        vm.expectEmit(true, true, false, false);
        emit UpgradeableMarket.UpgradeExecuted(oldImpl, address(newImplementation));
        market.upgradeToAndCall(address(newImplementation), "");
    }

    function test_UpgradeToAndCallIncrementsVersion() public {
        newImplementation = new UpgradeableMarket();
        
        assertEq(market.getVersion(), 1);
        
        vm.prank(owner);
        market.upgradeToAndCall(address(newImplementation), "");
        
        assertEq(market.getVersion(), 2);
    }

    function test_UpgradeToAndCallUpdatesHistory() public {
        newImplementation = new UpgradeableMarket();
        
        vm.prank(owner);
        market.upgradeToAndCall(address(newImplementation), "");
        
        address[] memory history = market.getUpgradeHistory();
        assertEq(history.length, 2);
        assertEq(history[1], address(newImplementation));
    }

    function test_UpgradeToAndCallRecordsTimestamp() public {
        newImplementation = new UpgradeableMarket();
        
        vm.prank(owner);
        uint256 blockTime = block.timestamp;
        market.upgradeToAndCall(address(newImplementation), "");
        
        assertEq(market.getUpgradeTimestamp(address(newImplementation)), blockTime);
    }

    function test_UpgradeToAndCallRejectsZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert("Invalid implementation");
        market.upgradeToAndCall(address(0), "");
    }

    function test_UpgradeToAndCallRejectsNonOwner() public {
        newImplementation = new UpgradeableMarket();
        
        vm.prank(user);
        vm.expectRevert();
        market.upgradeToAndCall(address(newImplementation), "");
    }

    function test_UpgradeToAndCallRejectsWhenLocked() public {
        newImplementation = new UpgradeableMarket();
        
        vm.prank(owner);
        market.lockUpgrades();
        
        vm.prank(owner);
        vm.expectRevert("Upgrade locked");
        market.upgradeToAndCall(address(newImplementation), "");
    }

    // -------------------------------------------------------------------------
    // Upgrade Lock Tests
    // -------------------------------------------------------------------------

    function test_LockUpgrades() public {
        vm.prank(owner);
        market.lockUpgrades();
        assertTrue(market.isUpgradeLocked());
    }

    function test_LockUpgradesRejectsNonOwner() public {
        vm.prank(user);
        vm.expectRevert();
        market.lockUpgrades();
    }

    function test_LockUpgradesRejectsWhenAlreadyLocked() public {
        vm.prank(owner);
        market.lockUpgrades();
        
        vm.prank(owner);
        vm.expectRevert("Already locked");
        market.lockUpgrades();
    }

    function test_UnlockUpgrades() public {
        vm.prank(owner);
        market.lockUpgrades();
        assertTrue(market.isUpgradeLocked());
        
        vm.prank(owner);
        market.unlockUpgrades();
        assertFalse(market.isUpgradeLocked());
    }

    function test_UnlockUpgradesRejectsNonOwner() public {
        vm.prank(owner);
        market.lockUpgrades();
        
        vm.prank(user);
        vm.expectRevert();
        market.unlockUpgrades();
    }

    function test_UnlockUpgradesRejectsWhenNotLocked() public {
        vm.prank(owner);
        vm.expectRevert("Not locked");
        market.unlockUpgrades();
    }

    // -------------------------------------------------------------------------
    // State Maintenance Tests
    // -------------------------------------------------------------------------

    function test_StatePreservedAfterUpgrade() public {
        newImplementation = new UpgradeableMarket();
        
        vm.prank(owner);
        market.upgradeToAndCall(address(newImplementation), "");
        
        // Version should be incremented
        assertEq(market.getVersion(), 2);
        
        // History should be maintained
        address[] memory history = market.getUpgradeHistory();
        assertEq(history.length, 2);
    }

    // -------------------------------------------------------------------------
    // Query Tests
    // -------------------------------------------------------------------------

    function test_GetVersion() public {
        assertEq(market.getVersion(), 1);
    }

    function test_GetUpgradeHistory() public {
        address[] memory history = market.getUpgradeHistory();
        assertEq(history.length, 1);
    }

    function test_GetUpgradeTimestamp() public {
        address impl = market.getImplementation();
        uint256 timestamp = market.getUpgradeTimestamp(impl);
        assertGt(timestamp, 0);
    }

    function test_GetImplementation() public {
        address impl = market.getImplementation();
        assertNotEq(impl, address(0));
    }

    function test_GetContractState() public {
        (uint256 version, bool locked) = market.getContractState();
        assertEq(version, 1);
        assertFalse(locked);
    }

    function test_GetContractStateAfterLock() public {
        vm.prank(owner);
        market.lockUpgrades();
        
        (uint256 version, bool locked) = market.getContractState();
        assertEq(version, 1);
        assertTrue(locked);
    }

    // -------------------------------------------------------------------------
    // Market Operations Tests
    // -------------------------------------------------------------------------

    function test_ExecuteMarketOperation() public {
        assertTrue(market.executeMarketOperation());
    }

    function test_MultipleUpgrades() public {
        newImplementation = new UpgradeableMarket();
        
        vm.prank(owner);
        market.upgradeToAndCall(address(newImplementation), "");
        assertEq(market.getVersion(), 2);
        
        UpgradeableMarket anotherImplementation = new UpgradeableMarket();
        
        vm.prank(owner);
        market.upgradeToAndCall(address(anotherImplementation), "");
        assertEq(market.getVersion(), 3);
        
        address[] memory history = market.getUpgradeHistory();
        assertEq(history.length, 3);
    }
}

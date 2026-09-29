// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/UpgradeableMarket.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title UpgradeAuthorizationFuzz
/// @notice Fuzz tests for UUPS upgrade authorization and state preservation
/// @dev Tests #959: Verify only authorized roles can upgrade implementations and state is preserved
contract UpgradeAuthorizationFuzz is Test {
    UpgradeableMarket internal implementation;
    UpgradeableMarket internal proxy;
    address internal owner;
    address internal nonOwner;
    address internal user1;

    function setUp() public {
        owner = address(this);
        nonOwner = makeAddr("nonOwner");
        user1 = makeAddr("user1");

        // Deploy implementation
        implementation = new UpgradeableMarket();
        
        // Deploy proxy
        bytes memory initData = abi.encodeCall(implementation.initialize, ());
        ERC1967Proxy proxyContract = new ERC1967Proxy(address(implementation), initData);
        proxy = UpgradeableMarket(address(proxyContract));
    }

    /// @notice Fuzz test: Upgrade authorization with non-owner
    function testFuzz_UnauthorizedUpgrade(address unauthorized) public {
        vm.assume(unauthorized != owner);
        vm.assume(unauthorized != address(0));
        vm.assume(unauthorized.code.length == 0);

        UpgradeableMarket newImpl = new UpgradeableMarket();

        vm.prank(unauthorized);
        vm.expectRevert();
        proxy.upgradeToAndCall(address(newImpl), "");
    }

    /// @notice Fuzz test: Upgrade with valid implementation
    function testFuzz_ValidUpgrade(uint8 upgradeCount) public {
        upgradeCount = uint8(bound(upgradeCount, 1, 10));

        uint256 initialVersion = proxy.getVersion();
        
        for (uint256 i = 0; i < upgradeCount; i++) {
            UpgradeableMarket newImpl = new UpgradeableMarket();
            
            proxy.upgradeToAndCall(address(newImpl), "");
            
            assertEq(proxy.getVersion(), initialVersion + i + 1, "Version should increment");
        }
    }

    /// @notice Fuzz test: State preservation across upgrades
    function testFuzz_StatePreservation(uint256 upgradeDelay) public {
        upgradeDelay = bound(upgradeDelay, 0, 365 days);

        uint256 versionBefore = proxy.getVersion();
        address[] memory historyBefore = proxy.getUpgradeHistory();
        
        vm.warp(block.timestamp + upgradeDelay);
        
        UpgradeableMarket newImpl = new UpgradeableMarket();
        proxy.upgradeToAndCall(address(newImpl), "");

        // Verify version incremented
        assertEq(proxy.getVersion(), versionBefore + 1, "Version should increment by 1");
        
        // Verify history preserved and extended
        address[] memory historyAfter = proxy.getUpgradeHistory();
        assertEq(historyAfter.length, historyBefore.length + 1, "History should grow by 1");
        
        for (uint256 i = 0; i < historyBefore.length; i++) {
            assertEq(historyAfter[i], historyBefore[i], "Previous history should be preserved");
        }
    }

    /// @notice Fuzz test: Lock and unlock cycles
    function testFuzz_LockUnlockCycles(uint8 cycles) public {
        cycles = uint8(bound(cycles, 1, 10));

        for (uint256 i = 0; i < cycles; i++) {
            // Lock
            proxy.lockUpgrades();
            assertTrue(proxy.isUpgradeLocked(), "Should be locked");

            // Try upgrade (should fail)
            UpgradeableMarket newImpl = new UpgradeableMarket();
            vm.expectRevert("Upgrade locked");
            proxy.upgradeToAndCall(address(newImpl), "");

            // Unlock
            proxy.unlockUpgrades();
            assertFalse(proxy.isUpgradeLocked(), "Should be unlocked");

            // Upgrade should work now
            proxy.upgradeToAndCall(address(newImpl), "");
        }
    }

    /// @notice Fuzz test: Upgrade authorization with lock state
    function testFuzz_UpgradeWithLock(bool locked) public {
        if (locked) {
            proxy.lockUpgrades();
        }

        UpgradeableMarket newImpl = new UpgradeableMarket();

        if (locked) {
            vm.expectRevert("Upgrade locked");
            proxy.upgradeToAndCall(address(newImpl), "");
        } else {
            proxy.upgradeToAndCall(address(newImpl), "");
            assertGt(proxy.getVersion(), 1, "Version should increase");
        }
    }

    /// @notice Fuzz test: Multiple sequential upgrades
    function testFuzz_SequentialUpgrades(uint8 count) public {
        count = uint8(bound(count, 1, 20));

        address[] memory implementations = new address[](count);
        
        for (uint256 i = 0; i < count; i++) {
            UpgradeableMarket newImpl = new UpgradeableMarket();
            implementations[i] = address(newImpl);
            
            proxy.upgradeToAndCall(implementations[i], "");
        }

        // Verify all implementations are in history
        address[] memory history = proxy.getUpgradeHistory();
        assertEq(history.length, count + 1, "History should include all implementations");
        
        // Verify version matches upgrade count
        assertEq(proxy.getVersion(), count + 1, "Version should match upgrade count");
    }

    /// @notice Fuzz test: Upgrade timing variations
    function testFuzz_UpgradeTiming(
        uint256 delay1,
        uint256 delay2,
        uint256 delay3
    ) public {
        delay1 = bound(delay1, 0, 30 days);
        delay2 = bound(delay2, 0, 30 days);
        delay3 = bound(delay3, 0, 30 days);

        uint256 startTime = block.timestamp;

        // First upgrade
        vm.warp(startTime + delay1);
        UpgradeableMarket impl1 = new UpgradeableMarket();
        proxy.upgradeToAndCall(address(impl1), "");
        uint256 ts1 = proxy.getUpgradeTimestamp(address(impl1));
        assertEq(ts1, block.timestamp, "Timestamp should match");

        // Second upgrade
        vm.warp(startTime + delay1 + delay2);
        UpgradeableMarket impl2 = new UpgradeableMarket();
        proxy.upgradeToAndCall(address(impl2), "");
        uint256 ts2 = proxy.getUpgradeTimestamp(address(impl2));
        assertEq(ts2, block.timestamp, "Timestamp should match");

        // Third upgrade
        vm.warp(startTime + delay1 + delay2 + delay3);
        UpgradeableMarket impl3 = new UpgradeableMarket();
        proxy.upgradeToAndCall(address(impl3), "");
        uint256 ts3 = proxy.getUpgradeTimestamp(address(impl3));
        assertEq(ts3, block.timestamp, "Timestamp should match");

        // Verify ordering
        assertLe(ts1, ts2, "Timestamps should be ordered");
        assertLe(ts2, ts3, "Timestamps should be ordered");
    }

    /// @notice Fuzz test: Authorization checks with random addresses
    function testFuzz_AuthorizationChecks(address caller) public {
        vm.assume(caller != owner);
        vm.assume(caller != address(0));
        vm.assume(caller != address(proxy));
        
        UpgradeableMarket newImpl = new UpgradeableMarket();

        vm.prank(caller);
        vm.expectRevert();
        proxy.authorizeUpgrade(address(newImpl));
    }

    /// @notice Fuzz test: Contract state after multiple upgrades
    function testFuzz_StateAfterMultipleUpgrades(uint8 upgradeCount) public {
        upgradeCount = uint8(bound(upgradeCount, 1, 15));

        for (uint256 i = 0; i < upgradeCount; i++) {
            UpgradeableMarket newImpl = new UpgradeableMarket();
            proxy.upgradeToAndCall(address(newImpl), "");

            // Verify state consistency after each upgrade
            (uint256 version, bool locked) = proxy.getContractState();
            assertEq(version, i + 2, "Version should match upgrade count");
            assertFalse(locked, "Should not be locked");
            
            // Verify market operation still works
            assertTrue(proxy.executeMarketOperation(), "Market operation should work");
        }
    }

    /// @notice Fuzz test: Upgrade authorization followed by operation
    function testFuzz_UpgradeAndOperate(bool shouldUpgrade) public {
        if (shouldUpgrade) {
            UpgradeableMarket newImpl = new UpgradeableMarket();
            proxy.upgradeToAndCall(address(newImpl), "");
        }

        // Market operations should work regardless
        bool result = proxy.executeMarketOperation();
        assertTrue(result, "Operation should succeed");
    }

    /// @notice Fuzz test: Lock timing variations
    function testFuzz_LockTiming(
        uint256 lockDelay,
        uint256 unlockDelay
    ) public {
        lockDelay = bound(lockDelay, 0, 30 days);
        unlockDelay = bound(unlockDelay, 1, 30 days);

        uint256 startTime = block.timestamp;

        // Wait and lock
        vm.warp(startTime + lockDelay);
        proxy.lockUpgrades();
        assertTrue(proxy.isUpgradeLocked());

        // Wait and unlock
        vm.warp(startTime + lockDelay + unlockDelay);
        proxy.unlockUpgrades();
        assertFalse(proxy.isUpgradeLocked());
    }

    /// @notice Fuzz test: Upgrade history integrity
    function testFuzz_HistoryIntegrity(uint8 upgradeCount) public {
        upgradeCount = uint8(bound(upgradeCount, 1, 10));

        address[] memory implementations = new address[](upgradeCount);
        
        for (uint256 i = 0; i < upgradeCount; i++) {
            UpgradeableMarket newImpl = new UpgradeableMarket();
            implementations[i] = address(newImpl);
            proxy.upgradeToAndCall(implementations[i], "");
        }

        address[] memory history = proxy.getUpgradeHistory();
        
        // Verify history length
        assertEq(history.length, upgradeCount + 1, "History length should match");
        
        // Verify implementations are in history (excluding initial)
        for (uint256 i = 0; i < upgradeCount; i++) {
            assertEq(history[i + 1], implementations[i], "Implementation should be in history");
            
            // Verify timestamp exists
            uint256 timestamp = proxy.getUpgradeTimestamp(implementations[i]);
            assertGt(timestamp, 0, "Timestamp should be recorded");
        }
    }

    /// @notice Fuzz test: Zero address protection
    function testFuzz_ZeroAddressProtection() public {
        vm.expectRevert("Invalid implementation");
        proxy.upgradeToAndCall(address(0), "");
    }

    /// @notice Fuzz test: Same implementation protection
    function testFuzz_SameImplementationProtection() public {
        address currentImpl = proxy.getImplementation();
        
        vm.expectRevert("Invalid implementation");
        proxy.upgradeToAndCall(currentImpl, "");
    }

    /// @notice Fuzz test: Complex upgrade scenarios
    function testFuzz_ComplexScenario(
        bool lock1,
        bool upgrade1,
        bool unlock1,
        bool lock2,
        bool upgrade2
    ) public {
        UpgradeableMarket impl1 = new UpgradeableMarket();
        UpgradeableMarket impl2 = new UpgradeableMarket();

        // First lock/unlock cycle
        if (lock1) {
            proxy.lockUpgrades();
        }

        if (upgrade1) {
            if (lock1) {
                vm.expectRevert("Upgrade locked");
                proxy.upgradeToAndCall(address(impl1), "");
            } else {
                proxy.upgradeToAndCall(address(impl1), "");
            }
        }

        if (unlock1 && lock1) {
            proxy.unlockUpgrades();
        }

        // Second lock/unlock cycle
        if (lock2 && (!lock1 || unlock1)) {
            proxy.lockUpgrades();
        }

        if (upgrade2) {
            bool isLocked = lock2 && (!lock1 || unlock1);
            if (isLocked) {
                vm.expectRevert("Upgrade locked");
                proxy.upgradeToAndCall(address(impl2), "");
            } else if (upgrade1 && !lock1) {
                proxy.upgradeToAndCall(address(impl2), "");
            }
        }
    }
}

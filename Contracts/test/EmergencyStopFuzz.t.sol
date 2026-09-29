// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/EmergencyStop.sol";

/// @title EmergencyStopFuzz
/// @notice Fuzz tests for emergency stop effects on active trades, withdrawals, and settlements
/// @dev Tests #961: Test how emergency stop affects active trades, queued withdrawals, and settlement operations
contract EmergencyStopFuzz is Test {
    EmergencyStop internal emergency;
    
    address internal admin;
    address internal emergencyOperator;
    address internal recoveryOperator;
    address internal user;

    // Mock state for testing
    struct Trade {
        address trader;
        uint256 amount;
        bool active;
        uint256 timestamp;
    }

    struct Withdrawal {
        address user;
        uint256 amount;
        bool pending;
        uint256 queuedAt;
    }

    struct Settlement {
        uint256 id;
        uint256 amount;
        bool completed;
    }

    Trade[] internal activeTrades;
    Withdrawal[] internal pendingWithdrawals;
    Settlement[] internal settlements;

    function setUp() public {
        admin = address(this);
        emergencyOperator = makeAddr("emergencyOp");
        recoveryOperator = makeAddr("recoveryOp");
        user = makeAddr("user");

        emergency = new EmergencyStop(admin);
        emergency.grantEmergencyRole(emergencyOperator);
        emergency.grantRecoveryRole(recoveryOperator);
    }

    /// @notice Fuzz test: Emergency activation blocks new trades
    function testFuzz_EmergencyBlocksNewTrades(
        uint256 tradeAmount,
        address trader
    ) public {
        vm.assume(trader != address(0));
        tradeAmount = bound(tradeAmount, 1, type(uint128).max);

        // Activate emergency
        vm.prank(emergencyOperator);
        emergency.activateEmergencyStop("Trade halt");

        // Attempt to create trade
        if (emergency.isEmergencyActive()) {
            // Should block
            vm.expectRevert("Emergency stop active");
            _createTrade(trader, tradeAmount);
        }
    }

    /// @notice Fuzz test: Active trades during emergency
    function testFuzz_ActiveTradesDuringEmergency(
        uint8 tradeCount,
        uint256 baseAmount
    ) public {
        tradeCount = uint8(bound(tradeCount, 1, 20));
        baseAmount = bound(baseAmount, 1e18, 1e24);

        // Create active trades
        for (uint256 i = 0; i < tradeCount; i++) {
            address trader = address(uint160(0x1000 + i));
            _createTrade(trader, baseAmount + i);
        }

        assertEq(activeTrades.length, tradeCount, "Trades should be created");

        // Activate emergency
        vm.prank(emergencyOperator);
        emergency.activateEmergencyStop("Active trades test");

        // Verify trades are frozen
        for (uint256 i = 0; i < activeTrades.length; i++) {
            assertTrue(activeTrades[i].active, "Trade should remain active");
            
            // But operations should be blocked
            vm.expectRevert("Emergency stop active");
            _settleTrade(i);
        }
    }

    /// @notice Fuzz test: Pending withdrawals during emergency
    function testFuzz_PendingWithdrawalsDuringEmergency(
        uint8 withdrawalCount,
        uint256 baseAmount
    ) public {
        withdrawalCount = uint8(bound(withdrawalCount, 1, 20));
        baseAmount = bound(baseAmount, 1e18, 1e24);

        // Queue withdrawals
        for (uint256 i = 0; i < withdrawalCount; i++) {
            address withdrawer = address(uint160(0x2000 + i));
            _queueWithdrawal(withdrawer, baseAmount + i);
        }

        assertEq(pendingWithdrawals.length, withdrawalCount, "Withdrawals should be queued");

        // Activate emergency
        vm.prank(emergencyOperator);
        emergency.activateEmergencyStop("Withdrawal freeze");

        // Attempt to process withdrawals
        for (uint256 i = 0; i < pendingWithdrawals.length; i++) {
            vm.expectRevert("Emergency stop active");
            _processWithdrawal(i);
        }
    }

    /// @notice Fuzz test: Settlement operations during emergency
    function testFuzz_SettlementDuringEmergency(
        uint8 settlementCount,
        uint256 baseAmount
    ) public {
        settlementCount = uint8(bound(settlementCount, 1, 15));
        baseAmount = bound(baseAmount, 1e18, 1e24);

        // Create pending settlements
        for (uint256 i = 0; i < settlementCount; i++) {
            settlements.push(Settlement({
                id: i,
                amount: baseAmount + i,
                completed: false
            }));
        }

        // Activate emergency
        vm.prank(emergencyOperator);
        emergency.activateEmergencyStop("Settlement halt");

        // Attempt settlements
        for (uint256 i = 0; i < settlements.length; i++) {
            vm.expectRevert("Emergency stop active");
            _attemptSettlement(i);
        }
    }

    /// @notice Fuzz test: Recovery process with pending operations
    function testFuzz_RecoveryWithPendingOps(
        uint8 tradeCount,
        uint8 withdrawalCount
    ) public {
        tradeCount = uint8(bound(tradeCount, 1, 10));
        withdrawalCount = uint8(bound(withdrawalCount, 1, 10));

        // Create pending operations
        for (uint256 i = 0; i < tradeCount; i++) {
            _createTrade(address(uint160(0x3000 + i)), 1 ether + i);
        }
        for (uint256 i = 0; i < withdrawalCount; i++) {
            _queueWithdrawal(address(uint160(0x4000 + i)), 1 ether + i);
        }

        // Emergency stop
        vm.prank(emergencyOperator);
        emergency.activateEmergencyStop("System halt");

        // Initiate recovery
        vm.prank(recoveryOperator);
        emergency.initiateRecovery();
        assertTrue(emergency.isRecoveryInProgress());

        // Complete recovery
        vm.prank(recoveryOperator);
        emergency.completeRecovery();

        // Operations should work again
        _createTrade(user, 1 ether);
        assertGt(activeTrades.length, tradeCount, "New trade should be created");
    }

    /// @notice Fuzz test: Emergency timing variations
    function testFuzz_EmergencyTiming(
        uint256 activationDelay,
        uint256 recoveryDelay
    ) public {
        activationDelay = bound(activationDelay, 0, 30 days);
        recoveryDelay = bound(recoveryDelay, 1 hours, 30 days);

        uint256 startTime = block.timestamp;

        // Wait before activation
        vm.warp(startTime + activationDelay);
        
        vm.prank(emergencyOperator);
        emergency.activateEmergencyStop("Timing test");
        
        uint256 activationTime = emergency.getEmergencyActivatedAt();
        assertEq(activationTime, block.timestamp);

        // Wait before recovery
        vm.warp(activationTime + recoveryDelay);
        
        vm.prank(recoveryOperator);
        emergency.initiateRecovery();
        
        vm.prank(recoveryOperator);
        emergency.completeRecovery();

        assertFalse(emergency.isEmergencyActive());
    }

    /// @notice Fuzz test: Multiple emergency cycles
    function testFuzz_MultipleEmergencyCycles(
        uint8 cycles,
        uint256 operationsPerCycle
    ) public {
        cycles = uint8(bound(cycles, 1, 5));
        operationsPerCycle = bound(operationsPerCycle, 1, 10);

        for (uint256 i = 0; i < cycles; i++) {
            // Normal operations
            for (uint256 j = 0; j < operationsPerCycle; j++) {
                _createTrade(address(uint160(0x5000 + i * 100 + j)), 1 ether);
            }

            // Emergency
            vm.prank(emergencyOperator);
            emergency.activateEmergencyStop("Cycle test");

            // Recovery
            vm.prank(recoveryOperator);
            emergency.initiateRecovery();
            
            vm.prank(recoveryOperator);
            emergency.completeRecovery();
        }

        // Verify all operations completed
        assertEq(activeTrades.length, cycles * operationsPerCycle);
    }

    /// @notice Fuzz test: Withdrawal queue behavior during emergency
    function testFuzz_WithdrawalQueueDuringEmergency(
        uint256[10] memory amounts,
        bool emergencyActive
    ) public {
        // Queue withdrawals
        for (uint256 i = 0; i < amounts.length; i++) {
            amounts[i] = bound(amounts[i], 1e18, 1e24);
            _queueWithdrawal(address(uint160(0x6000 + i)), amounts[i]);
        }

        if (emergencyActive) {
            vm.prank(emergencyOperator);
            emergency.activateEmergencyStop("Queue test");

            // All withdrawals should be blocked
            for (uint256 i = 0; i < pendingWithdrawals.length; i++) {
                vm.expectRevert("Emergency stop active");
                _processWithdrawal(i);
            }
        } else {
            // Process should work normally
            _processWithdrawal(0);
            assertFalse(pendingWithdrawals[0].pending);
        }
    }

    /// @notice Fuzz test: Trade settlement attempts during emergency
    function testFuzz_TradeSettlementAttempts(
        uint8 attemptCount,
        uint256 baseAmount
    ) public {
        attemptCount = uint8(bound(attemptCount, 1, 20));
        baseAmount = bound(baseAmount, 1e18, 1e24);

        // Create trades
        for (uint256 i = 0; i < attemptCount; i++) {
            _createTrade(address(uint160(0x7000 + i)), baseAmount + i);
        }

        // Activate emergency
        vm.prank(emergencyOperator);
        emergency.activateEmergencyStop("Settlement test");

        // Track failed attempts
        uint256 failedCount = 0;
        for (uint256 i = 0; i < attemptCount; i++) {
            try this.externalSettleTrade(i) {
                // Should not succeed
            } catch {
                failedCount++;
            }
        }

        assertEq(failedCount, attemptCount, "All settlements should fail");
    }

    /// @notice Fuzz test: Emergency deactivation and operation resume
    function testFuzz_DeactivationAndResume(
        uint8 operationCount,
        bool useRecovery
    ) public {
        operationCount = uint8(bound(operationCount, 1, 15));

        // Activate emergency
        vm.prank(emergencyOperator);
        emergency.activateEmergencyStop("Deactivation test");

        if (useRecovery) {
            vm.prank(recoveryOperator);
            emergency.initiateRecovery();
            
            vm.prank(recoveryOperator);
            emergency.completeRecovery();
        } else {
            vm.prank(emergencyOperator);
            emergency.deactivateEmergencyStop();
        }

        // Resume operations
        for (uint256 i = 0; i < operationCount; i++) {
            _createTrade(address(uint160(0x8000 + i)), 1 ether + i);
        }

        assertEq(activeTrades.length, operationCount);
    }

    /// @notice Fuzz test: Complex operation sequence with emergency
    function testFuzz_ComplexSequence(
        uint256 trades1,
        uint256 withdrawals1,
        uint256 trades2,
        uint256 withdrawals2
    ) public {
        trades1 = bound(trades1, 1, 5);
        withdrawals1 = bound(withdrawals1, 1, 5);
        trades2 = bound(trades2, 1, 5);
        withdrawals2 = bound(withdrawals2, 1, 5);

        // Phase 1: Normal operations
        for (uint256 i = 0; i < trades1; i++) {
            _createTrade(address(uint160(0x9000 + i)), 1 ether);
        }
        for (uint256 i = 0; i < withdrawals1; i++) {
            _queueWithdrawal(address(uint160(0x9100 + i)), 1 ether);
        }

        // Emergency
        vm.prank(emergencyOperator);
        emergency.activateEmergencyStop("Complex sequence");

        // Phase 2: Blocked operations
        for (uint256 i = 0; i < trades2; i++) {
            vm.expectRevert("Emergency stop active");
            _createTrade(address(uint160(0x9200 + i)), 1 ether);
        }

        // Recovery
        vm.prank(recoveryOperator);
        emergency.initiateRecovery();
        vm.prank(recoveryOperator);
        emergency.completeRecovery();

        // Phase 3: Resume operations
        for (uint256 i = 0; i < withdrawals2; i++) {
            _queueWithdrawal(address(uint160(0x9300 + i)), 1 ether);
        }

        assertEq(activeTrades.length, trades1);
        assertEq(pendingWithdrawals.length, withdrawals1 + withdrawals2);
    }

    // Helper functions
    function _createTrade(address trader, uint256 amount) internal {
        if (emergency.isEmergencyActive()) {
            revert("Emergency stop active");
        }
        activeTrades.push(Trade({
            trader: trader,
            amount: amount,
            active: true,
            timestamp: block.timestamp
        }));
    }

    function _settleTrade(uint256 index) internal {
        if (emergency.isEmergencyActive()) {
            revert("Emergency stop active");
        }
        require(index < activeTrades.length, "Invalid index");
        activeTrades[index].active = false;
    }

    function _queueWithdrawal(address user_, uint256 amount) internal {
        pendingWithdrawals.push(Withdrawal({
            user: user_,
            amount: amount,
            pending: true,
            queuedAt: block.timestamp
        }));
    }

    function _processWithdrawal(uint256 index) internal {
        if (emergency.isEmergencyActive()) {
            revert("Emergency stop active");
        }
        require(index < pendingWithdrawals.length, "Invalid index");
        pendingWithdrawals[index].pending = false;
    }

    function _attemptSettlement(uint256 index) internal {
        if (emergency.isEmergencyActive()) {
            revert("Emergency stop active");
        }
        require(index < settlements.length, "Invalid index");
        settlements[index].completed = true;
    }

    // External wrapper for testing
    function externalSettleTrade(uint256 index) external {
        _settleTrade(index);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/EmergencyStop.sol";

/// @dev A minimal integrator, wired the way EmergencyStop documents: normal
///      operations behind `whenNotEmergency`, remediation behind `whenEmergency`.
contract EmergencyTradingDesk is EmergencyStop {
    struct Trade {
        address trader;
        uint256 amount;
        bool open;
        bool settled;
    }

    struct Withdrawal {
        address account;
        uint256 amount;
        bool paid;
    }

    mapping(uint256 => Trade) public trades;
    mapping(uint256 => Withdrawal) public withdrawals;
    uint256 public nextTradeId;
    uint256 public nextWithdrawalId;

    constructor(address admin) EmergencyStop(admin) {}

    function openTrade(uint256 amount) external whenNotEmergency returns (uint256 id) {
        id = nextTradeId++;
        trades[id] = Trade(msg.sender, amount, true, false);
    }

    function closeTrade(uint256 id) external whenNotEmergency {
        require(trades[id].open, "Trade not open");
        trades[id].open = false;
    }

    function settleTrade(uint256 id) external whenNotEmergency {
        require(!trades[id].open && !trades[id].settled, "Not settleable");
        trades[id].settled = true;
    }

    function requestWithdrawal(uint256 amount) external whenNotEmergency returns (uint256 id) {
        id = nextWithdrawalId++;
        withdrawals[id] = Withdrawal(msg.sender, amount, false);
    }

    function processWithdrawal(uint256 id) external whenNotEmergency {
        require(!withdrawals[id].paid, "Already paid");
        withdrawals[id].paid = true;
    }

    /// @dev Remediation: a trader may unwind an open position only while halted.
    function unwindTrade(uint256 id) external whenEmergency {
        require(trades[id].trader == msg.sender, "Not trader");
        require(trades[id].open, "Trade not open");
        trades[id].open = false;
    }
}

/// @notice How the emergency stop affects active trades, queued withdrawals and
///         settlement attempts (#961).
contract EmergencyStopOperationsTest is Test {
    EmergencyTradingDesk internal desk;

    address internal admin = address(0xA11CE);
    address internal trader = address(0xB0B);
    address internal withdrawer = address(0xCAFE);

    uint256 internal tradeId;
    uint256 internal withdrawalId;

    function setUp() public {
        desk = new EmergencyTradingDesk(admin);

        vm.prank(trader);
        tradeId = desk.openTrade(100 ether);
        vm.prank(withdrawer);
        withdrawalId = desk.requestWithdrawal(40 ether);
    }

    function _halt() internal {
        vm.prank(admin);
        desk.activateEmergencyStop("Oracle compromised");
    }

    // --- Active trades ---------------------------------------------------

    function test_ActiveTradeCannotBeClosedDuringTheStop() public {
        _halt();
        vm.prank(trader);
        vm.expectRevert("Emergency stop active");
        desk.closeTrade(tradeId);

        (, uint256 amount, bool open,) = desk.trades(tradeId);
        assertTrue(open);
        assertEq(amount, 100 ether);
    }

    function test_NewTradesAreRejectedDuringTheStop() public {
        _halt();
        vm.prank(trader);
        vm.expectRevert("Emergency stop active");
        desk.openTrade(1 ether);
        assertEq(desk.nextTradeId(), 1);
    }

    function test_TraderCanUnwindOnlyWhileHalted() public {
        vm.prank(trader);
        vm.expectRevert("Emergency stop not active");
        desk.unwindTrade(tradeId);

        _halt();
        vm.prank(trader);
        desk.unwindTrade(tradeId);
        (,, bool open,) = desk.trades(tradeId);
        assertFalse(open);
    }

    // --- Settlement attempts ---------------------------------------------

    function test_SettlementAttemptRevertsDuringTheStop() public {
        vm.prank(trader);
        desk.closeTrade(tradeId);
        _halt();

        vm.expectRevert("Emergency stop active");
        desk.settleTrade(tradeId);
        (,,, bool settled) = desk.trades(tradeId);
        assertFalse(settled);
    }

    function test_AnUnwoundTradeSettlesOnceTheStopIsCleared() public {
        _halt();
        vm.prank(trader);
        desk.unwindTrade(tradeId);

        vm.expectRevert("Emergency stop active");
        desk.settleTrade(tradeId);

        vm.prank(admin);
        desk.deactivateEmergencyStop();
        desk.settleTrade(tradeId);
        (,,, bool settled) = desk.trades(tradeId);
        assertTrue(settled);
    }

    // --- Queued withdrawals ----------------------------------------------

    function test_QueuedWithdrawalCannotBeProcessedDuringTheStop() public {
        _halt();
        vm.expectRevert("Emergency stop active");
        desk.processWithdrawal(withdrawalId);

        (address account, uint256 amount, bool paid) = desk.withdrawals(withdrawalId);
        assertEq(account, withdrawer);
        assertEq(amount, 40 ether);
        assertFalse(paid);
    }

    function test_NewWithdrawalRequestsAreRejectedDuringTheStop() public {
        _halt();
        vm.prank(withdrawer);
        vm.expectRevert("Emergency stop active");
        desk.requestWithdrawal(1 ether);
        assertEq(desk.nextWithdrawalId(), 1);
    }

    // --- Recovery ----------------------------------------------------------

    function test_OperationsStayHaltedWhileRecoveryIsInProgress() public {
        _halt();
        vm.prank(admin);
        desk.initiateRecovery();

        vm.expectRevert("Emergency stop active");
        desk.processWithdrawal(withdrawalId);
        vm.prank(trader);
        vm.expectRevert("Emergency stop active");
        desk.closeTrade(tradeId);
    }

    function test_QueuedWorkResumesAfterRecoveryCompletes() public {
        _halt();
        vm.startPrank(admin);
        desk.initiateRecovery();
        desk.completeRecovery();
        vm.stopPrank();

        desk.processWithdrawal(withdrawalId);
        vm.prank(trader);
        desk.closeTrade(tradeId);
        desk.settleTrade(tradeId);

        (,, bool paid) = desk.withdrawals(withdrawalId);
        (,, bool open, bool settled) = desk.trades(tradeId);
        assertTrue(paid);
        assertFalse(open);
        assertTrue(settled);
    }

    function test_QueuedWorkResumesAfterManualDeactivation() public {
        _halt();
        vm.prank(admin);
        desk.deactivateEmergencyStop();

        desk.processWithdrawal(withdrawalId);
        (,, bool paid) = desk.withdrawals(withdrawalId);
        assertTrue(paid);
    }

    function test_AStopAndRecoveryLeaveTradeAndWithdrawalDataUntouched() public {
        _halt();
        vm.startPrank(admin);
        desk.initiateRecovery();
        desk.completeRecovery();
        vm.stopPrank();

        (address t, uint256 tradeAmount, bool open, bool settled) = desk.trades(tradeId);
        (address w, uint256 withdrawalAmount, bool paid) = desk.withdrawals(withdrawalId);
        assertEq(t, trader);
        assertEq(tradeAmount, 100 ether);
        assertTrue(open);
        assertFalse(settled);
        assertEq(w, withdrawer);
        assertEq(withdrawalAmount, 40 ether);
        assertFalse(paid);
    }
}

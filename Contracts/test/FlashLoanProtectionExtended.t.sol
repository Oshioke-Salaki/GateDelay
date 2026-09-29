// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/FlashLoanProtection.sol";

// ---------------------------------------------------------------------------
// Attack-scenario helpers
// ---------------------------------------------------------------------------

/// @dev Simulates an unapproved contract caller attempting to call a protected action.
contract UnapprovedCaller {
    FlashLoanProtection internal target;

    constructor(FlashLoanProtection _target) {
        target = _target;
    }

    function attemptProtectedAction(uint256 amount) external returns (bool) {
        return target.protectedAction(amount);
    }
}

/// @dev Simulates an approved contract caller (e.g. an approved relayer).
contract ApprovedCaller {
    FlashLoanProtection internal target;

    constructor(FlashLoanProtection _target) {
        target = _target;
    }

    function callProtectedAction(uint256 amount) external returns (bool) {
        return target.protectedAction(amount);
    }
}

/// @dev Simulates a nested / re-entrant-style call: an outer contract invokes
///      an inner contract, which in turn calls the protected function.
///      Both outer and inner are unapproved; only the inner touches the
///      guarded function.
contract OuterAttacker {
    InnerAttacker internal inner;

    constructor(InnerAttacker _inner) {
        inner = _inner;
    }

    function triggerNested(uint256 amount) external returns (bool) {
        return inner.callProtected(amount);
    }
}

contract InnerAttacker {
    FlashLoanProtection internal target;

    constructor(FlashLoanProtection _target) {
        target = _target;
    }

    function callProtected(uint256 amount) external returns (bool) {
        return target.protectedAction(amount);
    }
}

/// @dev A minimal contract that repeatedly calls protectedAction in a loop
///      within the same transaction to simulate same-block manipulation.
contract SameBlockManipulator {
    FlashLoanProtection internal target;

    constructor(FlashLoanProtection _target) {
        target = _target;
    }

    /// @notice Attempts to call protectedAction `count` times in a single tx.
    function multiCall(uint256 amount, uint256 count) external {
        for (uint256 i = 0; i < count; i++) {
            target.protectedAction(amount);
        }
    }
}

/// @dev Same-block attacker that is approved, so it can succeed repeatedly.
contract SameBlockApproved {
    FlashLoanProtection internal target;

    constructor(FlashLoanProtection _target) {
        target = _target;
    }

    function multiCall(uint256 amount, uint256 count) external returns (uint256 calls) {
        for (uint256 i = 0; i < count; i++) {
            target.protectedAction(amount);
            calls++;
        }
    }
}

// ---------------------------------------------------------------------------
// Tests – issue #973: flash loan protection
// ---------------------------------------------------------------------------
contract FlashLoanProtectionExtendedTest is Test {
    FlashLoanProtection   protection;

    address owner = address(0xA11CE);
    address eoa   = address(0xBEEF);   // externally owned account (tx.origin == msg.sender)

    function setUp() public {
        vm.prank(owner);
        protection = new FlashLoanProtection();
    }

    // ─────────────────────────────────────────────────────────────────
    // EOA calls (baseline – should always succeed)
    // ─────────────────────────────────────────────────────────────────

    /// @notice An EOA (msg.sender == tx.origin) can call protectedAction directly.
    function test_EoaCallerAllowed() public {
        // vm.prank sets msg.sender; tx.origin remains the test runner address
        // For an EOA scenario we need msg.sender == tx.origin.
        // Foundry's vm.prank only sets msg.sender; use vm.startPrank with tx.origin.
        vm.prank(eoa, eoa); // both msg.sender and tx.origin = eoa
        bool result = protection.protectedAction(100);
        assertTrue(result, "EOA call should succeed");
    }

    /// @notice Multiple EOA calls in the same block all succeed.
    function test_EoaMultipleCallsSameBlockAllowed() public {
        vm.prank(eoa, eoa);
        protection.protectedAction(10);

        vm.prank(eoa, eoa);
        protection.protectedAction(20);

        // loanCount is attributed to tx.origin
        assertEq(protection.loanCount(eoa), 2);
        assertEq(protection.lastLoanBlock(eoa), block.number);
    }

    // ─────────────────────────────────────────────────────────────────
    // Unapproved contract callers are blocked
    // ─────────────────────────────────────────────────────────────────

    /// @notice An unapproved contract calling protectedAction is blocked.
    function test_UnapprovedContractBlocked() public {
        UnapprovedCaller attacker = new UnapprovedCaller(protection);

        vm.expectRevert("FlashLoanProtection: unapproved contract caller");
        attacker.attemptProtectedAction(100);
    }

    /// @notice A freshly deployed contract (never approved) is blocked.
    function test_FreshContractNeverApprovedBlocked() public {
        // Different instance – ensure it's not inadvertently approved
        UnapprovedCaller fresh = new UnapprovedCaller(protection);

        assertFalse(protection.isApproved(address(fresh)));

        vm.expectRevert("FlashLoanProtection: unapproved contract caller");
        fresh.attemptProtectedAction(50);
    }

    // ─────────────────────────────────────────────────────────────────
    // Approved contract callers succeed
    // ─────────────────────────────────────────────────────────────────

    /// @notice Owner can approve a contract; it can then call protectedAction.
    function test_ApprovedContractAllowed() public {
        ApprovedCaller approved = new ApprovedCaller(protection);

        vm.prank(owner);
        protection.approveContract(address(approved));

        assertTrue(protection.isApproved(address(approved)));

        bool result = approved.callProtectedAction(200);
        assertTrue(result, "approved contract should succeed");
    }

    /// @notice After approval, loanCount for tx.origin is incremented.
    function test_ApprovedCallerLoanCountIncremented() public {
        ApprovedCaller approved = new ApprovedCaller(protection);

        vm.prank(owner);
        protection.approveContract(address(approved));

        approved.callProtectedAction(10);
        // loanCount is keyed on tx.origin; in Foundry that is the default sender
        address origin = tx.origin;
        assertEq(protection.loanCount(origin), 1);
        assertEq(protection.lastLoanBlock(origin), block.number);
    }

    // ─────────────────────────────────────────────────────────────────
    // Revocation: approved → revoked → blocked
    // ─────────────────────────────────────────────────────────────────

    /// @notice Revoking a previously approved contract blocks it again.
    function test_RevokedContractBlocked() public {
        ApprovedCaller caller = new ApprovedCaller(protection);

        vm.startPrank(owner);
        protection.approveContract(address(caller));
        protection.revokeContract(address(caller));
        vm.stopPrank();

        assertFalse(protection.isApproved(address(caller)));

        vm.expectRevert("FlashLoanProtection: unapproved contract caller");
        caller.callProtectedAction(100);
    }

    /// @notice Revoking an already-revoked or never-approved contract reverts.
    function test_RevokeNotApprovedReverts() public {
        address notApproved = address(0xDEAD);

        vm.prank(owner);
        vm.expectRevert("FlashLoanProtection: not approved");
        protection.revokeContract(notApproved);
    }

    // ─────────────────────────────────────────────────────────────────
    // Same-block manipulation: unapproved contract
    // ─────────────────────────────────────────────────────────────────

    /// @notice An unapproved contract making repeated same-block calls is blocked on the first attempt.
    function test_SameBlockUnapprovedBlocked() public {
        SameBlockManipulator attacker = new SameBlockManipulator(protection);

        // First call should already fail
        vm.expectRevert("FlashLoanProtection: unapproved contract caller");
        attacker.multiCall(100, 3);
    }

    // ─────────────────────────────────────────────────────────────────
    // Same-block manipulation: approved contract
    // ─────────────────────────────────────────────────────────────────

    /// @notice An approved contract can call protectedAction multiple times in the same block.
    function test_SameBlockApprovedAllowed() public {
        SameBlockApproved approved = new SameBlockApproved(protection);

        vm.prank(owner);
        protection.approveContract(address(approved));

        uint256 calls = approved.multiCall(50, 5);
        assertEq(calls, 5, "approved contract should complete all same-block calls");

        // loanCount accumulates across all calls; keyed on tx.origin
        address origin = tx.origin;
        assertEq(protection.loanCount(origin), 5);
    }

    /// @notice lastLoanBlock is updated to the current block after each call.
    function test_LastLoanBlockUpdatedEachCall() public {
        SameBlockApproved approved = new SameBlockApproved(protection);

        vm.prank(owner);
        protection.approveContract(address(approved));

        approved.multiCall(10, 2);
        // keyed on tx.origin
        assertEq(protection.lastLoanBlock(tx.origin), block.number);
    }

    // ─────────────────────────────────────────────────────────────────
    // Nested / multi-hop attack attempts
    // ─────────────────────────────────────────────────────────────────

    /// @notice Outer contract (unapproved) → inner contract (unapproved) → protectedAction
    ///         is blocked because the inner contract is the direct msg.sender.
    function test_NestedUnapprovedCallBlocked() public {
        InnerAttacker inner = new InnerAttacker(protection);
        OuterAttacker outer = new OuterAttacker(inner);

        // Neither inner nor outer is approved
        vm.expectRevert("FlashLoanProtection: unapproved contract caller");
        outer.triggerNested(100);
    }

    /// @notice Outer contract approved, inner contract calls protectedAction directly
    ///         — inner is the msg.sender, so inner must also be approved.
    function test_OnlyOuterApprovedInnerBlockedWhenCallingDirectly() public {
        InnerAttacker inner = new InnerAttacker(protection);
        OuterAttacker outer = new OuterAttacker(inner);

        // Approve only outer — inner is still unapproved
        vm.prank(owner);
        protection.approveContract(address(outer));

        // inner is the direct msg.sender to protection, so it must be approved
        vm.expectRevert("FlashLoanProtection: unapproved contract caller");
        outer.triggerNested(100);
    }

    /// @notice If both inner and outer are approved, the nested call succeeds.
    function test_BothApprovedNestedCallSucceeds() public {
        InnerAttacker inner = new InnerAttacker(protection);
        OuterAttacker outer = new OuterAttacker(inner);

        vm.startPrank(owner);
        protection.approveContract(address(inner));
        protection.approveContract(address(outer));
        vm.stopPrank();

        bool result = outer.triggerNested(100);
        assertTrue(result, "nested call should succeed when both contracts are approved");
    }

    // ─────────────────────────────────────────────────────────────────
    // Admin – approveContract / revokeContract access control
    // ─────────────────────────────────────────────────────────────────

    /// @notice Only owner can approve a contract.
    function test_NonOwnerCannotApproveContract() public {
        vm.prank(eoa);
        vm.expectRevert("FlashLoanProtection: only owner");
        protection.approveContract(address(0x1234));
    }

    /// @notice Only owner can revoke a contract.
    function test_NonOwnerCannotRevokeContract() public {
        ApprovedCaller caller = new ApprovedCaller(protection);

        vm.prank(owner);
        protection.approveContract(address(caller));

        vm.prank(eoa);
        vm.expectRevert("FlashLoanProtection: only owner");
        protection.revokeContract(address(caller));
    }

    /// @notice Approving zero address reverts.
    function test_ApproveZeroAddressReverts() public {
        vm.prank(owner);
        vm.expectRevert("FlashLoanProtection: zero address");
        protection.approveContract(address(0));
    }

    // ─────────────────────────────────────────────────────────────────
    // transferOwnership
    // ─────────────────────────────────────────────────────────────────

    /// @notice Owner can transfer ownership; new owner can approve contracts.
    function test_TransferOwnershipAllowsNewOwnerToApprove() public {
        address newOwner = address(0xF00D1);

        vm.prank(owner);
        protection.transferOwnership(newOwner);

        assertEq(protection.owner(), newOwner);

        ApprovedCaller caller = new ApprovedCaller(protection);

        vm.prank(newOwner);
        protection.approveContract(address(caller));

        assertTrue(protection.isApproved(address(caller)));
    }

    /// @notice Transferring ownership to zero address reverts.
    function test_TransferOwnershipZeroAddressReverts() public {
        vm.prank(owner);
        vm.expectRevert("FlashLoanProtection: zero address");
        protection.transferOwnership(address(0));
    }

    /// @notice Old owner loses admin rights after transferOwnership.
    function test_OldOwnerLosesAdminAfterTransfer() public {
        address newOwner = address(0xF00D2);

        vm.prank(owner);
        protection.transferOwnership(newOwner);

        vm.prank(owner);
        vm.expectRevert("FlashLoanProtection: only owner");
        protection.approveContract(address(0x1234));
    }

    // ─────────────────────────────────────────────────────────────────
    // loanCount / lastLoanBlock tracking
    // ─────────────────────────────────────────────────────────────────

    /// @notice loanCount starts at zero for a fresh address.
    function test_InitialLoanCountIsZero() public view {
        assertEq(protection.loanCount(eoa), 0);
    }

    /// @notice lastLoanBlock starts at zero for a fresh address.
    function test_InitialLastLoanBlockIsZero() public view {
        assertEq(protection.lastLoanBlock(eoa), 0);
    }

    /// @notice EOA calls across multiple blocks keep accumulating loanCount.
    function test_LoanCountAccumulatesAcrossBlocks() public {
        vm.prank(eoa, eoa);
        protection.protectedAction(1);

        vm.roll(block.number + 10);

        vm.prank(eoa, eoa);
        protection.protectedAction(1);

        assertEq(protection.loanCount(eoa), 2);
        assertEq(protection.lastLoanBlock(eoa), block.number);
    }

    // ─────────────────────────────────────────────────────────────────
    // Price-sensitive scenario: ensure protection is enforced every call
    // ─────────────────────────────────────────────────────────────────

    /// @notice An unapproved contract claiming to be an EOA (impossible in
    ///         production, but we verify the check is done on msg.sender).
    ///         Even if tx.origin matches, a contract msg.sender is still blocked.
    function test_ContractMsgSenderBlockedRegardlessOfOrigin() public {
        UnapprovedCaller caller = new UnapprovedCaller(protection);

        // Use a real EOA as tx.origin — but msg.sender is still the contract
        vm.prank(address(caller), eoa); // msg.sender = caller contract, tx.origin = eoa
        vm.expectRevert("FlashLoanProtection: unapproved contract caller");
        // Call directly (bypassing the UnapprovedCaller helper) to set msg.sender precisely
        protection.protectedAction(100);
    }
}

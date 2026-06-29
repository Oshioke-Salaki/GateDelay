// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/TimelockVesting.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Minimal ERC20 for testing
contract MockTimelockToken is ERC20 {
    constructor() ERC20("Timelock Token", "TLT") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract TimelockVestingTest is Test {
    TimelockVesting vesting;
    MockTimelockToken token;

    address owner    = address(0xA11CE);
    address guardian = address(0xBEEF);
    address alice    = address(0xA11CE1);
    address bob      = address(0xB0B);
    address other    = address(0xDEAD);

    uint256 constant AMOUNT          = 10_000e18;
    uint256 constant VESTING_DURATION = 365 days;
    uint256 constant CLIFF_DURATION  = 0;
    uint256 constant TIMELOCK_DELAY  = 2 days;

    function setUp() public {
        vm.startPrank(owner);

        token   = new MockTimelockToken();
        vesting = new TimelockVesting(guardian);

        token.mint(owner, AMOUNT * 100);
        token.approve(address(vesting), type(uint256).max);

        vm.stopPrank();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    function _createVesting() internal returns (uint256 vestingId) {
        vm.prank(owner);
        vestingId = vesting.createVesting(
            alice,
            address(token),
            AMOUNT,
            VESTING_DURATION,
            CLIFF_DURATION,
            TIMELOCK_DELAY,
            true
        );
    }

    // -------------------------------------------------------------------------
    // Vesting Creation
    // -------------------------------------------------------------------------

    function test_OwnerCanCreateVesting() public {
        uint256 id = _createVesting();
        assertEq(id, 0);
        assertEq(vesting.getVestingCount(), 1);
    }

    function test_NonOwnerCannotCreateVesting() public {
        vm.prank(other);
        vm.expectRevert();
        vesting.createVesting(alice, address(token), AMOUNT, VESTING_DURATION, 0, TIMELOCK_DELAY, false);
    }

    function test_CannotCreateWithZeroBeneficiary() public {
        vm.prank(owner);
        vm.expectRevert();
        vesting.createVesting(address(0), address(token), AMOUNT, VESTING_DURATION, 0, TIMELOCK_DELAY, false);
    }

    function test_CannotCreateWithZeroToken() public {
        vm.prank(owner);
        vm.expectRevert();
        vesting.createVesting(alice, address(0), AMOUNT, VESTING_DURATION, 0, TIMELOCK_DELAY, false);
    }

    function test_CannotCreateWithTooShortDelay() public {
        vm.prank(owner);
        vm.expectRevert();
        vesting.createVesting(alice, address(token), AMOUNT, VESTING_DURATION, 0, 30 minutes, false);
    }

    function test_CannotCreateWithTooLongDelay() public {
        vm.prank(owner);
        vm.expectRevert();
        vesting.createVesting(alice, address(token), AMOUNT, VESTING_DURATION, 0, 31 days, false);
    }

    function test_MinTimelockDelayAccepted() public {
        vm.prank(owner);
        vesting.createVesting(alice, address(token), AMOUNT, VESTING_DURATION, 0, 1 hours, false);
    }

    function test_MaxTimelockDelayAccepted() public {
        vm.prank(owner);
        vesting.createVesting(alice, address(token), AMOUNT, VESTING_DURATION, 0, 30 days, false);
    }

    // -------------------------------------------------------------------------
    // Queue Release
    // -------------------------------------------------------------------------

    function test_BeneficiaryCanQueueRelease() public {
        _createVesting();
        vm.warp(block.timestamp + 30 days);

        vm.prank(alice);
        uint256 releaseId = vesting.queueRelease(0);
        assertEq(releaseId, 0);
        assertTrue(vesting.hasPendingRelease(0));
    }

    function test_OwnerCanQueueRelease() public {
        _createVesting();
        vm.warp(block.timestamp + 30 days);

        vm.prank(owner);
        vesting.queueRelease(0);
        assertTrue(vesting.hasPendingRelease(0));
    }

    function test_CannotQueueReleaseWhenNothingVested() public {
        _createVesting();

        vm.prank(alice);
        vm.expectRevert();
        vesting.queueRelease(0);
    }

    function test_CannotQueueTwoConcurrentReleases() public {
        _createVesting();
        vm.warp(block.timestamp + 30 days);

        vm.prank(alice);
        vesting.queueRelease(0);

        vm.prank(alice);
        vm.expectRevert();
        vesting.queueRelease(0);
    }

    function test_NonBeneficiaryNonOwnerCannotQueue() public {
        _createVesting();
        vm.warp(block.timestamp + 30 days);

        vm.prank(other);
        vm.expectRevert();
        vesting.queueRelease(0);
    }

    function test_ReleaseSnapshotsAmountAtQueueTime() public {
        _createVesting();
        vm.warp(block.timestamp + 30 days);

        vm.prank(alice);
        uint256 releaseId = vesting.queueRelease(0);

        TimelockVesting.QueuedRelease memory rel = vesting.getRelease(releaseId);
        assertGt(rel.amount, 0);
    }

    // -------------------------------------------------------------------------
    // Execute Release
    // -------------------------------------------------------------------------

    function test_CannotExecuteBeforeTimelockExpires() public {
        _createVesting();
        vm.warp(block.timestamp + 30 days);

        vm.prank(alice);
        uint256 releaseId = vesting.queueRelease(0);

        vm.expectRevert();
        vesting.executeRelease(releaseId);
    }

    function test_CanExecuteAfterTimelockExpires() public {
        _createVesting();
        vm.warp(block.timestamp + 30 days);

        vm.prank(alice);
        uint256 releaseId = vesting.queueRelease(0);

        vm.warp(block.timestamp + TIMELOCK_DELAY);

        uint256 before = token.balanceOf(alice);
        vesting.executeRelease(releaseId);

        assertGt(token.balanceOf(alice), before);
    }

    function test_CannotExecuteReleaseTwice() public {
        _createVesting();
        vm.warp(block.timestamp + 30 days);

        vm.prank(alice);
        uint256 releaseId = vesting.queueRelease(0);

        vm.warp(block.timestamp + TIMELOCK_DELAY);
        vesting.executeRelease(releaseId);

        vm.expectRevert();
        vesting.executeRelease(releaseId);
    }

    function test_ExecuteReleaseUpdatesPendingFlag() public {
        _createVesting();
        vm.warp(block.timestamp + 30 days);

        vm.prank(alice);
        uint256 releaseId = vesting.queueRelease(0);

        vm.warp(block.timestamp + TIMELOCK_DELAY);
        vesting.executeRelease(releaseId);

        assertFalse(vesting.hasPendingRelease(0));
    }

    // -------------------------------------------------------------------------
    // Cancel Release
    // -------------------------------------------------------------------------

    function test_BeneficiaryCanCancelRelease() public {
        _createVesting();
        vm.warp(block.timestamp + 30 days);

        vm.prank(alice);
        uint256 releaseId = vesting.queueRelease(0);

        vm.prank(alice);
        vesting.cancelRelease(releaseId);

        assertFalse(vesting.hasPendingRelease(0));
    }

    function test_OwnerCanCancelRelease() public {
        _createVesting();
        vm.warp(block.timestamp + 30 days);

        vm.prank(alice);
        uint256 releaseId = vesting.queueRelease(0);

        vm.prank(owner);
        vesting.cancelRelease(releaseId);

        assertFalse(vesting.hasPendingRelease(0));
    }

    function test_NonBeneficiaryNonOwnerCannotCancel() public {
        _createVesting();
        vm.warp(block.timestamp + 30 days);

        vm.prank(alice);
        uint256 releaseId = vesting.queueRelease(0);

        vm.prank(other);
        vm.expectRevert();
        vesting.cancelRelease(releaseId);
    }

    function test_CanQueueAgainAfterCancel() public {
        _createVesting();
        vm.warp(block.timestamp + 30 days);

        vm.prank(alice);
        uint256 releaseId = vesting.queueRelease(0);

        vm.prank(alice);
        vesting.cancelRelease(releaseId);

        vm.prank(alice);
        vesting.queueRelease(0);
        assertTrue(vesting.hasPendingRelease(0));
    }

    // -------------------------------------------------------------------------
    // Early Release (Guardian)
    // -------------------------------------------------------------------------

    function test_GuardianCanQueueEarlyRelease() public {
        _createVesting();

        vm.prank(guardian);
        uint256 releaseId = vesting.queueEarlyRelease(0, AMOUNT / 10);

        TimelockVesting.QueuedRelease memory rel = vesting.getRelease(releaseId);
        assertTrue(rel.isEarlyRelease);
        assertEq(rel.amount, AMOUNT / 10);
    }

    function test_NonGuardianCannotQueueEarlyRelease() public {
        _createVesting();

        vm.prank(other);
        vm.expectRevert();
        vesting.queueEarlyRelease(0, AMOUNT / 10);
    }

    function test_EarlyReleaseExecutesAfterTimelock() public {
        _createVesting();

        uint256 earlyAmount = AMOUNT / 10;

        vm.prank(guardian);
        uint256 releaseId = vesting.queueEarlyRelease(0, earlyAmount);

        vm.warp(block.timestamp + TIMELOCK_DELAY);

        uint256 before = token.balanceOf(alice);
        vesting.executeRelease(releaseId);

        assertEq(token.balanceOf(alice) - before, earlyAmount);
    }

    function test_EarlyReleaseCapedAtRemainingBalance() public {
        _createVesting();

        vm.prank(guardian);
        vesting.queueEarlyRelease(0, AMOUNT * 100); // More than total

        TimelockVesting.QueuedRelease memory rel = vesting.getRelease(0);
        assertEq(rel.amount, AMOUNT); // capped at total
    }

    // -------------------------------------------------------------------------
    // Revocation
    // -------------------------------------------------------------------------

    function test_OwnerCanRevokeRevocableVesting() public {
        _createVesting();
        vm.warp(block.timestamp + VESTING_DURATION / 2);

        uint256 ownerBefore = token.balanceOf(owner);

        vm.prank(owner);
        vesting.revoke(0);

        assertGt(token.balanceOf(owner), ownerBefore);
    }

    function test_CannotRevokeAlreadyRevoked() public {
        _createVesting();

        vm.prank(owner);
        vesting.revoke(0);

        vm.prank(owner);
        vm.expectRevert();
        vesting.revoke(0);
    }

    function test_RevokeClearsPendingRelease() public {
        _createVesting();
        vm.warp(block.timestamp + 30 days);

        vm.prank(alice);
        vesting.queueRelease(0);

        vm.prank(owner);
        vesting.revoke(0);

        assertFalse(vesting.hasPendingRelease(0));
    }

    // -------------------------------------------------------------------------
    // Guardian Management
    // -------------------------------------------------------------------------

    function test_OwnerCanUpdateGuardian() public {
        vm.prank(owner);
        vesting.setGuardian(bob);
        assertEq(vesting.guardian(), bob);
    }

    function test_NonOwnerCannotUpdateGuardian() public {
        vm.prank(other);
        vm.expectRevert();
        vesting.setGuardian(bob);
    }

    function test_CannotSetZeroAddressAsGuardian() public {
        vm.prank(owner);
        vm.expectRevert();
        vesting.setGuardian(address(0));
    }

    // -------------------------------------------------------------------------
    // Query Functions
    // -------------------------------------------------------------------------

    function test_GetScheduleReturnsCorrectData() public {
        _createVesting();

        TimelockVesting.VestingSchedule memory s = vesting.getSchedule(0);
        assertEq(s.beneficiary,    alice);
        assertEq(s.totalAmount,    AMOUNT);
        assertEq(s.timelockDelay, TIMELOCK_DELAY);
        assertTrue(s.revocable);
        assertFalse(s.revoked);
    }

    function test_GetTimelockStatusShowsTimeRemaining() public {
        _createVesting();
        vm.warp(block.timestamp + 30 days);

        vm.prank(alice);
        vesting.queueRelease(0);

        (bool hasPending, uint256 timeRemaining) = vesting.getTimelockStatus(0);
        assertTrue(hasPending);
        assertApproxEqAbs(timeRemaining, TIMELOCK_DELAY, 2);
    }

    function test_GetTimelockStatusZeroWhenExpired() public {
        _createVesting();
        vm.warp(block.timestamp + 30 days);

        vm.prank(alice);
        vesting.queueRelease(0);

        vm.warp(block.timestamp + TIMELOCK_DELAY);

        (, uint256 timeRemaining) = vesting.getTimelockStatus(0);
        assertEq(timeRemaining, 0);
    }

    function test_GetBeneficiaryVestings() public {
        _createVesting();

        uint256[] memory ids = vesting.getBeneficiaryVestings(alice);
        assertEq(ids.length, 1);
        assertEq(ids[0], 0);
    }

    function test_GetVestingReleasesTracksAll() public {
        _createVesting();
        vm.warp(block.timestamp + 30 days);

        vm.prank(alice);
        vesting.queueRelease(0);

        uint256[] memory releases = vesting.getVestingReleases(0);
        assertEq(releases.length, 1);
    }

    function test_GetReleasableAmountZeroForRevokedVesting() public {
        _createVesting();
        vm.warp(block.timestamp + 30 days);

        vm.prank(owner);
        vesting.revoke(0);

        assertEq(vesting.getReleasableAmount(0), 0);
    }

    function test_InvalidVestingIdReverts() public {
        vm.expectRevert();
        vesting.getSchedule(999);
    }

    function test_InvalidReleaseIdReverts() public {
        vm.expectRevert();
        vesting.getRelease(999);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/RewardVesting.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Minimal ERC20 for testing
contract MockVestToken is ERC20 {
    constructor() ERC20("Vesting Token", "VST") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract RewardVestingTest is Test {
    RewardVesting vesting;
    MockVestToken token;

    address owner = address(0xA11CE);
    address alice = address(0xA11CE1);
    address bob   = address(0xB0B);
    address other = address(0xDEAD);

    uint256 constant TOTAL_AMOUNT    = 1_000e18;
    uint256 constant CLIFF_DURATION  = 30 days;
    uint256 constant VESTING_DURATION = 365 days;

    function setUp() public {
        vm.startPrank(owner);

        token   = new MockVestToken();
        vesting = new RewardVesting(address(token));

        token.mint(owner, TOTAL_AMOUNT * 20);
        token.approve(address(vesting), type(uint256).max);

        vm.stopPrank();
    }

    // -------------------------------------------------------------------------
    // Schedule Creation
    // -------------------------------------------------------------------------

    function test_OwnerCanCreateSchedule() public {
        vm.prank(owner);
        uint256 id = vesting.createSchedule(alice, TOTAL_AMOUNT, CLIFF_DURATION, VESTING_DURATION, false);
        assertEq(id, 0);
        assertEq(vesting.getScheduleCount(), 1);
    }

    function test_NonOwnerCannotCreateSchedule() public {
        vm.prank(other);
        vm.expectRevert();
        vesting.createSchedule(alice, TOTAL_AMOUNT, CLIFF_DURATION, VESTING_DURATION, false);
    }

    function test_CannotCreateWithZeroBeneficiary() public {
        vm.prank(owner);
        vm.expectRevert();
        vesting.createSchedule(address(0), TOTAL_AMOUNT, CLIFF_DURATION, VESTING_DURATION, false);
    }

    function test_CannotCreateWithZeroAmount() public {
        vm.prank(owner);
        vm.expectRevert();
        vesting.createSchedule(alice, 0, CLIFF_DURATION, VESTING_DURATION, false);
    }

    function test_CannotCreateWithZeroDuration() public {
        vm.prank(owner);
        vm.expectRevert();
        vesting.createSchedule(alice, TOTAL_AMOUNT, 0, 0, false);
    }

    function test_CannotCreateWithCliffExceedingDuration() public {
        vm.prank(owner);
        vm.expectRevert();
        vesting.createSchedule(alice, TOTAL_AMOUNT, VESTING_DURATION + 1, VESTING_DURATION, false);
    }

    function test_TokensTransferredOnCreate() public {
        uint256 contractBalanceBefore = token.balanceOf(address(vesting));

        vm.prank(owner);
        vesting.createSchedule(alice, TOTAL_AMOUNT, 0, VESTING_DURATION, false);

        assertEq(token.balanceOf(address(vesting)), contractBalanceBefore + TOTAL_AMOUNT);
    }

    // -------------------------------------------------------------------------
    // Cliff Behaviour
    // -------------------------------------------------------------------------

    function test_CannotClaimBeforeCliff() public {
        vm.prank(owner);
        vesting.createSchedule(alice, TOTAL_AMOUNT, CLIFF_DURATION, VESTING_DURATION, false);

        vm.warp(block.timestamp + CLIFF_DURATION - 1);

        vm.prank(alice);
        vm.expectRevert();
        vesting.claim(0);
    }

    function test_ClaimableZeroBeforeCliff() public {
        vm.prank(owner);
        vesting.createSchedule(alice, TOTAL_AMOUNT, CLIFF_DURATION, VESTING_DURATION, false);

        assertEq(vesting.getClaimableAmount(0), 0);
        assertFalse(vesting.isCliffReached(0));
    }

    function test_CliffReachedAfterDuration() public {
        vm.prank(owner);
        vesting.createSchedule(alice, TOTAL_AMOUNT, CLIFF_DURATION, VESTING_DURATION, false);

        vm.warp(block.timestamp + CLIFF_DURATION);

        assertTrue(vesting.isCliffReached(0));
        assertGt(vesting.getClaimableAmount(0), 0);
    }

    function test_NoCliffScheduleClaimableImmediately() public {
        vm.prank(owner);
        vesting.createSchedule(alice, TOTAL_AMOUNT, 0, VESTING_DURATION, false);

        vm.warp(block.timestamp + 1 days);

        assertGt(vesting.getClaimableAmount(0), 0);
    }

    // -------------------------------------------------------------------------
    // Claim
    // -------------------------------------------------------------------------

    function test_BeneficiaryCanClaim() public {
        vm.prank(owner);
        vesting.createSchedule(alice, TOTAL_AMOUNT, 0, VESTING_DURATION, false);

        vm.warp(block.timestamp + VESTING_DURATION / 2);

        uint256 before = token.balanceOf(alice);

        vm.prank(alice);
        vesting.claim(0);

        assertGt(token.balanceOf(alice), before);
    }

    function test_FullVestingReleasesAllTokens() public {
        vm.prank(owner);
        vesting.createSchedule(alice, TOTAL_AMOUNT, 0, VESTING_DURATION, false);

        vm.warp(block.timestamp + VESTING_DURATION + 1);

        vm.prank(alice);
        vesting.claim(0);

        assertEq(token.balanceOf(alice), TOTAL_AMOUNT);
    }

    function test_CannotDoubleClaim() public {
        vm.prank(owner);
        vesting.createSchedule(alice, TOTAL_AMOUNT, 0, VESTING_DURATION, false);

        vm.warp(block.timestamp + VESTING_DURATION);

        vm.prank(alice);
        vesting.claim(0);

        vm.prank(alice);
        vm.expectRevert();
        vesting.claim(0);
    }

    function test_PartialClaimThenFullClaim() public {
        vm.prank(owner);
        vesting.createSchedule(alice, TOTAL_AMOUNT, 0, VESTING_DURATION, false);

        vm.warp(block.timestamp + VESTING_DURATION / 2);
        vm.prank(alice);
        vesting.claim(0);

        vm.warp(block.timestamp + VESTING_DURATION);
        vm.prank(alice);
        vesting.claim(0);

        assertApproxEqAbs(token.balanceOf(alice), TOTAL_AMOUNT, 1e15);
    }

    // -------------------------------------------------------------------------
    // Revocation
    // -------------------------------------------------------------------------

    function test_OwnerCanRevokeRevocableSchedule() public {
        vm.prank(owner);
        vesting.createSchedule(alice, TOTAL_AMOUNT, 0, VESTING_DURATION, true);

        vm.warp(block.timestamp + VESTING_DURATION / 2);

        uint256 ownerBefore = token.balanceOf(owner);

        vm.prank(owner);
        vesting.revoke(0);

        assertGt(token.balanceOf(owner), ownerBefore);
    }

    function test_CannotRevokeNonRevocableSchedule() public {
        vm.prank(owner);
        vesting.createSchedule(alice, TOTAL_AMOUNT, 0, VESTING_DURATION, false);

        vm.prank(owner);
        vm.expectRevert();
        vesting.revoke(0);
    }

    function test_CannotRevokeAlreadyRevoked() public {
        vm.prank(owner);
        vesting.createSchedule(alice, TOTAL_AMOUNT, 0, VESTING_DURATION, true);

        vm.prank(owner);
        vesting.revoke(0);

        vm.prank(owner);
        vm.expectRevert();
        vesting.revoke(0);
    }

    function test_BeneficiaryReceivesVestedPortionOnRevoke() public {
        vm.prank(owner);
        vesting.createSchedule(alice, TOTAL_AMOUNT, 0, VESTING_DURATION, true);

        vm.warp(block.timestamp + VESTING_DURATION / 2);

        vm.prank(owner);
        vesting.revoke(0);

        assertGt(token.balanceOf(alice), 0);
    }

    function test_CannotClaimAfterRevoke() public {
        vm.prank(owner);
        vesting.createSchedule(alice, TOTAL_AMOUNT, 0, VESTING_DURATION, true);

        vm.prank(owner);
        vesting.revoke(0);

        vm.prank(alice);
        vm.expectRevert();
        vesting.claim(0);
    }

    // -------------------------------------------------------------------------
    // Query Functions
    // -------------------------------------------------------------------------

    function test_GetScheduleReturnsCorrectData() public {
        vm.prank(owner);
        vesting.createSchedule(alice, TOTAL_AMOUNT, CLIFF_DURATION, VESTING_DURATION, false);

        RewardVesting.VestingSchedule memory s = vesting.getSchedule(0);
        assertEq(s.beneficiary,      alice);
        assertEq(s.totalAmount,      TOTAL_AMOUNT);
        assertEq(s.cliffDuration,    CLIFF_DURATION);
        assertEq(s.vestingDuration,  VESTING_DURATION);
        assertFalse(s.revocable);
        assertFalse(s.revoked);
    }

    function test_GetBeneficiarySchedules() public {
        vm.startPrank(owner);
        vesting.createSchedule(alice, TOTAL_AMOUNT, 0, VESTING_DURATION, false);
        vesting.createSchedule(alice, TOTAL_AMOUNT, 0, VESTING_DURATION, false);
        vm.stopPrank();

        uint256[] memory ids = vesting.getBeneficiarySchedules(alice);
        assertEq(ids.length, 2);
    }

    function test_GetTimeToCliff() public {
        vm.prank(owner);
        vesting.createSchedule(alice, TOTAL_AMOUNT, CLIFF_DURATION, VESTING_DURATION, false);

        assertApproxEqAbs(vesting.getTimeToCliff(0), CLIFF_DURATION, 2);
    }

    function test_GetTimeToCliffZeroAfterCliff() public {
        vm.prank(owner);
        vesting.createSchedule(alice, TOTAL_AMOUNT, CLIFF_DURATION, VESTING_DURATION, false);

        vm.warp(block.timestamp + CLIFF_DURATION);

        assertEq(vesting.getTimeToCliff(0), 0);
    }

    function test_GetTimeToFullVest() public {
        vm.prank(owner);
        vesting.createSchedule(alice, TOTAL_AMOUNT, 0, VESTING_DURATION, false);

        assertApproxEqAbs(vesting.getTimeToFullVest(0), VESTING_DURATION, 2);
    }

    function test_GetTimeToFullVestZeroWhenComplete() public {
        vm.prank(owner);
        vesting.createSchedule(alice, TOTAL_AMOUNT, 0, VESTING_DURATION, false);

        vm.warp(block.timestamp + VESTING_DURATION + 1);

        assertEq(vesting.getTimeToFullVest(0), 0);
    }

    function test_InvalidScheduleIdReverts() public {
        vm.expectRevert();
        vesting.getSchedule(999);
    }
}

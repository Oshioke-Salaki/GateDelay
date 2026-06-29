// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/MarketVesting.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Minimal ERC20 for testing
contract MockMarketToken is ERC20 {
    constructor() ERC20("Market Token", "MKT") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract MarketVestingTest is Test {
    MarketVesting vesting;
    MockMarketToken token;

    address owner = address(0xA11CE);
    address alice = address(0xA11CE1);
    address bob   = address(0xB0B);
    address other = address(0xDEAD);

    uint256 constant AMOUNT   = 10_000e18;
    uint256 constant DURATION = 365 days;
    uint256 constant CLIFF    = 90 days;
    uint256 constant STEPS    = 12; // Monthly

    function setUp() public {
        vm.startPrank(owner);

        token   = new MockMarketToken();
        vesting = new MarketVesting();

        token.mint(owner, AMOUNT * 100);
        token.approve(address(vesting), type(uint256).max);

        vm.stopPrank();
    }

    // -------------------------------------------------------------------------
    // Linear Vesting
    // -------------------------------------------------------------------------

    function test_OwnerCanCreateLinearVesting() public {
        vm.prank(owner);
        uint256 id = vesting.createLinearVesting(alice, address(token), AMOUNT, DURATION, 0, false);
        assertEq(id, 0);
        assertEq(vesting.getVestingCount(), 1);
    }

    function test_LinearVestingReleasesGradually() public {
        vm.prank(owner);
        vesting.createLinearVesting(alice, address(token), AMOUNT, DURATION, 0, false);

        vm.warp(block.timestamp + DURATION / 4);

        assertApproxEqAbs(vesting.getReleasableAmount(0), AMOUNT / 4, 1e18);
    }

    function test_LinearVestingFullyReleasedAfterDuration() public {
        vm.prank(owner);
        vesting.createLinearVesting(alice, address(token), AMOUNT, DURATION, 0, false);

        vm.warp(block.timestamp + DURATION + 1);

        assertEq(vesting.getVestedAmount(0), AMOUNT);
    }

    function test_LinearVestingBeneficiaryCanRelease() public {
        vm.prank(owner);
        vesting.createLinearVesting(alice, address(token), AMOUNT, DURATION, 0, false);

        vm.warp(block.timestamp + DURATION / 2);

        vm.prank(alice);
        vesting.release(0);

        assertGt(token.balanceOf(alice), 0);
    }

    function test_LinearVestingWithCliffBlocksEarlyRelease() public {
        vm.prank(owner);
        vesting.createLinearVesting(alice, address(token), AMOUNT, DURATION, CLIFF, false);

        vm.warp(block.timestamp + CLIFF - 1);

        assertEq(vesting.getReleasableAmount(0), 0);
    }

    function test_LinearVestingWithCliffReleasesAfterCliff() public {
        vm.prank(owner);
        vesting.createLinearVesting(alice, address(token), AMOUNT, DURATION, CLIFF, false);

        vm.warp(block.timestamp + CLIFF);

        assertGt(vesting.getReleasableAmount(0), 0);
    }

    // -------------------------------------------------------------------------
    // Cliff Vesting
    // -------------------------------------------------------------------------

    function test_OwnerCanCreateCliffVesting() public {
        vm.prank(owner);
        uint256 id = vesting.createCliffVesting(alice, address(token), AMOUNT, CLIFF, false);
        assertEq(id, 0);
    }

    function test_CliffVestingReleasesNothingBeforeCliff() public {
        vm.prank(owner);
        vesting.createCliffVesting(alice, address(token), AMOUNT, CLIFF, false);

        vm.warp(block.timestamp + CLIFF - 1);

        assertEq(vesting.getReleasableAmount(0), 0);
        assertFalse(vesting.isCliffPassed(0));
    }

    function test_CliffVestingReleasesAllAtCliff() public {
        vm.prank(owner);
        vesting.createCliffVesting(alice, address(token), AMOUNT, CLIFF, false);

        vm.warp(block.timestamp + CLIFF);

        assertEq(vesting.getReleasableAmount(0), AMOUNT);
        assertTrue(vesting.isCliffPassed(0));
    }

    function test_CliffVestingBeneficiaryCanRelease() public {
        vm.prank(owner);
        vesting.createCliffVesting(alice, address(token), AMOUNT, CLIFF, false);

        vm.warp(block.timestamp + CLIFF);

        vm.prank(alice);
        vesting.release(0);

        assertEq(token.balanceOf(alice), AMOUNT);
    }

    // -------------------------------------------------------------------------
    // Stepped Vesting
    // -------------------------------------------------------------------------

    function test_OwnerCanCreateSteppedVesting() public {
        vm.prank(owner);
        uint256 id = vesting.createSteppedVesting(alice, address(token), AMOUNT, DURATION, STEPS, false);
        assertEq(id, 0);
    }

    function test_SteppedVestingReleasesOneStepAtATime() public {
        vm.prank(owner);
        vesting.createSteppedVesting(alice, address(token), AMOUNT, DURATION, STEPS, false);

        vm.warp(block.timestamp + DURATION / STEPS);

        assertApproxEqAbs(vesting.getVestedAmount(0), AMOUNT / STEPS, 1e18);
    }

    function test_SteppedVestingFullyVestedAfterDuration() public {
        vm.prank(owner);
        vesting.createSteppedVesting(alice, address(token), AMOUNT, DURATION, STEPS, false);

        vm.warp(block.timestamp + DURATION + 1);

        assertEq(vesting.getVestedAmount(0), AMOUNT);
    }

    function test_CannotCreateSteppedVestingWithZeroSteps() public {
        vm.prank(owner);
        vm.expectRevert();
        vesting.createSteppedVesting(alice, address(token), AMOUNT, DURATION, 0, false);
    }

    function test_CannotCreateSteppedVestingWithTooManySteps() public {
        vm.prank(owner);
        vm.expectRevert();
        vesting.createSteppedVesting(alice, address(token), AMOUNT, DURATION, 1001, false);
    }

    // -------------------------------------------------------------------------
    // Access Control
    // -------------------------------------------------------------------------

    function test_NonBeneficiaryCannotRelease() public {
        vm.prank(owner);
        vesting.createLinearVesting(alice, address(token), AMOUNT, DURATION, 0, false);

        vm.warp(block.timestamp + DURATION / 2);

        vm.prank(bob);
        vm.expectRevert();
        vesting.release(0);
    }

    function test_NonOwnerCannotCreateVesting() public {
        vm.prank(other);
        vm.expectRevert();
        vesting.createLinearVesting(alice, address(token), AMOUNT, DURATION, 0, false);
    }

    function test_CannotReleaseWithNothingAvailable() public {
        vm.prank(owner);
        vesting.createCliffVesting(alice, address(token), AMOUNT, CLIFF, false);

        vm.prank(alice);
        vm.expectRevert();
        vesting.release(0);
    }

    // -------------------------------------------------------------------------
    // Revocation
    // -------------------------------------------------------------------------

    function test_OwnerCanRevokeRevocableVesting() public {
        vm.prank(owner);
        vesting.createLinearVesting(alice, address(token), AMOUNT, DURATION, 0, true);

        vm.warp(block.timestamp + DURATION / 2);

        vm.prank(owner);
        vesting.revoke(0);

        MarketVesting.VestingRecord memory v = vesting.getVesting(0);
        assertTrue(v.revoked);
    }

    function test_CannotRevokeNonRevocableVesting() public {
        vm.prank(owner);
        vesting.createLinearVesting(alice, address(token), AMOUNT, DURATION, 0, false);

        vm.prank(owner);
        vm.expectRevert();
        vesting.revoke(0);
    }

    function test_CannotRevokeAlreadyRevoked() public {
        vm.prank(owner);
        vesting.createLinearVesting(alice, address(token), AMOUNT, DURATION, 0, true);

        vm.prank(owner);
        vesting.revoke(0);

        vm.prank(owner);
        vm.expectRevert();
        vesting.revoke(0);
    }

    function test_RevokeSendsVestedTokensToBeneficiary() public {
        vm.prank(owner);
        vesting.createLinearVesting(alice, address(token), AMOUNT, DURATION, 0, true);

        vm.warp(block.timestamp + DURATION / 2);

        vm.prank(owner);
        vesting.revoke(0);

        assertGt(token.balanceOf(alice), 0);
    }

    function test_RevokeReturnsUnvestedToOwner() public {
        vm.prank(owner);
        vesting.createLinearVesting(alice, address(token), AMOUNT, DURATION, 0, true);

        // Warp only a little so most is unvested
        vm.warp(block.timestamp + 1 days);

        uint256 ownerBefore = token.balanceOf(owner);

        vm.prank(owner);
        vesting.revoke(0);

        assertGt(token.balanceOf(owner), ownerBefore);
    }

    // -------------------------------------------------------------------------
    // Query Functions
    // -------------------------------------------------------------------------

    function test_GetVestingProgress() public {
        vm.prank(owner);
        vesting.createLinearVesting(alice, address(token), AMOUNT, DURATION, 0, false);

        vm.warp(block.timestamp + DURATION / 2);

        assertApproxEqAbs(vesting.getVestingProgress(0), 0.5e18, 1e15);
    }

    function test_GetBeneficiaryVestings() public {
        vm.startPrank(owner);
        vesting.createLinearVesting(alice, address(token), AMOUNT, DURATION, 0, false);
        vesting.createCliffVesting(alice,  address(token), AMOUNT, CLIFF,    false);
        vm.stopPrank();

        uint256[] memory ids = vesting.getBeneficiaryVestings(alice);
        assertEq(ids.length, 2);
    }

    function test_TokenLockedTracksAllocatedAmount() public {
        vm.prank(owner);
        vesting.createLinearVesting(alice, address(token), AMOUNT, DURATION, 0, false);

        assertEq(vesting.tokenLocked(address(token)), AMOUNT);
    }

    function test_TokenLockedDecreasesOnRelease() public {
        vm.prank(owner);
        vesting.createLinearVesting(alice, address(token), AMOUNT, DURATION, 0, false);

        vm.warp(block.timestamp + DURATION);

        vm.prank(alice);
        vesting.release(0);

        assertEq(vesting.tokenLocked(address(token)), 0);
    }

    function test_InvalidVestingIdReverts() public {
        vm.expectRevert();
        vesting.getVesting(999);
    }
}

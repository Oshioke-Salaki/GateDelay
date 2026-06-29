// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/LiquidityMining.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Minimal ERC20 for testing
contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract LiquidityMiningTest is Test {
    LiquidityMining mining;
    MockERC20 rewardToken;
    MockERC20 stakingToken;

    address owner  = address(0xA11CE);
    address alice  = address(0xA11CE1);
    address bob    = address(0xB0B);
    address other  = address(0xDEAD);

    uint256 constant REWARD_RATE  = 1e18;       // 1 token per second
    uint256 constant STAKE_AMOUNT = 1_000e18;
    uint256 constant REWARD_FUND  = 100_000e18;

    function setUp() public {
        vm.startPrank(owner);

        rewardToken  = new MockERC20("Reward",  "RWD");
        stakingToken = new MockERC20("Staking", "STK");
        mining       = new LiquidityMining(address(rewardToken));

        rewardToken.mint(owner, REWARD_FUND);
        rewardToken.approve(address(mining), REWARD_FUND);
        mining.fundRewards(REWARD_FUND);

        mining.createPool(address(stakingToken), REWARD_RATE);

        vm.stopPrank();

        stakingToken.mint(alice, STAKE_AMOUNT * 10);
        stakingToken.mint(bob,   STAKE_AMOUNT * 10);

        vm.prank(alice);
        stakingToken.approve(address(mining), type(uint256).max);

        vm.prank(bob);
        stakingToken.approve(address(mining), type(uint256).max);
    }

    // -------------------------------------------------------------------------
    // Pool Management
    // -------------------------------------------------------------------------

    function test_OwnerCanCreatePool() public {
        vm.prank(owner);
        uint256 poolId = mining.createPool(address(stakingToken), REWARD_RATE);
        assertEq(poolId, 1);
        assertEq(mining.getPoolCount(), 2);
    }

    function test_NonOwnerCannotCreatePool() public {
        vm.prank(other);
        vm.expectRevert();
        mining.createPool(address(stakingToken), REWARD_RATE);
    }

    function test_CannotCreatePoolWithZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert();
        mining.createPool(address(0), REWARD_RATE);
    }

    function test_CannotCreatePoolWithZeroRate() public {
        vm.prank(owner);
        vm.expectRevert();
        mining.createPool(address(stakingToken), 0);
    }

    function test_OwnerCanSetPoolInactive() public {
        vm.prank(owner);
        mining.setPoolActive(0, false);
        LiquidityMining.Pool memory pool = mining.getPool(0);
        assertFalse(pool.active);
    }

    function test_OwnerCanUpdateRewardRate() public {
        vm.prank(owner);
        mining.updateRewardRate(0, 2e18);
        assertEq(mining.getRewardRate(0), 2e18);
    }

    function test_NonOwnerCannotUpdateRewardRate() public {
        vm.prank(other);
        vm.expectRevert();
        mining.updateRewardRate(0, 2e18);
    }

    function test_GetPoolRevertsForInvalidId() public {
        vm.expectRevert();
        mining.getPool(999);
    }

    // -------------------------------------------------------------------------
    // Reward Funding
    // -------------------------------------------------------------------------

    function test_FundRewardsIncreasesReserve() public {
        uint256 before = mining.rewardReserve();

        vm.startPrank(owner);
        rewardToken.mint(owner, 500e18);
        rewardToken.approve(address(mining), 500e18);
        mining.fundRewards(500e18);
        vm.stopPrank();

        assertEq(mining.rewardReserve(), before + 500e18);
    }

    function test_FundRewardsRevertsOnZeroAmount() public {
        vm.prank(owner);
        vm.expectRevert();
        mining.fundRewards(0);
    }

    // -------------------------------------------------------------------------
    // Liquidity Provision
    // -------------------------------------------------------------------------

    function test_UserCanProvide() public {
        vm.prank(alice);
        mining.provide(0, STAKE_AMOUNT);

        LiquidityMining.UserPosition memory pos = mining.getPosition(0, alice);
        assertEq(pos.amount, STAKE_AMOUNT);
        assertEq(mining.getTotalStaked(0), STAKE_AMOUNT);
    }

    function test_CannotProvideToInactivePool() public {
        vm.prank(owner);
        mining.setPoolActive(0, false);

        vm.prank(alice);
        vm.expectRevert();
        mining.provide(0, STAKE_AMOUNT);
    }

    function test_CannotProvideZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert();
        mining.provide(0, 0);
    }

    function test_MultipleUsersCanProvide() public {
        vm.prank(alice);
        mining.provide(0, STAKE_AMOUNT);

        vm.prank(bob);
        mining.provide(0, STAKE_AMOUNT * 2);

        assertEq(mining.getTotalStaked(0), STAKE_AMOUNT * 3);
    }

    function test_UserCanWithdraw() public {
        vm.prank(alice);
        mining.provide(0, STAKE_AMOUNT);

        vm.prank(alice);
        mining.withdraw(0, STAKE_AMOUNT);

        LiquidityMining.UserPosition memory pos = mining.getPosition(0, alice);
        assertEq(pos.amount, 0);
        assertEq(mining.getTotalStaked(0), 0);
    }

    function test_CannotWithdrawMoreThanStaked() public {
        vm.prank(alice);
        mining.provide(0, STAKE_AMOUNT);

        vm.prank(alice);
        vm.expectRevert();
        mining.withdraw(0, STAKE_AMOUNT + 1);
    }

    function test_CannotWithdrawZeroAmount() public {
        vm.prank(alice);
        mining.provide(0, STAKE_AMOUNT);

        vm.prank(alice);
        vm.expectRevert();
        mining.withdraw(0, 0);
    }

    function test_StakingTokenReturnedOnWithdraw() public {
        uint256 before = stakingToken.balanceOf(alice);

        vm.prank(alice);
        mining.provide(0, STAKE_AMOUNT);

        vm.prank(alice);
        mining.withdraw(0, STAKE_AMOUNT);

        assertEq(stakingToken.balanceOf(alice), before);
    }

    // -------------------------------------------------------------------------
    // Reward Calculation
    // -------------------------------------------------------------------------

    function test_RewardsAccumulateOverTime() public {
        vm.prank(alice);
        mining.provide(0, STAKE_AMOUNT);

        vm.warp(block.timestamp + 100);

        assertGt(mining.getPendingRewards(0, alice), 0);
    }

    function test_RewardsProportionalToStake() public {
        vm.prank(alice);
        mining.provide(0, STAKE_AMOUNT);

        vm.prank(bob);
        mining.provide(0, STAKE_AMOUNT);

        vm.warp(block.timestamp + 100);

        uint256 alicePending = mining.getPendingRewards(0, alice);
        uint256 bobPending   = mining.getPendingRewards(0, bob);

        assertApproxEqAbs(alicePending, bobPending, 1e10);
    }

    function test_LargerStakeEarnsMoreRewards() public {
        vm.prank(alice);
        mining.provide(0, STAKE_AMOUNT);

        vm.prank(bob);
        mining.provide(0, STAKE_AMOUNT * 3);

        vm.warp(block.timestamp + 100);

        assertGt(mining.getPendingRewards(0, bob), mining.getPendingRewards(0, alice));
    }

    function test_UserCanClaimRewards() public {
        vm.prank(alice);
        mining.provide(0, STAKE_AMOUNT);

        vm.warp(block.timestamp + 100);

        uint256 balanceBefore = rewardToken.balanceOf(alice);

        vm.prank(alice);
        mining.claimRewards(0);

        assertGt(rewardToken.balanceOf(alice), balanceBefore);
    }

    function test_ClaimDecreasesRewardReserve() public {
        vm.prank(alice);
        mining.provide(0, STAKE_AMOUNT);

        vm.warp(block.timestamp + 10);

        uint256 reserveBefore = mining.rewardReserve();

        vm.prank(alice);
        mining.claimRewards(0);

        assertLt(mining.rewardReserve(), reserveBefore);
    }

    function test_CannotClaimWithNoPendingRewards() public {
        vm.prank(alice);
        vm.expectRevert();
        mining.claimRewards(0);
    }

    function test_PendingRewardsZeroAfterClaim() public {
        vm.prank(alice);
        mining.provide(0, STAKE_AMOUNT);

        vm.warp(block.timestamp + 50);

        vm.prank(alice);
        mining.claimRewards(0);

        // Immediately after claim pending should be ~0
        assertEq(mining.getPendingRewards(0, alice), 0);
    }

    // -------------------------------------------------------------------------
    // Query Functions
    // -------------------------------------------------------------------------

    function test_GetPoolReturnsCorrectData() public {
        LiquidityMining.Pool memory pool = mining.getPool(0);
        assertEq(address(pool.stakingToken), address(stakingToken));
        assertEq(pool.rewardRate, REWARD_RATE);
        assertTrue(pool.active);
    }

    function test_GetPoolParticipantsTracksProviders() public {
        vm.prank(alice);
        mining.provide(0, STAKE_AMOUNT);

        vm.prank(bob);
        mining.provide(0, STAKE_AMOUNT);

        address[] memory participants = mining.getPoolParticipants(0);
        assertEq(participants.length, 2);
    }

    function test_DepositTimestampRecordedOnFirstProvide() public {
        vm.prank(alice);
        mining.provide(0, STAKE_AMOUNT);

        LiquidityMining.UserPosition memory pos = mining.getPosition(0, alice);
        assertEq(pos.depositTimestamp, block.timestamp);
    }

    function test_LastClaimTimestampUpdatedOnClaim() public {
        vm.prank(alice);
        mining.provide(0, STAKE_AMOUNT);

        vm.warp(block.timestamp + 50);

        vm.prank(alice);
        mining.claimRewards(0);

        LiquidityMining.UserPosition memory pos = mining.getPosition(0, alice);
        assertEq(pos.lastClaimTimestamp, block.timestamp);
    }
}

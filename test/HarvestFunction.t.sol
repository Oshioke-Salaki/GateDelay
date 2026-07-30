// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../Contracts/contracts/HarvestFunction.sol";
import "../Contracts/src/ERC20Token.sol";

contract HarvestFunctionTest is Test {
    HarvestFunction public harvester;
    ERC20Token public rewardToken;

    address public owner = address(0x1);
    address public alice = address(0x2);
    address public bob = address(0x3);
    address public treasury = address(0x4);

    uint256 public constant INITIAL_SUPPLY = 1000000 * 1e18;

    function setUp() public {
        vm.startPrank(owner);
        harvester = new HarvestFunction(treasury);
        rewardToken = new ERC20Token(1000000); // 1M tokens minted to owner
        vm.stopPrank();

        // Distribute tokens to users and harvester contract
        vm.startPrank(owner);
        rewardToken.transfer(alice, 10000e18);
        rewardToken.transfer(bob, 10000e18);
        rewardToken.transfer(address(harvester), 50000e18); // Fund harvester with rewards
        vm.stopPrank();
    }

    function test_Initialization() public {
        assertEq(harvester.owner(), owner);
        assertEq(harvester.feeTreasury(), treasury);
        assertEq(harvester.sourceCount(), 0);
    }

    function test_SetFeeTreasury() public {
        address newTreasury = address(0x5);
        
        vm.prank(owner);
        harvester.setFeeTreasury(newTreasury);
        assertEq(harvester.feeTreasury(), newTreasury);
        
        // Revert when not owner
        vm.prank(alice);
        vm.expectRevert();
        harvester.setFeeTreasury(newTreasury);
    }

    function test_AddRewardSource() public {
        vm.startPrank(owner);
        uint256 sourceId = harvester.addRewardSource("GTD Pool", address(rewardToken), 1e18, 500);
        vm.stopPrank();

        assertEq(sourceId, 1);
        assertEq(harvester.sourceCount(), 1);

        (
            uint256 id,
            string memory name,
            address token,
            uint256 rate,
            uint256 lastUpdate,
            uint256 accPerShare,
            uint256 totalStaked,
            uint256 feeBps,
            bool active
        ) = harvester.rewardSources(1);

        assertEq(id, 1);
        assertEq(name, "GTD Pool");
        assertEq(token, address(rewardToken));
        assertEq(rate, 1e18);
        assertEq(feeBps, 500);
        assertTrue(active);
    }

    function test_UpdateRewardSource() public {
        vm.startPrank(owner);
        uint256 sourceId = harvester.addRewardSource("GTD Pool", address(rewardToken), 1e18, 500);
        harvester.updateRewardSource(sourceId, 2e18, 1000, false);
        vm.stopPrank();

        (
            ,,,
            uint256 rate,
            ,,,
            uint256 feeBps,
            bool active
        ) = harvester.rewardSources(sourceId);

        assertEq(rate, 2e18);
        assertEq(feeBps, 1000);
        assertFalse(active);
    }

    function test_StakeAndAccrual() public {
        vm.startPrank(owner);
        uint256 sourceId = harvester.addRewardSource("GTD Pool", address(rewardToken), 1e18, 1000);
        vm.stopPrank();

        // Alice stakes
        vm.startPrank(alice);
        rewardToken.approve(address(harvester), 1000e18);
        harvester.stake(sourceId, 1000e18);
        vm.stopPrank();

        (uint256 stakeAmount,,) = harvester.userPositions(sourceId, alice);
        assertEq(stakeAmount, 1000e18);

        // Advance time by 10 seconds
        vm.warp(block.timestamp + 10);

        // Since Alice is the only staker, she should accrue: 10 * 1e18 = 10e18 rewards
        uint256 pending = harvester.getPendingRewards(sourceId, alice);
        assertEq(pending, 10e18);
    }

    function test_HarvestAndFees() public {
        vm.startPrank(owner);
        uint256 sourceId = harvester.addRewardSource("GTD Pool", address(rewardToken), 1e18, 1000);
        vm.stopPrank();

        // Alice stakes
        vm.startPrank(alice);
        rewardToken.approve(address(harvester), 1000e18);
        harvester.stake(sourceId, 1000e18);
        vm.stopPrank();

        // Warp 10 seconds (10e18 total rewards)
        vm.warp(block.timestamp + 10);

        // Expected fee = 10e18 * 10% = 1e18
        // Expected net = 10e18 - 1e18 = 9e18
        uint256 expectedFee = harvester.calculateHarvestFee(10e18, 1000);
        assertEq(expectedFee, 1e18);

        uint256 aliceBalBefore = rewardToken.balanceOf(alice);
        uint256 treasuryBalBefore = rewardToken.balanceOf(treasury);

        // Alice harvests
        vm.prank(alice);
        uint256 netAmount = harvester.harvest(sourceId, alice);

        assertEq(netAmount, 9e18);
        assertEq(rewardToken.balanceOf(alice), aliceBalBefore + 9e18);
        assertEq(rewardToken.balanceOf(treasury), treasuryBalBefore + 1e18);

        // Double harvest should revert
        vm.prank(alice);
        vm.expectRevert(HarvestFunction.NoRewardsToHarvest.selector);
        harvester.harvest(sourceId, alice);
    }

    function test_HarvestHistoryTracking() public {
        vm.startPrank(owner);
        uint256 sourceId = harvester.addRewardSource("GTD Pool", address(rewardToken), 1e18, 1000);
        vm.stopPrank();

        // Alice stakes
        vm.startPrank(alice);
        rewardToken.approve(address(harvester), 1000e18);
        harvester.stake(sourceId, 1000e18);
        vm.stopPrank();

        // Warp 10s
        vm.warp(block.timestamp + 10);

        // Alice harvests
        vm.prank(alice);
        harvester.harvest(sourceId, alice);

        // Bob stakes
        vm.startPrank(bob);
        rewardToken.approve(address(harvester), 1000e18);
        harvester.stake(sourceId, 1000e18);
        vm.stopPrank();

        // Warp 10s
        vm.warp(block.timestamp + 10);

        // Bob harvests
        vm.prank(bob);
        harvester.harvest(sourceId, bob);

        // Verify history queries
        assertEq(harvester.getHarvestHistoryCount(), 2);

        HarvestFunction.HarvestRecord memory record1 = harvester.getHarvestHistoryRecord(0);
        assertEq(record1.user, alice);
        assertEq(record1.rewardAmount, 10e18);
        assertEq(record1.feeAmount, 1e18);
        assertEq(record1.netAmount, 9e18);

        HarvestFunction.HarvestRecord memory record2 = harvester.getHarvestHistoryRecord(1);
        assertEq(record2.user, bob);
        // Bob and Alice shared rewards for 10s (rate 1e18/s => 10e18 total distributed).
        // Since Bob staked 1000e18 and Alice staked 1000e18 (totalStaked = 2000e18), each got 5e18.
        // Fee = 5e18 * 10% = 0.5e18. Net = 4.5e18.
        assertEq(record2.rewardAmount, 5e18);
        assertEq(record2.feeAmount, 0.5e18);
        assertEq(record2.netAmount, 4.5e18);

        // Get user-specific harvest history
        HarvestFunction.HarvestRecord[] memory aliceHistory = harvester.getHarvestHistory(sourceId, alice);
        assertEq(aliceHistory.length, 1);
        assertEq(aliceHistory[0].user, alice);
        assertEq(aliceHistory[0].rewardAmount, 10e18);

        HarvestFunction.HarvestRecord[] memory bobHistory = harvester.getHarvestHistory(sourceId, bob);
        assertEq(bobHistory.length, 1);
        assertEq(bobHistory[0].user, bob);
        assertEq(bobHistory[0].rewardAmount, 5e18);
    }

    function test_GetActiveSourcesCount() public {
        vm.startPrank(owner);
        harvester.addRewardSource("Pool 1", address(rewardToken), 1e18, 500);
        harvester.addRewardSource("Pool 2", address(rewardToken), 2e18, 500);
        uint256 pool3 = harvester.addRewardSource("Pool 3", address(rewardToken), 3e18, 500);
        
        assertEq(harvester.getActiveSourcesCount(), 3);

        // Deactivate pool 3
        harvester.updateRewardSource(pool3, 3e18, 500, false);
        assertEq(harvester.getActiveSourcesCount(), 2);
        vm.stopPrank();
    }

    function test_HarvestMultiple() public {
        vm.startPrank(owner);
        uint256 sourceId1 = harvester.addRewardSource("Pool 1", address(rewardToken), 1e18, 500);
        uint256 sourceId2 = harvester.addRewardSource("Pool 2", address(rewardToken), 1e18, 500);
        vm.stopPrank();

        // Alice stakes in both pools
        vm.startPrank(alice);
        rewardToken.approve(address(harvester), 2000e18);
        harvester.stake(sourceId1, 1000e18);
        harvester.stake(sourceId2, 1000e18);
        vm.stopPrank();

        // Warp 10s
        vm.warp(block.timestamp + 10);

        // Alice harvests from both pools
        uint256[] memory sourceIds = new uint256[](2);
        sourceIds[0] = sourceId1;
        sourceIds[1] = sourceId2;

        vm.prank(alice);
        uint256[] memory netAmounts = harvester.harvestMultiple(sourceIds, alice);

        // Each pool should have 10e18 rewards with 5% fee = 9.5e18 net
        assertEq(netAmounts[0], 9.5e18);
        assertEq(netAmounts[1], 9.5e18);
    }
}

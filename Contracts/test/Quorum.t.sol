// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Quorum.sol";

contract QuorumTest is Test {
    Quorum quorum;

    function setUp() public {
        // Initialize with 50% percentage quorum
        quorum = new Quorum(Quorum.QuorumType.PERCENTAGE, 50e18);
    }

    function test_CalculateQuorumThreshold_Percentage() public view {
        uint256 totalVotes = 100e18;
        uint256 required = quorum.calculateQuorumThreshold(totalVotes);
        assertEq(required, 50e18);
    }

    function test_CalculateQuorumThreshold_Absolute() public {
        Quorum absoluteQuorum = new Quorum(Quorum.QuorumType.ABSOLUTE, 30e18);
        uint256 required = absoluteQuorum.calculateQuorumThreshold(100e18);
        assertEq(required, 30e18);
    }

    function test_ValidateQuorumAchievement_Success() public {
        uint256 votesReceived = 50e18;
        uint256 totalVotes = 100e18;
        bool achieved = quorum.validateQuorumAchievement(votesReceived, totalVotes);
        assertTrue(achieved);
    }

    function test_ValidateQuorumAchievement_Failure() public {
        uint256 votesReceived = 40e18;
        uint256 totalVotes = 100e18;
        vm.expectRevert(Quorum.QuorumNotAchieved.selector);
        quorum.validateQuorumAchievement(votesReceived, totalVotes);
    }

    function test_UpdateQuorumConfig() public {
        quorum.updateQuorumConfig(Quorum.QuorumType.PERCENTAGE, 75e18);
        (Quorum.QuorumType qType, uint256 threshold,) = quorum.getQuorumStatus();
        assertEq(uint256(qType), uint256(Quorum.QuorumType.PERCENTAGE));
        assertEq(threshold, 75e18);
    }

    function test_InvalidQuorumPercentage() public {
        vm.expectRevert(Quorum.InvalidQuorumPercentage.selector);
        new Quorum(Quorum.QuorumType.PERCENTAGE, 150e18);
    }

    function test_ZeroTotalVotes() public {
        vm.expectRevert(Quorum.ZeroTotalVotes.selector);
        quorum.calculateQuorumThreshold(0);
    }

    function test_GetQuorumStatus() public view {
        (Quorum.QuorumType qType, uint256 threshold, uint256 lastUpdated) = quorum.getQuorumStatus();
        assertEq(uint256(qType), uint256(Quorum.QuorumType.PERCENTAGE));
        assertEq(threshold, 50e18);
        assertGt(lastUpdated, 0);
    }
}

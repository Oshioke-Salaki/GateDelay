// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/MarketArbitration.sol";

contract MarketArbitrationTest is Test {
    MarketArbitration public arbitration;

    address public admin = address(0xADMIN);
    address public arb1 = address(0xARB1);
    address public arb2 = address(0xARB2);
    address public arb3 = address(0xARB3);
    address public market = address(0xMARKET);

    event ArbitrationCreated(
        uint256 indexed arbitrationId,
        uint256 indexed disputeId,
        address indexed market,
        address[] arbitrators
    );
    event ArbitratorVoted(
        uint256 indexed arbitrationId,
        address indexed arbitrator,
        MarketArbitration.Decision decision
    );
    event ArbitrationResolved(
        uint256 indexed arbitrationId,
        MarketArbitration.Decision finalDecision
    );

    function setUp() public {
        arbitration = new MarketArbitration(admin);

        vm.startPrank(admin);
        arbitration.approveArbitrator(arb1);
        arbitration.approveArbitrator(arb2);
        arbitration.approveArbitrator(arb3);
        vm.stopPrank();
    }

    function test_approveArbitrator() public {
        address newArb = address(0xNEWARB);
        
        vm.prank(admin);
        arbitration.approveArbitrator(newArb);

        assertTrue(arbitration.isApprovedArbitrator(newArb));
    }

    function test_revokeArbitrator() public {
        vm.prank(admin);
        arbitration.revokeArbitrator(arb1);

        assertFalse(arbitration.isApprovedArbitrator(arb1));
    }

    function test_createArbitration() public {
        address[] memory arbitrators = new address[](3);
        arbitrators[0] = arb1;
        arbitrators[1] = arb2;
        arbitrators[2] = arb3;

        vm.prank(admin);
        uint256 arbId = arbitration.createArbitration(1, market, arbitrators);

        assertEq(arbId, 1);
        assertEq(arbitration.arbitrationCount(), 1);

        MarketArbitration.Arbitration memory arb = arbitration.getArbitration(arbId);
        assertEq(arb.disputeId, 1);
        assertEq(arb.market, market);
        assertEq(uint256(arb.status), uint256(MarketArbitration.ArbitrationStatus.PENDING));
        assertEq(arb.arbitrators.length, 3);
    }

    function test_createArbitration_revertsInvalidArbitratorCount() public {
        address[] memory tooFew = new address[](2);
        tooFew[0] = arb1;
        tooFew[1] = arb2;

        vm.prank(admin);
        vm.expectRevert(MarketArbitration.InvalidArbitratorCount.selector);
        arbitration.createArbitration(1, market, tooFew);
    }

    function test_startVoting() public {
        address[] memory arbitrators = new address[](3);
        arbitrators[0] = arb1;
        arbitrators[1] = arb2;
        arbitrators[2] = arb3;

        vm.startPrank(admin);
        uint256 arbId = arbitration.createArbitration(1, market, arbitrators);
        arbitration.startVoting(arbId);
        vm.stopPrank();

        MarketArbitration.Arbitration memory arb = arbitration.getArbitration(arbId);
        assertEq(uint256(arb.status), uint256(MarketArbitration.ArbitrationStatus.VOTING));
    }

    function test_vote() public {
        address[] memory arbitrators = new address[](3);
        arbitrators[0] = arb1;
        arbitrators[1] = arb2;
        arbitrators[2] = arb3;

        vm.startPrank(admin);
        uint256 arbId = arbitration.createArbitration(1, market, arbitrators);
        arbitration.startVoting(arbId);
        vm.stopPrank();

        vm.prank(arb1);
        arbitration.vote(arbId, MarketArbitration.Decision.UPHOLD, "Evidence is strong");

        MarketArbitration.Vote[] memory votes = arbitration.getVotes(arbId);
        assertEq(votes.length, 1);
        assertEq(votes[0].arbitrator, arb1);
        assertEq(uint256(votes[0].decision), uint256(MarketArbitration.Decision.UPHOLD));
    }

    function test_vote_revertsAlreadyVoted() public {
        address[] memory arbitrators = new address[](3);
        arbitrators[0] = arb1;
        arbitrators[1] = arb2;
        arbitrators[2] = arb3;

        vm.startPrank(admin);
        uint256 arbId = arbitration.createArbitration(1, market, arbitrators);
        arbitration.startVoting(arbId);
        vm.stopPrank();

        vm.startPrank(arb1);
        arbitration.vote(arbId, MarketArbitration.Decision.UPHOLD, "");
        
        vm.expectRevert(MarketArbitration.AlreadyVoted.selector);
        arbitration.vote(arbId, MarketArbitration.Decision.REJECT, "");
        vm.stopPrank();
    }

    function test_vote_revertsNotArbitrator() public {
        address[] memory arbitrators = new address[](3);
        arbitrators[0] = arb1;
        arbitrators[1] = arb2;
        arbitrators[2] = arb3;

        vm.startPrank(admin);
        uint256 arbId = arbitration.createArbitration(1, market, arbitrators);
        arbitration.startVoting(arbId);
        vm.stopPrank();

        address notArbitrator = address(0xNOTARB);
        vm.prank(notArbitrator);
        vm.expectRevert(MarketArbitration.NotArbitrator.selector);
        arbitration.vote(arbId, MarketArbitration.Decision.UPHOLD, "");
    }

    function test_autoResolve_upheld() public {
        address[] memory arbitrators = new address[](3);
        arbitrators[0] = arb1;
        arbitrators[1] = arb2;
        arbitrators[2] = arb3;

        vm.startPrank(admin);
        uint256 arbId = arbitration.createArbitration(1, market, arbitrators);
        arbitration.startVoting(arbId);
        vm.stopPrank();

        vm.prank(arb1);
        arbitration.vote(arbId, MarketArbitration.Decision.UPHOLD, "");

        vm.prank(arb2);
        arbitration.vote(arbId, MarketArbitration.Decision.UPHOLD, "");

        vm.prank(arb3);
        arbitration.vote(arbId, MarketArbitration.Decision.REJECT, "");

        MarketArbitration.Arbitration memory arb = arbitration.getArbitration(arbId);
        assertEq(uint256(arb.status), uint256(MarketArbitration.ArbitrationStatus.RESOLVED));
        assertEq(uint256(arb.finalDecision), uint256(MarketArbitration.Decision.UPHOLD));
    }

    function test_autoResolve_rejected() public {
        address[] memory arbitrators = new address[](3);
        arbitrators[0] = arb1;
        arbitrators[1] = arb2;
        arbitrators[2] = arb3;

        vm.startPrank(admin);
        uint256 arbId = arbitration.createArbitration(1, market, arbitrators);
        arbitration.startVoting(arbId);
        vm.stopPrank();

        vm.prank(arb1);
        arbitration.vote(arbId, MarketArbitration.Decision.REJECT, "");

        vm.prank(arb2);
        arbitration.vote(arbId, MarketArbitration.Decision.REJECT, "");

        vm.prank(arb3);
        arbitration.vote(arbId, MarketArbitration.Decision.UPHOLD, "");

        MarketArbitration.Arbitration memory arb = arbitration.getArbitration(arbId);
        assertEq(uint256(arb.finalDecision), uint256(MarketArbitration.Decision.REJECT));
    }

    function test_getArbitrationForDispute() public {
        address[] memory arbitrators = new address[](3);
        arbitrators[0] = arb1;
        arbitrators[1] = arb2;
        arbitrators[2] = arb3;

        vm.prank(admin);
        uint256 arbId = arbitration.createArbitration(42, market, arbitrators);

        assertEq(arbitration.getArbitrationForDispute(42), arbId);
    }

    function test_getArbitratorAssignments() public {
        address[] memory arbitrators1 = new address[](3);
        arbitrators1[0] = arb1;
        arbitrators1[1] = arb2;
        arbitrators1[2] = arb3;

        address[] memory arbitrators2 = new address[](3);
        arbitrators2[0] = arb1;
        arbitrators2[1] = arb2;
        arbitrators2[2] = arb3;

        vm.startPrank(admin);
        arbitration.createArbitration(1, market, arbitrators1);
        arbitration.createArbitration(2, market, arbitrators2);
        vm.stopPrank();

        uint256[] memory assignments = arbitration.getArbitratorAssignments(arb1);
        assertEq(assignments.length, 2);
        assertEq(assignments[0], 1);
        assertEq(assignments[1], 2);
    }

    function test_getVoteCounts() public {
        address[] memory arbitrators = new address[](3);
        arbitrators[0] = arb1;
        arbitrators[1] = arb2;
        arbitrators[2] = arb3;

        vm.startPrank(admin);
        uint256 arbId = arbitration.createArbitration(1, market, arbitrators);
        arbitration.startVoting(arbId);
        vm.stopPrank();

        vm.prank(arb1);
        arbitration.vote(arbId, MarketArbitration.Decision.UPHOLD, "");

        vm.prank(arb2);
        arbitration.vote(arbId, MarketArbitration.Decision.REJECT, "");

        (uint256 upholdVotes, uint256 rejectVotes) = arbitration.getVoteCounts(arbId);
        assertEq(upholdVotes, 1);
        assertEq(rejectVotes, 1);
    }

    function testFuzz_createArbitration(uint8 arbitratorCount) public {
        arbitratorCount = uint8(bound(arbitratorCount, 3, 11));

        address[] memory arbitrators = new address[](arbitratorCount);
        for (uint8 i = 0; i < arbitratorCount; i++) {
            address arb = address(uint160(0x1000 + i));
            vm.prank(admin);
            arbitration.approveArbitrator(arb);
            arbitrators[i] = arb;
        }

        vm.prank(admin);
        uint256 arbId = arbitration.createArbitration(1, market, arbitrators);

        MarketArbitration.Arbitration memory arb = arbitration.getArbitration(arbId);
        assertEq(arb.arbitrators.length, arbitratorCount);
    }
}

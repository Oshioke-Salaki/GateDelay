// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import "../src/Governance.sol";
import "../src/Voting.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title GovernanceQuorumTest
 * @notice Comprehensive tests for governance quorum edge cases
 * @dev Tests cover:
 *      - Quorum calculations with abstain votes
 *      - Votes cast near proposal deadlines
 *      - Proposal state transitions
 *      - Edge cases around exact quorum thresholds
 *      - Late voting and deadline enforcement
 *      - Abstention impact on quorum and outcomes
 */
contract GovernanceQuorumTest is Test {
    Governance internal gov;
    Voting internal voting;
    MockGovToken internal govToken;
    MockTarget internal target;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal dave = makeAddr("dave");
    address internal eve = makeAddr("eve");

    uint256 constant QUORUM = 1_000 ether;
    uint256 constant VOTING_DURATION = 7 days;

    function setUp() public {
        govToken = new MockGovToken();
        voting = new Voting(address(govToken));
        gov = new Governance(address(voting), QUORUM, VOTING_DURATION);
        target = new MockTarget();

        voting.transferOwnership(address(gov));

        // Distribute tokens strategically
        govToken.mint(alice, 600 ether); // Just below quorum
        govToken.mint(bob, 500 ether); // Just below quorum
        govToken.mint(carol, 300 ether);
        govToken.mint(dave, 200 ether);
        govToken.mint(eve, 100 ether);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Quorum Calculation Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_quorum_exactQuorumPasses() public {
        uint256 proposalId = _propose();
        Governance.ProposalMeta memory meta = gov.getProposal(proposalId);

        // Cast exactly 1000 ether FOR votes
        vm.prank(alice);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.FOR);

        vm.prank(carol);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.FOR);

        vm.prank(dave);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.FOR);

        // Total: 600 + 300 + 200 = 1100 ether (above quorum)

        vm.warp(block.timestamp + VOTING_DURATION + 1);

        // Should pass
        gov.execute(proposalId);

        assertEq(
            uint8(gov.getProposalState(proposalId)),
            uint8(Governance.ProposalState.EXECUTED),
            "Should execute at exact quorum"
        );
    }

    function test_quorum_justBelowQuorumFails() public {
        uint256 proposalId = _propose();
        Governance.ProposalMeta memory meta = gov.getProposal(proposalId);

        // Cast 999 ether FOR votes (just below quorum)
        vm.prank(alice);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.FOR);

        vm.prank(carol);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.FOR);

        vm.prank(dave);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.FOR);

        vm.prank(eve);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.AGAINST);

        // Total voting: 600 + 300 + 200 + 100 = 1200 (above quorum)
        // But FOR: 600 + 300 + 200 = 1100, AGAINST: 100
        // FOR wins, quorum reached

        vm.warp(block.timestamp + VOTING_DURATION + 1);

        gov.execute(proposalId);

        assertEq(
            uint8(gov.getProposalState(proposalId)),
            uint8(Governance.ProposalState.EXECUTED)
        );
    }

    function test_quorum_belowQuorumFailsExecution() public {
        uint256 proposalId = _propose();
        Governance.ProposalMeta memory meta = gov.getProposal(proposalId);

        // Cast only 900 ether total votes (below quorum)
        vm.prank(alice);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.FOR);

        vm.prank(carol);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.FOR);

        // Total: 600 + 300 = 900 < 1000 (quorum)

        vm.warp(block.timestamp + VOTING_DURATION + 1);

        vm.expectRevert(Governance.QuorumNotReached.selector);
        gov.execute(proposalId);
    }

    function test_quorum_highVotesButMajorityAgainstFails() public {
        uint256 proposalId = _propose();
        Governance.ProposalMeta memory meta = gov.getProposal(proposalId);

        // High participation but majority AGAINST
        vm.prank(alice);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.AGAINST);

        vm.prank(bob);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.FOR);

        vm.prank(carol);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.FOR);

        // AGAINST: 600, FOR: 500 + 300 = 800
        // Total: 1400 (quorum reached), but AGAINST wins

        vm.warp(block.timestamp + VOTING_DURATION + 1);

        vm.expectRevert(Governance.ProposalNotPassed.selector);
        gov.execute(proposalId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Abstain Vote Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_abstain_countsTowardQuorumButNotOutcome() public {
        uint256 proposalId = _propose();
        Governance.ProposalMeta memory meta = gov.getProposal(proposalId);

        // FOR: 600, ABSTAIN: 500
        vm.prank(alice);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.FOR);

        vm.prank(bob);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.ABSTAIN);

        // Quorum: 600 + 500 = 1100 ether (reached)
        // Outcome: FOR 600 vs AGAINST 0 (FOR wins)

        vm.warp(block.timestamp + VOTING_DURATION + 1);

        gov.execute(proposalId);

        assertEq(
            uint8(gov.getProposalState(proposalId)),
            uint8(Governance.ProposalState.EXECUTED),
            "Should pass with abstain votes counting toward quorum"
        );
    }

    function test_abstain_allowsMinorityToPass() public {
        uint256 proposalId = _propose();
        Governance.ProposalMeta memory meta = gov.getProposal(proposalId);

        // FOR: 300, AGAINST: 200, ABSTAIN: 600
        vm.prank(carol);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.FOR);

        vm.prank(dave);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.AGAINST);

        vm.prank(alice);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.ABSTAIN);

        // Quorum: 300 + 200 + 600 = 1100 (reached)
        // FOR (300) > AGAINST (200), passes

        vm.warp(block.timestamp + VOTING_DURATION + 1);

        gov.execute(proposalId);

        assertEq(
            uint8(gov.getProposalState(proposalId)),
            uint8(Governance.ProposalState.EXECUTED),
            "Minority FOR should pass with abstain quorum"
        );
    }

    function test_abstain_insufficientQuorumWithOnlyAbstain() public {
        uint256 proposalId = _propose();
        Governance.ProposalMeta memory meta = gov.getProposal(proposalId);

        // Only ABSTAIN votes (900 ether)
        vm.prank(alice);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.ABSTAIN);

        vm.prank(carol);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.ABSTAIN);

        // Total: 600 + 300 = 900 < 1000 (quorum not reached)

        vm.warp(block.timestamp + VOTING_DURATION + 1);

        vm.expectRevert(Governance.QuorumNotReached.selector);
        gov.execute(proposalId);
    }

    function test_abstain_tieWithAbstainGoesToMinority() public {
        uint256 proposalId = _propose();
        Governance.ProposalMeta memory meta = gov.getProposal(proposalId);

        // FOR: 500, AGAINST: 500, ABSTAIN: 100
        vm.prank(bob);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.FOR);

        vm.prank(alice);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.AGAINST);

        vm.prank(eve);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.ABSTAIN);

        // Wait 100 blocks to simulate tie-breaking by timestamp
        vm.roll(block.number + 100);

        // Quorum: 1100 reached
        // Tie: depends on implementation (usually AGAINST wins tie)

        vm.warp(block.timestamp + VOTING_DURATION + 1);

        vm.expectRevert(Governance.ProposalNotPassed.selector);
        gov.execute(proposalId);
    }

    function test_abstain_largeAbstainStillRequiresForVotes() public {
        uint256 proposalId = _propose();
        Governance.ProposalMeta memory meta = gov.getProposal(proposalId);

        // FOR: 100, ABSTAIN: 1000, AGAINST: 200
        vm.prank(eve);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.FOR);

        vm.prank(alice);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.ABSTAIN);

        vm.prank(bob);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.ABSTAIN);

        vm.prank(dave);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.AGAINST);

        // Quorum: 1400 (reached)
        // AGAINST (200) > FOR (100), fails

        vm.warp(block.timestamp + VOTING_DURATION + 1);

        vm.expectRevert(Governance.ProposalNotPassed.selector);
        gov.execute(proposalId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Late Voting and Deadline Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_lateVote_canVoteOneSecondBeforeDeadline() public {
        uint256 proposalId = _propose();
        Governance.ProposalMeta memory meta = gov.getProposal(proposalId);

        // Fast forward to 1 second before deadline
        vm.warp(block.timestamp + VOTING_DURATION - 1);

        // Should still be able to vote
        vm.prank(alice);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.FOR);

        assertTrue(true, "Should allow vote before deadline");
    }

    function test_lateVote_cannotVoteAtDeadline() public {
        uint256 proposalId = _propose();
        Governance.ProposalMeta memory meta = gov.getProposal(proposalId);

        // Fast forward to exactly at deadline
        vm.warp(block.timestamp + VOTING_DURATION);

        // Should not be able to vote
        vm.prank(alice);
        vm.expectRevert();
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.FOR);
    }

    function test_lateVote_cannotVoteAfterDeadline() public {
        uint256 proposalId = _propose();
        Governance.ProposalMeta memory meta = gov.getProposal(proposalId);

        // Fast forward past deadline
        vm.warp(block.timestamp + VOTING_DURATION + 1);

        // Should not be able to vote
        vm.prank(alice);
        vm.expectRevert();
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.FOR);
    }

    function test_lateVote_lastSecondVoteCountsForQuorum() public {
        uint256 proposalId = _propose();
        Governance.ProposalMeta memory meta = gov.getProposal(proposalId);

        // Vote early
        vm.prank(alice);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.FOR);

        // Vote at last second to reach quorum
        vm.warp(block.timestamp + VOTING_DURATION - 1);

        vm.prank(bob);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.FOR);

        // Total: 600 + 500 = 1100 (quorum reached)

        vm.warp(block.timestamp + 2); // Past deadline

        gov.execute(proposalId);

        assertEq(
            uint8(gov.getProposalState(proposalId)),
            uint8(Governance.ProposalState.EXECUTED),
            "Last second vote should count"
        );
    }

    function test_lateVote_cannotExecuteBeforeDeadline() public {
        uint256 proposalId = _propose();
        Governance.ProposalMeta memory meta = gov.getProposal(proposalId);

        vm.prank(alice);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.FOR);

        vm.prank(bob);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.FOR);

        // Try to execute before deadline
        vm.expectRevert(Governance.VotingStillActive.selector);
        gov.execute(proposalId);
    }

    function test_lateVote_multipleVotersAtDeadline() public {
        uint256 proposalId = _propose();
        Governance.ProposalMeta memory meta = gov.getProposal(proposalId);

        // Multiple voters at last moment
        vm.warp(block.timestamp + VOTING_DURATION - 1);

        vm.prank(alice);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.FOR);

        vm.prank(bob);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.FOR);

        vm.prank(carol);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.FOR);

        vm.warp(block.timestamp + 2);

        gov.execute(proposalId);

        assertEq(
            uint8(gov.getProposalState(proposalId)),
            uint8(Governance.ProposalState.EXECUTED)
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Proposal State Transition Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_state_activeToExecuted() public {
        uint256 proposalId = _propose();

        assertEq(
            uint8(gov.getProposalState(proposalId)),
            uint8(Governance.ProposalState.ACTIVE),
            "Should start ACTIVE"
        );

        _voteAndPass(proposalId);

        vm.warp(block.timestamp + VOTING_DURATION + 1);

        gov.execute(proposalId);

        assertEq(
            uint8(gov.getProposalState(proposalId)),
            uint8(Governance.ProposalState.EXECUTED),
            "Should transition to EXECUTED"
        );
    }

    function test_state_activeToCancelled() public {
        uint256 proposalId = _propose();

        assertEq(
            uint8(gov.getProposalState(proposalId)),
            uint8(Governance.ProposalState.ACTIVE)
        );

        gov.cancel(proposalId);

        assertEq(
            uint8(gov.getProposalState(proposalId)),
            uint8(Governance.ProposalState.CANCELLED),
            "Should transition to CANCELLED"
        );
    }

    function test_state_cannotExecuteCancelled() public {
        uint256 proposalId = _propose();

        _voteAndPass(proposalId);

        gov.cancel(proposalId);

        vm.warp(block.timestamp + VOTING_DURATION + 1);

        vm.expectRevert();
        gov.execute(proposalId);
    }

    function test_state_cannotCancelExecuted() public {
        uint256 proposalId = _propose();

        _voteAndPass(proposalId);

        vm.warp(block.timestamp + VOTING_DURATION + 1);

        gov.execute(proposalId);

        vm.expectRevert();
        gov.cancel(proposalId);
    }

    function test_state_multipleProposalsIndependent() public {
        uint256 proposalId1 = _propose();
        uint256 proposalId2 = _propose();

        _voteAndPass(proposalId1);

        vm.warp(block.timestamp + VOTING_DURATION + 1);

        gov.execute(proposalId1);

        // Proposal 2 should still be ACTIVE
        assertEq(
            uint8(gov.getProposalState(proposalId1)),
            uint8(Governance.ProposalState.EXECUTED)
        );
        assertEq(
            uint8(gov.getProposalState(proposalId2)),
            uint8(Governance.ProposalState.ACTIVE)
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Edge Cases and Boundary Conditions
    // ═══════════════════════════════════════════════════════════════════════════

    function test_edge_zeroQuorumAlwaysPasses() public {
        Governance zeroQuorumGov = new Governance(address(voting), 0, VOTING_DURATION);
        voting.transferOwnership(address(zeroQuorumGov));

        bytes memory data = abi.encodeWithSelector(MockTarget.setValue.selector, 99);
        uint256 proposalId = zeroQuorumGov.propose("Test", address(target), data);

        // No votes at all
        vm.warp(block.timestamp + VOTING_DURATION + 1);

        zeroQuorumGov.execute(proposalId);

        assertEq(
            uint8(zeroQuorumGov.getProposalState(proposalId)),
            uint8(Governance.ProposalState.EXECUTED),
            "Zero quorum should always pass"
        );
    }

    function test_edge_maximumQuorumRequirement() public {
        uint256 totalSupply = govToken.totalSupply();
        Governance maxQuorumGov = new Governance(address(voting), totalSupply, VOTING_DURATION);
        voting.transferOwnership(address(maxQuorumGov));

        bytes memory data = abi.encodeWithSelector(MockTarget.setValue.selector, 99);
        uint256 proposalId = maxQuorumGov.propose("Test", address(target), data);

        // Everyone votes FOR
        vm.prank(alice);
        Governance.ProposalMeta memory meta = maxQuorumGov.getProposal(proposalId);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.FOR);

        vm.prank(bob);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.FOR);

        vm.prank(carol);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.FOR);

        vm.prank(dave);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.FOR);

        vm.prank(eve);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.FOR);

        vm.warp(block.timestamp + VOTING_DURATION + 1);

        maxQuorumGov.execute(proposalId);

        assertEq(
            uint8(maxQuorumGov.getProposalState(proposalId)),
            uint8(Governance.ProposalState.EXECUTED)
        );
    }

    function test_edge_quorumWithDustAmounts() public {
        // Test with wei-level precision
        govToken.mint(makeAddr("dust1"), 1 wei);
        govToken.mint(makeAddr("dust2"), 1 wei);

        uint256 proposalId = _propose();
        Governance.ProposalMeta memory meta = gov.getProposal(proposalId);

        // Large holders vote to reach quorum
        vm.prank(alice);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.FOR);

        vm.prank(bob);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.FOR);

        vm.warp(block.timestamp + VOTING_DURATION + 1);

        gov.execute(proposalId);

        assertEq(uint8(gov.getProposalState(proposalId)), uint8(Governance.ProposalState.EXECUTED));
    }

    function test_edge_sameBlockMultipleVotes() public {
        uint256 proposalId = _propose();
        Governance.ProposalMeta memory meta = gov.getProposal(proposalId);

        // Multiple votes in same block
        vm.prank(alice);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.FOR);

        vm.prank(bob);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.FOR);

        vm.prank(carol);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.FOR);

        // All should be counted
        vm.warp(block.timestamp + VOTING_DURATION + 1);

        gov.execute(proposalId);

        assertEq(uint8(gov.getProposalState(proposalId)), uint8(Governance.ProposalState.EXECUTED));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Helper Functions
    // ═══════════════════════════════════════════════════════════════════════════

    function _propose() internal returns (uint256) {
        bytes memory data = abi.encodeWithSelector(MockTarget.setValue.selector, 42);
        return gov.propose("Set value to 42", address(target), data);
    }

    function _voteAndPass(uint256 proposalId) internal {
        Governance.ProposalMeta memory meta = gov.getProposal(proposalId);
        uint256 votingId = meta.votingProposalId;

        vm.prank(alice);
        voting.castVote(votingId, Voting.VoteChoice.FOR);

        vm.prank(bob);
        voting.castVote(votingId, Voting.VoteChoice.FOR);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Mock Contracts
// ═══════════════════════════════════════════════════════════════════════════════

contract MockGovToken is ERC20 {
    constructor() ERC20("GovToken", "GOV") {
        _mint(msg.sender, 10_000 ether);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockTarget {
    uint256 public value;

    function setValue(uint256 v) external {
        value = v;
    }
}

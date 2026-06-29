// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {VotingWithVoteWeight} from "../contracts/VotingWithVoteWeight.sol";
import {VoteWeight} from "../contracts/VoteWeight.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Mock ERC20 token for testing
contract MockGovernanceToken is ERC20 {
    constructor() ERC20("Governance Token", "GOV") {
        _mint(msg.sender, 1_000_000 * 10**18);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}

/// @title VotingWithVoteWeightTest
/// @notice Integration tests for VotingWithVoteWeight contract
contract VotingWithVoteWeightTest is Test {
    VotingWithVoteWeight public voting;
    VoteWeight public voteWeight;
    MockGovernanceToken public token;

    address public owner;
    address public alice;
    address public bob;
    address public charlie;
    address public dave;

    uint256 constant INITIAL_BALANCE = 1000 * 10**18;
    uint256 constant VOTING_DURATION = 7 days;

    event ProposalCreated(
        uint256 indexed proposalId,
        string description,
        uint256 startTime,
        uint256 endTime,
        uint256 snapshotId
    );
    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        VotingWithVoteWeight.VoteChoice choice,
        uint256 weight
    );

    function setUp() public {
        owner = address(this);
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        charlie = makeAddr("charlie");
        dave = makeAddr("dave");

        // Deploy token
        token = new MockGovernanceToken();

        // Deploy VoteWeight
        voteWeight = new VoteWeight(address(token));

        // Deploy VotingWithVoteWeight
        voting = new VotingWithVoteWeight(address(token), address(voteWeight));

        // Transfer VoteWeight ownership to Voting contract
        voteWeight.transferOwnership(address(voting));

        // Distribute tokens
        token.mint(alice, INITIAL_BALANCE);
        token.mint(bob, INITIAL_BALANCE);
        token.mint(charlie, INITIAL_BALANCE);
        token.mint(dave, INITIAL_BALANCE);

        // Initialize weights
        voteWeight.updateWeight(alice);
        voteWeight.updateWeight(bob);
        voteWeight.updateWeight(charlie);
        voteWeight.updateWeight(dave);
    }

    // ── Proposal Creation Tests ────────────────────────────────────────────────

    function test_CreateProposal_WithSnapshot() public {
        string memory description = "Test Proposal";
        
        vm.expectEmit(true, true, true, true);
        emit ProposalCreated(1, description, block.timestamp, block.timestamp + VOTING_DURATION, 1);

        uint256 proposalId = voting.createProposal(description, VOTING_DURATION);

        assertEq(proposalId, 1);
        assertEq(voteWeight.currentSnapshotId(), 1);

        VotingWithVoteWeight.Proposal memory proposal = voting.getProposal(proposalId);
        assertEq(proposal.id, 1);
        assertEq(proposal.description, description);
        assertEq(proposal.snapshotId, 1);
        assertTrue(proposal.active);
    }

    function test_CreateProposal_SnapshotCapturesWeights() public {
        uint256 proposalId = voting.createProposal("Test", VOTING_DURATION);
        
        VotingWithVoteWeight.Proposal memory proposal = voting.getProposal(proposalId);
        uint256 snapshotId = proposal.snapshotId;

        // Verify snapshot captured correct weights
        assertEq(voteWeight.getWeightAtSnapshot(snapshotId, alice), INITIAL_BALANCE);
        assertEq(voteWeight.getWeightAtSnapshot(snapshotId, bob), INITIAL_BALANCE);
        assertEq(voteWeight.getWeightAtSnapshot(snapshotId, charlie), INITIAL_BALANCE);
        assertEq(voteWeight.getWeightAtSnapshot(snapshotId, dave), INITIAL_BALANCE);
    }

    // ── Voting Tests ───────────────────────────────────────────────────────────

    function test_CastVote_Success() public {
        uint256 proposalId = voting.createProposal("Test", VOTING_DURATION);

        vm.expectEmit(true, true, true, true);
        emit VoteCast(proposalId, alice, VotingWithVoteWeight.VoteChoice.FOR, INITIAL_BALANCE);

        vm.prank(alice);
        voting.castVote(proposalId, VotingWithVoteWeight.VoteChoice.FOR);

        (uint256 forVotes, uint256 againstVotes, uint256 abstainVotes) = voting.getResults(proposalId);
        assertEq(forVotes, INITIAL_BALANCE);
        assertEq(againstVotes, 0);
        assertEq(abstainVotes, 0);
    }

    function test_CastVote_MultipleVoters() public {
        uint256 proposalId = voting.createProposal("Test", VOTING_DURATION);

        vm.prank(alice);
        voting.castVote(proposalId, VotingWithVoteWeight.VoteChoice.FOR);

        vm.prank(bob);
        voting.castVote(proposalId, VotingWithVoteWeight.VoteChoice.FOR);

        vm.prank(charlie);
        voting.castVote(proposalId, VotingWithVoteWeight.VoteChoice.AGAINST);

        (uint256 forVotes, uint256 againstVotes, uint256 abstainVotes) = voting.getResults(proposalId);
        assertEq(forVotes, INITIAL_BALANCE * 2);
        assertEq(againstVotes, INITIAL_BALANCE);
        assertEq(abstainVotes, 0);
    }

    function test_CastVote_UsesSnapshotWeight() public {
        uint256 proposalId = voting.createProposal("Test", VOTING_DURATION);

        // Alice transfers tokens after proposal creation
        vm.prank(alice);
        token.transfer(dave, 500 * 10**18);
        voteWeight.updateWeight(alice);

        // Alice should still vote with original weight from snapshot
        vm.prank(alice);
        voting.castVote(proposalId, VotingWithVoteWeight.VoteChoice.FOR);

        (uint256 forVotes,,) = voting.getResults(proposalId);
        assertEq(forVotes, INITIAL_BALANCE); // Original balance, not reduced
    }

    function test_CastVote_RevertAlreadyVoted() public {
        uint256 proposalId = voting.createProposal("Test", VOTING_DURATION);

        vm.startPrank(alice);
        voting.castVote(proposalId, VotingWithVoteWeight.VoteChoice.FOR);

        vm.expectRevert(VotingWithVoteWeight.AlreadyVoted.selector);
        voting.castVote(proposalId, VotingWithVoteWeight.VoteChoice.AGAINST);
        vm.stopPrank();
    }

    function test_CastVote_RevertZeroVotingPower() public {
        address noTokens = makeAddr("noTokens");
        uint256 proposalId = voting.createProposal("Test", VOTING_DURATION);

        vm.prank(noTokens);
        vm.expectRevert(VotingWithVoteWeight.ZeroVotingPower.selector);
        voting.castVote(proposalId, VotingWithVoteWeight.VoteChoice.FOR);
    }

    function test_CastVote_RevertVotingEnded() public {
        uint256 proposalId = voting.createProposal("Test", VOTING_DURATION);

        // Fast forward past voting period
        vm.warp(block.timestamp + VOTING_DURATION + 1);

        vm.prank(alice);
        vm.expectRevert(VotingWithVoteWeight.VotingEnded.selector);
        voting.castVote(proposalId, VotingWithVoteWeight.VoteChoice.FOR);
    }

    // ── Delegation Tests ───────────────────────────────────────────────────────

    function test_Delegate_BeforeProposal() public {
        // Alice delegates to Bob before proposal
        vm.prank(alice);
        voting.delegate(bob);

        // Create proposal (snapshot should capture delegation)
        uint256 proposalId = voting.createProposal("Test", VOTING_DURATION);

        // Bob should have combined weight in snapshot
        uint256 bobWeight = voting.getVotingPowerAtProposal(proposalId, bob);
        assertEq(bobWeight, INITIAL_BALANCE * 2);

        // Alice should have zero weight
        uint256 aliceWeight = voting.getVotingPowerAtProposal(proposalId, alice);
        assertEq(aliceWeight, 0);
    }

    function test_Delegate_AfterProposal() public {
        // Create proposal first
        uint256 proposalId = voting.createProposal("Test", VOTING_DURATION);

        // Alice delegates after proposal creation
        vm.prank(alice);
        voting.delegate(bob);

        // Snapshot should have original weights (delegation doesn't affect it)
        uint256 aliceWeight = voting.getVotingPowerAtProposal(proposalId, alice);
        uint256 bobWeight = voting.getVotingPowerAtProposal(proposalId, bob);
        
        assertEq(aliceWeight, INITIAL_BALANCE);
        assertEq(bobWeight, INITIAL_BALANCE);
    }

    function test_Delegate_VotingWithDelegatedWeight() public {
        // Alice and Charlie delegate to Bob
        vm.prank(alice);
        voting.delegate(bob);

        vm.prank(charlie);
        voting.delegate(bob);

        // Create proposal
        uint256 proposalId = voting.createProposal("Test", VOTING_DURATION);

        // Bob votes with combined weight
        vm.prank(bob);
        voting.castVote(proposalId, VotingWithVoteWeight.VoteChoice.FOR);

        (uint256 forVotes,,) = voting.getResults(proposalId);
        assertEq(forVotes, INITIAL_BALANCE * 3); // Bob + Alice + Charlie
    }

    function test_Undelegate() public {
        // Alice delegates to Bob
        vm.prank(alice);
        voting.delegate(bob);

        assertTrue(voting.hasDelegated(alice));
        assertEq(voting.getDelegatee(alice), bob);

        // Alice undelegates
        vm.prank(alice);
        voting.undelegate();

        assertFalse(voting.hasDelegated(alice));
        assertEq(voting.getDelegatee(alice), address(0));
    }

    function test_Delegate_RevertSelfDelegation() public {
        vm.prank(alice);
        vm.expectRevert(VotingWithVoteWeight.SelfDelegation.selector);
        voting.delegate(alice);
    }

    // ── Query Tests ────────────────────────────────────────────────────────────

    function test_GetVotingPower() public {
        uint256 power = voting.getVotingPower(alice);
        assertEq(power, INITIAL_BALANCE);
    }

    function test_GetVotingPowerAtProposal() public {
        uint256 proposalId = voting.createProposal("Test", VOTING_DURATION);

        uint256 power = voting.getVotingPowerAtProposal(proposalId, alice);
        assertEq(power, INITIAL_BALANCE);
    }

    function test_GetWeightBreakdown() public {
        vm.prank(alice);
        voting.delegate(bob);

        (uint256 base, uint256 received, uint256 given, uint256 total) = 
            voting.getWeightBreakdown(bob);

        assertEq(base, INITIAL_BALANCE);
        assertEq(received, INITIAL_BALANCE);
        assertEq(given, 0);
        assertEq(total, INITIAL_BALANCE * 2);
    }

    function test_GetDelegationInfo() public {
        vm.prank(alice);
        voting.delegate(bob);

        VoteWeight.DelegationInfo memory info = voting.getDelegationInfo(alice);
        assertEq(info.delegatee, bob);
        assertEq(info.amount, INITIAL_BALANCE);
        assertTrue(info.active);
    }

    function test_GetDelegators() public {
        vm.prank(alice);
        voting.delegate(bob);

        vm.prank(charlie);
        voting.delegate(bob);

        address[] memory delegators = voting.getDelegators(bob);
        assertEq(delegators.length, 2);
    }

    function test_GetWeightChangeHistory() public {
        voteWeight.updateWeight(alice);

        VoteWeight.WeightChange[] memory history = voting.getWeightChangeHistory(alice);
        assertGt(history.length, 0);
    }

    // ── Integration Tests ──────────────────────────────────────────────────────

    function test_CompleteVotingFlow() public {
        // Setup: Alice and Bob delegate to Charlie
        vm.prank(alice);
        voting.delegate(charlie);

        vm.prank(bob);
        voting.delegate(charlie);

        // Create proposal
        uint256 proposalId = voting.createProposal("Increase treasury allocation", VOTING_DURATION);

        // Charlie votes with delegated power
        vm.prank(charlie);
        voting.castVote(proposalId, VotingWithVoteWeight.VoteChoice.FOR);

        // Dave votes against
        vm.prank(dave);
        voting.castVote(proposalId, VotingWithVoteWeight.VoteChoice.AGAINST);

        // Check results
        (uint256 forVotes, uint256 againstVotes, uint256 abstainVotes) = voting.getResults(proposalId);
        assertEq(forVotes, INITIAL_BALANCE * 3); // Charlie + Alice + Bob
        assertEq(againstVotes, INITIAL_BALANCE); // Dave
        assertEq(abstainVotes, 0);

        // Close proposal
        vm.warp(block.timestamp + VOTING_DURATION + 1);
        voting.closeProposal(proposalId);

        VotingWithVoteWeight.Proposal memory proposal = voting.getProposal(proposalId);
        assertFalse(proposal.active);
    }

    function test_MultipleProposals_IndependentSnapshots() public {
        // Create first proposal
        uint256 proposal1 = voting.createProposal("Proposal 1", VOTING_DURATION);

        // Alice transfers tokens
        vm.prank(alice);
        token.transfer(dave, 500 * 10**18);
        voteWeight.updateWeight(alice);
        voteWeight.updateWeight(dave);

        // Create second proposal
        uint256 proposal2 = voting.createProposal("Proposal 2", VOTING_DURATION);

        // Check weights at different proposals
        uint256 aliceWeight1 = voting.getVotingPowerAtProposal(proposal1, alice);
        uint256 aliceWeight2 = voting.getVotingPowerAtProposal(proposal2, alice);

        assertEq(aliceWeight1, INITIAL_BALANCE);
        assertEq(aliceWeight2, 500 * 10**18);
    }

    function test_DelegationChain() public {
        // Alice delegates to Bob
        vm.prank(alice);
        voting.delegate(bob);

        // Bob delegates to Charlie
        vm.prank(bob);
        voting.delegate(charlie);

        // Create proposal
        uint256 proposalId = voting.createProposal("Test", VOTING_DURATION);

        // Charlie should have Alice's + Bob's + own weight
        uint256 charlieWeight = voting.getVotingPowerAtProposal(proposalId, charlie);
        assertEq(charlieWeight, INITIAL_BALANCE * 3);
    }

    function test_VoteBuying_Prevention() public {
        // Create proposal
        uint256 proposalId = voting.createProposal("Test", VOTING_DURATION);

        // Dave tries to buy voting power by receiving tokens after proposal
        vm.prank(alice);
        token.transfer(dave, INITIAL_BALANCE);
        voteWeight.updateWeight(dave);

        // Dave's voting power for this proposal should still be original
        uint256 daveWeight = voting.getVotingPowerAtProposal(proposalId, dave);
        assertEq(daveWeight, INITIAL_BALANCE); // Not doubled
    }

    function test_BatchUpdateWeights() public {
        address[] memory accounts = new address[](3);
        accounts[0] = alice;
        accounts[1] = bob;
        accounts[2] = charlie;

        // Transfer tokens
        vm.prank(alice);
        token.transfer(bob, 100 * 10**18);

        // Batch update
        voting.batchUpdateWeights(accounts);

        // Verify updates
        assertEq(voting.getVotingPower(alice), 900 * 10**18);
        assertEq(voting.getVotingPower(bob), 1100 * 10**18);
    }

    // ── Admin Tests ────────────────────────────────────────────────────────────

    function test_SetVoteWeight_OnlyOwner() public {
        VoteWeight newVoteWeight = new VoteWeight(address(token));

        voting.setVoteWeight(address(newVoteWeight));
        assertEq(address(voting.voteWeight()), address(newVoteWeight));
    }

    function test_SetVoteWeight_RevertNonOwner() public {
        VoteWeight newVoteWeight = new VoteWeight(address(token));

        vm.prank(alice);
        vm.expectRevert();
        voting.setVoteWeight(address(newVoteWeight));
    }

    function test_CloseProposal_OnlyOwner() public {
        uint256 proposalId = voting.createProposal("Test", VOTING_DURATION);

        vm.warp(block.timestamp + VOTING_DURATION + 1);
        voting.closeProposal(proposalId);

        VotingWithVoteWeight.Proposal memory proposal = voting.getProposal(proposalId);
        assertFalse(proposal.active);
    }

    // ── Edge Cases ─────────────────────────────────────────────────────────────

    function test_VoteWithZeroDelegatedWeight() public {
        address noTokens = makeAddr("noTokens");
        
        // NoTokens delegates to Bob (but has no tokens)
        voteWeight.updateWeight(noTokens);
        vm.prank(noTokens);
        voting.delegate(bob);

        uint256 proposalId = voting.createProposal("Test", VOTING_DURATION);

        // Bob's weight should be unchanged
        uint256 bobWeight = voting.getVotingPowerAtProposal(proposalId, bob);
        assertEq(bobWeight, INITIAL_BALANCE);
    }

    function test_MultipleDelegationChanges() public {
        // Alice delegates to Bob
        vm.prank(alice);
        voting.delegate(bob);

        uint256 proposal1 = voting.createProposal("Proposal 1", VOTING_DURATION);

        // Alice changes delegation to Charlie
        vm.prank(alice);
        voting.delegate(charlie);

        uint256 proposal2 = voting.createProposal("Proposal 2", VOTING_DURATION);

        // Check weights at different proposals
        assertEq(voting.getVotingPowerAtProposal(proposal1, bob), INITIAL_BALANCE * 2);
        assertEq(voting.getVotingPowerAtProposal(proposal1, charlie), INITIAL_BALANCE);

        assertEq(voting.getVotingPowerAtProposal(proposal2, bob), INITIAL_BALANCE);
        assertEq(voting.getVotingPowerAtProposal(proposal2, charlie), INITIAL_BALANCE * 2);
    }
}

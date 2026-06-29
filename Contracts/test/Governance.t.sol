// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/Governance.sol";
import "../contracts/Voting.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockGovToken is ERC20 {
    constructor() ERC20("GovToken", "GOV") {
        _mint(msg.sender, 1_000_000 ether);
    }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

/// @dev Simple target contract for execution tests
contract MockTarget {
    uint256 public value;
    function setValue(uint256 v) external { value = v; }
}

contract GovernanceTest is Test {
    Governance     internal gov;
    Voting         internal voting;
    MockGovToken   internal govToken;
    MockTarget     internal target;

    address internal alice   = address(0xA11CE);
    address internal bob     = address(0xB0B);
    address internal carol   = address(0xCA401);

    uint256 constant QUORUM   = 100 ether;
    uint256 constant DURATION = 7 days;

    function setUp() public {
        govToken = new MockGovToken();
        voting   = new Voting(address(govToken));
        gov      = new Governance(address(voting), QUORUM, DURATION);
        target   = new MockTarget();

        // Transfer Voting ownership to Governance so it can create/close proposals
        voting.transferOwnership(address(gov));

        govToken.mint(alice, 1_000 ether);
        govToken.mint(bob,   500 ether);
        govToken.mint(carol, 200 ether);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

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

    // ── Proposal submission ────────────────────────────────────────────────────

    function test_propose_storesMetadata() public {
        uint256 id = _propose();
        Governance.ProposalMeta memory meta = gov.getProposal(id);
        assertEq(meta.proposer, address(this));
        assertEq(meta.target, address(target));
        assertEq(uint8(meta.state), uint8(Governance.ProposalState.ACTIVE));
    }

    function test_propose_incrementsCount() public {
        _propose();
        _propose();
        assertEq(gov.getProposalCount(), 2);
    }

    function test_propose_addsToHistory() public {
        _propose();
        _propose();
        uint256[] memory history = gov.getProposalHistory();
        assertEq(history.length, 2);
    }

    function test_propose_revertsZeroTarget() public {
        vm.expectRevert(Governance.ZeroAddress.selector);
        gov.propose("Bad", address(0), "");
    }

    // ── Execution ──────────────────────────────────────────────────────────────

    function test_execute_runsCallAndUpdatesState() public {
        uint256 id = _propose();
        _voteAndPass(id);

        vm.warp(block.timestamp + DURATION + 1);
        gov.execute(id);

        assertEq(target.value(), 42);
        assertEq(uint8(gov.getProposalState(id)), uint8(Governance.ProposalState.EXECUTED));
    }

    function test_execute_revertsIfVotingActive() public {
        uint256 id = _propose();
        _voteAndPass(id);
        vm.expectRevert(Governance.VotingStillActive.selector);
        gov.execute(id);
    }

    function test_execute_revertsIfQuorumNotReached() public {
        uint256 id = _propose();
        // carol votes FOR but only 200 ether < QUORUM (100 ether) — wait, 200 > 100
        // Use a fresh proposal with no votes to fail quorum
        bytes memory data = abi.encodeWithSelector(MockTarget.setValue.selector, 1);
        uint256 id2 = gov.propose("No votes", address(target), data);

        vm.warp(block.timestamp + DURATION + 1);
        vm.expectRevert(Governance.QuorumNotReached.selector);
        gov.execute(id2);
    }

    function test_execute_revertsIfDefeated() public {
        uint256 id = _propose();
        Governance.ProposalMeta memory meta = gov.getProposal(id);

        // Bob votes AGAINST with more power than alice FOR
        vm.prank(alice);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.AGAINST);
        vm.prank(bob);
        voting.castVote(meta.votingProposalId, Voting.VoteChoice.FOR);

        // alice has 1000, bob has 500 — alice AGAINST wins
        vm.warp(block.timestamp + DURATION + 1);
        vm.expectRevert(Governance.ProposalNotPassed.selector);
        gov.execute(id);
    }

    function test_execute_revertsDoubleExecution() public {
        uint256 id = _propose();
        _voteAndPass(id);
        vm.warp(block.timestamp + DURATION + 1);
        gov.execute(id);

        vm.expectRevert(Governance.ProposalAlreadyExecuted.selector);
        gov.execute(id);
    }

    // ── Cancellation ──────────────────────────────────────────────────────────

    function test_cancel_byProposer() public {
        uint256 id = _propose();
        gov.cancel(id);
        assertEq(uint8(gov.getProposalState(id)), uint8(Governance.ProposalState.CANCELLED));
    }

    function test_cancel_byOwner() public {
        vm.prank(alice);
        bytes memory data = abi.encodeWithSelector(MockTarget.setValue.selector, 99);
        uint256 id = gov.propose("Alice proposal", address(target), data);

        gov.cancel(id); // owner cancels
        assertEq(uint8(gov.getProposalState(id)), uint8(Governance.ProposalState.CANCELLED));
    }

    function test_cancel_revertsIfNotProposerOrOwner() public {
        uint256 id = _propose();
        vm.prank(alice);
        vm.expectRevert(Governance.NotProposer.selector);
        gov.cancel(id);
    }

    // ── Admin ──────────────────────────────────────────────────────────────────

    function test_setQuorum_updatesValue() public {
        gov.setQuorum(500 ether);
        assertEq(gov.quorum(), 500 ether);
    }

    function test_setVotingDuration_updatesValue() public {
        gov.setVotingDuration(14 days);
        assertEq(gov.votingDuration(), 14 days);
    }

    function test_setVotingDuration_revertsZero() public {
        vm.expectRevert(Governance.InvalidDuration.selector);
        gov.setVotingDuration(0);
    }

    // ── History & queries ──────────────────────────────────────────────────────

    function test_getProposalHistory_tracksAll() public {
        _propose();
        _propose();
        _propose();
        assertEq(gov.getProposalHistory().length, 3);
    }

    function test_getProposalState_returnsActive() public {
        uint256 id = _propose();
        assertEq(uint8(gov.getProposalState(id)), uint8(Governance.ProposalState.ACTIVE));
    }
}

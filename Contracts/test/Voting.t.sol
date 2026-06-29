// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/Voting.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// ─── Mock governance token ─────────────────────────────────────────────────────

contract MockGovToken is ERC20 {
    constructor() ERC20("GovToken", "GOV") {
        _mint(msg.sender, 1_000_000 ether);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

// ─── VotingTest ────────────────────────────────────────────────────────────────

contract VotingTest is Test {
    Voting       internal voting;
    MockGovToken internal govToken;

    address internal alice = address(0xA11CE);
    address internal bob   = address(0xB0B);
    address internal carol = address(0xCA401);
    address internal dave  = address(0xDA4E);

    uint256 constant DURATION = 7 days;

    // ── Events (mirrored for expectEmit) ──────────────────────────────────────
    event ProposalCreated(uint256 indexed proposalId, string description, uint256 startTime, uint256 endTime);
    event VoteCast(uint256 indexed proposalId, address indexed voter, Voting.VoteChoice choice, uint256 weight);
    event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);
    event ProposalClosed(uint256 indexed proposalId);

    // ── Setup ─────────────────────────────────────────────────────────────────

    function setUp() public {
        govToken = new MockGovToken();
        voting   = new Voting(address(govToken));

        govToken.mint(alice, 1_000 ether);
        govToken.mint(bob,   500 ether);
        govToken.mint(carol, 200 ether);
        govToken.mint(dave,  100 ether);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    function _createProposal() internal returns (uint256) {
        return voting.createProposal("Test proposal", DURATION);
    }

    function _createProposal(string memory desc, uint256 dur) internal returns (uint256) {
        return voting.createProposal(desc, dur);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Constructor
    // ══════════════════════════════════════════════════════════════════════════

    function test_constructor_setsGovernanceToken() public view {
        assertEq(address(voting.governanceToken()), address(govToken));
    }

    function test_constructor_revertsOnZeroAddress() public {
        vm.expectRevert(Voting.ZeroAddress.selector);
        new Voting(address(0));
    }

    function test_constructor_setsOwner() public view {
        assertEq(voting.owner(), address(this));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Proposal creation
    // ══════════════════════════════════════════════════════════════════════════

    function test_createProposal_storesData() public {
        uint256 id = _createProposal();
        Voting.Proposal memory p = voting.getProposal(id);

        assertEq(p.id, id);
        assertEq(p.description, "Test proposal");
        assertTrue(p.active);
        assertEq(p.startTime, block.timestamp);
        assertEq(p.endTime, block.timestamp + DURATION);
        assertEq(p.forVotes, 0);
        assertEq(p.againstVotes, 0);
        assertEq(p.abstainVotes, 0);
    }

    function test_createProposal_incrementsCount() public {
        _createProposal();
        _createProposal();
        assertEq(voting.proposalCount(), 2);
    }

    function test_createProposal_emitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit ProposalCreated(1, "Test proposal", block.timestamp, block.timestamp + DURATION);
        _createProposal();
    }

    function test_createProposal_revertsIfNotOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        voting.createProposal("Unauthorized", DURATION);
    }

    function test_createProposal_multipleProposalsIndependent() public {
        uint256 id1 = _createProposal("Proposal A", DURATION);
        uint256 id2 = _createProposal("Proposal B", DURATION * 2);

        Voting.Proposal memory p1 = voting.getProposal(id1);
        Voting.Proposal memory p2 = voting.getProposal(id2);

        assertEq(p1.description, "Proposal A");
        assertEq(p2.description, "Proposal B");
        assertEq(p2.endTime - p2.startTime, DURATION * 2);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Vote casting — acceptance criteria: "Votes are cast"
    // ══════════════════════════════════════════════════════════════════════════

    function test_castVote_for() public {
        uint256 id = _createProposal();
        vm.prank(alice);
        voting.castVote(id, Voting.VoteChoice.FOR);

        (uint256 forVotes,,) = voting.getResults(id);
        assertEq(forVotes, 1_000 ether);
    }

    function test_castVote_against() public {
        uint256 id = _createProposal();
        vm.prank(bob);
        voting.castVote(id, Voting.VoteChoice.AGAINST);

        (, uint256 againstVotes,) = voting.getResults(id);
        assertEq(againstVotes, 500 ether);
    }

    function test_castVote_abstain() public {
        uint256 id = _createProposal();
        vm.prank(carol);
        voting.castVote(id, Voting.VoteChoice.ABSTAIN);

        (,, uint256 abstainVotes) = voting.getResults(id);
        assertEq(abstainVotes, 200 ether);
    }

    function test_castVote_emitsEvent() public {
        uint256 id = _createProposal();
        vm.expectEmit(true, true, false, true);
        emit VoteCast(id, alice, Voting.VoteChoice.FOR, 1_000 ether);
        vm.prank(alice);
        voting.castVote(id, Voting.VoteChoice.FOR);
    }

    function test_castVote_multipleVoters() public {
        uint256 id = _createProposal();

        vm.prank(alice);
        voting.castVote(id, Voting.VoteChoice.FOR);
        vm.prank(bob);
        voting.castVote(id, Voting.VoteChoice.AGAINST);
        vm.prank(carol);
        voting.castVote(id, Voting.VoteChoice.ABSTAIN);

        (uint256 f, uint256 a, uint256 ab) = voting.getResults(id);
        assertEq(f,  1_000 ether);
        assertEq(a,  500 ether);
        assertEq(ab, 200 ether);
    }

    function test_castVote_revertsDoubleVote() public {
        uint256 id = _createProposal();
        vm.startPrank(alice);
        voting.castVote(id, Voting.VoteChoice.FOR);
        vm.expectRevert(Voting.AlreadyVoted.selector);
        voting.castVote(id, Voting.VoteChoice.AGAINST);
        vm.stopPrank();
    }

    function test_castVote_revertsAfterDeadline() public {
        uint256 id = _createProposal();
        vm.warp(block.timestamp + DURATION + 1);
        vm.prank(alice);
        vm.expectRevert(Voting.VotingEnded.selector);
        voting.castVote(id, Voting.VoteChoice.FOR);
    }

    function test_castVote_revertsOnInactiveProposal() public {
        uint256 id = _createProposal();
        vm.warp(block.timestamp + DURATION + 1);
        voting.closeProposal(id);

        vm.prank(alice);
        vm.expectRevert(Voting.ProposalNotActive.selector);
        voting.castVote(id, Voting.VoteChoice.FOR);
    }

    function test_castVote_revertsZeroVotingPower() public {
        uint256 id = _createProposal();
        address nobody = address(0xDEAD);
        vm.prank(nobody);
        vm.expectRevert(Voting.ZeroVotingPower.selector);
        voting.castVote(id, Voting.VoteChoice.FOR);
    }

    function test_castVote_atExactDeadline_succeeds() public {
        uint256 id = _createProposal();
        // warp to exactly endTime — still within window
        Voting.Proposal memory p = voting.getProposal(id);
        vm.warp(p.endTime);
        vm.prank(alice);
        voting.castVote(id, Voting.VoteChoice.FOR);
        (uint256 f,,) = voting.getResults(id);
        assertEq(f, 1_000 ether);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Voting power — acceptance criteria: "Power is calculated"
    // ══════════════════════════════════════════════════════════════════════════

    function test_getVotingPower_ownBalance() public view {
        assertEq(voting.getVotingPower(alice), 1_000 ether);
        assertEq(voting.getVotingPower(bob),   500 ether);
        assertEq(voting.getVotingPower(carol), 200 ether);
    }

    function test_getVotingPower_zeroForNoTokens() public view {
        assertEq(voting.getVotingPower(address(0xDEAD)), 0);
    }

    function test_getVotingPower_reflectsTokenBalance() public {
        govToken.mint(alice, 500 ether); // alice now has 1500
        assertEq(voting.getVotingPower(alice), 1_500 ether);
    }

    function test_getVotingPower_delegatorLosesPower() public {
        vm.prank(bob);
        voting.delegate(alice);
        // Bob delegated away — his own power is 0
        assertEq(voting.getVotingPower(bob), 0);
    }

    function test_getVotingPower_delegateeGainsPower() public {
        vm.prank(bob);
        voting.delegate(alice);
        // Alice: own 1000 + delegated 500
        assertEq(voting.getVotingPower(alice), 1_500 ether);
    }

    function test_getVotingPower_multipleDelegatorsToOne() public {
        vm.prank(bob);
        voting.delegate(alice);
        vm.prank(carol);
        voting.delegate(alice);
        // Alice: 1000 + 500 + 200
        assertEq(voting.getVotingPower(alice), 1_700 ether);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Vote results tracking — acceptance criteria: "Results are tracked"
    // ══════════════════════════════════════════════════════════════════════════

    function test_getResults_initiallyZero() public {
        uint256 id = _createProposal();
        (uint256 f, uint256 a, uint256 ab) = voting.getResults(id);
        assertEq(f,  0);
        assertEq(a,  0);
        assertEq(ab, 0);
    }

    function test_getResults_accumulatesCorrectly() public {
        uint256 id = _createProposal();

        vm.prank(alice);
        voting.castVote(id, Voting.VoteChoice.FOR);
        vm.prank(bob);
        voting.castVote(id, Voting.VoteChoice.FOR);
        vm.prank(carol);
        voting.castVote(id, Voting.VoteChoice.AGAINST);
        vm.prank(dave);
        voting.castVote(id, Voting.VoteChoice.ABSTAIN);

        (uint256 f, uint256 a, uint256 ab) = voting.getResults(id);
        assertEq(f,  1_500 ether); // alice + bob
        assertEq(a,  200 ether);   // carol
        assertEq(ab, 100 ether);   // dave
    }

    function test_getResults_independentAcrossProposals() public {
        uint256 id1 = _createProposal("P1", DURATION);
        uint256 id2 = _createProposal("P2", DURATION);

        vm.prank(alice);
        voting.castVote(id1, Voting.VoteChoice.FOR);
        vm.prank(alice);
        voting.castVote(id2, Voting.VoteChoice.AGAINST);

        (uint256 f1,,)  = voting.getResults(id1);
        (, uint256 a2,) = voting.getResults(id2);

        assertEq(f1, 1_000 ether);
        assertEq(a2, 1_000 ether);
    }

    function test_getVote_returnsRecord() public {
        uint256 id = _createProposal();
        vm.prank(alice);
        voting.castVote(id, Voting.VoteChoice.FOR);

        Voting.VoteRecord memory r = voting.getVote(id, alice);
        assertEq(uint8(r.choice), uint8(Voting.VoteChoice.FOR));
        assertEq(r.weight, 1_000 ether);
    }

    function test_getVote_noneBeforeVoting() public {
        uint256 id = _createProposal();
        Voting.VoteRecord memory r = voting.getVote(id, alice);
        assertEq(uint8(r.choice), uint8(Voting.VoteChoice.NONE));
        assertEq(r.weight, 0);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Delegation — acceptance criteria: "Delegation works"
    // ══════════════════════════════════════════════════════════════════════════

    function test_delegate_transfersPower() public {
        vm.prank(bob);
        voting.delegate(alice);

        assertEq(voting.getVotingPower(alice), 1_500 ether);
        assertEq(voting.getVotingPower(bob),   0);
    }

    function test_delegate_voteUsesFullDelegatedPower() public {
        vm.prank(bob);
        voting.delegate(alice);

        uint256 id = _createProposal();
        vm.prank(alice);
        voting.castVote(id, Voting.VoteChoice.FOR);

        (uint256 forVotes,,) = voting.getResults(id);
        assertEq(forVotes, 1_500 ether);
    }

    function test_delegate_emitsEvent() public {
        vm.expectEmit(true, true, true, false);
        emit DelegateChanged(bob, address(0), alice);
        vm.prank(bob);
        voting.delegate(alice);
    }

    function test_delegate_revertsOnSelfDelegation() public {
        vm.prank(alice);
        vm.expectRevert(Voting.SelfDelegation.selector);
        voting.delegate(alice);
    }

    function test_delegate_revertsOnLoop() public {
        vm.prank(alice);
        voting.delegate(bob);

        vm.prank(bob);
        vm.expectRevert(Voting.DelegationLoop.selector);
        voting.delegate(alice);
    }

    function test_delegate_removeDelegation() public {
        vm.prank(bob);
        voting.delegate(alice);
        assertEq(voting.getVotingPower(alice), 1_500 ether);

        vm.prank(bob);
        voting.delegate(address(0));

        assertEq(voting.getVotingPower(alice), 1_000 ether);
        assertEq(voting.getVotingPower(bob),   500 ether);
    }

    function test_delegate_changeDelegatee() public {
        // Bob delegates to Alice first
        vm.prank(bob);
        voting.delegate(alice);
        assertEq(voting.getVotingPower(alice), 1_500 ether);
        assertEq(voting.getVotingPower(carol), 200 ether);

        // Bob re-delegates to Carol
        vm.prank(bob);
        voting.delegate(carol);

        assertEq(voting.getVotingPower(alice), 1_000 ether); // back to own only
        assertEq(voting.getVotingPower(carol), 700 ether);   // 200 + 500
        assertEq(voting.getVotingPower(bob),   0);
    }

    function test_delegate_storesDelegate() public {
        vm.prank(bob);
        voting.delegate(alice);
        assertEq(voting.delegates(bob), alice);
    }

    function test_delegate_storesDelegatedPower() public {
        vm.prank(bob);
        voting.delegate(alice);
        assertEq(voting.delegatedPower(alice), 500 ether);
    }

    function test_delegate_toZeroAddress_emitsEvent() public {
        vm.prank(bob);
        voting.delegate(alice);

        vm.expectEmit(true, true, true, false);
        emit DelegateChanged(bob, alice, address(0));
        vm.prank(bob);
        voting.delegate(address(0));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Queries — acceptance criteria: "Queries work"
    // ══════════════════════════════════════════════════════════════════════════

    function test_getProposal_returnsFullStruct() public {
        uint256 id = _createProposal("Full query test", DURATION);
        Voting.Proposal memory p = voting.getProposal(id);

        assertEq(p.id, id);
        assertEq(p.description, "Full query test");
        assertTrue(p.active);
        assertEq(p.endTime - p.startTime, DURATION);
    }

    function test_getProposal_nonExistentReturnsDefaults() public view {
        Voting.Proposal memory p = voting.getProposal(999);
        assertEq(p.id, 0);
        assertFalse(p.active);
    }

    function test_proposalCount_startsAtZero() public view {
        assertEq(voting.proposalCount(), 0);
    }

    function test_proposalCount_incrementsPerProposal() public {
        _createProposal();
        assertEq(voting.proposalCount(), 1);
        _createProposal();
        assertEq(voting.proposalCount(), 2);
        _createProposal();
        assertEq(voting.proposalCount(), 3);
    }

    function test_delegates_defaultsToZeroAddress() public view {
        assertEq(voting.delegates(alice), address(0));
    }

    function test_delegatedPower_defaultsToZero() public view {
        assertEq(voting.delegatedPower(alice), 0);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Close proposal
    // ══════════════════════════════════════════════════════════════════════════

    function test_closeProposal_marksInactive() public {
        uint256 id = _createProposal();
        vm.warp(block.timestamp + DURATION + 1);
        voting.closeProposal(id);

        Voting.Proposal memory p = voting.getProposal(id);
        assertFalse(p.active);
    }

    function test_closeProposal_emitsEvent() public {
        uint256 id = _createProposal();
        vm.warp(block.timestamp + DURATION + 1);

        vm.expectEmit(true, false, false, false);
        emit ProposalClosed(id);
        voting.closeProposal(id);
    }

    function test_closeProposal_revertsBeforeEnd() public {
        uint256 id = _createProposal();
        vm.expectRevert(Voting.VotingNotEnded.selector);
        voting.closeProposal(id);
    }

    function test_closeProposal_revertsIfAlreadyClosed() public {
        uint256 id = _createProposal();
        vm.warp(block.timestamp + DURATION + 1);
        voting.closeProposal(id);

        vm.expectRevert(Voting.InvalidProposal.selector);
        voting.closeProposal(id);
    }

    function test_closeProposal_revertsIfNotOwner() public {
        uint256 id = _createProposal();
        vm.warp(block.timestamp + DURATION + 1);

        vm.prank(alice);
        vm.expectRevert();
        voting.closeProposal(id);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Fuzz tests
    // ══════════════════════════════════════════════════════════════════════════

    function testFuzz_votingPowerMatchesBalance(uint128 amount) public {
        vm.assume(amount > 0);
        address voter = address(0x1234);
        govToken.mint(voter, uint256(amount));
        assertEq(voting.getVotingPower(voter), uint256(amount));
    }

    function testFuzz_castVote_weightMatchesBalance(uint128 amount) public {
        vm.assume(amount > 0);
        address voter = makeAddr("fuzzVoter");
        govToken.mint(voter, uint256(amount));

        uint256 id = _createProposal();
        vm.prank(voter);
        voting.castVote(id, Voting.VoteChoice.FOR);

        Voting.VoteRecord memory r = voting.getVote(id, voter);
        assertEq(r.weight, uint256(amount));
    }

    function testFuzz_delegatedPowerAccumulates(uint128 a, uint128 b) public {
        vm.assume(a > 0 && b > 0);
        address delegator1 = makeAddr("d1");
        address delegator2 = makeAddr("d2");
        address delegatee  = makeAddr("delegatee");

        govToken.mint(delegator1, uint256(a));
        govToken.mint(delegator2, uint256(b));

        vm.prank(delegator1);
        voting.delegate(delegatee);
        vm.prank(delegator2);
        voting.delegate(delegatee);

        assertEq(voting.getVotingPower(delegatee), uint256(a) + uint256(b));
    }

    function testFuzz_resultsNeverExceedTotalSupply(uint128 amount) public {
        vm.assume(amount > 0 && amount <= 1_000_000 ether);
        address voter = makeAddr("voter");
        govToken.mint(voter, uint256(amount));

        uint256 id = _createProposal();
        vm.prank(voter);
        voting.castVote(id, Voting.VoteChoice.FOR);

        (uint256 f, uint256 a, uint256 ab) = voting.getResults(id);
        assertLe(f + a + ab, govToken.totalSupply());
    }
}

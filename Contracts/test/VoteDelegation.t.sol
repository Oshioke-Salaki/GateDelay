// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/VoteDelegation.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// ─── Mock governance token ─────────────────────────────────────────────────────

contract MockGovToken is ERC20 {
    constructor() ERC20("GovToken", "GOV") {
        _mint(msg.sender, 10_000_000 ether);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}

// ─── VoteDelegationTest ────────────────────────────────────────────────────────

contract VoteDelegationTest is Test {
    VoteDelegation internal voteDelegation;
    MockGovToken   internal govToken;

    address internal alice = address(0xA11CE);
    address internal bob   = address(0xB0B);
    address internal carol = address(0xCA401);
    address internal dave  = address(0xDA4E);
    address internal eve   = address(0xE4E);

    // ── Events (mirrored for expectEmit) ──────────────────────────────────────
    event DelegationCreated(
        address indexed delegator,
        address indexed delegatee,
        uint256 timestamp
    );
    
    event DelegationRemoved(
        address indexed delegator,
        address indexed previousDelegatee,
        uint256 timestamp
    );
    
    event DelegationChanged(
        address indexed delegator,
        address indexed fromDelegatee,
        address indexed toDelegatee,
        uint256 timestamp
    );
    
    event VotingPowerUpdated(
        address indexed account,
        uint256 previousPower,
        uint256 newPower
    );

    // ── Setup ─────────────────────────────────────────────────────────────────

    function setUp() public {
        govToken = new MockGovToken();
        voteDelegation = new VoteDelegation(address(govToken));

        // Distribute tokens
        govToken.mint(alice, 1_000 ether);
        govToken.mint(bob,   500 ether);
        govToken.mint(carol, 300 ether);
        govToken.mint(dave,  200 ether);
        govToken.mint(eve,   100 ether);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Constructor Tests
    // ══════════════════════════════════════════════════════════════════════════

    function test_constructor_setsGovernanceToken() public view {
        assertEq(address(voteDelegation.governanceToken()), address(govToken));
    }

    function test_constructor_revertsOnZeroAddress() public {
        vm.expectRevert(VoteDelegation.ZeroAddress.selector);
        new VoteDelegation(address(0));
    }

    function test_constructor_setsOwner() public view {
        assertEq(voteDelegation.owner(), address(this));
    }

    function test_constructor_initializesState() public view {
        assertEq(voteDelegation.totalActiveDelegations(), 0);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Delegation Handling — Acceptance Criteria: "Delegations are handled"
    // ══════════════════════════════════════════════════════════════════════════

    function test_delegate_createsDelegation() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        VoteDelegation.Delegation memory delegation = voteDelegation.getCurrentDelegation(alice);
        assertEq(delegation.delegatee, bob);
        assertTrue(delegation.active);
        assertEq(delegation.timestamp, block.timestamp);
    }

    function test_delegate_transfersPower() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        assertEq(voteDelegation.getVotingPower(alice), 0);
        assertEq(voteDelegation.getVotingPower(bob), 1_500 ether); // 500 + 1000
    }

    function test_delegate_emitsCreatedEvent() public {
        vm.expectEmit(true, true, false, true);
        emit DelegationCreated(alice, bob, block.timestamp);
        
        vm.prank(alice);
        voteDelegation.delegate(bob);
    }

    function test_delegate_incrementsActiveDelegations() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        assertEq(voteDelegation.getTotalActiveDelegations(), 1);
    }

    function test_delegate_addsToDelegators() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        address[] memory delegators = voteDelegation.getDelegators(bob);
        assertEq(delegators.length, 1);
        assertEq(delegators[0], alice);
    }

    function test_delegate_addsToHistory() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        VoteDelegation.Delegation[] memory history = voteDelegation.getDelegationHistory(alice);
        assertEq(history.length, 1);
        assertEq(history[0].delegatee, bob);
        assertTrue(history[0].active);
    }

    function test_delegate_revertsOnZeroAddress() public {
        vm.prank(alice);
        vm.expectRevert(VoteDelegation.ZeroAddress.selector);
        voteDelegation.delegate(address(0));
    }

    function test_delegate_revertsOnSelfDelegation() public {
        vm.prank(alice);
        vm.expectRevert(VoteDelegation.SelfDelegation.selector);
        voteDelegation.delegate(alice);
    }

    function test_delegate_revertsOnLoop() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        vm.prank(bob);
        vm.expectRevert(VoteDelegation.DelegationLoop.selector);
        voteDelegation.delegate(alice);
    }

    function test_delegate_changeDelegatee() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        vm.expectEmit(true, true, true, true);
        emit DelegationChanged(alice, bob, carol, block.timestamp);

        vm.prank(alice);
        voteDelegation.delegate(carol);

        assertEq(voteDelegation.getVotingPower(bob), 500 ether);
        assertEq(voteDelegation.getVotingPower(carol), 1_300 ether); // 300 + 1000
    }

    function test_delegate_multipleDelegatorsToOne() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);
        
        vm.prank(carol);
        voteDelegation.delegate(bob);

        assertEq(voteDelegation.getVotingPower(bob), 2_300 ether); // 500 + 1000 + 300
        assertEq(voteDelegation.getTotalActiveDelegations(), 2);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Undelegation Tests
    // ══════════════════════════════════════════════════════════════════════════

    function test_undelegate_removesDelegation() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        vm.prank(alice);
        voteDelegation.undelegate();

        VoteDelegation.Delegation memory delegation = voteDelegation.getCurrentDelegation(alice);
        assertFalse(delegation.active);
    }

    function test_undelegate_restoresPower() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        vm.prank(alice);
        voteDelegation.undelegate();

        assertEq(voteDelegation.getVotingPower(alice), 1_000 ether);
        assertEq(voteDelegation.getVotingPower(bob), 500 ether);
    }

    function test_undelegate_emitsRemovedEvent() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        vm.expectEmit(true, true, false, true);
        emit DelegationRemoved(alice, bob, block.timestamp);

        vm.prank(alice);
        voteDelegation.undelegate();
    }

    function test_undelegate_decrementsActiveDelegations() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        vm.prank(alice);
        voteDelegation.undelegate();

        assertEq(voteDelegation.getTotalActiveDelegations(), 0);
    }

    function test_undelegate_revertsWhenNoActiveDelegation() public {
        vm.prank(alice);
        vm.expectRevert(VoteDelegation.NoActiveDelegation.selector);
        voteDelegation.undelegate();
    }

    function test_undelegate_updatesHistory() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        vm.prank(alice);
        voteDelegation.undelegate();

        VoteDelegation.Delegation[] memory history = voteDelegation.getDelegationHistory(alice);
        assertEq(history.length, 1);
        assertFalse(history[0].active);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Chain Tracking — Acceptance Criteria: "Chains are tracked"
    // ══════════════════════════════════════════════════════════════════════════

    function test_getDelegationChain_singleLevel() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        VoteDelegation.DelegationChain memory chain = voteDelegation.getDelegationChain(alice);
        assertEq(chain.depth, 1);
        assertEq(chain.chain.length, 2);
        assertEq(chain.chain[0], alice);
        assertEq(chain.chain[1], bob);
    }

    function test_getDelegationChain_multiLevel() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);
        
        vm.prank(bob);
        voteDelegation.delegate(carol);

        VoteDelegation.DelegationChain memory chain = voteDelegation.getDelegationChain(alice);
        assertEq(chain.depth, 2);
        assertEq(chain.chain.length, 3);
        assertEq(chain.chain[0], alice);
        assertEq(chain.chain[1], bob);
        assertEq(chain.chain[2], carol);
    }

    function test_getDelegationChain_complexChain() public {
        // Create chain: alice -> bob -> carol -> dave
        vm.prank(alice);
        voteDelegation.delegate(bob);
        
        vm.prank(bob);
        voteDelegation.delegate(carol);
        
        vm.prank(carol);
        voteDelegation.delegate(dave);

        VoteDelegation.DelegationChain memory chain = voteDelegation.getDelegationChain(alice);
        assertEq(chain.depth, 3);
        assertEq(chain.chain.length, 4);
        assertEq(chain.chain[0], alice);
        assertEq(chain.chain[1], bob);
        assertEq(chain.chain[2], carol);
        assertEq(chain.chain[3], dave);
    }

    function test_getDelegationChain_noDelegation() public {
        VoteDelegation.DelegationChain memory chain = voteDelegation.getDelegationChain(alice);
        assertEq(chain.depth, 0);
        assertEq(chain.chain.length, 1);
        assertEq(chain.chain[0], alice);
    }

    function test_getFinalDelegatee_withChain() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);
        
        vm.prank(bob);
        voteDelegation.delegate(carol);

        assertEq(voteDelegation.getFinalDelegatee(alice), carol);
    }

    function test_getFinalDelegatee_noDelegation() public {
        assertEq(voteDelegation.getFinalDelegatee(alice), alice);
    }

    function test_hasActiveDelegation_true() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        assertTrue(voteDelegation.hasActiveDelegation(alice));
    }

    function test_hasActiveDelegation_false() public view {
        assertFalse(voteDelegation.hasActiveDelegation(alice));
    }

    function test_maxChainDepth_enforced() public {
        address[] memory accounts = new address[](12);
        accounts[0] = alice;
        accounts[1] = bob;
        accounts[2] = carol;
        accounts[3] = dave;
        accounts[4] = eve;
        
        // Create additional accounts
        for (uint256 i = 5; i < 12; i++) {
            accounts[i] = address(uint160(0x1000 + i));
            govToken.mint(accounts[i], 100 ether);
        }

        // Create chain of MAX_CHAIN_DEPTH
        for (uint256 i = 0; i < 10; i++) {
            vm.prank(accounts[i]);
            voteDelegation.delegate(accounts[i + 1]);
        }

        // Try to add one more - should fail
        vm.prank(accounts[11]);
        vm.expectRevert(VoteDelegation.MaxChainDepthExceeded.selector);
        voteDelegation.delegate(accounts[10]);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Power Calculation — Acceptance Criteria: "Power is calculated"
    // ══════════════════════════════════════════════════════════════════════════

    function test_getVotingPower_ownBalance() public view {
        assertEq(voteDelegation.getVotingPower(alice), 1_000 ether);
        assertEq(voteDelegation.getVotingPower(bob), 500 ether);
    }

    function test_getVotingPower_withDelegation() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        assertEq(voteDelegation.getVotingPower(bob), 1_500 ether);
    }

    function test_getVotingPower_delegatorHasZero() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        assertEq(voteDelegation.getVotingPower(alice), 0);
    }

    function test_getVotingPower_chainedDelegation() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);
        
        vm.prank(bob);
        voteDelegation.delegate(carol);

        // Carol gets: own 300 + alice's 1000 + bob's 500
        assertEq(voteDelegation.getVotingPower(carol), 2_100 ether);
        assertEq(voteDelegation.getVotingPower(bob), 0);
        assertEq(voteDelegation.getVotingPower(alice), 0);
    }

    function test_getVotingPower_multipleDelegators() public {
        vm.prank(alice);
        voteDelegation.delegate(dave);
        
        vm.prank(bob);
        voteDelegation.delegate(dave);
        
        vm.prank(carol);
        voteDelegation.delegate(dave);

        // Dave gets: own 200 + alice 1000 + bob 500 + carol 300
        assertEq(voteDelegation.getVotingPower(dave), 2_000 ether);
    }

    function test_getTotalDelegatedPower() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        assertEq(voteDelegation.getTotalDelegatedPower(bob), 1_000 ether);
    }

    function test_getVotingPower_afterTokenTransfer() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        // Alice receives more tokens
        govToken.mint(alice, 500 ether);

        // Voting power should reflect new balance
        assertEq(voteDelegation.getVotingPower(bob), 2_000 ether); // 500 + 1500
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Delegation Changes — Acceptance Criteria: "Changes work"
    // ══════════════════════════════════════════════════════════════════════════

    function test_changeDelegation_updatesPower() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        vm.prank(alice);
        voteDelegation.delegate(carol);

        assertEq(voteDelegation.getVotingPower(bob), 500 ether);
        assertEq(voteDelegation.getVotingPower(carol), 1_300 ether);
    }

    function test_changeDelegation_maintainsCount() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        vm.prank(alice);
        voteDelegation.delegate(carol);

        assertEq(voteDelegation.getTotalActiveDelegations(), 1);
    }

    function test_changeDelegation_updatesHistory() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        vm.prank(alice);
        voteDelegation.delegate(carol);

        VoteDelegation.Delegation[] memory history = voteDelegation.getDelegationHistory(alice);
        assertEq(history.length, 2);
        assertEq(history[0].delegatee, bob);
        assertEq(history[1].delegatee, carol);
        assertTrue(history[1].active);
    }

    function test_changeDelegation_updatesDelegators() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        vm.prank(alice);
        voteDelegation.delegate(carol);

        address[] memory bobDelegators = voteDelegation.getDelegators(bob);
        address[] memory carolDelegators = voteDelegation.getDelegators(carol);

        assertEq(bobDelegators.length, 0);
        assertEq(carolDelegators.length, 1);
        assertEq(carolDelegators[0], alice);
    }

    function test_multipleDelegationChanges() public {
        vm.startPrank(alice);
        voteDelegation.delegate(bob);
        voteDelegation.delegate(carol);
        voteDelegation.delegate(dave);
        vm.stopPrank();

        assertEq(voteDelegation.getVotingPower(dave), 1_200 ether);
        assertEq(voteDelegation.getVotingPower(bob), 500 ether);
        assertEq(voteDelegation.getVotingPower(carol), 300 ether);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Query Functions — Acceptance Criteria: "Queries work"
    // ══════════════════════════════════════════════════════════════════════════

    function test_getDelegators_empty() public view {
        address[] memory delegators = voteDelegation.getDelegators(alice);
        assertEq(delegators.length, 0);
    }

    function test_getDelegators_multiple() public {
        vm.prank(alice);
        voteDelegation.delegate(dave);
        
        vm.prank(bob);
        voteDelegation.delegate(dave);
        
        vm.prank(carol);
        voteDelegation.delegate(dave);

        address[] memory delegators = voteDelegation.getDelegators(dave);
        assertEq(delegators.length, 3);
    }

    function test_getDelegationHistory_empty() public view {
        VoteDelegation.Delegation[] memory history = voteDelegation.getDelegationHistory(alice);
        assertEq(history.length, 0);
    }

    function test_getDelegationHistory_multiple() public {
        vm.startPrank(alice);
        voteDelegation.delegate(bob);
        voteDelegation.delegate(carol);
        voteDelegation.delegate(dave);
        vm.stopPrank();

        VoteDelegation.Delegation[] memory history = voteDelegation.getDelegationHistory(alice);
        assertEq(history.length, 3);
        assertEq(history[0].delegatee, bob);
        assertEq(history[1].delegatee, carol);
        assertEq(history[2].delegatee, dave);
    }

    function test_getCurrentDelegation() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        VoteDelegation.Delegation memory current = voteDelegation.getCurrentDelegation(alice);
        assertEq(current.delegatee, bob);
        assertTrue(current.active);
    }

    function test_getTotalActiveDelegations() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);
        
        vm.prank(carol);
        voteDelegation.delegate(dave);

        assertEq(voteDelegation.getTotalActiveDelegations(), 2);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Checkpoint Tests
    // ══════════════════════════════════════════════════════════════════════════

    function test_checkpoints_createdOnDelegation() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        assertGt(voteDelegation.getCheckpointCount(alice), 0);
        assertGt(voteDelegation.getCheckpointCount(bob), 0);
    }

    function test_checkpoints_storeVotingPower() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        VoteDelegation.Checkpoint memory cp = voteDelegation.getCheckpoint(bob, 0);
        assertEq(cp.fromBlock, block.number);
        assertEq(cp.votingPower, 1_500 ether);
    }

    function test_getVotingPowerAt_revertsForFutureBlock() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        vm.expectRevert(VoteDelegation.InvalidCheckpoint.selector);
        voteDelegation.getVotingPowerAt(bob, block.number + 1);
    }

    function test_getVotingPowerAt_returnsHistoricalPower() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        uint256 blockNum = block.number;
        
        vm.roll(block.number + 10);
        
        uint256 historicalPower = voteDelegation.getVotingPowerAt(bob, blockNum);
        assertEq(historicalPower, 1_500 ether);
    }

    function test_checkpoints_multipleUpdates() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        vm.roll(block.number + 1);

        vm.prank(carol);
        voteDelegation.delegate(bob);

        assertGt(voteDelegation.getCheckpointCount(bob), 1);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Edge Cases and Complex Scenarios
    // ══════════════════════════════════════════════════════════════════════════

    function test_delegateWithZeroBalance() public {
        address nobody = address(0xDEAD);
        
        vm.prank(nobody);
        voteDelegation.delegate(alice);

        assertEq(voteDelegation.getVotingPower(alice), 1_000 ether);
    }

    function test_complexDelegationScenario() public {
        // Alice delegates to Bob
        vm.prank(alice);
        voteDelegation.delegate(bob);

        // Carol delegates to Bob
        vm.prank(carol);
        voteDelegation.delegate(bob);

        // Bob delegates to Dave
        vm.prank(bob);
        voteDelegation.delegate(dave);

        // Dave should have: own 200 + alice 1000 + carol 300 + bob 500
        assertEq(voteDelegation.getVotingPower(dave), 2_000 ether);
        assertEq(voteDelegation.getVotingPower(bob), 0);
        assertEq(voteDelegation.getVotingPower(alice), 0);
        assertEq(voteDelegation.getVotingPower(carol), 0);
    }

    function test_undelegateInChain() public {
        // Create chain: alice -> bob -> carol
        vm.prank(alice);
        voteDelegation.delegate(bob);
        
        vm.prank(bob);
        voteDelegation.delegate(carol);

        // Bob undelegates
        vm.prank(bob);
        voteDelegation.undelegate();

        // Bob should now have his own power + alice's delegation
        assertEq(voteDelegation.getVotingPower(bob), 1_500 ether);
        assertEq(voteDelegation.getVotingPower(carol), 300 ether);
    }

    function test_delegationAfterTokenBurn() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        // Burn some of alice's tokens
        govToken.burn(alice, 500 ether);

        // Bob's power should reflect the burn
        assertEq(voteDelegation.getVotingPower(bob), 1_000 ether); // 500 + 500
    }

    function test_multipleDelegationCycles() public {
        vm.startPrank(alice);
        voteDelegation.delegate(bob);
        voteDelegation.undelegate();
        voteDelegation.delegate(carol);
        voteDelegation.undelegate();
        voteDelegation.delegate(dave);
        vm.stopPrank();

        VoteDelegation.Delegation[] memory history = voteDelegation.getDelegationHistory(alice);
        assertEq(history.length, 3);
        assertEq(voteDelegation.getTotalActiveDelegations(), 1);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Fuzz Tests
    // ══════════════════════════════════════════════════════════════════════════

    function testFuzz_delegate_anyValidAddress(address delegatee) public {
        vm.assume(delegatee != address(0));
        vm.assume(delegatee != alice);
        vm.assume(delegatee.code.length == 0); // Not a contract

        vm.prank(alice);
        voteDelegation.delegate(delegatee);

        assertTrue(voteDelegation.hasActiveDelegation(alice));
        assertEq(voteDelegation.getCurrentDelegation(alice).delegatee, delegatee);
    }

    function testFuzz_votingPower_matchesBalance(uint128 amount) public {
        vm.assume(amount > 0);
        address voter = address(0x9999);
        govToken.mint(voter, uint256(amount));

        assertEq(voteDelegation.getVotingPower(voter), uint256(amount));
    }

    function testFuzz_delegatedPower_accumulates(uint128 amount1, uint128 amount2) public {
        vm.assume(amount1 > 0 && amount2 > 0);
        vm.assume(uint256(amount1) + uint256(amount2) <= type(uint128).max);

        address delegator1 = address(0x1111);
        address delegator2 = address(0x2222);
        address delegatee = address(0x3333);

        govToken.mint(delegator1, uint256(amount1));
        govToken.mint(delegator2, uint256(amount2));

        vm.prank(delegator1);
        voteDelegation.delegate(delegatee);

        vm.prank(delegator2);
        voteDelegation.delegate(delegatee);

        assertEq(
            voteDelegation.getTotalDelegatedPower(delegatee),
            uint256(amount1) + uint256(amount2)
        );
    }

    function testFuzz_undelegate_restoresExactPower(uint128 amount) public {
        vm.assume(amount > 0);
        address delegator = address(0x4444);
        govToken.mint(delegator, uint256(amount));

        vm.startPrank(delegator);
        voteDelegation.delegate(bob);
        voteDelegation.undelegate();
        vm.stopPrank();

        assertEq(voteDelegation.getVotingPower(delegator), uint256(amount));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Integration Tests
    // ══════════════════════════════════════════════════════════════════════════

    function test_integration_fullDelegationLifecycle() public {
        // 1. Alice delegates to Bob
        vm.prank(alice);
        voteDelegation.delegate(bob);
        assertEq(voteDelegation.getVotingPower(bob), 1_500 ether);

        // 2. Carol delegates to Bob
        vm.prank(carol);
        voteDelegation.delegate(bob);
        assertEq(voteDelegation.getVotingPower(bob), 2_300 ether);

        // 3. Bob delegates to Dave (chain delegation)
        vm.prank(bob);
        voteDelegation.delegate(dave);
        assertEq(voteDelegation.getVotingPower(dave), 2_000 ether);

        // 4. Alice changes delegation to Eve
        vm.prank(alice);
        voteDelegation.delegate(eve);
        assertEq(voteDelegation.getVotingPower(dave), 1_000 ether);
        assertEq(voteDelegation.getVotingPower(eve), 1_100 ether);

        // 5. Carol undelegates
        vm.prank(carol);
        voteDelegation.undelegate();
        assertEq(voteDelegation.getVotingPower(carol), 300 ether);
        assertEq(voteDelegation.getVotingPower(dave), 700 ether);

        // 6. Verify final state
        assertEq(voteDelegation.getTotalActiveDelegations(), 2); // Alice->Eve, Bob->Dave
        assertTrue(voteDelegation.hasActiveDelegation(alice));
        assertTrue(voteDelegation.hasActiveDelegation(bob));
        assertFalse(voteDelegation.hasActiveDelegation(carol));
    }

    function test_integration_complexChainReorganization() public {
        // Build initial chain: alice -> bob -> carol -> dave
        vm.prank(alice);
        voteDelegation.delegate(bob);
        
        vm.prank(bob);
        voteDelegation.delegate(carol);
        
        vm.prank(carol);
        voteDelegation.delegate(dave);

        assertEq(voteDelegation.getVotingPower(dave), 2_000 ether);

        // Break the chain in the middle
        vm.prank(bob);
        voteDelegation.undelegate();

        // Now: alice -> bob (stopped), carol -> dave
        assertEq(voteDelegation.getVotingPower(bob), 1_500 ether);
        assertEq(voteDelegation.getVotingPower(dave), 500 ether);

        // Rebuild differently: bob -> eve
        vm.prank(bob);
        voteDelegation.delegate(eve);

        assertEq(voteDelegation.getVotingPower(eve), 1_600 ether);
    }

    function test_integration_massiveDelegationToOne() public {
        address[] memory delegators = new address[](10);
        uint256 totalPower = dave.balance; // Start with dave's own balance
        
        totalPower = 200 ether; // Dave's balance

        for (uint256 i = 0; i < 10; i++) {
            delegators[i] = address(uint160(0x5000 + i));
            uint256 amount = (i + 1) * 100 ether;
            govToken.mint(delegators[i], amount);
            totalPower += amount;

            vm.prank(delegators[i]);
            voteDelegation.delegate(dave);
        }

        assertEq(voteDelegation.getVotingPower(dave), totalPower);
        assertEq(voteDelegation.getDelegators(dave).length, 10);
        assertEq(voteDelegation.getTotalActiveDelegations(), 10);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Gas Optimization Tests
    // ══════════════════════════════════════════════════════════════════════════

    function test_gas_singleDelegation() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);
    }

    function test_gas_changeDelegation() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        vm.prank(alice);
        voteDelegation.delegate(carol);
    }

    function test_gas_undelegate() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        vm.prank(alice);
        voteDelegation.undelegate();
    }

    function test_gas_getDelegationChain() public view {
        voteDelegation.getDelegationChain(alice);
    }

    function test_gas_getVotingPower() public view {
        voteDelegation.getVotingPower(alice);
    }
}

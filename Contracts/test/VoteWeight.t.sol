// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
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

/// @title VoteWeightTest
/// @notice Comprehensive test suite for VoteWeight contract
contract VoteWeightTest is Test {
    VoteWeight public voteWeight;
    MockGovernanceToken public token;

    address public owner;
    address public alice;
    address public bob;
    address public charlie;
    address public dave;

    uint256 constant INITIAL_BALANCE = 1000 * 10**18;

    event WeightUpdated(
        address indexed account,
        uint256 oldWeight,
        uint256 newWeight,
        int256 delta,
        VoteWeight.ChangeReason reason
    );
    event DelegationCreated(
        address indexed delegator,
        address indexed delegatee,
        uint256 amount,
        uint256 timestamp
    );
    event DelegationRemoved(
        address indexed delegator,
        address indexed delegatee,
        uint256 amount,
        uint256 timestamp
    );
    event SnapshotCreated(uint256 indexed snapshotId, uint256 blockNumber, uint256 timestamp);
    event CheckpointCreated(address indexed account, uint256 blockNumber, uint256 weight);

    function setUp() public {
        owner = address(this);
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        charlie = makeAddr("charlie");
        dave = makeAddr("dave");

        // Deploy token and VoteWeight
        token = new MockGovernanceToken();
        voteWeight = new VoteWeight(address(token));

        // Distribute tokens
        token.mint(alice, INITIAL_BALANCE);
        token.mint(bob, INITIAL_BALANCE);
        token.mint(charlie, INITIAL_BALANCE);
        token.mint(dave, INITIAL_BALANCE);
    }

    // ── Weight Tracking Tests ──────────────────────────────────────────────────

    function test_UpdateWeight_Success() public {
        vm.expectEmit(true, true, true, true);
        emit WeightUpdated(alice, 0, INITIAL_BALANCE, int256(INITIAL_BALANCE), VoteWeight.ChangeReason.BALANCE_CHANGE);
        
        voteWeight.updateWeight(alice);

        assertEq(voteWeight.currentWeight(alice), INITIAL_BALANCE);
        assertEq(voteWeight.baseWeight(alice), INITIAL_BALANCE);
        assertTrue(voteWeight.isTracked(alice));
    }

    function test_UpdateWeight_MultipleAccounts() public {
        voteWeight.updateWeight(alice);
        voteWeight.updateWeight(bob);
        voteWeight.updateWeight(charlie);

        assertEq(voteWeight.currentWeight(alice), INITIAL_BALANCE);
        assertEq(voteWeight.currentWeight(bob), INITIAL_BALANCE);
        assertEq(voteWeight.currentWeight(charlie), INITIAL_BALANCE);
        assertEq(voteWeight.getTrackedAccountCount(), 3);
    }

    function test_UpdateWeight_AfterBalanceChange() public {
        voteWeight.updateWeight(alice);
        assertEq(voteWeight.currentWeight(alice), INITIAL_BALANCE);

        // Transfer tokens
        vm.prank(alice);
        token.transfer(bob, 500 * 10**18);

        voteWeight.updateWeight(alice);
        assertEq(voteWeight.currentWeight(alice), 500 * 10**18);
    }

    function test_UpdateWeight_RevertZeroAddress() public {
        vm.expectRevert(VoteWeight.ZeroAddress.selector);
        voteWeight.updateWeight(address(0));
    }

    function test_UpdateWeight_RevertNoChange() public {
        voteWeight.updateWeight(alice);
        
        vm.expectRevert(VoteWeight.NoWeightChange.selector);
        voteWeight.updateWeight(alice);
    }

    function test_BatchUpdateWeights() public {
        address[] memory accounts = new address[](3);
        accounts[0] = alice;
        accounts[1] = bob;
        accounts[2] = charlie;

        voteWeight.batchUpdateWeights(accounts);

        assertEq(voteWeight.currentWeight(alice), INITIAL_BALANCE);
        assertEq(voteWeight.currentWeight(bob), INITIAL_BALANCE);
        assertEq(voteWeight.currentWeight(charlie), INITIAL_BALANCE);
    }

    function test_TotalVotingWeight() public {
        voteWeight.updateWeight(alice);
        voteWeight.updateWeight(bob);

        assertEq(voteWeight.getTotalVotingWeight(), INITIAL_BALANCE * 2);
    }

    // ── Delegation Tests ───────────────────────────────────────────────────────

    function test_Delegate_Success() public {
        voteWeight.updateWeight(alice);
        voteWeight.updateWeight(bob);

        vm.expectEmit(true, true, true, true);
        emit DelegationCreated(alice, bob, INITIAL_BALANCE, block.timestamp);

        vm.prank(alice);
        voteWeight.delegate(bob);

        // Alice's weight should be 0 (delegated away)
        assertEq(voteWeight.currentWeight(alice), 0);
        assertEq(voteWeight.delegatedWeightGiven(alice), INITIAL_BALANCE);

        // Bob's weight should be doubled (own + delegated)
        assertEq(voteWeight.currentWeight(bob), INITIAL_BALANCE * 2);
        assertEq(voteWeight.delegatedWeightReceived(bob), INITIAL_BALANCE);

        // Check delegation info
        assertEq(voteWeight.currentDelegation(alice), bob);
        assertTrue(voteWeight.hasDelegated(alice));
        assertEq(voteWeight.getDelegatee(alice), bob);
    }

    function test_Delegate_ChangeDelegatee() public {
        voteWeight.updateWeight(alice);
        voteWeight.updateWeight(bob);
        voteWeight.updateWeight(charlie);

        // Alice delegates to Bob
        vm.prank(alice);
        voteWeight.delegate(bob);
        assertEq(voteWeight.currentWeight(bob), INITIAL_BALANCE * 2);

        // Alice changes delegation to Charlie
        vm.prank(alice);
        voteWeight.delegate(charlie);

        assertEq(voteWeight.currentWeight(bob), INITIAL_BALANCE);
        assertEq(voteWeight.currentWeight(charlie), INITIAL_BALANCE * 2);
        assertEq(voteWeight.currentDelegation(alice), charlie);
    }

    function test_Undelegate_Success() public {
        voteWeight.updateWeight(alice);
        voteWeight.updateWeight(bob);

        vm.prank(alice);
        voteWeight.delegate(bob);

        vm.expectEmit(true, true, true, true);
        emit DelegationRemoved(alice, bob, INITIAL_BALANCE, block.timestamp);

        vm.prank(alice);
        voteWeight.undelegate();

        assertEq(voteWeight.currentWeight(alice), INITIAL_BALANCE);
        assertEq(voteWeight.currentWeight(bob), INITIAL_BALANCE);
        assertEq(voteWeight.currentDelegation(alice), address(0));
        assertFalse(voteWeight.hasDelegated(alice));
    }

    function test_Delegate_RevertSelfDelegation() public {
        voteWeight.updateWeight(alice);

        vm.prank(alice);
        vm.expectRevert(VoteWeight.SelfDelegation.selector);
        voteWeight.delegate(alice);
    }

    function test_Delegate_RevertZeroAddress() public {
        voteWeight.updateWeight(alice);

        vm.prank(alice);
        vm.expectRevert(VoteWeight.ZeroAddress.selector);
        voteWeight.delegate(address(0));
    }

    function test_Delegate_RevertDelegationLoop() public {
        voteWeight.updateWeight(alice);
        voteWeight.updateWeight(bob);

        // Alice delegates to Bob
        vm.prank(alice);
        voteWeight.delegate(bob);

        // Bob tries to delegate to Alice (would create loop)
        vm.prank(bob);
        vm.expectRevert(VoteWeight.DelegationLoop.selector);
        voteWeight.delegate(alice);
    }

    function test_Delegate_MultipleDelegators() public {
        voteWeight.updateWeight(alice);
        voteWeight.updateWeight(bob);
        voteWeight.updateWeight(charlie);
        voteWeight.updateWeight(dave);

        // Alice, Bob, and Charlie all delegate to Dave
        vm.prank(alice);
        voteWeight.delegate(dave);

        vm.prank(bob);
        voteWeight.delegate(dave);

        vm.prank(charlie);
        voteWeight.delegate(dave);

        // Dave should have 4x weight
        assertEq(voteWeight.currentWeight(dave), INITIAL_BALANCE * 4);
        assertEq(voteWeight.delegatedWeightReceived(dave), INITIAL_BALANCE * 3);

        // Check delegators
        address[] memory delegators = voteWeight.getDelegators(dave);
        assertEq(delegators.length, 3);
    }

    function test_GetDelegationInfo() public {
        voteWeight.updateWeight(alice);
        voteWeight.updateWeight(bob);

        vm.prank(alice);
        voteWeight.delegate(bob);

        VoteWeight.DelegationInfo memory info = voteWeight.getDelegationInfo(alice);
        assertEq(info.delegatee, bob);
        assertEq(info.amount, INITIAL_BALANCE);
        assertTrue(info.active);
        assertEq(info.timestamp, block.timestamp);
    }

    // ── Weight Change History Tests ────────────────────────────────────────────

    function test_WeightChangeHistory() public {
        voteWeight.updateWeight(alice);

        VoteWeight.WeightChange[] memory history = voteWeight.getWeightChangeHistory(alice);
        assertEq(history.length, 1);
        assertEq(history[0].oldWeight, 0);
        assertEq(history[0].newWeight, INITIAL_BALANCE);
        assertEq(history[0].delta, int256(INITIAL_BALANCE));
        assertTrue(history[0].reason == VoteWeight.ChangeReason.BALANCE_CHANGE);
    }

    function test_WeightChangeHistory_WithDelegation() public {
        voteWeight.updateWeight(alice);
        voteWeight.updateWeight(bob);

        vm.prank(alice);
        voteWeight.delegate(bob);

        VoteWeight.WeightChange[] memory aliceHistory = voteWeight.getWeightChangeHistory(alice);
        assertEq(aliceHistory.length, 2); // Initial update + delegation

        VoteWeight.WeightChange[] memory bobHistory = voteWeight.getWeightChangeHistory(bob);
        assertEq(bobHistory.length, 2); // Initial update + receiving delegation
    }

    function test_GetRecentWeightChanges() public {
        voteWeight.updateWeight(alice);
        
        vm.prank(alice);
        token.transfer(bob, 100 * 10**18);
        voteWeight.updateWeight(alice);

        vm.prank(alice);
        token.transfer(charlie, 100 * 10**18);
        voteWeight.updateWeight(alice);

        VoteWeight.WeightChange[] memory recent = voteWeight.getRecentWeightChanges(alice, 2);
        assertEq(recent.length, 2);
    }

    function test_CalculateWeightChange() public {
        voteWeight.updateWeight(alice);
        uint256 startBlock = block.number;

        vm.roll(block.number + 1);
        vm.prank(alice);
        token.transfer(bob, 500 * 10**18);
        voteWeight.updateWeight(alice);

        int256 change = voteWeight.calculateWeightChange(alice, startBlock, block.number);
        assertEq(change, -500 * 10**18);
    }

    // ── Checkpoint Tests ───────────────────────────────────────────────────────

    function test_Checkpoints_Created() public {
        voteWeight.updateWeight(alice);

        assertEq(voteWeight.getCheckpointCount(alice), 1);
        
        VoteWeight.Checkpoint memory cp = voteWeight.getCheckpoint(alice, 0);
        assertEq(cp.blockNumber, block.number);
        assertEq(cp.weight, INITIAL_BALANCE);
    }

    function test_GetWeightAt() public {
        voteWeight.updateWeight(alice);
        uint256 block1 = block.number;

        vm.roll(block.number + 10);
        vm.prank(alice);
        token.transfer(bob, 500 * 10**18);
        voteWeight.updateWeight(alice);

        // Check weight at first block
        uint256 weightAtBlock1 = voteWeight.getWeightAt(alice, block1);
        assertEq(weightAtBlock1, INITIAL_BALANCE);

        // Check current weight
        assertEq(voteWeight.currentWeight(alice), 500 * 10**18);
    }

    function test_GetWeightAt_RevertInvalidBlock() public {
        voteWeight.updateWeight(alice);

        vm.expectRevert(VoteWeight.InvalidBlockNumber.selector);
        voteWeight.getWeightAt(alice, block.number + 1);
    }

    function test_GetWeightAt_NoCheckpoints() public {
        uint256 weight = voteWeight.getWeightAt(alice, block.number);
        assertEq(weight, 0);
    }

    // ── Snapshot Tests ─────────────────────────────────────────────────────────

    function test_CreateSnapshot() public {
        voteWeight.updateWeight(alice);
        voteWeight.updateWeight(bob);

        vm.expectEmit(true, true, true, true);
        emit SnapshotCreated(1, block.number, block.timestamp);

        uint256 snapshotId = voteWeight.createSnapshot();
        assertEq(snapshotId, 1);
        assertEq(voteWeight.currentSnapshotId(), 1);
    }

    function test_GetWeightAtSnapshot() public {
        voteWeight.updateWeight(alice);
        voteWeight.updateWeight(bob);

        uint256 snapshotId = voteWeight.createSnapshot();

        // Change weights after snapshot
        vm.prank(alice);
        token.transfer(charlie, 500 * 10**18);
        voteWeight.updateWeight(alice);

        // Check snapshot weight (should be original)
        uint256 snapshotWeight = voteWeight.getWeightAtSnapshot(snapshotId, alice);
        assertEq(snapshotWeight, INITIAL_BALANCE);

        // Check current weight (should be reduced)
        assertEq(voteWeight.currentWeight(alice), 500 * 10**18);
    }

    function test_GetSnapshotInfo() public {
        voteWeight.updateWeight(alice);
        voteWeight.updateWeight(bob);

        uint256 snapshotId = voteWeight.createSnapshot();

        (uint256 id, uint256 blockNumber, uint256 timestamp, uint256 accountCount) = 
            voteWeight.getSnapshotInfo(snapshotId);

        assertEq(id, 1);
        assertEq(blockNumber, block.number);
        assertEq(timestamp, block.timestamp);
        assertEq(accountCount, 2);
    }

    function test_GetWeightAtSnapshot_RevertInvalidId() public {
        vm.expectRevert(VoteWeight.InvalidSnapshotId.selector);
        voteWeight.getWeightAtSnapshot(999, alice);
    }

    function test_CreateSnapshot_OnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        voteWeight.createSnapshot();
    }

    function test_MultipleSnapshots() public {
        voteWeight.updateWeight(alice);
        
        uint256 snapshot1 = voteWeight.createSnapshot();
        
        vm.prank(alice);
        token.transfer(bob, 500 * 10**18);
        voteWeight.updateWeight(alice);
        
        uint256 snapshot2 = voteWeight.createSnapshot();

        assertEq(voteWeight.getWeightAtSnapshot(snapshot1, alice), INITIAL_BALANCE);
        assertEq(voteWeight.getWeightAtSnapshot(snapshot2, alice), 500 * 10**18);
    }

    // ── Query Function Tests ───────────────────────────────────────────────────

    function test_GetVotingWeight() public {
        voteWeight.updateWeight(alice);
        assertEq(voteWeight.getVotingWeight(alice), INITIAL_BALANCE);
    }

    function test_GetWeightBreakdown() public {
        voteWeight.updateWeight(alice);
        voteWeight.updateWeight(bob);

        vm.prank(alice);
        voteWeight.delegate(bob);

        (uint256 base, uint256 received, uint256 given, uint256 total) = 
            voteWeight.getWeightBreakdown(alice);

        assertEq(base, INITIAL_BALANCE);
        assertEq(received, 0);
        assertEq(given, INITIAL_BALANCE);
        assertEq(total, 0);

        (base, received, given, total) = voteWeight.getWeightBreakdown(bob);
        assertEq(base, INITIAL_BALANCE);
        assertEq(received, INITIAL_BALANCE);
        assertEq(given, 0);
        assertEq(total, INITIAL_BALANCE * 2);
    }

    function test_GetTrackedAccounts() public {
        voteWeight.updateWeight(alice);
        voteWeight.updateWeight(bob);
        voteWeight.updateWeight(charlie);

        address[] memory tracked = voteWeight.getTrackedAccounts();
        assertEq(tracked.length, 3);
        assertEq(tracked[0], alice);
        assertEq(tracked[1], bob);
        assertEq(tracked[2], charlie);
    }

    // ── Integration Tests ──────────────────────────────────────────────────────

    function test_ComplexDelegationScenario() public {
        // Setup: 4 users with tokens
        voteWeight.updateWeight(alice);
        voteWeight.updateWeight(bob);
        voteWeight.updateWeight(charlie);
        voteWeight.updateWeight(dave);

        // Alice delegates to Bob
        vm.prank(alice);
        voteWeight.delegate(bob);
        assertEq(voteWeight.currentWeight(bob), INITIAL_BALANCE * 2);

        // Charlie delegates to Bob
        vm.prank(charlie);
        voteWeight.delegate(bob);
        assertEq(voteWeight.currentWeight(bob), INITIAL_BALANCE * 3);

        // Bob delegates to Dave (Bob keeps delegated weight)
        vm.prank(bob);
        voteWeight.delegate(dave);
        assertEq(voteWeight.currentWeight(dave), INITIAL_BALANCE * 2); // Dave's own + Bob's base
        assertEq(voteWeight.currentWeight(bob), INITIAL_BALANCE * 2); // Alice's + Charlie's delegations

        // Alice undelegates
        vm.prank(alice);
        voteWeight.undelegate();
        assertEq(voteWeight.currentWeight(alice), INITIAL_BALANCE);
        assertEq(voteWeight.currentWeight(bob), INITIAL_BALANCE); // Only Charlie's delegation
    }

    function test_WeightTrackingWithTransfers() public {
        voteWeight.updateWeight(alice);
        voteWeight.updateWeight(bob);

        uint256 snapshot1 = voteWeight.createSnapshot();

        // Transfer tokens
        vm.prank(alice);
        token.transfer(bob, 300 * 10**18);

        voteWeight.updateWeight(alice);
        voteWeight.updateWeight(bob);

        uint256 snapshot2 = voteWeight.createSnapshot();

        // Verify snapshot 1
        assertEq(voteWeight.getWeightAtSnapshot(snapshot1, alice), INITIAL_BALANCE);
        assertEq(voteWeight.getWeightAtSnapshot(snapshot1, bob), INITIAL_BALANCE);

        // Verify snapshot 2
        assertEq(voteWeight.getWeightAtSnapshot(snapshot2, alice), 700 * 10**18);
        assertEq(voteWeight.getWeightAtSnapshot(snapshot2, bob), 1300 * 10**18);
    }

    function test_DelegationWithBalanceChanges() public {
        voteWeight.updateWeight(alice);
        voteWeight.updateWeight(bob);

        // Alice delegates to Bob
        vm.prank(alice);
        voteWeight.delegate(bob);
        assertEq(voteWeight.currentWeight(bob), INITIAL_BALANCE * 2);

        // Alice receives more tokens
        token.mint(alice, 500 * 10**18);
        voteWeight.updateWeight(alice);

        // Bob's delegated weight should NOT automatically update
        // (delegation amount is fixed at delegation time)
        assertEq(voteWeight.currentWeight(bob), INITIAL_BALANCE * 2);

        // Alice needs to re-delegate to update
        vm.prank(alice);
        voteWeight.undelegate();
        
        vm.prank(alice);
        voteWeight.delegate(bob);
        
        // Now Bob should have the updated weight
        assertEq(voteWeight.currentWeight(bob), INITIAL_BALANCE + (INITIAL_BALANCE + 500 * 10**18));
    }

    // ── Fuzz Tests ─────────────────────────────────────────────────────────────

    function testFuzz_UpdateWeight(uint256 amount) public {
        vm.assume(amount > 0 && amount < 1_000_000_000 * 10**18);
        
        token.mint(alice, amount);
        voteWeight.updateWeight(alice);

        assertEq(voteWeight.currentWeight(alice), INITIAL_BALANCE + amount);
    }

    function testFuzz_Delegation(uint8 numDelegators) public {
        vm.assume(numDelegators > 0 && numDelegators <= 10);

        voteWeight.updateWeight(dave);
        uint256 expectedWeight = INITIAL_BALANCE;

        for (uint8 i = 0; i < numDelegators; i++) {
            address delegator = address(uint160(1000 + i));
            token.mint(delegator, INITIAL_BALANCE);
            voteWeight.updateWeight(delegator);

            vm.prank(delegator);
            voteWeight.delegate(dave);

            expectedWeight += INITIAL_BALANCE;
        }

        assertEq(voteWeight.currentWeight(dave), expectedWeight);
    }

    // ── Edge Cases ─────────────────────────────────────────────────────────────

    function test_ZeroBalanceAccount() public {
        address zeroAccount = makeAddr("zero");
        voteWeight.updateWeight(zeroAccount);

        assertEq(voteWeight.currentWeight(zeroAccount), 0);
        assertTrue(voteWeight.isTracked(zeroAccount));
    }

    function test_DelegateWithZeroBalance() public {
        address zeroAccount = makeAddr("zero");
        voteWeight.updateWeight(zeroAccount);
        voteWeight.updateWeight(bob);

        vm.prank(zeroAccount);
        voteWeight.delegate(bob);

        assertEq(voteWeight.currentWeight(bob), INITIAL_BALANCE);
        assertEq(voteWeight.delegatedWeightReceived(bob), 0);
    }

    function test_MultipleDelegationChanges() public {
        voteWeight.updateWeight(alice);
        voteWeight.updateWeight(bob);
        voteWeight.updateWeight(charlie);

        // Alice delegates to Bob
        vm.prank(alice);
        voteWeight.delegate(bob);

        // Alice changes to Charlie
        vm.prank(alice);
        voteWeight.delegate(charlie);

        // Alice changes back to Bob
        vm.prank(alice);
        voteWeight.delegate(bob);

        // Alice undelegates
        vm.prank(alice);
        voteWeight.undelegate();

        assertEq(voteWeight.currentWeight(alice), INITIAL_BALANCE);
        assertEq(voteWeight.currentWeight(bob), INITIAL_BALANCE);
        assertEq(voteWeight.currentWeight(charlie), INITIAL_BALANCE);
    }
}

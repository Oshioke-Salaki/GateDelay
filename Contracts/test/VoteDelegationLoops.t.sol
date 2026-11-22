// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import "../src/VoteDelegation.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title VoteDelegationLoopsTest
 * @notice Comprehensive tests for delegation loops, revoke behavior, and vote weight snapshots
 * @dev Tests cover:
 *      - Delegation loop prevention (A->B->A, A->B->C->A, etc.)
 *      - Revoke behavior and voting power updates
 *      - Vote weight snapshots consistency
 *      - Complex delegation chains
 *      - Edge cases and boundary conditions
 */
contract VoteDelegationLoopsTest is Test {
    VoteDelegation internal voteDelegation;
    MockGovToken internal govToken;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal dave = makeAddr("dave");
    address internal eve = makeAddr("eve");

    function setUp() public {
        govToken = new MockGovToken();
        voteDelegation = new VoteDelegation(address(govToken));

        // Distribute tokens
        govToken.mint(alice, 1_000 ether);
        govToken.mint(bob, 500 ether);
        govToken.mint(carol, 300 ether);
        govToken.mint(dave, 200 ether);
        govToken.mint(eve, 100 ether);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Delegation Loop Prevention Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_loop_preventDirectLoop() public {
        // A delegates to B
        vm.prank(alice);
        voteDelegation.delegate(bob);

        // B tries to delegate to A (creates loop: A->B->A)
        vm.prank(bob);
        vm.expectRevert(VoteDelegation.DelegationLoop.selector);
        voteDelegation.delegate(alice);
    }

    function test_loop_preventThreePersonLoop() public {
        // A->B
        vm.prank(alice);
        voteDelegation.delegate(bob);

        // B->C
        vm.prank(bob);
        voteDelegation.delegate(carol);

        // C tries to delegate to A (creates loop: A->B->C->A)
        vm.prank(carol);
        vm.expectRevert(VoteDelegation.DelegationLoop.selector);
        voteDelegation.delegate(alice);
    }

    function test_loop_preventFourPersonLoop() public {
        // A->B->C->D
        vm.prank(alice);
        voteDelegation.delegate(bob);

        vm.prank(bob);
        voteDelegation.delegate(carol);

        vm.prank(carol);
        voteDelegation.delegate(dave);

        // D tries to delegate to A (creates loop: A->B->C->D->A)
        vm.prank(dave);
        vm.expectRevert(VoteDelegation.DelegationLoop.selector);
        voteDelegation.delegate(alice);
    }

    function test_loop_preventLoopToMiddleOfChain() public {
        // A->B->C->D
        vm.prank(alice);
        voteDelegation.delegate(bob);

        vm.prank(bob);
        voteDelegation.delegate(carol);

        vm.prank(carol);
        voteDelegation.delegate(dave);

        // D tries to delegate to B (creates loop: B->C->D->B)
        vm.prank(dave);
        vm.expectRevert(VoteDelegation.DelegationLoop.selector);
        voteDelegation.delegate(bob);

        // D tries to delegate to C (creates loop: C->D->C)
        vm.prank(dave);
        vm.expectRevert(VoteDelegation.DelegationLoop.selector);
        voteDelegation.delegate(carol);
    }

    function test_loop_allowsComplexNonLoopChains() public {
        // Create diamond pattern: A,B,C all delegate to D (no loops)
        vm.prank(alice);
        voteDelegation.delegate(dave);

        vm.prank(bob);
        voteDelegation.delegate(dave);

        vm.prank(carol);
        voteDelegation.delegate(dave);

        // All should succeed - no loops
        assertEq(voteDelegation.getVotingPower(dave), 2_000 ether); // 200 + 1000 + 500 + 300
    }

    function test_loop_preventAfterBreakAndReform() public {
        // A->B->C
        vm.prank(alice);
        voteDelegation.delegate(bob);

        vm.prank(bob);
        voteDelegation.delegate(carol);

        // B breaks chain
        vm.prank(bob);
        voteDelegation.undelegate();

        // C delegates to A (would be fine now)
        vm.prank(carol);
        voteDelegation.delegate(alice);

        // Now B tries to delegate to C (would create A->C->B loop? No, A delegates to B is broken)
        // Actually creates: C->A, B->C which is: B->C->A (no loop)
        vm.prank(bob);
        voteDelegation.delegate(carol);

        // This should work since A's delegation to B was broken
        assertTrue(voteDelegation.hasActiveDelegation(bob), "Should allow after break");
    }

    function test_loop_detectsLoopAcrossChangedDelegations() public {
        // A->B
        vm.prank(alice);
        voteDelegation.delegate(bob);

        // B->C
        vm.prank(bob);
        voteDelegation.delegate(carol);

        // A changes to C (A->C)
        vm.prank(alice);
        voteDelegation.delegate(carol);

        // C now has both A and B delegating to it
        // C tries to delegate to B (would create B->C->B loop)
        vm.prank(carol);
        vm.expectRevert(VoteDelegation.DelegationLoop.selector);
        voteDelegation.delegate(bob);
    }

    function test_loop_maxDepthPreventsInfiniteChains() public {
        address[] memory accounts = new address[](12);
        accounts[0] = alice;
        accounts[1] = bob;
        accounts[2] = carol;
        accounts[3] = dave;
        accounts[4] = eve;

        for (uint256 i = 5; i < 12; i++) {
            accounts[i] = makeAddr(string(abi.encodePacked("user", i)));
            govToken.mint(accounts[i], 100 ether);
        }

        // Create max depth chain
        for (uint256 i = 0; i < 10; i++) {
            vm.prank(accounts[i]);
            voteDelegation.delegate(accounts[i + 1]);
        }

        // Try to extend beyond max depth
        vm.prank(accounts[11]);
        vm.expectRevert(VoteDelegation.MaxChainDepthExceeded.selector);
        voteDelegation.delegate(accounts[10]);
    }

    function test_loop_allowsParallelChains() public {
        // Chain 1: A->B
        vm.prank(alice);
        voteDelegation.delegate(bob);

        // Chain 2: C->D
        vm.prank(carol);
        voteDelegation.delegate(dave);

        // No loops, both should work
        assertEq(voteDelegation.getVotingPower(bob), 1_500 ether);
        assertEq(voteDelegation.getVotingPower(dave), 500 ether);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Revoke Behavior Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_revoke_restoresVotingPower() public {
        uint256 alicePowerBefore = voteDelegation.getVotingPower(alice);

        vm.prank(alice);
        voteDelegation.delegate(bob);

        assertEq(voteDelegation.getVotingPower(alice), 0, "Alice should have 0 power when delegated");

        vm.prank(alice);
        voteDelegation.undelegate();

        assertEq(
            voteDelegation.getVotingPower(alice),
            alicePowerBefore,
            "Power should be fully restored"
        );
    }

    function test_revoke_reducesDelegateePower() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        uint256 bobPowerBefore = voteDelegation.getVotingPower(bob);

        vm.prank(alice);
        voteDelegation.undelegate();

        uint256 bobPowerAfter = voteDelegation.getVotingPower(bob);

        assertEq(bobPowerAfter, bobPowerBefore - 1_000 ether, "Bob should lose Alice's power");
    }

    function test_revoke_updatesChainPowerCorrectly() public {
        // A->B->C
        vm.prank(alice);
        voteDelegation.delegate(bob);

        vm.prank(bob);
        voteDelegation.delegate(carol);

        // C has: 300 (own) + 1000 (alice) + 500 (bob) = 1800
        assertEq(voteDelegation.getVotingPower(carol), 2_100 ether);

        // B revokes
        vm.prank(bob);
        voteDelegation.undelegate();

        // Now: A->B (stopped), C alone
        // B has: 500 (own) + 1000 (alice) = 1500
        // C has: 300 (own) = 300
        assertEq(voteDelegation.getVotingPower(bob), 1_500 ether);
        assertEq(voteDelegation.getVotingPower(carol), 300 ether);
    }

    function test_revoke_multipleRevokesInChain() public {
        // A->B->C->D
        vm.prank(alice);
        voteDelegation.delegate(bob);

        vm.prank(bob);
        voteDelegation.delegate(carol);

        vm.prank(carol);
        voteDelegation.delegate(dave);

        // Revoke from the end
        vm.prank(carol);
        voteDelegation.undelegate();

        // Now: A->B->C (stopped), D alone
        assertEq(voteDelegation.getVotingPower(carol), 1_800 ether); // 300 + 1000 + 500
        assertEq(voteDelegation.getVotingPower(dave), 200 ether);

        // Revoke B
        vm.prank(bob);
        voteDelegation.undelegate();

        // Now: A->B (stopped), C alone, D alone
        assertEq(voteDelegation.getVotingPower(bob), 1_500 ether);
        assertEq(voteDelegation.getVotingPower(carol), 300 ether);
        assertEq(voteDelegation.getVotingPower(dave), 200 ether);
    }

    function test_revoke_allowsRedelegationAfterRevoke() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        vm.prank(alice);
        voteDelegation.undelegate();

        // Should be able to delegate to someone else
        vm.prank(alice);
        voteDelegation.delegate(carol);

        assertEq(voteDelegation.getVotingPower(carol), 1_300 ether);
        assertEq(voteDelegation.getVotingPower(bob), 500 ether);
    }

    function test_revoke_preventsLoopAfterRevoke() public {
        // A->B
        vm.prank(alice);
        voteDelegation.delegate(bob);

        // B->C
        vm.prank(bob);
        voteDelegation.delegate(carol);

        // C tries to delegate to A (would create loop)
        vm.prank(carol);
        vm.expectRevert(VoteDelegation.DelegationLoop.selector);
        voteDelegation.delegate(alice);

        // A revokes
        vm.prank(alice);
        voteDelegation.undelegate();

        // Now C can delegate to A (no longer a loop)
        vm.prank(carol);
        voteDelegation.delegate(alice);

        // Should succeed
        assertTrue(voteDelegation.hasActiveDelegation(carol), "Should allow after revoke breaks loop");
    }

    function test_revoke_batchRevokes() public {
        // Multiple people delegate to Dave
        vm.prank(alice);
        voteDelegation.delegate(dave);

        vm.prank(bob);
        voteDelegation.delegate(dave);

        vm.prank(carol);
        voteDelegation.delegate(dave);

        uint256 davePowerBefore = voteDelegation.getVotingPower(dave);
        assertEq(davePowerBefore, 2_000 ether); // 200 + 1000 + 500 + 300

        // All revoke
        vm.prank(alice);
        voteDelegation.undelegate();

        vm.prank(bob);
        voteDelegation.undelegate();

        vm.prank(carol);
        voteDelegation.undelegate();

        assertEq(voteDelegation.getVotingPower(dave), 200 ether, "Dave should only have own power");
    }

    function test_revoke_revokeWithZeroBalance() public {
        address nobody = makeAddr("nobody"); // No tokens

        vm.prank(nobody);
        voteDelegation.delegate(alice);

        vm.prank(nobody);
        voteDelegation.undelegate();

        // Should not affect Alice's power
        assertEq(voteDelegation.getVotingPower(alice), 1_000 ether);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Vote Weight Snapshot Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_snapshot_createdOnDelegation() public {
        uint256 checkpointsBefore = voteDelegation.getCheckpointCount(bob);

        vm.prank(alice);
        voteDelegation.delegate(bob);

        uint256 checkpointsAfter = voteDelegation.getCheckpointCount(bob);

        assertTrue(checkpointsAfter > checkpointsBefore, "Checkpoint should be created");
    }

    function test_snapshot_recordsCorrectBlock() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        uint256 checkpointCount = voteDelegation.getCheckpointCount(bob);
        VoteDelegation.Checkpoint memory cp = voteDelegation.getCheckpoint(bob, checkpointCount - 1);

        assertEq(cp.fromBlock, block.number, "Should record current block");
    }

    function test_snapshot_recordsCorrectVotingPower() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        uint256 checkpointCount = voteDelegation.getCheckpointCount(bob);
        VoteDelegation.Checkpoint memory cp = voteDelegation.getCheckpoint(bob, checkpointCount - 1);

        assertEq(cp.votingPower, 1_500 ether, "Should record correct power");
    }

    function test_snapshot_historicalPowerRetrieval() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        uint256 blockAtDelegation = block.number;

        vm.roll(block.number + 10);

        uint256 historicalPower = voteDelegation.getVotingPowerAt(bob, blockAtDelegation);
        assertEq(historicalPower, 1_500 ether, "Should retrieve historical power");
    }

    function test_snapshot_multipleDelegationsCreateMultipleSnapshots() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        vm.roll(block.number + 1);

        vm.prank(carol);
        voteDelegation.delegate(bob);

        vm.roll(block.number + 1);

        vm.prank(dave);
        voteDelegation.delegate(bob);

        assertTrue(voteDelegation.getCheckpointCount(bob) >= 3, "Should have multiple checkpoints");
    }

    function test_snapshot_revokeCreatesNewSnapshot() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        uint256 checkpointsAfterDelegate = voteDelegation.getCheckpointCount(bob);

        vm.roll(block.number + 1);

        vm.prank(alice);
        voteDelegation.undelegate();

        uint256 checkpointsAfterRevoke = voteDelegation.getCheckpointCount(bob);

        assertTrue(checkpointsAfterRevoke > checkpointsAfterDelegate, "Revoke should create checkpoint");
    }

    function test_snapshot_powerTimelineCorrectness() public {
        uint256[] memory blocks = new uint256[](4);
        uint256[] memory expectedPowers = new uint256[](4);

        // Block 0: Bob has 500
        blocks[0] = block.number;
        expectedPowers[0] = 500 ether;

        // Alice delegates (+1000)
        vm.prank(alice);
        voteDelegation.delegate(bob);

        vm.roll(block.number + 1);
        blocks[1] = block.number;
        expectedPowers[1] = 1_500 ether;

        // Carol delegates (+300)
        vm.prank(carol);
        voteDelegation.delegate(bob);

        vm.roll(block.number + 1);
        blocks[2] = block.number;
        expectedPowers[2] = 2_300 ether;

        // Alice revokes (-1000)
        vm.prank(alice);
        voteDelegation.undelegate();

        vm.roll(block.number + 1);
        blocks[3] = block.number;
        expectedPowers[3] = 800 ether;

        // Verify historical powers
        for (uint256 i = 0; i < 4; i++) {
            uint256 power = voteDelegation.getVotingPowerAt(bob, blocks[i]);
            assertEq(power, expectedPowers[i], "Historical power mismatch");
        }
    }

    function test_snapshot_cannotQueryFutureBlock() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        vm.expectRevert(VoteDelegation.InvalidCheckpoint.selector);
        voteDelegation.getVotingPowerAt(bob, block.number + 1);
    }

    function test_snapshot_chainedDelegationSnapshots() public {
        // A->B->C, check all snapshots
        vm.prank(alice);
        voteDelegation.delegate(bob);

        uint256 blockAfterAtoB = block.number;

        vm.roll(block.number + 1);

        vm.prank(bob);
        voteDelegation.delegate(carol);

        uint256 blockAfterBtoC = block.number;

        vm.roll(block.number + 1);

        // Historical queries
        uint256 alicePowerAtBlock0 = voteDelegation.getVotingPowerAt(alice, blockAfterAtoB);
        uint256 bobPowerAtBlock0 = voteDelegation.getVotingPowerAt(bob, blockAfterAtoB);
        uint256 carolPowerAtBlock0 = voteDelegation.getVotingPowerAt(carol, blockAfterAtoB);

        assertEq(alicePowerAtBlock0, 0, "Alice delegated away power");
        assertEq(bobPowerAtBlock0, 1_500 ether, "Bob had Alice's delegation");
        assertEq(carolPowerAtBlock0, 300 ether, "Carol only had her own");

        uint256 bobPowerAtBlock1 = voteDelegation.getVotingPowerAt(bob, blockAfterBtoC);
        uint256 carolPowerAtBlock1 = voteDelegation.getVotingPowerAt(carol, blockAfterBtoC);

        assertEq(bobPowerAtBlock1, 0, "Bob delegated away power");
        assertEq(carolPowerAtBlock1, 2_100 ether, "Carol got full chain");
    }

    function test_snapshot_consistencyAcrossMultipleOperations() public {
        // Complex scenario: multiple delegates, revokes, changes
        vm.prank(alice);
        voteDelegation.delegate(dave);
        uint256 block1 = block.number;

        vm.roll(block.number + 1);

        vm.prank(bob);
        voteDelegation.delegate(dave);
        uint256 block2 = block.number;

        vm.roll(block.number + 1);

        vm.prank(alice);
        voteDelegation.undelegate();
        uint256 block3 = block.number;

        vm.roll(block.number + 1);

        vm.prank(carol);
        voteDelegation.delegate(dave);
        uint256 block4 = block.number;

        // Verify consistency
        assertEq(voteDelegation.getVotingPowerAt(dave, block1), 1_200 ether); // 200 + 1000
        assertEq(voteDelegation.getVotingPowerAt(dave, block2), 2_200 ether); // 200 + 1000 + 500
        assertEq(voteDelegation.getVotingPowerAt(dave, block3), 700 ether); // 200 + 500
        assertEq(voteDelegation.getVotingPowerAt(dave, block4), 1_000 ether); // 200 + 500 + 300
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Complex Scenarios
    // ═══════════════════════════════════════════════════════════════════════════

    function test_complex_simultaneousChainBreakAndReform() public {
        // A->B->C
        vm.prank(alice);
        voteDelegation.delegate(bob);

        vm.prank(bob);
        voteDelegation.delegate(carol);

        // Break and reform simultaneously
        vm.prank(bob);
        voteDelegation.undelegate();

        vm.prank(alice);
        voteDelegation.delegate(carol);

        // Carol should now have Alice's power directly, Bob has his own
        assertEq(voteDelegation.getVotingPower(carol), 1_300 ether);
        assertEq(voteDelegation.getVotingPower(bob), 500 ether);
    }

    function test_complex_starTopologyDelegation() public {
        // Everyone delegates to Dave (star pattern)
        vm.prank(alice);
        voteDelegation.delegate(dave);

        vm.prank(bob);
        voteDelegation.delegate(dave);

        vm.prank(carol);
        voteDelegation.delegate(dave);

        vm.prank(eve);
        voteDelegation.delegate(dave);

        // Dave should have everyone's power
        uint256 expectedPower = 200 ether + 1_000 ether + 500 ether + 300 ether + 100 ether;
        assertEq(voteDelegation.getVotingPower(dave), expectedPower);
    }

    function test_complex_cyclicRedelegation() public {
        // A->B, B->C, C->D
        vm.prank(alice);
        voteDelegation.delegate(bob);

        vm.prank(bob);
        voteDelegation.delegate(carol);

        vm.prank(carol);
        voteDelegation.delegate(dave);

        // Change to: A->C, B->D, C->E
        vm.prank(alice);
        voteDelegation.delegate(carol);

        vm.prank(bob);
        voteDelegation.delegate(dave);

        vm.prank(carol);
        voteDelegation.delegate(eve);

        // Verify powers
        assertEq(voteDelegation.getVotingPower(eve), 1_400 ether); // 100 + 1000 + 300
        assertEq(voteDelegation.getVotingPower(dave), 700 ether); // 200 + 500
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Mock Contract
// ═══════════════════════════════════════════════════════════════════════════════

contract MockGovToken is ERC20 {
    constructor() ERC20("GovToken", "GOV") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

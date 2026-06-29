// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/DisputeHandler.sol";

contract DisputeHandlerTest is Test {
    DisputeHandler public handler;

    address public admin = address(0xADMIN);
    address public alice = address(0xALICE);
    address public bob = address(0xBOB);
    address public market = address(0xMARKET);

    event DisputeSubmitted(
        uint256 indexed disputeId,
        address indexed market,
        address indexed disputer,
        string evidenceURI
    );
    event EvidenceAdded(uint256 indexed disputeId, address indexed submitter, string evidenceURI);
    event DisputeStatusChanged(uint256 indexed disputeId, DisputeHandler.DisputeStatus newStatus);
    event DisputeResolved(uint256 indexed disputeId, address indexed resolver, bool upheld);

    function setUp() public {
        handler = new DisputeHandler(admin);
    }

    function test_submitDispute() public {
        vm.prank(alice);
        uint256 disputeId = handler.submitDispute(market, "ipfs://evidence1");

        assertEq(disputeId, 1);
        assertEq(handler.disputeCount(), 1);

        DisputeHandler.Dispute memory dispute = handler.getDispute(disputeId);
        assertEq(dispute.market, market);
        assertEq(dispute.disputer, alice);
        assertEq(dispute.initialEvidence, "ipfs://evidence1");
        assertEq(uint256(dispute.status), uint256(DisputeHandler.DisputeStatus.PENDING));
    }

    function test_submitDispute_emitsEvent() public {
        vm.prank(alice);
        vm.expectEmit(true, true, true, true);
        emit DisputeSubmitted(1, market, alice, "ipfs://evidence1");
        handler.submitDispute(market, "ipfs://evidence1");
    }

    function test_submitDispute_revertsInvalidEvidence() public {
        vm.prank(alice);
        vm.expectRevert(DisputeHandler.InvalidEvidence.selector);
        handler.submitDispute(market, "");
    }

    function test_addEvidence() public {
        vm.prank(alice);
        uint256 disputeId = handler.submitDispute(market, "ipfs://evidence1");

        vm.prank(bob);
        handler.addEvidence(disputeId, "ipfs://evidence2");

        DisputeHandler.Evidence[] memory evidence = handler.getEvidence(disputeId);
        assertEq(evidence.length, 2);
        assertEq(evidence[1].submitter, bob);
        assertEq(evidence[1].evidenceURI, "ipfs://evidence2");
    }

    function test_addEvidence_emitsEvent() public {
        vm.prank(alice);
        uint256 disputeId = handler.submitDispute(market, "ipfs://evidence1");

        vm.prank(bob);
        vm.expectEmit(true, true, false, true);
        emit EvidenceAdded(disputeId, bob, "ipfs://evidence2");
        handler.addEvidence(disputeId, "ipfs://evidence2");
    }

    function test_addEvidence_revertsDisputeNotFound() public {
        vm.expectRevert(DisputeHandler.DisputeNotFound.selector);
        handler.addEvidence(999, "ipfs://evidence");
    }

    function test_addEvidence_revertsDisputeAlreadyResolved() public {
        vm.prank(alice);
        uint256 disputeId = handler.submitDispute(market, "ipfs://evidence1");

        vm.prank(admin);
        handler.resolveDispute(disputeId, true);

        vm.prank(bob);
        vm.expectRevert(DisputeHandler.DisputeAlreadyResolved.selector);
        handler.addEvidence(disputeId, "ipfs://evidence2");
    }

    function test_updateStatus() public {
        vm.prank(alice);
        uint256 disputeId = handler.submitDispute(market, "ipfs://evidence1");

        vm.prank(admin);
        handler.updateStatus(disputeId, DisputeHandler.DisputeStatus.UNDER_REVIEW);

        DisputeHandler.Dispute memory dispute = handler.getDispute(disputeId);
        assertEq(uint256(dispute.status), uint256(DisputeHandler.DisputeStatus.UNDER_REVIEW));
    }

    function test_updateStatus_revertsNotAuthorized() public {
        vm.prank(alice);
        uint256 disputeId = handler.submitDispute(market, "ipfs://evidence1");

        vm.prank(bob);
        vm.expectRevert(DisputeHandler.NotAuthorized.selector);
        handler.updateStatus(disputeId, DisputeHandler.DisputeStatus.UNDER_REVIEW);
    }

    function test_resolveDispute_upheld() public {
        vm.prank(alice);
        uint256 disputeId = handler.submitDispute(market, "ipfs://evidence1");

        vm.prank(admin);
        handler.resolveDispute(disputeId, true);

        DisputeHandler.Dispute memory dispute = handler.getDispute(disputeId);
        assertEq(uint256(dispute.status), uint256(DisputeHandler.DisputeStatus.RESOLVED));
        assertTrue(dispute.upheld);
        assertEq(dispute.resolver, admin);
        assertGt(dispute.resolvedAt, 0);
    }

    function test_resolveDispute_rejected() public {
        vm.prank(alice);
        uint256 disputeId = handler.submitDispute(market, "ipfs://evidence1");

        vm.prank(admin);
        handler.resolveDispute(disputeId, false);

        DisputeHandler.Dispute memory dispute = handler.getDispute(disputeId);
        assertEq(uint256(dispute.status), uint256(DisputeHandler.DisputeStatus.REJECTED));
        assertFalse(dispute.upheld);
    }

    function test_resolveDispute_emitsEvent() public {
        vm.prank(alice);
        uint256 disputeId = handler.submitDispute(market, "ipfs://evidence1");

        vm.prank(admin);
        vm.expectEmit(true, true, false, true);
        emit DisputeResolved(disputeId, admin, true);
        handler.resolveDispute(disputeId, true);
    }

    function test_getMarketDisputes() public {
        vm.startPrank(alice);
        handler.submitDispute(market, "ipfs://evidence1");
        handler.submitDispute(market, "ipfs://evidence2");
        vm.stopPrank();

        uint256[] memory disputes = handler.getMarketDisputes(market);
        assertEq(disputes.length, 2);
        assertEq(disputes[0], 1);
        assertEq(disputes[1], 2);
    }

    function test_getUserDisputes() public {
        vm.prank(alice);
        handler.submitDispute(market, "ipfs://evidence1");

        vm.prank(bob);
        handler.submitDispute(market, "ipfs://evidence2");

        vm.prank(alice);
        handler.submitDispute(market, "ipfs://evidence3");

        uint256[] memory aliceDisputes = handler.getUserDisputes(alice);
        assertEq(aliceDisputes.length, 2);
        assertEq(aliceDisputes[0], 1);
        assertEq(aliceDisputes[1], 3);

        uint256[] memory bobDisputes = handler.getUserDisputes(bob);
        assertEq(bobDisputes.length, 1);
        assertEq(bobDisputes[0], 2);
    }

    function test_disputeExists() public {
        assertFalse(handler.disputeExists(1));

        vm.prank(alice);
        handler.submitDispute(market, "ipfs://evidence1");

        assertTrue(handler.disputeExists(1));
        assertFalse(handler.disputeExists(2));
    }

    function testFuzz_submitDispute(address disputer, string calldata evidenceURI) public {
        vm.assume(disputer != address(0));
        vm.assume(bytes(evidenceURI).length > 0);

        vm.prank(disputer);
        uint256 disputeId = handler.submitDispute(market, evidenceURI);

        DisputeHandler.Dispute memory dispute = handler.getDispute(disputeId);
        assertEq(dispute.disputer, disputer);
        assertEq(dispute.initialEvidence, evidenceURI);
    }

    function testFuzz_addEvidence(uint8 evidenceCount) public {
        evidenceCount = uint8(bound(evidenceCount, 1, 20));

        vm.prank(alice);
        uint256 disputeId = handler.submitDispute(market, "ipfs://initial");

        for (uint8 i = 0; i < evidenceCount; i++) {
            vm.prank(bob);
            handler.addEvidence(disputeId, string(abi.encodePacked("ipfs://evidence", i)));
        }

        DisputeHandler.Evidence[] memory evidence = handler.getEvidence(disputeId);
        assertEq(evidence.length, evidenceCount + 1); // +1 for initial evidence
    }
}

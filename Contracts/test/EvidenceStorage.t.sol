// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/EvidenceStorage.sol";

contract EvidenceStorageTest is Test {
    EvidenceStorage public storage_;

    address public admin = address(0xADMIN);
    address public alice = address(0xALICE);
    address public bob = address(0xBOB);

    bytes32 public constant EVIDENCE_HASH_1 = keccak256("evidence1");
    bytes32 public constant EVIDENCE_HASH_2 = keccak256("evidence2");

    event EvidenceStored(
        uint256 indexed evidenceId,
        uint256 indexed disputeId,
        address indexed submitter,
        string evidenceURI,
        bytes32 evidenceHash
    );
    event EvidenceVerified(uint256 indexed evidenceId, address indexed verifier);

    function setUp() public {
        storage_ = new EvidenceStorage(admin);
    }

    function test_storeEvidence() public {
        vm.prank(alice);
        uint256 evidenceId = storage_.storeEvidence(1, "ipfs://evidence1", EVIDENCE_HASH_1);

        assertEq(evidenceId, 1);
        assertEq(storage_.evidenceCount(), 1);

        EvidenceStorage.Evidence memory evidence = storage_.getEvidence(evidenceId);
        assertEq(evidence.disputeId, 1);
        assertEq(evidence.submitter, alice);
        assertEq(evidence.evidenceURI, "ipfs://evidence1");
        assertEq(evidence.evidenceHash, EVIDENCE_HASH_1);
        assertFalse(evidence.verified);
    }

    function test_storeEvidence_emitsEvent() public {
        vm.prank(alice);
        vm.expectEmit(true, true, true, true);
        emit EvidenceStored(1, 1, alice, "ipfs://evidence1", EVIDENCE_HASH_1);
        storage_.storeEvidence(1, "ipfs://evidence1", EVIDENCE_HASH_1);
    }

    function test_storeEvidence_revertsInvalidEvidence_emptyURI() public {
        vm.prank(alice);
        vm.expectRevert(EvidenceStorage.InvalidEvidence.selector);
        storage_.storeEvidence(1, "", EVIDENCE_HASH_1);
    }

    function test_storeEvidence_revertsInvalidEvidence_zeroHash() public {
        vm.prank(alice);
        vm.expectRevert(EvidenceStorage.InvalidEvidence.selector);
        storage_.storeEvidence(1, "ipfs://evidence1", bytes32(0));
    }

    function test_verifyEvidence() public {
        vm.prank(alice);
        uint256 evidenceId = storage_.storeEvidence(1, "ipfs://evidence1", EVIDENCE_HASH_1);

        vm.prank(admin);
        storage_.verifyEvidence(evidenceId);

        assertTrue(storage_.isVerified(evidenceId));
    }

    function test_verifyEvidence_emitsEvent() public {
        vm.prank(alice);
        uint256 evidenceId = storage_.storeEvidence(1, "ipfs://evidence1", EVIDENCE_HASH_1);

        vm.prank(admin);
        vm.expectEmit(true, true, false, false);
        emit EvidenceVerified(evidenceId, admin);
        storage_.verifyEvidence(evidenceId);
    }

    function test_verifyEvidence_revertsNotAuthorized() public {
        vm.prank(alice);
        uint256 evidenceId = storage_.storeEvidence(1, "ipfs://evidence1", EVIDENCE_HASH_1);

        vm.prank(bob);
        vm.expectRevert(EvidenceStorage.NotAuthorized.selector);
        storage_.verifyEvidence(evidenceId);
    }

    function test_validateEvidenceHash_valid() public {
        vm.prank(alice);
        uint256 evidenceId = storage_.storeEvidence(1, "ipfs://evidence1", EVIDENCE_HASH_1);

        assertTrue(storage_.validateEvidenceHash(evidenceId, EVIDENCE_HASH_1));
    }

    function test_validateEvidenceHash_invalid() public {
        vm.prank(alice);
        uint256 evidenceId = storage_.storeEvidence(1, "ipfs://evidence1", EVIDENCE_HASH_1);

        assertFalse(storage_.validateEvidenceHash(evidenceId, EVIDENCE_HASH_2));
    }

    function test_getDisputeEvidence() public {
        vm.startPrank(alice);
        storage_.storeEvidence(1, "ipfs://evidence1", EVIDENCE_HASH_1);
        storage_.storeEvidence(1, "ipfs://evidence2", EVIDENCE_HASH_2);
        vm.stopPrank();

        uint256[] memory evidenceIds = storage_.getDisputeEvidence(1);
        assertEq(evidenceIds.length, 2);
        assertEq(evidenceIds[0], 1);
        assertEq(evidenceIds[1], 2);
    }

    function test_getSubmitterEvidence() public {
        vm.prank(alice);
        storage_.storeEvidence(1, "ipfs://evidence1", EVIDENCE_HASH_1);

        vm.prank(bob);
        storage_.storeEvidence(1, "ipfs://evidence2", EVIDENCE_HASH_2);

        vm.prank(alice);
        storage_.storeEvidence(2, "ipfs://evidence3", keccak256("evidence3"));

        uint256[] memory aliceEvidence = storage_.getSubmitterEvidence(alice);
        assertEq(aliceEvidence.length, 2);
        assertEq(aliceEvidence[0], 1);
        assertEq(aliceEvidence[1], 3);

        uint256[] memory bobEvidence = storage_.getSubmitterEvidence(bob);
        assertEq(bobEvidence.length, 1);
        assertEq(bobEvidence[0], 2);
    }

    function test_getEvidenceByHash() public {
        vm.prank(alice);
        uint256 evidenceId = storage_.storeEvidence(1, "ipfs://evidence1", EVIDENCE_HASH_1);

        assertEq(storage_.getEvidenceByHash(EVIDENCE_HASH_1), evidenceId);
    }

    function test_evidenceExists() public {
        assertFalse(storage_.evidenceExists(1));

        vm.prank(alice);
        storage_.storeEvidence(1, "ipfs://evidence1", EVIDENCE_HASH_1);

        assertTrue(storage_.evidenceExists(1));
        assertFalse(storage_.evidenceExists(2));
    }

    function test_getEvidenceTimestamp() public {
        uint256 beforeTimestamp = block.timestamp;

        vm.prank(alice);
        uint256 evidenceId = storage_.storeEvidence(1, "ipfs://evidence1", EVIDENCE_HASH_1);

        uint256 timestamp = storage_.getEvidenceTimestamp(evidenceId);
        assertGe(timestamp, beforeTimestamp);
    }

    function test_getMultipleEvidence() public {
        vm.startPrank(alice);
        storage_.storeEvidence(1, "ipfs://evidence1", EVIDENCE_HASH_1);
        storage_.storeEvidence(1, "ipfs://evidence2", EVIDENCE_HASH_2);
        vm.stopPrank();

        uint256[] memory ids = new uint256[](2);
        ids[0] = 1;
        ids[1] = 2;

        EvidenceStorage.Evidence[] memory evidenceList = storage_.getMultipleEvidence(ids);
        assertEq(evidenceList.length, 2);
        assertEq(evidenceList[0].evidenceURI, "ipfs://evidence1");
        assertEq(evidenceList[1].evidenceURI, "ipfs://evidence2");
    }

    function test_getEvidence_revertsEvidenceNotFound() public {
        vm.expectRevert(EvidenceStorage.EvidenceNotFound.selector);
        storage_.getEvidence(999);
    }

    function testFuzz_storeEvidence(
        uint256 disputeId,
        string calldata evidenceURI,
        bytes32 evidenceHash
    ) public {
        vm.assume(bytes(evidenceURI).length > 0);
        vm.assume(evidenceHash != bytes32(0));

        vm.prank(alice);
        uint256 evidenceId = storage_.storeEvidence(disputeId, evidenceURI, evidenceHash);

        EvidenceStorage.Evidence memory evidence = storage_.getEvidence(evidenceId);
        assertEq(evidence.disputeId, disputeId);
        assertEq(evidence.evidenceURI, evidenceURI);
        assertEq(evidence.evidenceHash, evidenceHash);
    }

    function testFuzz_validateEvidenceHash(bytes32 hash1, bytes32 hash2) public {
        vm.assume(hash1 != bytes32(0));
        vm.assume(hash2 != bytes32(0));

        vm.prank(alice);
        uint256 evidenceId = storage_.storeEvidence(1, "ipfs://evidence", hash1);

        bool valid1 = storage_.validateEvidenceHash(evidenceId, hash1);
        bool valid2 = storage_.validateEvidenceHash(evidenceId, hash2);

        assertTrue(valid1);
        if (hash1 != hash2) {
            assertFalse(valid2);
        }
    }

    function testFuzz_multipleSubmitters(uint8 submitterCount) public {
        submitterCount = uint8(bound(submitterCount, 1, 20));

        for (uint8 i = 0; i < submitterCount; i++) {
            address submitter = address(uint160(0x1000 + i));
            vm.prank(submitter);
            storage_.storeEvidence(1, "ipfs://evidence", keccak256(abi.encodePacked(i)));
        }

        assertEq(storage_.evidenceCount(), submitterCount);
        
        uint256[] memory disputeEvidence = storage_.getDisputeEvidence(1);
        assertEq(disputeEvidence.length, submitterCount);
    }
}

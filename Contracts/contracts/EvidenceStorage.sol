// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title EvidenceStorage
/// @notice Manages evidence storage and retrieval for disputes
/// @dev Provides timestamped, immutable evidence storage with validation
contract EvidenceStorage is ReentrancyGuard {
    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error InvalidEvidence();
    error EvidenceNotFound();
    error NotAuthorized();

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------
    struct Evidence {
        uint256 id;
        uint256 disputeId;
        address submitter;
        string evidenceURI;
        bytes32 evidenceHash;
        uint256 timestamp;
        bool verified;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event EvidenceStored(
        uint256 indexed evidenceId,
        uint256 indexed disputeId,
        address indexed submitter,
        string evidenceURI,
        bytes32 evidenceHash
    );
    event EvidenceVerified(uint256 indexed evidenceId, address indexed verifier);

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------
    address public immutable admin;
    uint256 public evidenceCount;

    mapping(uint256 => Evidence) public evidences;
    mapping(uint256 => uint256[]) public disputeEvidence;
    mapping(address => uint256[]) public submitterEvidence;
    mapping(bytes32 => uint256) public hashToEvidence;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(address _admin) {
        admin = _admin;
    }

    // -------------------------------------------------------------------------
    // External functions
    // -------------------------------------------------------------------------

    /// @notice Store evidence for a dispute
    /// @param disputeId The dispute ID
    /// @param evidenceURI URI pointing to the evidence
    /// @param evidenceHash Hash of the evidence content
    /// @return evidenceId The ID of the stored evidence
    function storeEvidence(
        uint256 disputeId,
        string calldata evidenceURI,
        bytes32 evidenceHash
    ) external nonReentrant returns (uint256 evidenceId) {
        if (bytes(evidenceURI).length == 0) revert InvalidEvidence();
        if (evidenceHash == bytes32(0)) revert InvalidEvidence();

        evidenceId = ++evidenceCount;

        evidences[evidenceId] = Evidence({
            id: evidenceId,
            disputeId: disputeId,
            submitter: msg.sender,
            evidenceURI: evidenceURI,
            evidenceHash: evidenceHash,
            timestamp: block.timestamp,
            verified: false
        });

        disputeEvidence[disputeId].push(evidenceId);
        submitterEvidence[msg.sender].push(evidenceId);
        hashToEvidence[evidenceHash] = evidenceId;

        emit EvidenceStored(evidenceId, disputeId, msg.sender, evidenceURI, evidenceHash);
    }

    /// @notice Verify evidence (admin only)
    /// @param evidenceId The evidence ID
    function verifyEvidence(uint256 evidenceId) external {
        if (msg.sender != admin) revert NotAuthorized();
        
        Evidence storage evidence = evidences[evidenceId];
        if (evidence.timestamp == 0) revert EvidenceNotFound();

        evidence.verified = true;
        emit EvidenceVerified(evidenceId, msg.sender);
    }

    /// @notice Validate evidence hash matches stored hash
    /// @param evidenceId The evidence ID
    /// @param providedHash The hash to validate
    /// @return valid True if hash matches
    function validateEvidenceHash(uint256 evidenceId, bytes32 providedHash) 
        external 
        view 
        returns (bool valid) 
    {
        Evidence memory evidence = evidences[evidenceId];
        if (evidence.timestamp == 0) revert EvidenceNotFound();
        return evidence.evidenceHash == providedHash;
    }

    // -------------------------------------------------------------------------
    // View functions
    // -------------------------------------------------------------------------

    /// @notice Get evidence details
    /// @param evidenceId The evidence ID
    /// @return evidence The evidence struct
    function getEvidence(uint256 evidenceId) external view returns (Evidence memory) {
        Evidence memory evidence = evidences[evidenceId];
        if (evidence.timestamp == 0) revert EvidenceNotFound();
        return evidence;
    }

    /// @notice Get all evidence for a dispute
    /// @param disputeId The dispute ID
    /// @return evidenceIds Array of evidence IDs
    function getDisputeEvidence(uint256 disputeId) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return disputeEvidence[disputeId];
    }

    /// @notice Get all evidence submitted by an address
    /// @param submitter The submitter address
    /// @return evidenceIds Array of evidence IDs
    function getSubmitterEvidence(address submitter) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return submitterEvidence[submitter];
    }

    /// @notice Get evidence ID by hash
    /// @param evidenceHash The evidence hash
    /// @return evidenceId The evidence ID (0 if not found)
    function getEvidenceByHash(bytes32 evidenceHash) 
        external 
        view 
        returns (uint256) 
    {
        return hashToEvidence[evidenceHash];
    }

    /// @notice Check if evidence exists
    /// @param evidenceId The evidence ID
    /// @return exists True if evidence exists
    function evidenceExists(uint256 evidenceId) external view returns (bool) {
        return evidences[evidenceId].timestamp > 0;
    }

    /// @notice Check if evidence is verified
    /// @param evidenceId The evidence ID
    /// @return verified True if verified
    function isVerified(uint256 evidenceId) external view returns (bool) {
        Evidence memory evidence = evidences[evidenceId];
        if (evidence.timestamp == 0) revert EvidenceNotFound();
        return evidence.verified;
    }

    /// @notice Get evidence timestamp
    /// @param evidenceId The evidence ID
    /// @return timestamp The submission timestamp
    function getEvidenceTimestamp(uint256 evidenceId) external view returns (uint256) {
        Evidence memory evidence = evidences[evidenceId];
        if (evidence.timestamp == 0) revert EvidenceNotFound();
        return evidence.timestamp;
    }

    /// @notice Get multiple evidence details at once
    /// @param evidenceIds Array of evidence IDs
    /// @return evidenceList Array of evidence structs
    function getMultipleEvidence(uint256[] calldata evidenceIds) 
        external 
        view 
        returns (Evidence[] memory evidenceList) 
    {
        evidenceList = new Evidence[](evidenceIds.length);
        for (uint256 i = 0; i < evidenceIds.length; i++) {
            Evidence memory evidence = evidences[evidenceIds[i]];
            if (evidence.timestamp == 0) revert EvidenceNotFound();
            evidenceList[i] = evidence;
        }
    }
}

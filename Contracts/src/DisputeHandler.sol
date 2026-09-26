// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title DisputeHandler
/// @notice Manages dispute submissions, evidence, and resolution tracking
/// @dev Handles the full dispute lifecycle with evidence management
contract DisputeHandler is ReentrancyGuard {
    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error NotAuthorized();
    error DisputeNotFound();
    error DisputeAlreadyResolved();
    error InvalidEvidence();
    error DisputeNotPending();

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------
    enum DisputeStatus {
        NONE,
        PENDING,
        UNDER_REVIEW,
        RESOLVED,
        REJECTED
    }

    struct Dispute {
        address market;
        address disputer;
        string initialEvidence;
        uint256 submittedAt;
        DisputeStatus status;
        address resolver;
        uint256 resolvedAt;
        bool upheld;
    }

    struct Evidence {
        address submitter;
        string evidenceURI;
        uint256 timestamp;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event DisputeSubmitted(
        uint256 indexed disputeId,
        address indexed market,
        address indexed disputer,
        string evidenceURI
    );
    event EvidenceAdded(uint256 indexed disputeId, address indexed submitter, string evidenceURI);
    event DisputeStatusChanged(uint256 indexed disputeId, DisputeStatus newStatus);
    event DisputeResolved(
        uint256 indexed disputeId,
        address indexed resolver,
        bool upheld
    );

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------
    address public immutable admin;
    uint256 public disputeCount;

    mapping(uint256 => Dispute) public disputes;
    mapping(uint256 => Evidence[]) public disputeEvidence;
    mapping(address => uint256[]) public marketDisputes;
    mapping(address => uint256[]) public userDisputes;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(address _admin) {
        admin = _admin;
    }

    // -------------------------------------------------------------------------
    // External functions
    // -------------------------------------------------------------------------

    /// @notice Submit a new dispute
    /// @param market The market being disputed
    /// @param evidenceURI URI pointing to initial evidence
    /// @return disputeId The ID of the created dispute
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    /// @dev Reverts: `InvalidEvidence` if `bytes(evidenceURI).length == 0` is true.
    function submitDispute(address market, string calldata evidenceURI) 
        external 
        nonReentrant 
        returns (uint256 disputeId) 
    {
        if (bytes(evidenceURI).length == 0) revert InvalidEvidence();

        disputeId = ++disputeCount;

        disputes[disputeId] = Dispute({
            market: market,
            disputer: msg.sender,
            initialEvidence: evidenceURI,
            submittedAt: block.timestamp,
            status: DisputeStatus.PENDING,
            resolver: address(0),
            resolvedAt: 0,
            upheld: false
        });

        disputeEvidence[disputeId].push(Evidence({
            submitter: msg.sender,
            evidenceURI: evidenceURI,
            timestamp: block.timestamp
        }));

        marketDisputes[market].push(disputeId);
        userDisputes[msg.sender].push(disputeId);

        emit DisputeSubmitted(disputeId, market, msg.sender, evidenceURI);
    }

    /// @notice Add additional evidence to an existing dispute
    /// @param disputeId The dispute ID
    /// @param evidenceURI URI pointing to additional evidence
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    /// @dev Reverts: `DisputeNotFound` if `dispute.submittedAt == 0` is true.
    ///     `DisputeAlreadyResolved` if `dispute.status == DisputeStatus.RESOLVED || dispute.status
    ///     == DisputeStatus.REJECTED` is true. `InvalidEvidence` if `bytes(evidenceURI).length ==
    ///     0` is true.
    function addEvidence(uint256 disputeId, string calldata evidenceURI) external nonReentrant {
        Dispute storage dispute = disputes[disputeId];
        if (dispute.submittedAt == 0) revert DisputeNotFound();
        if (dispute.status == DisputeStatus.RESOLVED || dispute.status == DisputeStatus.REJECTED) {
            revert DisputeAlreadyResolved();
        }
        if (bytes(evidenceURI).length == 0) revert InvalidEvidence();

        disputeEvidence[disputeId].push(Evidence({
            submitter: msg.sender,
            evidenceURI: evidenceURI,
            timestamp: block.timestamp
        }));

        emit EvidenceAdded(disputeId, msg.sender, evidenceURI);
    }

    /// @notice Update dispute status
    /// @param disputeId The dispute ID
    /// @param newStatus The new status
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    /// @dev Reverts: `NotAuthorized` if `msg.sender != admin` is true. `DisputeNotFound` if
    ///     `dispute.submittedAt == 0` is true. `DisputeAlreadyResolved` if `dispute.status ==
    ///     DisputeStatus.RESOLVED || dispute.status == DisputeStatus.REJECTED` is true.
    function updateStatus(uint256 disputeId, DisputeStatus newStatus) external {
        if (msg.sender != admin) revert NotAuthorized();
        
        Dispute storage dispute = disputes[disputeId];
        if (dispute.submittedAt == 0) revert DisputeNotFound();
        if (dispute.status == DisputeStatus.RESOLVED || dispute.status == DisputeStatus.REJECTED) {
            revert DisputeAlreadyResolved();
        }

        dispute.status = newStatus;
        emit DisputeStatusChanged(disputeId, newStatus);
    }

    /// @notice Resolve a dispute
    /// @param disputeId The dispute ID
    /// @param upheld Whether the dispute is upheld
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    /// @dev Reverts: `NotAuthorized` if `msg.sender != admin` is true. `DisputeNotFound` if
    ///     `dispute.submittedAt == 0` is true. `DisputeAlreadyResolved` if `dispute.status ==
    ///     DisputeStatus.RESOLVED || dispute.status == DisputeStatus.REJECTED` is true.
    function resolveDispute(uint256 disputeId, bool upheld) external {
        if (msg.sender != admin) revert NotAuthorized();
        
        Dispute storage dispute = disputes[disputeId];
        if (dispute.submittedAt == 0) revert DisputeNotFound();
        if (dispute.status == DisputeStatus.RESOLVED || dispute.status == DisputeStatus.REJECTED) {
            revert DisputeAlreadyResolved();
        }

        dispute.status = upheld ? DisputeStatus.RESOLVED : DisputeStatus.REJECTED;
        dispute.resolver = msg.sender;
        dispute.resolvedAt = block.timestamp;
        dispute.upheld = upheld;

        emit DisputeResolved(disputeId, msg.sender, upheld);
    }

    // -------------------------------------------------------------------------
    // View functions
    // -------------------------------------------------------------------------

    /// @notice Get dispute details
    /// @param disputeId The dispute ID
    /// @return dispute The dispute struct
    /// @dev Access: No caller-specific access restriction is imposed.
    function getDispute(uint256 disputeId) external view returns (Dispute memory) {
        return disputes[disputeId];
    }

    /// @notice Get all evidence for a dispute
    /// @param disputeId The dispute ID
    /// @return evidence Array of evidence
    /// @dev Access: No caller-specific access restriction is imposed.
    function getEvidence(uint256 disputeId) external view returns (Evidence[] memory) {
        return disputeEvidence[disputeId];
    }

    /// @notice Get all disputes for a market
    /// @param market The market address
    /// @return disputeIds Array of dispute IDs
    /// @dev Access: No caller-specific access restriction is imposed.
    function getMarketDisputes(address market) external view returns (uint256[] memory) {
        return marketDisputes[market];
    }

    /// @notice Get all disputes submitted by a user
    /// @param user The user address
    /// @return disputeIds Array of dispute IDs
    /// @dev Access: No caller-specific access restriction is imposed.
    function getUserDisputes(address user) external view returns (uint256[] memory) {
        return userDisputes[user];
    }

    /// @notice Get dispute status
    /// @param disputeId The dispute ID
    /// @return status The current status
    /// @dev Access: No caller-specific access restriction is imposed.
    function getDisputeStatus(uint256 disputeId) external view returns (DisputeStatus) {
        return disputes[disputeId].status;
    }

    /// @notice Check if dispute exists
    /// @param disputeId The dispute ID
    /// @return exists True if dispute exists
    /// @dev Access: No caller-specific access restriction is imposed.
    function disputeExists(uint256 disputeId) external view returns (bool) {
        return disputes[disputeId].submittedAt > 0;
    }
}

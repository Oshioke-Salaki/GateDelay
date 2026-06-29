// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MarketArbitration
/// @notice Manages arbitration process for disputed markets
/// @dev Handles arbitrator selection, voting, and final decisions
contract MarketArbitration {
    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error NotAuthorized();
    error ArbitrationNotFound();
    error ArbitrationAlreadyResolved();
    error NotArbitrator();
    error AlreadyVoted();
    error VotingNotActive();
    error InvalidArbitratorCount();

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------
    enum ArbitrationStatus {
        NONE,
        PENDING,
        VOTING,
        RESOLVED
    }

    enum Decision {
        NONE,
        UPHOLD,
        REJECT
    }

    struct Arbitration {
        uint256 disputeId;
        address market;
        uint256 createdAt;
        ArbitrationStatus status;
        Decision finalDecision;
        uint256 resolvedAt;
        address[] arbitrators;
        uint256 upholdVotes;
        uint256 rejectVotes;
    }

    struct Vote {
        address arbitrator;
        Decision decision;
        uint256 timestamp;
        string reasoning;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event ArbitrationCreated(
        uint256 indexed arbitrationId,
        uint256 indexed disputeId,
        address indexed market,
        address[] arbitrators
    );
    event ArbitratorVoted(
        uint256 indexed arbitrationId,
        address indexed arbitrator,
        Decision decision
    );
    event ArbitrationResolved(
        uint256 indexed arbitrationId,
        Decision finalDecision
    );
    event ArbitrationStatusChanged(
        uint256 indexed arbitrationId,
        ArbitrationStatus newStatus
    );

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------
    address public immutable admin;
    uint256 public arbitrationCount;
    uint256 public constant MIN_ARBITRATORS = 3;
    uint256 public constant MAX_ARBITRATORS = 11;

    mapping(uint256 => Arbitration) public arbitrations;
    mapping(uint256 => Vote[]) public arbitrationVotes;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => uint256) public disputeToArbitration;
    mapping(address => bool) public approvedArbitrators;
    mapping(address => uint256[]) public arbitratorAssignments;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(address _admin) {
        admin = _admin;
    }

    // -------------------------------------------------------------------------
    // External functions
    // -------------------------------------------------------------------------

    /// @notice Approve an arbitrator
    /// @param arbitrator The arbitrator address
    function approveArbitrator(address arbitrator) external {
        if (msg.sender != admin) revert NotAuthorized();
        approvedArbitrators[arbitrator] = true;
    }

    /// @notice Revoke arbitrator approval
    /// @param arbitrator The arbitrator address
    function revokeArbitrator(address arbitrator) external {
        if (msg.sender != admin) revert NotAuthorized();
        approvedArbitrators[arbitrator] = false;
    }

    /// @notice Create a new arbitration for a dispute
    /// @param disputeId The dispute ID
    /// @param market The market address
    /// @param arbitrators Array of selected arbitrators
    /// @return arbitrationId The created arbitration ID
    function createArbitration(
        uint256 disputeId,
        address market,
        address[] calldata arbitrators
    ) external returns (uint256 arbitrationId) {
        if (msg.sender != admin) revert NotAuthorized();
        if (arbitrators.length < MIN_ARBITRATORS || arbitrators.length > MAX_ARBITRATORS) {
            revert InvalidArbitratorCount();
        }

        // Verify all arbitrators are approved
        for (uint256 i = 0; i < arbitrators.length; i++) {
            require(approvedArbitrators[arbitrators[i]], "Arbitrator not approved");
        }

        arbitrationId = ++arbitrationCount;

        arbitrations[arbitrationId] = Arbitration({
            disputeId: disputeId,
            market: market,
            createdAt: block.timestamp,
            status: ArbitrationStatus.PENDING,
            finalDecision: Decision.NONE,
            resolvedAt: 0,
            arbitrators: arbitrators,
            upholdVotes: 0,
            rejectVotes: 0
        });

        disputeToArbitration[disputeId] = arbitrationId;

        // Track assignments
        for (uint256 i = 0; i < arbitrators.length; i++) {
            arbitratorAssignments[arbitrators[i]].push(arbitrationId);
        }

        emit ArbitrationCreated(arbitrationId, disputeId, market, arbitrators);
    }

    /// @notice Start voting phase
    /// @param arbitrationId The arbitration ID
    function startVoting(uint256 arbitrationId) external {
        if (msg.sender != admin) revert NotAuthorized();
        
        Arbitration storage arb = arbitrations[arbitrationId];
        if (arb.createdAt == 0) revert ArbitrationNotFound();
        if (arb.status != ArbitrationStatus.PENDING) revert ArbitrationAlreadyResolved();

        arb.status = ArbitrationStatus.VOTING;
        emit ArbitrationStatusChanged(arbitrationId, ArbitrationStatus.VOTING);
    }

    /// @notice Submit a vote as an arbitrator
    /// @param arbitrationId The arbitration ID
    /// @param decision The vote decision
    /// @param reasoning Optional reasoning for the vote
    function vote(
        uint256 arbitrationId,
        Decision decision,
        string calldata reasoning
    ) external {
        Arbitration storage arb = arbitrations[arbitrationId];
        if (arb.createdAt == 0) revert ArbitrationNotFound();
        if (arb.status != ArbitrationStatus.VOTING) revert VotingNotActive();
        if (!_isArbitrator(arbitrationId, msg.sender)) revert NotArbitrator();
        if (hasVoted[arbitrationId][msg.sender]) revert AlreadyVoted();
        require(decision != Decision.NONE, "Invalid decision");

        hasVoted[arbitrationId][msg.sender] = true;

        arbitrationVotes[arbitrationId].push(Vote({
            arbitrator: msg.sender,
            decision: decision,
            timestamp: block.timestamp,
            reasoning: reasoning
        }));

        if (decision == Decision.UPHOLD) {
            arb.upholdVotes++;
        } else {
            arb.rejectVotes++;
        }

        emit ArbitratorVoted(arbitrationId, msg.sender, decision);

        // Auto-resolve if all arbitrators have voted
        if (arb.upholdVotes + arb.rejectVotes == arb.arbitrators.length) {
            _resolveArbitration(arbitrationId);
        }
    }

    /// @notice Manually resolve arbitration (admin only, for edge cases)
    /// @param arbitrationId The arbitration ID
    function manualResolve(uint256 arbitrationId) external {
        if (msg.sender != admin) revert NotAuthorized();
        _resolveArbitration(arbitrationId);
    }

    // -------------------------------------------------------------------------
    // Internal functions
    // -------------------------------------------------------------------------

    function _isArbitrator(uint256 arbitrationId, address account) internal view returns (bool) {
        address[] memory arbitrators = arbitrations[arbitrationId].arbitrators;
        for (uint256 i = 0; i < arbitrators.length; i++) {
            if (arbitrators[i] == account) return true;
        }
        return false;
    }

    function _resolveArbitration(uint256 arbitrationId) internal {
        Arbitration storage arb = arbitrations[arbitrationId];
        if (arb.status == ArbitrationStatus.RESOLVED) revert ArbitrationAlreadyResolved();

        Decision finalDecision = arb.upholdVotes > arb.rejectVotes 
            ? Decision.UPHOLD 
            : Decision.REJECT;

        arb.finalDecision = finalDecision;
        arb.status = ArbitrationStatus.RESOLVED;
        arb.resolvedAt = block.timestamp;

        emit ArbitrationResolved(arbitrationId, finalDecision);
    }

    // -------------------------------------------------------------------------
    // View functions
    // -------------------------------------------------------------------------

    /// @notice Get arbitration details
    /// @param arbitrationId The arbitration ID
    /// @return arbitration The arbitration struct
    function getArbitration(uint256 arbitrationId) 
        external 
        view 
        returns (Arbitration memory) 
    {
        return arbitrations[arbitrationId];
    }

    /// @notice Get all votes for an arbitration
    /// @param arbitrationId The arbitration ID
    /// @return votes Array of votes
    function getVotes(uint256 arbitrationId) external view returns (Vote[] memory) {
        return arbitrationVotes[arbitrationId];
    }

    /// @notice Get arbitration ID for a dispute
    /// @param disputeId The dispute ID
    /// @return arbitrationId The arbitration ID
    function getArbitrationForDispute(uint256 disputeId) 
        external 
        view 
        returns (uint256) 
    {
        return disputeToArbitration[disputeId];
    }

    /// @notice Get all arbitrations assigned to an arbitrator
    /// @param arbitrator The arbitrator address
    /// @return arbitrationIds Array of arbitration IDs
    function getArbitratorAssignments(address arbitrator) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return arbitratorAssignments[arbitrator];
    }

    /// @notice Check if address is approved arbitrator
    /// @param arbitrator The arbitrator address
    /// @return approved True if approved
    function isApprovedArbitrator(address arbitrator) external view returns (bool) {
        return approvedArbitrators[arbitrator];
    }

    /// @notice Get arbitration status
    /// @param arbitrationId The arbitration ID
    /// @return status The current status
    function getStatus(uint256 arbitrationId) external view returns (ArbitrationStatus) {
        return arbitrations[arbitrationId].status;
    }

    /// @notice Get vote counts
    /// @param arbitrationId The arbitration ID
    /// @return upholdVotes Number of uphold votes
    /// @return rejectVotes Number of reject votes
    function getVoteCounts(uint256 arbitrationId) 
        external 
        view 
        returns (uint256 upholdVotes, uint256 rejectVotes) 
    {
        Arbitration memory arb = arbitrations[arbitrationId];
        return (arb.upholdVotes, arb.rejectVotes);
    }
}

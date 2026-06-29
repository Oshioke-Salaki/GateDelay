// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ProposalExecutor
/// @notice Executes governance proposals with approval validation and timelock support.
contract ProposalExecutor {
    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error ProposalNotApproved();
    error ProposalAlreadyExecuted();
    error ProposalNotFound();
    error ExecutionFailed();
    error TimelockNotReady();
    error InvalidProposal();

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------
    enum ProposalStatus { PENDING, APPROVED, EXECUTED, FAILED, CANCELLED }

    struct Proposal {
        uint256 id;
        address proposer;
        bytes[] actions;
        address[] targets;
        uint256[] values;
        string description;
        uint256 approvalCount;
        uint256 executedAt;
        ProposalStatus status;
        uint256 timelockUntil;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string description);
    event ProposalApproved(uint256 indexed proposalId, uint256 approvalCount);
    event ProposalExecuted(uint256 indexed proposalId, address indexed executor);
    event ProposalExecutionFailed(uint256 indexed proposalId, string reason);
    event ProposalCancelled(uint256 indexed proposalId);

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    mapping(uint256 => Proposal) public proposals;
    uint256 public proposalCount;
    uint256 public timelockDelay;
    address public admin;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(uint256 _timelockDelay) {
        timelockDelay = _timelockDelay;
        admin = msg.sender;
    }

    // -------------------------------------------------------------------------
    // External functions
    // -------------------------------------------------------------------------

    /// @notice Create a new proposal.
    /// @param targets Array of target addresses for execution.
    /// @param values Array of ETH values to send with each action.
    /// @param actions Array of encoded function calls.
    /// @param description Description of the proposal.
    /// @return proposalId The ID of the created proposal.
    function createProposal(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata actions,
        string calldata description
    ) external returns (uint256 proposalId) {
        if (targets.length == 0 || targets.length != values.length || targets.length != actions.length) {
            revert InvalidProposal();
        }

        proposalId = proposalCount++;

        proposals[proposalId] = Proposal({
            id: proposalId,
            proposer: msg.sender,
            actions: actions,
            targets: targets,
            values: values,
            description: description,
            approvalCount: 0,
            executedAt: 0,
            status: ProposalStatus.PENDING,
            timelockUntil: block.timestamp + timelockDelay
        });

        emit ProposalCreated(proposalId, msg.sender, description);
    }

    /// @notice Approve a proposal.
    /// @param proposalId The ID of the proposal to approve.
    function approveProposal(uint256 proposalId) external {
        if (proposalId >= proposalCount) revert ProposalNotFound();

        Proposal storage proposal = proposals[proposalId];
        if (proposal.status != ProposalStatus.PENDING) revert InvalidProposal();

        proposal.approvalCount++;
        proposal.status = ProposalStatus.APPROVED;

        emit ProposalApproved(proposalId, proposal.approvalCount);
    }

    /// @notice Execute an approved proposal.
    /// @param proposalId The ID of the proposal to execute.
    function executeProposal(uint256 proposalId) external {
        if (proposalId >= proposalCount) revert ProposalNotFound();

        Proposal storage proposal = proposals[proposalId];

        if (proposal.status != ProposalStatus.APPROVED) revert ProposalNotApproved();
        if (proposal.executedAt != 0) revert ProposalAlreadyExecuted();
        if (block.timestamp < proposal.timelockUntil) revert TimelockNotReady();

        proposal.status = ProposalStatus.EXECUTED;
        proposal.executedAt = block.timestamp;

        // Execute all actions
        for (uint256 i = 0; i < proposal.targets.length; i++) {
            (bool success,) = proposal.targets[i].call{value: proposal.values[i]}(proposal.actions[i]);

            if (!success) {
                proposal.status = ProposalStatus.FAILED;
                emit ProposalExecutionFailed(proposalId, "Action execution failed");
                revert ExecutionFailed();
            }
        }

        emit ProposalExecuted(proposalId, msg.sender);
    }

    /// @notice Cancel a proposal.
    /// @param proposalId The ID of the proposal to cancel.
    function cancelProposal(uint256 proposalId) external {
        if (msg.sender != admin) revert();
        if (proposalId >= proposalCount) revert ProposalNotFound();

        Proposal storage proposal = proposals[proposalId];
        proposal.status = ProposalStatus.CANCELLED;

        emit ProposalCancelled(proposalId);
    }

    /// @notice Get proposal details.
    /// @param proposalId The ID of the proposal.
    /// @return proposal The proposal struct.
    function getProposal(uint256 proposalId) external view returns (Proposal memory proposal) {
        if (proposalId >= proposalCount) revert ProposalNotFound();
        return proposals[proposalId];
    }

    /// @notice Track execution status of a proposal.
    /// @param proposalId The ID of the proposal.
    /// @return status The current status of the proposal.
    /// @return executedAt The timestamp when the proposal was executed (0 if not executed).
    function getExecutionStatus(uint256 proposalId)
        external
        view
        returns (ProposalStatus status, uint256 executedAt)
    {
        if (proposalId >= proposalCount) revert ProposalNotFound();
        Proposal storage proposal = proposals[proposalId];
        return (proposal.status, proposal.executedAt);
    }

    /// @notice Check if timelock is ready for a proposal.
    /// @param proposalId The ID of the proposal.
    /// @return ready True if timelock delay has passed.
    function isTimelockReady(uint256 proposalId) external view returns (bool ready) {
        if (proposalId >= proposalCount) revert ProposalNotFound();
        return block.timestamp >= proposals[proposalId].timelockUntil;
    }
}

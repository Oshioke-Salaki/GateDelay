// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Voting} from "./Voting.sol";

/// @title Governance
/// @notice Manages the full lifecycle of governance proposals: creation, voting, execution, and history.
contract Governance is Ownable, ReentrancyGuard {
    // ── Errors ─────────────────────────────────────────────────────────────────
    error ZeroAddress();
    error ProposalNotFound();
    error ProposalNotPassed();
    error ProposalAlreadyExecuted();
    error VotingStillActive();
    error ExecutionFailed();
    error InvalidDuration();
    error QuorumNotReached();
    error NotProposer();

    // ── Types ──────────────────────────────────────────────────────────────────

    enum ProposalState { PENDING, ACTIVE, DEFEATED, SUCCEEDED, EXECUTED, CANCELLED }

    struct ProposalMeta {
        uint256 votingProposalId;   // ID in the Voting contract
        address proposer;
        address target;             // contract to call on execution
        bytes   callData;           // encoded function call
        uint256 createdAt;
        uint256 executedAt;
        ProposalState state;
        string  description;
    }

    // ── Events ─────────────────────────────────────────────────────────────────
    event ProposalSubmitted(uint256 indexed proposalId, address indexed proposer, string description);
    event ProposalExecuted(uint256 indexed proposalId, address indexed executor);
    event ProposalCancelled(uint256 indexed proposalId);
    event QuorumUpdated(uint256 newQuorum);
    event VotingDurationUpdated(uint256 newDuration);

    // ── State ──────────────────────────────────────────────────────────────────

    Voting public immutable voting;

    uint256 public proposalCount;
    uint256 public quorum;          // minimum total votes (FOR + AGAINST + ABSTAIN) required
    uint256 public votingDuration;  // seconds

    /// @notice proposalId => ProposalMeta
    mapping(uint256 => ProposalMeta) public proposals;

    /// @notice Full history of all proposal IDs (including executed/cancelled)
    uint256[] public proposalHistory;

    // ── Constructor ────────────────────────────────────────────────────────────

    /// @param _voting          Address of the deployed Voting contract.
    /// @param _quorum          Minimum total votes for a proposal to be valid.
    /// @param _votingDuration  Default voting period in seconds.
    constructor(address _voting, uint256 _quorum, uint256 _votingDuration) Ownable(msg.sender) {
        if (_voting == address(0)) revert ZeroAddress();
        voting = Voting(_voting);
        quorum = _quorum;
        votingDuration = _votingDuration;
    }

    // ── Proposal lifecycle ─────────────────────────────────────────────────────

    /// @notice Submit a new governance proposal.
    /// @param description  Human-readable description.
    /// @param target       Contract address to call if proposal passes.
    /// @param callData     ABI-encoded call to execute on `target`.
    /// @return proposalId  The new proposal's ID.
    function propose(string calldata description, address target, bytes calldata callData)
        external
        returns (uint256 proposalId)
    {
        if (target == address(0)) revert ZeroAddress();

        proposalId = ++proposalCount;

        // Create the vote in the Voting contract
        uint256 votingId = voting.createProposal(description, votingDuration);

        proposals[proposalId] = ProposalMeta({
            votingProposalId: votingId,
            proposer: msg.sender,
            target: target,
            callData: callData,
            createdAt: block.timestamp,
            executedAt: 0,
            state: ProposalState.ACTIVE,
            description: description
        });

        proposalHistory.push(proposalId);

        emit ProposalSubmitted(proposalId, msg.sender, description);
    }

    /// @notice Finalise a proposal after voting ends and execute if it passed.
    /// @param proposalId  The governance proposal to execute.
    function execute(uint256 proposalId) external nonReentrant {
        ProposalMeta storage meta = proposals[proposalId];
        if (meta.proposer == address(0)) revert ProposalNotFound();
        if (meta.state == ProposalState.EXECUTED) revert ProposalAlreadyExecuted();
        if (meta.state != ProposalState.ACTIVE) revert ProposalNotPassed();

        Voting.Proposal memory vp = voting.getProposal(meta.votingProposalId);
        if (block.timestamp <= vp.endTime) revert VotingStillActive();

        uint256 totalVotes = vp.forVotes + vp.againstVotes + vp.abstainVotes;
        if (totalVotes < quorum) {
            meta.state = ProposalState.DEFEATED;
            revert QuorumNotReached();
        }

        if (vp.forVotes <= vp.againstVotes) {
            meta.state = ProposalState.DEFEATED;
            revert ProposalNotPassed();
        }

        meta.state = ProposalState.SUCCEEDED;

        // Close the vote
        voting.closeProposal(meta.votingProposalId);

        // Execute the proposal call
        (bool success,) = meta.target.call(meta.callData);
        if (!success) revert ExecutionFailed();

        meta.state = ProposalState.EXECUTED;
        meta.executedAt = block.timestamp;

        emit ProposalExecuted(proposalId, msg.sender);
    }

    /// @notice Cancel a proposal. Only the proposer or owner can cancel.
    function cancel(uint256 proposalId) external {
        ProposalMeta storage meta = proposals[proposalId];
        if (meta.proposer == address(0)) revert ProposalNotFound();
        if (msg.sender != meta.proposer && msg.sender != owner()) revert NotProposer();
        if (meta.state == ProposalState.EXECUTED) revert ProposalAlreadyExecuted();

        meta.state = ProposalState.CANCELLED;
        emit ProposalCancelled(proposalId);
    }

    // ── Admin ──────────────────────────────────────────────────────────────────

    function setQuorum(uint256 newQuorum) external onlyOwner {
        quorum = newQuorum;
        emit QuorumUpdated(newQuorum);
    }

    function setVotingDuration(uint256 newDuration) external onlyOwner {
        if (newDuration == 0) revert InvalidDuration();
        votingDuration = newDuration;
        emit VotingDurationUpdated(newDuration);
    }

    // ── Queries ────────────────────────────────────────────────────────────────

    /// @notice Returns the state of a proposal.
    function getProposalState(uint256 proposalId) external view returns (ProposalState) {
        return proposals[proposalId].state;
    }

    /// @notice Returns full proposal metadata.
    function getProposal(uint256 proposalId) external view returns (ProposalMeta memory) {
        return proposals[proposalId];
    }

    /// @notice Returns the full history of proposal IDs.
    function getProposalHistory() external view returns (uint256[] memory) {
        return proposalHistory;
    }

    /// @notice Returns the number of proposals ever created.
    function getProposalCount() external view returns (uint256) {
        return proposalCount;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {VoteWeight} from "./VoteWeight.sol";

/// @title VotingWithVoteWeight
/// @notice Enhanced voting contract that integrates with VoteWeight system
/// @dev Extends the original Voting contract with VoteWeight integration for advanced weight tracking
contract VotingWithVoteWeight is Ownable, ReentrancyGuard {
    // ── Errors ─────────────────────────────────────────────────────────────────
    error ZeroAddress();
    error ProposalNotActive();
    error AlreadyVoted();
    error VotingEnded();
    error VotingNotEnded();
    error InvalidProposal();
    error SelfDelegation();
    error DelegationLoop();
    error ZeroVotingPower();

    // ── Types ──────────────────────────────────────────────────────────────────

    enum VoteChoice { NONE, FOR, AGAINST, ABSTAIN }

    struct Proposal {
        uint256 id;
        string  description;
        uint256 startTime;
        uint256 endTime;
        uint256 snapshotId;      // VoteWeight snapshot for this proposal
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        bool    active;
    }

    struct VoteRecord {
        VoteChoice choice;
        uint256    weight;
    }

    // ── Events ─────────────────────────────────────────────────────────────────
    event ProposalCreated(
        uint256 indexed proposalId,
        string description,
        uint256 startTime,
        uint256 endTime,
        uint256 snapshotId
    );
    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        VoteChoice choice,
        uint256 weight
    );
    event DelegateChanged(
        address indexed delegator,
        address indexed fromDelegate,
        address indexed toDelegate
    );
    event ProposalClosed(uint256 indexed proposalId);
    event VoteWeightUpdated(address indexed newVoteWeight);

    // ── State ──────────────────────────────────────────────────────────────────

    /// @notice The governance token used to calculate voting power
    IERC20 public immutable governanceToken;

    /// @notice The VoteWeight contract for advanced weight tracking
    VoteWeight public voteWeight;

    uint256 public proposalCount;

    /// @notice proposalId => Proposal
    mapping(uint256 => Proposal) public proposals;

    /// @notice proposalId => voter => VoteRecord
    mapping(uint256 => mapping(address => VoteRecord)) public votes;

    // ── Constructor ────────────────────────────────────────────────────────────

    /// @param _governanceToken Address of the governance token
    /// @param _voteWeight Address of the VoteWeight contract
    constructor(address _governanceToken, address _voteWeight) Ownable(msg.sender) {
        if (_governanceToken == address(0)) revert ZeroAddress();
        if (_voteWeight == address(0)) revert ZeroAddress();
        
        governanceToken = IERC20(_governanceToken);
        voteWeight = VoteWeight(_voteWeight);
    }

    // ── Proposal management ────────────────────────────────────────────────────

    /// @notice Create a new voting proposal with automatic snapshot
    /// @param description  Human-readable description of the proposal
    /// @param duration     Voting period in seconds
    /// @return proposalId  The new proposal's ID
    function createProposal(string calldata description, uint256 duration)
        external
        onlyOwner
        returns (uint256 proposalId)
    {
        // Update weights for all tracked accounts before snapshot
        address[] memory trackedAccounts = voteWeight.getTrackedAccounts();
        for (uint256 i = 0; i < trackedAccounts.length; i++) {
            try voteWeight.updateWeight(trackedAccounts[i]) {} catch {}
        }

        // Create snapshot for this proposal
        uint256 snapshotId = voteWeight.createSnapshot();

        proposalId = ++proposalCount;
        proposals[proposalId] = Proposal({
            id: proposalId,
            description: description,
            startTime: block.timestamp,
            endTime: block.timestamp + duration,
            snapshotId: snapshotId,
            forVotes: 0,
            againstVotes: 0,
            abstainVotes: 0,
            active: true
        });

        emit ProposalCreated(
            proposalId,
            description,
            block.timestamp,
            block.timestamp + duration,
            snapshotId
        );
    }

    /// @notice Close a proposal after voting ends
    function closeProposal(uint256 proposalId) external onlyOwner {
        Proposal storage p = proposals[proposalId];
        if (!p.active) revert InvalidProposal();
        if (block.timestamp < p.endTime) revert VotingNotEnded();
        p.active = false;
        emit ProposalClosed(proposalId);
    }

    // ── Voting ─────────────────────────────────────────────────────────────────

    /// @notice Cast a vote on a proposal using snapshot weight
    /// @param proposalId  The proposal to vote on
    /// @param choice      FOR, AGAINST, or ABSTAIN
    function castVote(uint256 proposalId, VoteChoice choice) external nonReentrant {
        Proposal storage p = proposals[proposalId];
        if (!p.active) revert ProposalNotActive();
        if (block.timestamp > p.endTime) revert VotingEnded();
        if (votes[proposalId][msg.sender].choice != VoteChoice.NONE) revert AlreadyVoted();

        // Get weight from snapshot (prevents vote buying after proposal creation)
        uint256 weight = voteWeight.getWeightAtSnapshot(p.snapshotId, msg.sender);
        if (weight == 0) revert ZeroVotingPower();

        votes[proposalId][msg.sender] = VoteRecord({choice: choice, weight: weight});

        if (choice == VoteChoice.FOR) {
            p.forVotes += weight;
        } else if (choice == VoteChoice.AGAINST) {
            p.againstVotes += weight;
        } else {
            p.abstainVotes += weight;
        }

        emit VoteCast(proposalId, msg.sender, choice, weight);
    }

    // ── Delegation ─────────────────────────────────────────────────────────────

    /// @notice Delegate your voting power through VoteWeight system
    /// @param delegatee  Address to delegate to
    function delegate(address delegatee) external {
        if (delegatee == msg.sender) revert SelfDelegation();
        if (delegatee == address(0)) revert ZeroAddress();

        // Update weights before delegation
        voteWeight.updateWeight(msg.sender);
        voteWeight.updateWeight(delegatee);

        // Get old delegatee
        address oldDelegatee = voteWeight.getDelegatee(msg.sender);

        // Delegate through VoteWeight
        voteWeight.delegate(delegatee);

        emit DelegateChanged(msg.sender, oldDelegatee, delegatee);
    }

    /// @notice Remove delegation through VoteWeight system
    function undelegate() external {
        address oldDelegatee = voteWeight.getDelegatee(msg.sender);
        if (oldDelegatee == address(0)) revert ZeroAddress();

        voteWeight.undelegate();

        emit DelegateChanged(msg.sender, oldDelegatee, address(0));
    }

    // ── Queries ────────────────────────────────────────────────────────────────

    /// @notice Returns the current voting power of an address
    /// @param account Address to query
    /// @return uint256 Current voting power
    function getVotingPower(address account) public view returns (uint256) {
        return voteWeight.getVotingWeight(account);
    }

    /// @notice Returns the voting power at a specific proposal's snapshot
    /// @param proposalId Proposal ID
    /// @param account Address to query
    /// @return uint256 Voting power at proposal snapshot
    function getVotingPowerAtProposal(uint256 proposalId, address account)
        external
        view
        returns (uint256)
    {
        Proposal storage p = proposals[proposalId];
        return voteWeight.getWeightAtSnapshot(p.snapshotId, account);
    }

    /// @notice Returns the vote record of a voter for a proposal
    function getVote(uint256 proposalId, address voter)
        external
        view
        returns (VoteRecord memory)
    {
        return votes[proposalId][voter];
    }

    /// @notice Returns the current tally for a proposal
    function getResults(uint256 proposalId)
        external
        view
        returns (uint256 forVotes, uint256 againstVotes, uint256 abstainVotes)
    {
        Proposal storage p = proposals[proposalId];
        return (p.forVotes, p.againstVotes, p.abstainVotes);
    }

    /// @notice Returns full proposal data
    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        return proposals[proposalId];
    }

    /// @notice Returns detailed weight breakdown for an account
    function getWeightBreakdown(address account)
        external
        view
        returns (uint256 base, uint256 received, uint256 given, uint256 total)
    {
        return voteWeight.getWeightBreakdown(account);
    }

    /// @notice Returns delegation info for an account
    function getDelegationInfo(address account)
        external
        view
        returns (VoteWeight.DelegationInfo memory)
    {
        return voteWeight.getDelegationInfo(account);
    }

    /// @notice Returns all delegators for a delegatee
    function getDelegators(address delegatee) external view returns (address[] memory) {
        return voteWeight.getDelegators(delegatee);
    }

    /// @notice Returns weight change history for an account
    function getWeightChangeHistory(address account)
        external
        view
        returns (VoteWeight.WeightChange[] memory)
    {
        return voteWeight.getWeightChangeHistory(account);
    }

    /// @notice Check if an account has delegated
    function hasDelegated(address account) external view returns (bool) {
        return voteWeight.hasDelegated(account);
    }

    /// @notice Get the delegatee for an account
    function getDelegatee(address account) external view returns (address) {
        return voteWeight.getDelegatee(account);
    }

    // ── Admin ──────────────────────────────────────────────────────────────────

    /// @notice Update the VoteWeight contract address (owner only)
    /// @param newVoteWeight Address of new VoteWeight contract
    function setVoteWeight(address newVoteWeight) external onlyOwner {
        if (newVoteWeight == address(0)) revert ZeroAddress();
        voteWeight = VoteWeight(newVoteWeight);
        emit VoteWeightUpdated(newVoteWeight);
    }

    /// @notice Batch update weights for multiple accounts
    /// @param accounts Array of accounts to update
    function batchUpdateWeights(address[] calldata accounts) external {
        voteWeight.batchUpdateWeights(accounts);
    }
}

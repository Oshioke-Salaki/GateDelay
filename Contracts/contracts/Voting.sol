// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Voting
/// @notice Token-weighted voting with delegation support for governance proposals.
contract Voting is Ownable, ReentrancyGuard {
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
    event ProposalCreated(uint256 indexed proposalId, string description, uint256 startTime, uint256 endTime);
    event VoteCast(uint256 indexed proposalId, address indexed voter, VoteChoice choice, uint256 weight);
    event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);
    event ProposalClosed(uint256 indexed proposalId);

    // ── State ──────────────────────────────────────────────────────────────────

    /// @notice The governance token used to calculate voting power
    IERC20 public immutable governanceToken;

    uint256 public proposalCount;

    /// @notice proposalId => Proposal
    mapping(uint256 => Proposal) public proposals;

    /// @notice proposalId => voter => VoteRecord
    mapping(uint256 => mapping(address => VoteRecord)) public votes;

    /// @notice delegator => delegate
    mapping(address => address) public delegates;

    /// @notice delegate => total delegated power
    mapping(address => uint256) public delegatedPower;

    // ── Constructor ────────────────────────────────────────────────────────────

    constructor(address _governanceToken) Ownable(msg.sender) {
        if (_governanceToken == address(0)) revert ZeroAddress();
        governanceToken = IERC20(_governanceToken);
    }

    // ── Proposal management ────────────────────────────────────────────────────

    /// @notice Create a new voting proposal. Only owner (Governance contract) can call.
    /// @param description  Human-readable description of the proposal.
    /// @param duration     Voting period in seconds.
    /// @return proposalId  The new proposal's ID.
    function createProposal(string calldata description, uint256 duration)
        external
        onlyOwner
        returns (uint256 proposalId)
    {
        proposalId = ++proposalCount;
        proposals[proposalId] = Proposal({
            id: proposalId,
            description: description,
            startTime: block.timestamp,
            endTime: block.timestamp + duration,
            forVotes: 0,
            againstVotes: 0,
            abstainVotes: 0,
            active: true
        });
        emit ProposalCreated(proposalId, description, block.timestamp, block.timestamp + duration);
    }

    /// @notice Close a proposal after voting ends.
    function closeProposal(uint256 proposalId) external onlyOwner {
        Proposal storage p = proposals[proposalId];
        if (!p.active) revert InvalidProposal();
        if (block.timestamp < p.endTime) revert VotingNotEnded();
        p.active = false;
        emit ProposalClosed(proposalId);
    }

    // ── Voting ─────────────────────────────────────────────────────────────────

    /// @notice Cast a vote on a proposal.
    /// @param proposalId  The proposal to vote on.
    /// @param choice      FOR, AGAINST, or ABSTAIN.
    function castVote(uint256 proposalId, VoteChoice choice) external nonReentrant {
        Proposal storage p = proposals[proposalId];
        if (!p.active) revert ProposalNotActive();
        if (block.timestamp > p.endTime) revert VotingEnded();
        if (votes[proposalId][msg.sender].choice != VoteChoice.NONE) revert AlreadyVoted();

        uint256 weight = getVotingPower(msg.sender);
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

    /// @notice Delegate your voting power to another address.
    /// @param delegatee  Address to delegate to. Pass address(0) to remove delegation.
    function delegate(address delegatee) external {
        if (delegatee == msg.sender) revert SelfDelegation();

        address current = delegates[msg.sender];

        // Remove power from old delegate
        if (current != address(0)) {
            uint256 power = governanceToken.balanceOf(msg.sender);
            if (delegatedPower[current] >= power) {
                delegatedPower[current] -= power;
            }
        }

        delegates[msg.sender] = delegatee;

        // Add power to new delegate
        if (delegatee != address(0)) {
            // Simple loop-prevention: delegatee must not delegate back to msg.sender
            if (delegates[delegatee] == msg.sender) revert DelegationLoop();
            delegatedPower[delegatee] += governanceToken.balanceOf(msg.sender);
        }

        emit DelegateChanged(msg.sender, current, delegatee);
    }

    // ── Queries ────────────────────────────────────────────────────────────────

    /// @notice Returns the effective voting power of an address (own balance + delegated).
    function getVotingPower(address account) public view returns (uint256) {
        uint256 own = delegates[account] == address(0) ? governanceToken.balanceOf(account) : 0;
        return own + delegatedPower[account];
    }

    /// @notice Returns the vote record of a voter for a proposal.
    function getVote(uint256 proposalId, address voter) external view returns (VoteRecord memory) {
        return votes[proposalId][voter];
    }

    /// @notice Returns the current tally for a proposal.
    function getResults(uint256 proposalId)
        external
        view
        returns (uint256 forVotes, uint256 againstVotes, uint256 abstainVotes)
    {
        Proposal storage p = proposals[proposalId];
        return (p.forVotes, p.againstVotes, p.abstainVotes);
    }

    /// @notice Returns full proposal data.
    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        return proposals[proposalId];
    }
}

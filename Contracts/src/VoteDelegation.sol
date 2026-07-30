// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title VoteDelegation
/// @notice Advanced vote delegation system with full chain tracking and power calculation.
/// @dev Handles multi-level delegation chains, prevents loops, and provides comprehensive queries.
contract VoteDelegation is Ownable, ReentrancyGuard {
    // ── Errors ─────────────────────────────────────────────────────────────────
    error ZeroAddress();
    error SelfDelegation();
    error DelegationLoop();
    error MaxChainDepthExceeded();
    error InvalidCheckpoint();
    error NoActiveDelegation();

    // ── Types ──────────────────────────────────────────────────────────────────

    /// @notice Represents a single delegation record
    struct Delegation {
        address delegatee;      // Address receiving the delegation
        uint256 timestamp;      // When delegation was made
        bool active;            // Whether delegation is currently active
    }

    /// @notice Checkpoint for historical voting power tracking
    struct Checkpoint {
        uint256 fromBlock;
        uint256 votingPower;
    }

    /// @notice Delegation chain information
    struct DelegationChain {
        address[] chain;        // Full chain from delegator to final delegatee
        uint256 depth;          // Length of the chain
        uint256 totalPower;     // Total voting power at end of chain
    }

    // ── Events ─────────────────────────────────────────────────────────────────
    event DelegationCreated(
        address indexed delegator,
        address indexed delegatee,
        uint256 timestamp
    );
    
    event DelegationRemoved(
        address indexed delegator,
        address indexed previousDelegatee,
        uint256 timestamp
    );
    
    event DelegationChanged(
        address indexed delegator,
        address indexed fromDelegatee,
        address indexed toDelegatee,
        uint256 timestamp
    );
    
    event VotingPowerUpdated(
        address indexed account,
        uint256 previousPower,
        uint256 newPower
    );

    // ── Constants ──────────────────────────────────────────────────────────────
    
    /// @notice Maximum allowed delegation chain depth to prevent gas issues
    uint256 public constant MAX_CHAIN_DEPTH = 10;

    // ── State ──────────────────────────────────────────────────────────────────

    /// @notice The governance token used for voting power calculation
    IERC20 public immutable governanceToken;

    /// @notice Maps delegator to their current delegation
    mapping(address => Delegation) public delegations;

    /// @notice Maps delegatee to total power delegated to them
    mapping(address => uint256) public delegatedPower;

    /// @notice Maps delegatee to list of all delegators
    mapping(address => address[]) public delegators;

    /// @notice Maps delegator to their delegation history
    mapping(address => Delegation[]) public delegationHistory;

    /// @notice Maps account to their voting power checkpoints
    mapping(address => Checkpoint[]) public checkpoints;

    /// @notice Tracks total number of active delegations
    uint256 public totalActiveDelegations;

    // ── Constructor ────────────────────────────────────────────────────────────

    /// @param _governanceToken Address of the governance token
    constructor(address _governanceToken) Ownable(msg.sender) {
        if (_governanceToken == address(0)) revert ZeroAddress();
        governanceToken = IERC20(_governanceToken);
    }

    // ── Delegation Management ──────────────────────────────────────────────────

    /// @notice Delegate voting power to another address
    /// @param delegatee Address to delegate to
    function delegate(address delegatee) external nonReentrant {
        if (delegatee == address(0)) revert ZeroAddress();
        if (delegatee == msg.sender) revert SelfDelegation();

        // Check for delegation loops
        _checkDelegationLoop(msg.sender, delegatee);

        // Check chain depth
        uint256 chainDepth = _getChainDepth(delegatee);
        if (chainDepth >= MAX_CHAIN_DEPTH) revert MaxChainDepthExceeded();

        Delegation storage currentDelegation = delegations[msg.sender];
        address previousDelegatee = currentDelegation.delegatee;
        uint256 delegatorPower = governanceToken.balanceOf(msg.sender);
        bool isChangingDelegation = currentDelegation.active;

        // Remove previous delegation if exists
        if (isChangingDelegation) {
            _removeDelegation(msg.sender, previousDelegatee, delegatorPower);
        }

        // Create new delegation
        currentDelegation.delegatee = delegatee;
        currentDelegation.timestamp = block.timestamp;
        currentDelegation.active = true;

        // Update delegated power
        delegatedPower[delegatee] += delegatorPower;
        delegators[delegatee].push(msg.sender);
        
        // Only increment if this is a new delegation, not a change
        if (!isChangingDelegation) {
            totalActiveDelegations++;
        }

        // Add to history
        delegationHistory[msg.sender].push(Delegation({
            delegatee: delegatee,
            timestamp: block.timestamp,
            active: true
        }));

        // Update checkpoints
        _updateCheckpoint(delegatee);
        _updateCheckpoint(msg.sender);

        if (previousDelegatee != address(0)) {
            emit DelegationChanged(msg.sender, previousDelegatee, delegatee, block.timestamp);
        } else {
            emit DelegationCreated(msg.sender, delegatee, block.timestamp);
        }

        emit VotingPowerUpdated(delegatee, delegatedPower[delegatee] - delegatorPower, delegatedPower[delegatee]);
    }

    /// @notice Remove current delegation and reclaim voting power
    function undelegate() external nonReentrant {
        Delegation storage currentDelegation = delegations[msg.sender];
        if (!currentDelegation.active) revert NoActiveDelegation();

        address previousDelegatee = currentDelegation.delegatee;
        uint256 delegatorPower = governanceToken.balanceOf(msg.sender);

        _removeDelegation(msg.sender, previousDelegatee, delegatorPower);

        currentDelegation.active = false;
        totalActiveDelegations--;

        // Update history
        uint256 historyLength = delegationHistory[msg.sender].length;
        if (historyLength > 0) {
            delegationHistory[msg.sender][historyLength - 1].active = false;
        }

        // Update checkpoints
        _updateCheckpoint(previousDelegatee);
        _updateCheckpoint(msg.sender);

        emit DelegationRemoved(msg.sender, previousDelegatee, block.timestamp);
        emit VotingPowerUpdated(msg.sender, 0, delegatorPower);
    }

    // ── Internal Functions ─────────────────────────────────────────────────────

    /// @notice Internal function to remove a delegation
    function _removeDelegation(address delegator, address delegatee, uint256 power) internal {
        if (delegatedPower[delegatee] >= power) {
            delegatedPower[delegatee] -= power;
        }

        // Remove from delegators array
        address[] storage dels = delegators[delegatee];
        for (uint256 i = 0; i < dels.length; i++) {
            if (dels[i] == delegator) {
                dels[i] = dels[dels.length - 1];
                dels.pop();
                break;
            }
        }

        emit VotingPowerUpdated(delegatee, delegatedPower[delegatee] + power, delegatedPower[delegatee]);
    }

    /// @notice Check if delegation would create a loop
    function _checkDelegationLoop(address delegator, address delegatee) internal view {
        address current = delegatee;
        uint256 depth = 0;

        while (delegations[current].active && depth < MAX_CHAIN_DEPTH) {
            current = delegations[current].delegatee;
            if (current == delegator) revert DelegationLoop();
            depth++;
        }
    }

    /// @notice Get the depth of a delegation chain
    function _getChainDepth(address account) internal view returns (uint256 depth) {
        address current = account;
        depth = 0;

        while (delegations[current].active && depth < MAX_CHAIN_DEPTH) {
            current = delegations[current].delegatee;
            depth++;
        }
    }

    /// @notice Update voting power checkpoint for an account
    function _updateCheckpoint(address account) internal {
        uint256 power = getVotingPower(account);
        Checkpoint[] storage accountCheckpoints = checkpoints[account];

        if (accountCheckpoints.length > 0 && 
            accountCheckpoints[accountCheckpoints.length - 1].fromBlock == block.number) {
            // Update existing checkpoint in same block
            accountCheckpoints[accountCheckpoints.length - 1].votingPower = power;
        } else {
            // Create new checkpoint
            accountCheckpoints.push(Checkpoint({
                fromBlock: block.number,
                votingPower: power
            }));
        }
    }

    // ── Voting Power Calculation ───────────────────────────────────────────────

    /// @notice Get the current voting power of an account
    /// @param account Address to check
    /// @return Total voting power (own balance + delegated power if not delegating)
    function getVotingPower(address account) public view returns (uint256) {
        uint256 ownBalance = governanceToken.balanceOf(account);
        
        // If account has delegated their power, they have no voting power
        if (delegations[account].active) {
            return delegatedPower[account];
        }
        
        // Otherwise, they have their own balance plus any delegated power
        return ownBalance + delegatedPower[account];
    }

    /// @notice Get voting power at a specific block
    /// @param account Address to check
    /// @param blockNumber Block number to query
    /// @return Voting power at that block
    function getVotingPowerAt(address account, uint256 blockNumber) 
        external 
        view 
        returns (uint256) 
    {
        if (blockNumber >= block.number) revert InvalidCheckpoint();
        
        Checkpoint[] storage accountCheckpoints = checkpoints[account];
        if (accountCheckpoints.length == 0) {
            return 0;
        }

        // Binary search for the checkpoint
        uint256 lower = 0;
        uint256 upper = accountCheckpoints.length - 1;

        while (upper > lower) {
            uint256 center = upper - (upper - lower) / 2;
            Checkpoint memory cp = accountCheckpoints[center];
            
            if (cp.fromBlock == blockNumber) {
                return cp.votingPower;
            } else if (cp.fromBlock < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }

        return accountCheckpoints[lower].votingPower;
    }

    // ── Delegation Chain Queries ───────────────────────────────────────────────

    /// @notice Get the full delegation chain for an account
    /// @param account Address to trace
    /// @return chain Full delegation chain information
    function getDelegationChain(address account) 
        external 
        view 
        returns (DelegationChain memory chain) 
    {
        address[] memory chainAddresses = new address[](MAX_CHAIN_DEPTH + 1);
        chainAddresses[0] = account;
        
        address current = account;
        uint256 depth = 0;

        while (delegations[current].active && depth < MAX_CHAIN_DEPTH) {
            current = delegations[current].delegatee;
            depth++;
            chainAddresses[depth] = current;
        }

        // Trim array to actual size
        address[] memory trimmedChain = new address[](depth + 1);
        for (uint256 i = 0; i <= depth; i++) {
            trimmedChain[i] = chainAddresses[i];
        }

        chain = DelegationChain({
            chain: trimmedChain,
            depth: depth,
            totalPower: getVotingPower(current)
        });
    }

    /// @notice Get the final delegatee in a chain (who actually votes)
    /// @param account Address to trace
    /// @return Final delegatee address
    function getFinalDelegatee(address account) external view returns (address) {
        address current = account;
        uint256 depth = 0;

        while (delegations[current].active && depth < MAX_CHAIN_DEPTH) {
            current = delegations[current].delegatee;
            depth++;
        }

        return current;
    }

    /// @notice Check if an account has an active delegation
    /// @param account Address to check
    /// @return True if account is currently delegating
    function hasActiveDelegation(address account) external view returns (bool) {
        return delegations[account].active;
    }

    /// @notice Get all delegators for a delegatee
    /// @param delegatee Address to check
    /// @return Array of delegator addresses
    function getDelegators(address delegatee) external view returns (address[] memory) {
        return delegators[delegatee];
    }

    /// @notice Get delegation history for an account
    /// @param account Address to check
    /// @return Array of historical delegations
    function getDelegationHistory(address account) 
        external 
        view 
        returns (Delegation[] memory) 
    {
        return delegationHistory[account];
    }

    /// @notice Get the number of checkpoints for an account
    /// @param account Address to check
    /// @return Number of checkpoints
    function getCheckpointCount(address account) external view returns (uint256) {
        return checkpoints[account].length;
    }

    /// @notice Get a specific checkpoint for an account
    /// @param account Address to check
    /// @param index Checkpoint index
    /// @return Checkpoint data
    function getCheckpoint(address account, uint256 index) 
        external 
        view 
        returns (Checkpoint memory) 
    {
        return checkpoints[account][index];
    }

    // ── Statistics ─────────────────────────────────────────────────────────────

    /// @notice Get total number of active delegations in the system
    /// @return Total active delegations
    function getTotalActiveDelegations() external view returns (uint256) {
        return totalActiveDelegations;
    }

    /// @notice Get total delegated power for an account
    /// @param account Address to check
    /// @return Total power delegated to this account
    function getTotalDelegatedPower(address account) external view returns (uint256) {
        return delegatedPower[account];
    }

    /// @notice Get the current delegation for an account
    /// @param account Address to check
    /// @return Current delegation struct
    function getCurrentDelegation(address account) 
        external 
        view 
        returns (Delegation memory) 
    {
        return delegations[account];
    }
}

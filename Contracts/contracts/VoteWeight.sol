// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title VoteWeight
/// @notice Advanced vote weight tracking system with delegation, snapshots, and historical queries
/// @dev Tracks voting weights, changes, delegations, and provides point-in-time snapshots
contract VoteWeight is Ownable, ReentrancyGuard {
    // ── Errors ─────────────────────────────────────────────────────────────────
    error ZeroAddress();
    error SelfDelegation();
    error DelegationLoop();
    error InvalidSnapshotId();
    error SnapshotNotFound();
    error InvalidBlockNumber();
    error NoWeightChange();
    error CircularDelegation();

    // ── Types ──────────────────────────────────────────────────────────────────

    /// @notice Represents a checkpoint of weight at a specific block
    struct Checkpoint {
        uint256 blockNumber;
        uint256 weight;
    }

    /// @notice Represents a weight change event
    struct WeightChange {
        uint256 timestamp;
        uint256 blockNumber;
        uint256 oldWeight;
        uint256 newWeight;
        int256 delta;
        ChangeReason reason;
    }

    /// @notice Reasons for weight changes
    enum ChangeReason {
        BALANCE_CHANGE,
        DELEGATION_RECEIVED,
        DELEGATION_REMOVED,
        DELEGATION_GIVEN,
        DELEGATION_REVOKED,
        SNAPSHOT_CREATED
    }

    /// @notice Snapshot of all weights at a specific point in time
    struct Snapshot {
        uint256 id;
        uint256 blockNumber;
        uint256 timestamp;
        mapping(address => uint256) weights;
        address[] accounts;
    }

    /// @notice Delegation information
    struct DelegationInfo {
        address delegatee;
        uint256 amount;
        uint256 timestamp;
        bool active;
    }

    // ── Events ─────────────────────────────────────────────────────────────────
    event WeightUpdated(
        address indexed account,
        uint256 oldWeight,
        uint256 newWeight,
        int256 delta,
        ChangeReason reason
    );
    event DelegationCreated(
        address indexed delegator,
        address indexed delegatee,
        uint256 amount,
        uint256 timestamp
    );
    event DelegationRemoved(
        address indexed delegator,
        address indexed delegatee,
        uint256 amount,
        uint256 timestamp
    );
    event DelegationChanged(
        address indexed delegator,
        address indexed oldDelegatee,
        address indexed newDelegatee,
        uint256 amount
    );
    event SnapshotCreated(uint256 indexed snapshotId, uint256 blockNumber, uint256 timestamp);
    event CheckpointCreated(address indexed account, uint256 blockNumber, uint256 weight);

    // ── State ──────────────────────────────────────────────────────────────────

    /// @notice The governance token used to calculate base voting power
    IERC20 public immutable governanceToken;

    /// @notice Current voting weight for each account (includes delegations)
    mapping(address => uint256) public currentWeight;

    /// @notice Base weight from token balance (excludes delegations)
    mapping(address => uint256) public baseWeight;

    /// @notice Delegated weight received from others
    mapping(address => uint256) public delegatedWeightReceived;

    /// @notice Delegated weight given to others
    mapping(address => uint256) public delegatedWeightGiven;

    /// @notice Current delegation: delegator => delegatee
    mapping(address => address) public currentDelegation;

    /// @notice Delegation details: delegator => DelegationInfo
    mapping(address => DelegationInfo) public delegationInfo;

    /// @notice All delegators for a delegatee: delegatee => delegators[]
    mapping(address => address[]) public delegators;

    /// @notice Historical checkpoints: account => Checkpoint[]
    mapping(address => Checkpoint[]) public checkpoints;

    /// @notice Weight change history: account => WeightChange[]
    mapping(address => WeightChange[]) public weightChangeHistory;

    /// @notice Snapshot storage: snapshotId => Snapshot
    mapping(uint256 => Snapshot) private snapshots;

    /// @notice Current snapshot ID counter
    uint256 public currentSnapshotId;

    /// @notice List of all tracked accounts
    address[] public trackedAccounts;

    /// @notice Mapping to check if account is tracked
    mapping(address => bool) public isTracked;

    /// @notice Total supply of voting weight
    uint256 public totalVotingWeight;

    // ── Constructor ────────────────────────────────────────────────────────────

    /// @param _governanceToken Address of the governance token
    constructor(address _governanceToken) Ownable(msg.sender) {
        if (_governanceToken == address(0)) revert ZeroAddress();
        governanceToken = IERC20(_governanceToken);
    }

    // ── Weight Tracking ────────────────────────────────────────────────────────

    /// @notice Update the weight for an account based on current token balance
    /// @param account The account to update
    function updateWeight(address account) public {
        if (account == address(0)) revert ZeroAddress();

        uint256 tokenBalance = governanceToken.balanceOf(account);
        uint256 oldBaseWeight = baseWeight[account];
        
        if (tokenBalance == oldBaseWeight) revert NoWeightChange();

        // Update base weight
        baseWeight[account] = tokenBalance;

        // Calculate new total weight (base + delegated received - delegated given)
        uint256 oldWeight = currentWeight[account];
        uint256 newWeight = tokenBalance + delegatedWeightReceived[account] - delegatedWeightGiven[account];
        
        currentWeight[account] = newWeight;

        // Track account if not already tracked
        if (!isTracked[account]) {
            trackedAccounts.push(account);
            isTracked[account] = true;
        }

        // Update total voting weight
        if (newWeight > oldWeight) {
            totalVotingWeight += (newWeight - oldWeight);
        } else {
            totalVotingWeight -= (oldWeight - newWeight);
        }

        // Record weight change
        _recordWeightChange(account, oldWeight, newWeight, ChangeReason.BALANCE_CHANGE);

        // Create checkpoint
        _createCheckpoint(account, newWeight);

        emit WeightUpdated(account, oldWeight, newWeight, int256(newWeight) - int256(oldWeight), ChangeReason.BALANCE_CHANGE);
    }

    /// @notice Batch update weights for multiple accounts
    /// @param accounts Array of accounts to update
    function batchUpdateWeights(address[] calldata accounts) external {
        for (uint256 i = 0; i < accounts.length; i++) {
            updateWeight(accounts[i]);
        }
    }

    // ── Weight Delegation ──────────────────────────────────────────────────────

    /// @notice Delegate voting weight to another address
    /// @param delegatee Address to delegate to
    function delegate(address delegatee) external nonReentrant {
        if (delegatee == address(0)) revert ZeroAddress();
        if (delegatee == msg.sender) revert SelfDelegation();
        
        // Check for delegation loops
        if (_wouldCreateLoop(msg.sender, delegatee)) revert DelegationLoop();

        address currentDelegatee = currentDelegation[msg.sender];
        
        // Remove old delegation if exists
        if (currentDelegatee != address(0)) {
            _removeDelegation(msg.sender, currentDelegatee);
        }

        // Create new delegation
        _createDelegation(msg.sender, delegatee);
    }

    /// @notice Remove current delegation
    function undelegate() external nonReentrant {
        address currentDelegatee = currentDelegation[msg.sender];
        if (currentDelegatee == address(0)) revert ZeroAddress();

        _removeDelegation(msg.sender, currentDelegatee);
    }

    /// @notice Internal function to create a delegation
    /// @param delegator Address delegating weight
    /// @param delegatee Address receiving delegated weight
    function _createDelegation(address delegator, address delegatee) internal {
        uint256 amount = governanceToken.balanceOf(delegator);
        
        // Update delegator's weights
        uint256 oldDelegatorWeight = currentWeight[delegator];
        delegatedWeightGiven[delegator] = amount;
        currentWeight[delegator] = baseWeight[delegator] + delegatedWeightReceived[delegator] - amount;
        
        // Update delegatee's weights
        uint256 oldDelegateeWeight = currentWeight[delegatee];
        delegatedWeightReceived[delegatee] += amount;
        currentWeight[delegatee] = baseWeight[delegatee] + delegatedWeightReceived[delegatee] - delegatedWeightGiven[delegatee];

        // Update delegation tracking
        currentDelegation[delegator] = delegatee;
        delegationInfo[delegator] = DelegationInfo({
            delegatee: delegatee,
            amount: amount,
            timestamp: block.timestamp,
            active: true
        });
        delegators[delegatee].push(delegator);

        // Track accounts
        if (!isTracked[delegator]) {
            trackedAccounts.push(delegator);
            isTracked[delegator] = true;
        }
        if (!isTracked[delegatee]) {
            trackedAccounts.push(delegatee);
            isTracked[delegatee] = true;
        }

        // Record weight changes
        _recordWeightChange(delegator, oldDelegatorWeight, currentWeight[delegator], ChangeReason.DELEGATION_GIVEN);
        _recordWeightChange(delegatee, oldDelegateeWeight, currentWeight[delegatee], ChangeReason.DELEGATION_RECEIVED);

        // Create checkpoints
        _createCheckpoint(delegator, currentWeight[delegator]);
        _createCheckpoint(delegatee, currentWeight[delegatee]);

        emit DelegationCreated(delegator, delegatee, amount, block.timestamp);
        emit WeightUpdated(delegator, oldDelegatorWeight, currentWeight[delegator], int256(currentWeight[delegator]) - int256(oldDelegatorWeight), ChangeReason.DELEGATION_GIVEN);
        emit WeightUpdated(delegatee, oldDelegateeWeight, currentWeight[delegatee], int256(currentWeight[delegatee]) - int256(oldDelegateeWeight), ChangeReason.DELEGATION_RECEIVED);
    }

    /// @notice Internal function to remove a delegation
    /// @param delegator Address that delegated weight
    /// @param delegatee Address that received delegated weight
    function _removeDelegation(address delegator, address delegatee) internal {
        DelegationInfo storage info = delegationInfo[delegator];
        uint256 amount = info.amount;

        // Update delegator's weights
        uint256 oldDelegatorWeight = currentWeight[delegator];
        delegatedWeightGiven[delegator] = 0;
        currentWeight[delegator] = baseWeight[delegator] + delegatedWeightReceived[delegator];

        // Update delegatee's weights
        uint256 oldDelegateeWeight = currentWeight[delegatee];
        if (delegatedWeightReceived[delegatee] >= amount) {
            delegatedWeightReceived[delegatee] -= amount;
        }
        currentWeight[delegatee] = baseWeight[delegatee] + delegatedWeightReceived[delegatee] - delegatedWeightGiven[delegatee];

        // Update delegation tracking
        currentDelegation[delegator] = address(0);
        info.active = false;

        // Remove from delegators array
        _removeDelegatorFromArray(delegatee, delegator);

        // Record weight changes
        _recordWeightChange(delegator, oldDelegatorWeight, currentWeight[delegator], ChangeReason.DELEGATION_REVOKED);
        _recordWeightChange(delegatee, oldDelegateeWeight, currentWeight[delegatee], ChangeReason.DELEGATION_REMOVED);

        // Create checkpoints
        _createCheckpoint(delegator, currentWeight[delegator]);
        _createCheckpoint(delegatee, currentWeight[delegatee]);

        emit DelegationRemoved(delegator, delegatee, amount, block.timestamp);
        emit WeightUpdated(delegator, oldDelegatorWeight, currentWeight[delegator], int256(currentWeight[delegator]) - int256(oldDelegatorWeight), ChangeReason.DELEGATION_REVOKED);
        emit WeightUpdated(delegatee, oldDelegateeWeight, currentWeight[delegatee], int256(currentWeight[delegatee]) - int256(oldDelegateeWeight), ChangeReason.DELEGATION_REMOVED);
    }

    /// @notice Check if delegation would create a loop
    /// @param delegator Address wanting to delegate
    /// @param delegatee Address to delegate to
    /// @return bool True if would create a loop
    function _wouldCreateLoop(address delegator, address delegatee) internal view returns (bool) {
        address current = delegatee;
        uint256 depth = 0;
        uint256 maxDepth = 10; // Prevent infinite loops

        while (current != address(0) && depth < maxDepth) {
            if (current == delegator) {
                return true;
            }
            current = currentDelegation[current];
            depth++;
        }

        return false;
    }

    /// @notice Remove delegator from delegatee's delegators array
    /// @param delegatee Address that received delegation
    /// @param delegator Address to remove
    function _removeDelegatorFromArray(address delegatee, address delegator) internal {
        address[] storage dels = delegators[delegatee];
        for (uint256 i = 0; i < dels.length; i++) {
            if (dels[i] == delegator) {
                dels[i] = dels[dels.length - 1];
                dels.pop();
                break;
            }
        }
    }

    // ── Weight Changes ─────────────────────────────────────────────────────────

    /// @notice Record a weight change in history
    /// @param account Account whose weight changed
    /// @param oldWeight Previous weight
    /// @param newWeight New weight
    /// @param reason Reason for the change
    function _recordWeightChange(
        address account,
        uint256 oldWeight,
        uint256 newWeight,
        ChangeReason reason
    ) internal {
        weightChangeHistory[account].push(WeightChange({
            timestamp: block.timestamp,
            blockNumber: block.number,
            oldWeight: oldWeight,
            newWeight: newWeight,
            delta: int256(newWeight) - int256(oldWeight),
            reason: reason
        }));
    }

    /// @notice Get weight change history for an account
    /// @param account Account to query
    /// @return WeightChange[] Array of weight changes
    function getWeightChangeHistory(address account) external view returns (WeightChange[] memory) {
        return weightChangeHistory[account];
    }

    /// @notice Get recent weight changes for an account
    /// @param account Account to query
    /// @param count Number of recent changes to return
    /// @return WeightChange[] Array of recent weight changes
    function getRecentWeightChanges(address account, uint256 count) external view returns (WeightChange[] memory) {
        WeightChange[] storage history = weightChangeHistory[account];
        uint256 length = history.length;
        
        if (length == 0) {
            return new WeightChange[](0);
        }

        uint256 returnCount = count > length ? length : count;
        WeightChange[] memory recent = new WeightChange[](returnCount);
        
        for (uint256 i = 0; i < returnCount; i++) {
            recent[i] = history[length - returnCount + i];
        }
        
        return recent;
    }

    /// @notice Calculate total weight change over a period
    /// @param account Account to query
    /// @param fromBlock Starting block number
    /// @param toBlock Ending block number
    /// @return int256 Total weight change (can be negative)
    function calculateWeightChange(
        address account,
        uint256 fromBlock,
        uint256 toBlock
    ) external view returns (int256) {
        if (toBlock < fromBlock) revert InvalidBlockNumber();

        WeightChange[] storage history = weightChangeHistory[account];
        int256 totalChange = 0;

        for (uint256 i = 0; i < history.length; i++) {
            if (history[i].blockNumber >= fromBlock && history[i].blockNumber <= toBlock) {
                totalChange += history[i].delta;
            }
        }

        return totalChange;
    }

    // ── Checkpoints & Snapshots ────────────────────────────────────────────────

    /// @notice Create a checkpoint for an account
    /// @param account Account to checkpoint
    /// @param weight Current weight
    function _createCheckpoint(address account, uint256 weight) internal {
        Checkpoint[] storage accountCheckpoints = checkpoints[account];
        
        // Only create checkpoint if weight changed or first checkpoint
        if (accountCheckpoints.length == 0 || 
            accountCheckpoints[accountCheckpoints.length - 1].weight != weight) {
            accountCheckpoints.push(Checkpoint({
                blockNumber: block.number,
                weight: weight
            }));
            
            emit CheckpointCreated(account, block.number, weight);
        }
    }

    /// @notice Get weight at a specific block number
    /// @param account Account to query
    /// @param blockNumber Block number to query
    /// @return uint256 Weight at that block
    function getWeightAt(address account, uint256 blockNumber) public view returns (uint256) {
        if (blockNumber > block.number) revert InvalidBlockNumber();

        Checkpoint[] storage accountCheckpoints = checkpoints[account];
        
        if (accountCheckpoints.length == 0) {
            return 0;
        }

        // Check if blockNumber is before first checkpoint
        if (blockNumber < accountCheckpoints[0].blockNumber) {
            return 0;
        }

        // Binary search for the checkpoint
        uint256 lower = 0;
        uint256 upper = accountCheckpoints.length - 1;

        while (upper > lower) {
            uint256 center = upper - (upper - lower) / 2;
            Checkpoint memory cp = accountCheckpoints[center];
            
            if (cp.blockNumber == blockNumber) {
                return cp.weight;
            } else if (cp.blockNumber < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }

        return accountCheckpoints[lower].weight;
    }

    /// @notice Create a snapshot of all current weights
    /// @return uint256 Snapshot ID
    function createSnapshot() external onlyOwner returns (uint256) {
        uint256 snapshotId = ++currentSnapshotId;
        Snapshot storage snapshot = snapshots[snapshotId];
        
        snapshot.id = snapshotId;
        snapshot.blockNumber = block.number;
        snapshot.timestamp = block.timestamp;

        // Store weights for all tracked accounts
        for (uint256 i = 0; i < trackedAccounts.length; i++) {
            address account = trackedAccounts[i];
            snapshot.weights[account] = currentWeight[account];
            snapshot.accounts.push(account);
        }

        emit SnapshotCreated(snapshotId, block.number, block.timestamp);
        
        return snapshotId;
    }

    /// @notice Get weight from a snapshot
    /// @param snapshotId Snapshot ID
    /// @param account Account to query
    /// @return uint256 Weight at snapshot
    function getWeightAtSnapshot(uint256 snapshotId, address account) external view returns (uint256) {
        if (snapshotId == 0 || snapshotId > currentSnapshotId) revert InvalidSnapshotId();
        return snapshots[snapshotId].weights[account];
    }

    /// @notice Get snapshot info
    /// @param snapshotId Snapshot ID
    /// @return id Snapshot ID
    /// @return blockNumber Block number of snapshot
    /// @return timestamp Timestamp of snapshot
    /// @return accountCount Number of accounts in snapshot
    function getSnapshotInfo(uint256 snapshotId) external view returns (
        uint256 id,
        uint256 blockNumber,
        uint256 timestamp,
        uint256 accountCount
    ) {
        if (snapshotId == 0 || snapshotId > currentSnapshotId) revert InvalidSnapshotId();
        Snapshot storage snapshot = snapshots[snapshotId];
        return (snapshot.id, snapshot.blockNumber, snapshot.timestamp, snapshot.accounts.length);
    }

    // ── Query Functions ────────────────────────────────────────────────────────

    /// @notice Get current voting weight for an account
    /// @param account Account to query
    /// @return uint256 Current voting weight
    function getVotingWeight(address account) external view returns (uint256) {
        return currentWeight[account];
    }

    /// @notice Get detailed weight breakdown for an account
    /// @param account Account to query
    /// @return base Base weight from token balance
    /// @return received Delegated weight received
    /// @return given Delegated weight given away
    /// @return total Total effective voting weight
    function getWeightBreakdown(address account) external view returns (
        uint256 base,
        uint256 received,
        uint256 given,
        uint256 total
    ) {
        return (
            baseWeight[account],
            delegatedWeightReceived[account],
            delegatedWeightGiven[account],
            currentWeight[account]
        );
    }

    /// @notice Get delegation info for an account
    /// @param account Account to query
    /// @return DelegationInfo Delegation information
    function getDelegationInfo(address account) external view returns (DelegationInfo memory) {
        return delegationInfo[account];
    }

    /// @notice Get all delegators for a delegatee
    /// @param delegatee Address to query
    /// @return address[] Array of delegators
    function getDelegators(address delegatee) external view returns (address[] memory) {
        return delegators[delegatee];
    }

    /// @notice Get number of checkpoints for an account
    /// @param account Account to query
    /// @return uint256 Number of checkpoints
    function getCheckpointCount(address account) external view returns (uint256) {
        return checkpoints[account].length;
    }

    /// @notice Get specific checkpoint for an account
    /// @param account Account to query
    /// @param index Checkpoint index
    /// @return Checkpoint Checkpoint data
    function getCheckpoint(address account, uint256 index) external view returns (Checkpoint memory) {
        return checkpoints[account][index];
    }

    /// @notice Get all tracked accounts
    /// @return address[] Array of tracked accounts
    function getTrackedAccounts() external view returns (address[] memory) {
        return trackedAccounts;
    }

    /// @notice Get total number of tracked accounts
    /// @return uint256 Number of tracked accounts
    function getTrackedAccountCount() external view returns (uint256) {
        return trackedAccounts.length;
    }

    /// @notice Get total voting weight across all accounts
    /// @return uint256 Total voting weight
    function getTotalVotingWeight() external view returns (uint256) {
        return totalVotingWeight;
    }

    /// @notice Check if an account has delegated their weight
    /// @param account Account to check
    /// @return bool True if account has active delegation
    function hasDelegated(address account) external view returns (bool) {
        return currentDelegation[account] != address(0);
    }

    /// @notice Get the delegatee for an account
    /// @param account Account to query
    /// @return address Current delegatee (address(0) if none)
    function getDelegatee(address account) external view returns (address) {
        return currentDelegation[account];
    }
}

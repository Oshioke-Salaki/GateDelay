// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title  MarketReward
 * @notice Reward system for market participation.
 *
 * Supports multiple reward types (e.g. TRADING, LIQUIDITY, REFERRAL).
 * Each type has its own allocation pool. Authorised distributors (e.g. the
 * trading engine) call recordParticipation to credit rewards; users claim
 * at any time.
 */
contract MarketReward is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Errors ─────────────────────────────────────────────────────────────────
    error ZeroAmount();
    error ZeroAddress();
    error UnknownRewardType();
    error NotDistributor();
    error AlreadyClaimed();
    error NoRewardsToClaim();
    error InsufficientPool();

    // ── Types ──────────────────────────────────────────────────────────────────

    struct RewardType {
        string  name;
        uint256 totalAllocated;   // total rewards ever allocated from this type
        uint256 totalClaimed;     // total rewards ever claimed from this type
        uint256 poolBalance;      // tokens currently available in pool
        bool    active;
    }

    struct ClaimRecord {
        uint256 totalEarned;
        uint256 totalClaimed;
        uint256 lastClaimedAt;
    }

    // ── Events ─────────────────────────────────────────────────────────────────
    event RewardTypeAdded(bytes32 indexed typeId, string name);
    event RewardTypeDeactivated(bytes32 indexed typeId);
    event PoolFunded(bytes32 indexed typeId, uint256 amount);
    event RewardAllocated(bytes32 indexed typeId, address indexed user, uint256 amount);
    event RewardClaimed(bytes32 indexed typeId, address indexed user, uint256 amount);
    event DistributorSet(address indexed distributor, bool enabled);

    // ── State ──────────────────────────────────────────────────────────────────

    IERC20 public immutable rewardToken;

    mapping(bytes32 => RewardType) public rewardTypes;
    bytes32[] public rewardTypeIds;

    // typeId => user => ClaimRecord
    mapping(bytes32 => mapping(address => ClaimRecord)) public claimRecords;

    // authorised addresses that can call recordParticipation
    mapping(address => bool) public distributors;

    // ── Constructor ────────────────────────────────────────────────────────────

    constructor(address _rewardToken) Ownable(msg.sender) {
        if (_rewardToken == address(0)) revert ZeroAddress();
        rewardToken = IERC20(_rewardToken);
    }

    // ── Admin ──────────────────────────────────────────────────────────────────

    /// @notice Executes addRewardType.
    /// @param typeId Identifier of the relevant type.
    /// @param name name used by this operation.
    /// @dev Access: Caller must be the contract owner.
    function addRewardType(bytes32 typeId, string calldata name) external onlyOwner {
        rewardTypes[typeId] = RewardType({
            name: name,
            totalAllocated: 0,
            totalClaimed: 0,
            poolBalance: 0,
            active: true
        });
        rewardTypeIds.push(typeId);
        emit RewardTypeAdded(typeId, name);
    }

    /// @notice Executes deactivateRewardType.
    /// @param typeId Identifier of the relevant type.
    /// @dev Access: Caller must be the contract owner.
    /// @dev Reverts: `UnknownRewardType` if `!rewardTypes[typeId].active` is true.
    function deactivateRewardType(bytes32 typeId) external onlyOwner {
        if (!rewardTypes[typeId].active) revert UnknownRewardType();
        rewardTypes[typeId].active = false;
        emit RewardTypeDeactivated(typeId);
    }

    /// @notice Executes setDistributor.
    /// @param distributor Address associated with distributor.
    /// @param enabled Whether the configuration is enabled.
    /// @dev Access: Caller must be the contract owner.
    /// @dev Reverts: `ZeroAddress` if `distributor == address(0)` is true.
    function setDistributor(address distributor, bool enabled) external onlyOwner {
        if (distributor == address(0)) revert ZeroAddress();
        distributors[distributor] = enabled;
        emit DistributorSet(distributor, enabled);
    }

    /// @notice Fund a reward pool with tokens.
    /// @param typeId Identifier of the relevant type.
    /// @param amount Amount to process, in the relevant token units.
    /// @dev Access: Caller must be the contract owner.
    /// @dev Reverts: `ZeroAmount` if `amount == 0` is true. `UnknownRewardType` if
    ///     `!rewardTypes[typeId].active` is true.
    function fundPool(bytes32 typeId, uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        if (!rewardTypes[typeId].active) revert UnknownRewardType();
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
        rewardTypes[typeId].poolBalance += amount;
        emit PoolFunded(typeId, amount);
    }

    // ── Distribution ───────────────────────────────────────────────────────────

    /**
     * @notice Record participation reward for a user. Called by authorised distributors.
     * @param typeId  Reward type identifier.
     * @param user    Recipient address.
     * @param amount  Reward amount to allocate.
     * @dev Access: Caller permissions are checked against the sender or assigned roles.
     * @dev Reverts: `NotDistributor` if `!distributors[msg.sender]` is true. `ZeroAddress` if `user
     *     == address(0)` is true. `ZeroAmount` if `amount == 0` is true. `UnknownRewardType` if
     *     `!rt.active` is true. `InsufficientPool` if `rt.poolBalance < amount` is true.
     */
    function recordParticipation(bytes32 typeId, address user, uint256 amount) external {
        if (!distributors[msg.sender]) revert NotDistributor();
        if (user == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        RewardType storage rt = rewardTypes[typeId];
        if (!rt.active) revert UnknownRewardType();
        if (rt.poolBalance < amount) revert InsufficientPool();

        rt.poolBalance    -= amount;
        rt.totalAllocated += amount;

        claimRecords[typeId][user].totalEarned += amount;

        emit RewardAllocated(typeId, user, amount);
    }

    // ── Claiming ───────────────────────────────────────────────────────────────

    /// @notice Claim all pending rewards for a specific reward type.
    /// @param typeId Identifier of the relevant type.
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    /// @dev Reverts: `NoRewardsToClaim` if `pending == 0` is true.
    function claim(bytes32 typeId) external nonReentrant {
        ClaimRecord storage rec = claimRecords[typeId][msg.sender];
        uint256 pending = rec.totalEarned - rec.totalClaimed;
        if (pending == 0) revert NoRewardsToClaim();

        rec.totalClaimed  += pending;
        rec.lastClaimedAt  = block.timestamp;
        rewardTypes[typeId].totalClaimed += pending;

        rewardToken.safeTransfer(msg.sender, pending);
        emit RewardClaimed(typeId, msg.sender, pending);
    }

    /// @notice Claim rewards across all reward types in one transaction.
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    /// @dev Reverts: `NoRewardsToClaim` if `total == 0` is true.
    function claimAll() external nonReentrant {
        uint256 total;
        for (uint256 i; i < rewardTypeIds.length; ++i) {
            bytes32 typeId = rewardTypeIds[i];
            ClaimRecord storage rec = claimRecords[typeId][msg.sender];
            uint256 pending = rec.totalEarned - rec.totalClaimed;
            if (pending == 0) continue;
            rec.totalClaimed  += pending;
            rec.lastClaimedAt  = block.timestamp;
            rewardTypes[typeId].totalClaimed += pending;
            total += pending;
            emit RewardClaimed(typeId, msg.sender, pending);
        }
        if (total == 0) revert NoRewardsToClaim();
        rewardToken.safeTransfer(msg.sender, total);
    }

    // ── Queries ────────────────────────────────────────────────────────────────

    /// @notice Pending claimable reward for a user under a specific type.
    /// @param typeId Identifier of the relevant type.
    /// @param user User address affected by this operation.
    /// @return Value produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function pendingReward(bytes32 typeId, address user) external view returns (uint256) {
        ClaimRecord storage rec = claimRecords[typeId][user];
        return rec.totalEarned - rec.totalClaimed;
    }

    /// @notice Full claim record for a user under a specific type.
    /// @param typeId Identifier of the relevant type.
    /// @param user User address affected by this operation.
    /// @return Claim record returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getClaimRecord(bytes32 typeId, address user) external view returns (ClaimRecord memory) {
        return claimRecords[typeId][user];
    }

    /// @notice Returns all registered reward type IDs.
    /// @return Reward type ids returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getRewardTypeIds() external view returns (bytes32[] memory) {
        return rewardTypeIds;
    }

    /// @notice Returns reward type details.
    /// @param typeId Identifier of the relevant type.
    /// @return Reward type returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getRewardType(bytes32 typeId) external view returns (RewardType memory) {
        return rewardTypes[typeId];
    }
}

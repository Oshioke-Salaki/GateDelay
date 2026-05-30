// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title LiquidityMining
/// @notice Manages liquidity mining rewards across multiple pools.
/// @dev Tracks time-weighted liquidity provision and distributes rewards proportionally.
///      Uses a reward-per-token accumulator (inspired by Synthetix StakingRewards) scaled
///      by PRECISION to avoid fractional token loss. PRBMath fixed-point precision model
///      is replicated here with integer arithmetic for gas efficiency.
contract LiquidityMining is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Errors ─────────────────────────────────────────────────────────────────
    error ZeroAddress();
    error ZeroAmount();
    error PoolNotFound();
    error PoolNotActive();
    error InsufficientBalance();
    error NoPendingRewards();
    error InvalidRewardRate();
    error InsufficientRewardBalance();

    // ── Types ──────────────────────────────────────────────────────────────────

    /// @notice Mining pool configuration and live state
    struct Pool {
        IERC20 stakingToken;          // Token deposited by liquidity providers
        uint256 rewardRate;           // Reward tokens emitted per second (wei/s)
        uint256 lastUpdateTime;       // Timestamp of the last reward accumulation
        uint256 rewardPerTokenStored; // Cumulative reward-per-staked-token (scaled by PRECISION)
        uint256 totalStaked;          // Total staking tokens held by the pool
        bool active;                  // Whether new deposits are accepted
    }

    /// @notice A user's position within a single pool
    struct UserPosition {
        uint256 amount;              // Staking tokens currently deposited
        uint256 rewardDebt;          // rewardPerTokenStored snapshot at last interaction
        uint256 pendingRewards;      // Accumulated but unclaimed reward tokens
        uint256 depositTimestamp;    // Timestamp of first deposit (informational)
        uint256 lastClaimTimestamp;  // Timestamp of last reward claim
    }

    // ── Events ─────────────────────────────────────────────────────────────────
    event PoolCreated(uint256 indexed poolId, address indexed stakingToken, uint256 rewardRate);
    event PoolStatusUpdated(uint256 indexed poolId, bool active);
    event RewardRateUpdated(uint256 indexed poolId, uint256 oldRate, uint256 newRate);
    event LiquidityProvided(uint256 indexed poolId, address indexed user, uint256 amount);
    event LiquidityWithdrawn(uint256 indexed poolId, address indexed user, uint256 amount);
    event RewardsClaimed(uint256 indexed poolId, address indexed user, uint256 amount);
    event RewardsFunded(uint256 amount);

    // ── Constants ──────────────────────────────────────────────────────────────

    /// @notice Scaling factor used in reward-per-token calculations
    uint256 public constant PRECISION = 1e18;

    // ── State ──────────────────────────────────────────────────────────────────

    /// @notice Token distributed as mining rewards across all pools
    IERC20 public immutable rewardToken;

    /// @notice Total reward tokens available for distribution
    uint256 public rewardReserve;

    /// @notice Total number of pools created (monotonically increasing)
    uint256 public poolCount;

    /// @notice Maps poolId => Pool
    mapping(uint256 => Pool) private _pools;

    /// @notice Maps poolId => user => UserPosition
    mapping(uint256 => mapping(address => UserPosition)) private _positions;

    /// @notice Maps poolId => addresses that have ever deposited
    mapping(uint256 => address[]) private _poolParticipants;

    /// @notice Tracks first-time participation per pool per user
    mapping(uint256 => mapping(address => bool)) private _hasParticipated;

    // ── Constructor ────────────────────────────────────────────────────────────

    /// @param _rewardToken Address of the ERC20 token distributed as rewards
    constructor(address _rewardToken) Ownable(msg.sender) {
        if (_rewardToken == address(0)) revert ZeroAddress();
        rewardToken = IERC20(_rewardToken);
    }

    // ── Pool Management ────────────────────────────────────────────────────────

    /// @notice Create a new liquidity mining pool
    /// @param stakingToken ERC20 token that providers deposit
    /// @param rewardRate Reward tokens emitted per second (in wei)
    /// @return poolId Identifier of the newly created pool
    function createPool(address stakingToken, uint256 rewardRate) external onlyOwner returns (uint256 poolId) {
        if (stakingToken == address(0)) revert ZeroAddress();
        if (rewardRate == 0) revert InvalidRewardRate();

        poolId = poolCount++;
        _pools[poolId] = Pool({
            stakingToken: IERC20(stakingToken),
            rewardRate: rewardRate,
            lastUpdateTime: block.timestamp,
            rewardPerTokenStored: 0,
            totalStaked: 0,
            active: true
        });

        emit PoolCreated(poolId, stakingToken, rewardRate);
    }

    /// @notice Enable or disable new deposits into a pool
    /// @param poolId Pool to update
    /// @param active New active state
    function setPoolActive(uint256 poolId, bool active) external onlyOwner {
        if (poolId >= poolCount) revert PoolNotFound();
        _pools[poolId].active = active;
        emit PoolStatusUpdated(poolId, active);
    }

    /// @notice Update the per-second reward emission rate for a pool
    /// @param poolId Pool to update
    /// @param newRate New reward rate (wei per second)
    function updateRewardRate(uint256 poolId, uint256 newRate) external onlyOwner {
        if (poolId >= poolCount) revert PoolNotFound();
        if (newRate == 0) revert InvalidRewardRate();

        _updatePool(poolId);

        uint256 oldRate = _pools[poolId].rewardRate;
        _pools[poolId].rewardRate = newRate;

        emit RewardRateUpdated(poolId, oldRate, newRate);
    }

    /// @notice Transfer reward tokens into the contract reserve
    /// @param amount Number of reward tokens to deposit
    function fundRewards(uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
        rewardReserve += amount;
        emit RewardsFunded(amount);
    }

    // ── Liquidity Provision ────────────────────────────────────────────────────

    /// @notice Deposit staking tokens to start earning mining rewards
    /// @param poolId Pool to deposit into
    /// @param amount Amount of staking tokens to deposit
    function provide(uint256 poolId, uint256 amount) external nonReentrant {
        if (poolId >= poolCount) revert PoolNotFound();
        if (!_pools[poolId].active) revert PoolNotActive();
        if (amount == 0) revert ZeroAmount();

        _updatePool(poolId);
        _updateUserRewards(poolId, msg.sender);

        Pool storage pool = _pools[poolId];
        UserPosition storage pos = _positions[poolId][msg.sender];

        pool.stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        if (!_hasParticipated[poolId][msg.sender]) {
            _poolParticipants[poolId].push(msg.sender);
            _hasParticipated[poolId][msg.sender] = true;
            pos.depositTimestamp = block.timestamp;
        }

        pos.amount += amount;
        pos.rewardDebt = pool.rewardPerTokenStored;
        pool.totalStaked += amount;

        emit LiquidityProvided(poolId, msg.sender, amount);
    }

    /// @notice Withdraw staking tokens from a pool
    /// @param poolId Pool to withdraw from
    /// @param amount Amount of staking tokens to withdraw
    function withdraw(uint256 poolId, uint256 amount) external nonReentrant {
        if (poolId >= poolCount) revert PoolNotFound();
        if (amount == 0) revert ZeroAmount();

        UserPosition storage pos = _positions[poolId][msg.sender];
        if (pos.amount < amount) revert InsufficientBalance();

        _updatePool(poolId);
        _updateUserRewards(poolId, msg.sender);

        Pool storage pool = _pools[poolId];

        pos.amount -= amount;
        pos.rewardDebt = pool.rewardPerTokenStored;
        pool.totalStaked -= amount;

        pool.stakingToken.safeTransfer(msg.sender, amount);

        emit LiquidityWithdrawn(poolId, msg.sender, amount);
    }

    /// @notice Claim all accumulated mining rewards for a pool
    /// @param poolId Pool to claim rewards from
    function claimRewards(uint256 poolId) external nonReentrant {
        if (poolId >= poolCount) revert PoolNotFound();

        _updatePool(poolId);
        _updateUserRewards(poolId, msg.sender);

        UserPosition storage pos = _positions[poolId][msg.sender];
        uint256 pending = pos.pendingRewards;
        if (pending == 0) revert NoPendingRewards();
        if (pending > rewardReserve) revert InsufficientRewardBalance();

        pos.pendingRewards = 0;
        pos.lastClaimTimestamp = block.timestamp;
        rewardReserve -= pending;

        rewardToken.safeTransfer(msg.sender, pending);

        emit RewardsClaimed(poolId, msg.sender, pending);
    }

    // ── Internal Helpers ───────────────────────────────────────────────────────

    /// @notice Accumulate rewards for a pool since the last update timestamp
    function _updatePool(uint256 poolId) internal {
        Pool storage pool = _pools[poolId];

        if (pool.totalStaked == 0) {
            pool.lastUpdateTime = block.timestamp;
            return;
        }

        uint256 elapsed = block.timestamp - pool.lastUpdateTime;
        if (elapsed > 0) {
            pool.rewardPerTokenStored += (elapsed * pool.rewardRate * PRECISION) / pool.totalStaked;
            pool.lastUpdateTime = block.timestamp;
        }
    }

    /// @notice Snapshot pending rewards for a user based on current pool state
    function _updateUserRewards(uint256 poolId, address user) internal {
        Pool storage pool = _pools[poolId];
        UserPosition storage pos = _positions[poolId][user];

        if (pos.amount > 0) {
            uint256 earned = (pos.amount * (pool.rewardPerTokenStored - pos.rewardDebt)) / PRECISION;
            pos.pendingRewards += earned;
        }

        pos.rewardDebt = pool.rewardPerTokenStored;
    }

    // ── Query Functions ────────────────────────────────────────────────────────

    /// @notice Get the configuration and state of a pool
    /// @param poolId Pool to query
    /// @return Pool data struct
    function getPool(uint256 poolId) external view returns (Pool memory) {
        if (poolId >= poolCount) revert PoolNotFound();
        return _pools[poolId];
    }

    /// @notice Get a user's position in a specific pool
    /// @param poolId Pool to query
    /// @param user Address to check
    /// @return UserPosition struct
    function getPosition(uint256 poolId, address user) external view returns (UserPosition memory) {
        return _positions[poolId][user];
    }

    /// @notice Compute the pending reward amount for a user without modifying state
    /// @param poolId Pool to query
    /// @param user Address to check
    /// @return Total pending reward tokens
    function getPendingRewards(uint256 poolId, address user) external view returns (uint256) {
        if (poolId >= poolCount) revert PoolNotFound();

        Pool storage pool = _pools[poolId];
        UserPosition storage pos = _positions[poolId][user];

        uint256 rewardPerToken = pool.rewardPerTokenStored;

        if (pool.totalStaked > 0) {
            uint256 elapsed = block.timestamp - pool.lastUpdateTime;
            rewardPerToken += (elapsed * pool.rewardRate * PRECISION) / pool.totalStaked;
        }

        uint256 earned = (pos.amount * (rewardPerToken - pos.rewardDebt)) / PRECISION;
        return pos.pendingRewards + earned;
    }

    /// @notice Get every address that has ever deposited into a pool
    /// @param poolId Pool to query
    /// @return Array of participant addresses
    function getPoolParticipants(uint256 poolId) external view returns (address[] memory) {
        if (poolId >= poolCount) revert PoolNotFound();
        return _poolParticipants[poolId];
    }

    /// @notice Get the total staked balance in a pool
    /// @param poolId Pool to query
    /// @return Total staked tokens
    function getTotalStaked(uint256 poolId) external view returns (uint256) {
        if (poolId >= poolCount) revert PoolNotFound();
        return _pools[poolId].totalStaked;
    }

    /// @notice Get the number of pools that have been created
    /// @return Total pool count
    function getPoolCount() external view returns (uint256) {
        return poolCount;
    }

    /// @notice Get the current reward emission rate for a pool
    /// @param poolId Pool to query
    /// @return Reward tokens emitted per second
    function getRewardRate(uint256 poolId) external view returns (uint256) {
        if (poolId >= poolCount) revert PoolNotFound();
        return _pools[poolId].rewardRate;
    }
}

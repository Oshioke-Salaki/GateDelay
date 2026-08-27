// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title  StakingContract
 * @notice Handles token staking, reward calculation, period tracking, and withdrawals.
 *
 * Rewards accrue per-second based on a configurable rate (rewardPerSecond).
 * Each staker's pending rewards are snapshotted on every deposit/withdrawal via
 * a global rewardPerTokenStored accumulator pattern (similar to Synthetix).
 */
contract StakingContract is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Errors ─────────────────────────────────────────────────────────────────
    error ZeroAmount();
    error ZeroAddress();
    error InsufficientStake();
    error StakingPeriodActive();
    error NoRewardsToClaim();

    // ── Types ──────────────────────────────────────────────────────────────────

    struct StakeInfo {
        uint256 amount;              // tokens currently staked
        uint256 rewardDebt;          // reward already accounted for
        uint256 pendingRewards;      // rewards accumulated but not yet claimed
        uint256 stakedAt;            // timestamp of last deposit
        uint256 totalStaked;         // lifetime total staked by this user
    }

    // ── Events ─────────────────────────────────────────────────────────────────
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 reward);
    event RewardRateUpdated(uint256 newRate);
    event RewardFunded(uint256 amount);

    // ── State ──────────────────────────────────────────────────────────────────

    IERC20 public immutable stakingToken;
    IERC20 public immutable rewardToken;

    uint256 public rewardPerSecond;          // reward tokens emitted per second across all stakers
    uint256 public rewardPerTokenStored;     // accumulated reward per staked token (scaled 1e18)
    uint256 public lastUpdateTime;           // last time rewardPerTokenStored was updated
    uint256 public totalStaked;              // total tokens currently staked

    mapping(address => StakeInfo) public stakes;

    // ── Constructor ────────────────────────────────────────────────────────────

    constructor(address _stakingToken, address _rewardToken, uint256 _rewardPerSecond)
        Ownable(msg.sender)
    {
        if (_stakingToken == address(0) || _rewardToken == address(0)) revert ZeroAddress();
        stakingToken = IERC20(_stakingToken);
        rewardToken  = IERC20(_rewardToken);
        rewardPerSecond = _rewardPerSecond;
        lastUpdateTime  = block.timestamp;
    }

    // ── Admin ──────────────────────────────────────────────────────────────────

    /// @notice Update the reward emission rate.
    function setRewardRate(uint256 newRate) external onlyOwner {
        _updateReward(address(0));
        rewardPerSecond = newRate;
        emit RewardRateUpdated(newRate);
    }

    /// @notice Fund the contract with reward tokens.
    function fundRewards(uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
        emit RewardFunded(amount);
    }

    // ── Core ───────────────────────────────────────────────────────────────────

    /// @notice Deposit staking tokens.
    function stake(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _updateReward(msg.sender);

        StakeInfo storage info = stakes[msg.sender];
        info.amount      += amount;
        info.totalStaked += amount;
        if (info.stakedAt == 0) info.stakedAt = block.timestamp;
        totalStaked += amount;

        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    /// @notice Withdraw staked tokens. Pending rewards remain claimable.
    function withdraw(uint256 amount) external nonReentrant {
        StakeInfo storage info = stakes[msg.sender];
        if (amount == 0) revert ZeroAmount();
        if (info.amount < amount) revert InsufficientStake();

        _updateReward(msg.sender);

        info.amount -= amount;
        totalStaked -= amount;
        if (info.amount == 0) info.stakedAt = 0;

        stakingToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Claim all pending rewards.
    function claimRewards() external nonReentrant {
        _updateReward(msg.sender);
        StakeInfo storage info = stakes[msg.sender];
        uint256 reward = info.pendingRewards;
        if (reward == 0) revert NoRewardsToClaim();

        info.pendingRewards = 0;
        rewardToken.safeTransfer(msg.sender, reward);
        emit RewardClaimed(msg.sender, reward);
    }

    // ── Queries ────────────────────────────────────────────────────────────────

    /// @notice Returns the current pending reward for a user.
    function pendingReward(address user) external view returns (uint256) {
        StakeInfo storage info = stakes[user];
        uint256 rpt = _currentRewardPerToken();
        uint256 earned = (info.amount * (rpt - info.rewardDebt)) / 1e18;
        return info.pendingRewards + earned;
    }

    /// @notice Returns full stake info for a user.
    function getStakeInfo(address user) external view returns (StakeInfo memory) {
        return stakes[user];
    }

    /// @notice Returns the staking period duration (seconds since first stake).
    function stakingPeriod(address user) external view returns (uint256) {
        uint256 start = stakes[user].stakedAt;
        if (start == 0) return 0;
        return block.timestamp - start;
    }

    // ── Internal ───────────────────────────────────────────────────────────────

    function _currentRewardPerToken() internal view returns (uint256) {
        if (totalStaked == 0) return rewardPerTokenStored;
        uint256 elapsed = block.timestamp - lastUpdateTime;
        return rewardPerTokenStored + (elapsed * rewardPerSecond * 1e18) / totalStaked;
    }

    function _updateReward(address user) internal {
        rewardPerTokenStored = _currentRewardPerToken();
        lastUpdateTime = block.timestamp;

        if (user != address(0)) {
            StakeInfo storage info = stakes[user];
            uint256 earned = (info.amount * (rewardPerTokenStored - info.rewardDebt)) / 1e18;
            info.pendingRewards += earned;
            info.rewardDebt = rewardPerTokenStored;
        }
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title HarvestFunction
 * @notice Implements reward identification, harvesting operations, history tracking,
 *         fee calculation, and query functionality.
 */
contract HarvestFunction is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Errors ─────────────────────────────────────────────────────────────────
    error ZeroAddress();
    error ZeroAmount();
    error InvalidFeeBps();
    error SourceNotFound();
    error SourceNotActive();
    error InsufficientRewardBalance();
    error NoRewardsToHarvest();
    error TransferFailed();

    // ── Types ──────────────────────────────────────────────────────────────────

    struct RewardSource {
        uint256 id;
        string name;
        address rewardToken;       // Address of the reward token (address(0) for native ETH)
        uint256 rewardRate;        // Reward tokens accumulated per second
        uint256 lastUpdateTime;    // Timestamp of last update
        uint256 accRewardPerShare; // Accumulated rewards per share (scaled by 1e12)
        uint256 totalStaked;       // Total tokens staked in this source
        uint256 feeBps;           // Harvest fee in basis points (e.g. 100 = 1%)
        bool isActive;             // Status of the reward source
    }

    struct UserPosition {
        uint256 stakeAmount;       // Amount staked by user
        uint256 rewardDebt;        // Reward debt
        uint256 accumulatedReward; // Unclaimed rewards accumulated
    }

    struct HarvestRecord {
        uint256 sourceId;
        address user;
        address harvester;
        uint256 rewardAmount;
        uint256 feeAmount;
        uint256 netAmount;
        uint256 timestamp;
    }

    // ── Events ─────────────────────────────────────────────────────────────────
    event RewardSourceAdded(
        uint256 indexed sourceId,
        string name,
        address indexed rewardToken,
        uint256 rewardRate,
        uint256 feeBps
    );
    event RewardSourceUpdated(
        uint256 indexed sourceId,
        uint256 rewardRate,
        uint256 feeBps,
        bool isActive
    );
    event Staked(uint256 indexed sourceId, address indexed user, uint256 amount);
    event Withdrawn(uint256 indexed sourceId, address indexed user, uint256 amount);
    event Harvested(
        uint256 indexed sourceId,
        address indexed user,
        address indexed harvester,
        uint256 rewardAmount,
        uint256 feeAmount,
        uint256 netAmount
    );
    event FeeTreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event EmergencyWithdrawn(uint256 indexed sourceId, address indexed user, uint256 amount);

    // ── Constants ──────────────────────────────────────────────────────────────
    uint256 public constant MAX_FEE_BPS = 2000; // Maximum harvest fee: 20%
    uint256 public constant FEE_DENOMINATOR = 10000;
    uint256 public constant SHARE_MULTIPLIER = 1e12;

    // ── State ──────────────────────────────────────────────────────────────────
    uint256 public sourceCount;
    address public feeTreasury;

    // sourceId => RewardSource
    mapping(uint256 => RewardSource) public rewardSources;
    
    // sourceId => userAddress => UserPosition
    mapping(uint256 => mapping(address => UserPosition)) public userPositions;

    // Complete history of harvests
    HarvestRecord[] private _harvestHistory;

    // sourceId => userAddress => list of indices in _harvestHistory
    mapping(uint256 => mapping(address => uint256[])) private _userHarvestIndices;

    // ── Constructor ────────────────────────────────────────────────────────────
    constructor(address _feeTreasury) Ownable(msg.sender) {
        if (_feeTreasury == address(0)) revert ZeroAddress();
        feeTreasury = _feeTreasury;
        emit FeeTreasuryUpdated(address(0), _feeTreasury);
    }

    // ── Admin Functions ────────────────────────────────────────────────────────

    /**
     * @notice Add a new reward source
     */
    function addRewardSource(
        string calldata name,
        address rewardToken,
        uint256 rewardRate,
        uint256 feeBps
    ) external onlyOwner returns (uint256 sourceId) {
        if (feeBps > MAX_FEE_BPS) revert InvalidFeeBps();
        
        sourceId = ++sourceCount;
        rewardSources[sourceId] = RewardSource({
            id: sourceId,
            name: name,
            rewardToken: rewardToken,
            rewardRate: rewardRate,
            lastUpdateTime: block.timestamp,
            accRewardPerShare: 0,
            totalStaked: 0,
            feeBps: feeBps,
            isActive: true
        });

        emit RewardSourceAdded(sourceId, name, rewardToken, rewardRate, feeBps);
    }

    /**
     * @notice Update an existing reward source
     */
    function updateRewardSource(
        uint256 sourceId,
        uint256 rewardRate,
        uint256 feeBps,
        bool isActive
    ) external onlyOwner {
        RewardSource storage source = rewardSources[sourceId];
        if (source.id == 0) revert SourceNotFound();
        if (feeBps > MAX_FEE_BPS) revert InvalidFeeBps();

        _updatePool(sourceId);

        source.rewardRate = rewardRate;
        source.feeBps = feeBps;
        source.isActive = isActive;

        emit RewardSourceUpdated(sourceId, rewardRate, feeBps, isActive);
    }

    /**
     * @notice Set a new fee treasury address
     */
    function setFeeTreasury(address _feeTreasury) external onlyOwner {
        if (_feeTreasury == address(0)) revert ZeroAddress();
        address oldTreasury = feeTreasury;
        feeTreasury = _feeTreasury;
        emit FeeTreasuryUpdated(oldTreasury, _feeTreasury);
    }

    // ── Staking logic (to enable yield generation & testing) ───────────────────

    /**
     * @notice Stake tokens into a reward source
     */
    function stake(uint256 sourceId, uint256 amount) external nonReentrant {
        RewardSource storage source = rewardSources[sourceId];
        if (source.id == 0) revert SourceNotFound();
        if (!source.isActive) revert SourceNotActive();
        if (amount == 0) revert ZeroAmount();

        _updatePool(sourceId);

        UserPosition storage position = userPositions[sourceId][msg.sender];
        if (position.stakeAmount > 0) {
            uint256 pending = (position.stakeAmount * source.accRewardPerShare) / SHARE_MULTIPLIER - position.rewardDebt;
            position.accumulatedReward += pending;
        }

        if (source.rewardToken != address(0)) {
            // If rewardToken is different from staked token, stake using rewardToken or assume 1-1 or a staking token.
            // To keep it simple, we stake the rewardToken itself to earn more rewardToken (single-token staking)
            IERC20(source.rewardToken).safeTransferFrom(msg.sender, address(this), amount);
        } else {
            // Native ETH staking
            revert("Staking native ETH not supported via this function");
        }

        position.stakeAmount += amount;
        source.totalStaked += amount;
        position.rewardDebt = (position.stakeAmount * source.accRewardPerShare) / SHARE_MULTIPLIER;

        emit Staked(sourceId, msg.sender, amount);
    }

    /**
     * @notice Withdraw staked tokens from a reward source
     */
    function withdraw(uint256 sourceId, uint256 amount) external nonReentrant {
        RewardSource storage source = rewardSources[sourceId];
        if (source.id == 0) revert SourceNotFound();
        UserPosition storage position = userPositions[sourceId][msg.sender];
        if (position.stakeAmount < amount) revert InsufficientRewardBalance();
        if (amount == 0) revert ZeroAmount();

        _updatePool(sourceId);

        uint256 pending = (position.stakeAmount * source.accRewardPerShare) / SHARE_MULTIPLIER - position.rewardDebt;
        position.accumulatedReward += pending;

        position.stakeAmount -= amount;
        source.totalStaked -= amount;
        position.rewardDebt = (position.stakeAmount * source.accRewardPerShare) / SHARE_MULTIPLIER;

        if (source.rewardToken != address(0)) {
            IERC20(source.rewardToken).safeTransfer(msg.sender, amount);
        }

        emit Withdrawn(sourceId, msg.sender, amount);
    }

    /**
     * @notice Emergency withdraw without caring about rewards
     */
    function emergencyWithdraw(uint256 sourceId) external nonReentrant {
        RewardSource storage source = rewardSources[sourceId];
        if (source.id == 0) revert SourceNotFound();
        UserPosition storage position = userPositions[sourceId][msg.sender];
        uint256 amount = position.stakeAmount;
        if (amount == 0) revert ZeroAmount();

        position.stakeAmount = 0;
        position.rewardDebt = 0;
        position.accumulatedReward = 0;
        source.totalStaked = source.totalStaked > amount ? source.totalStaked - amount : 0;

        if (source.rewardToken != address(0)) {
            IERC20(source.rewardToken).safeTransfer(msg.sender, amount);
        }

        emit EmergencyWithdrawn(sourceId, msg.sender, amount);
    }

    // ── Harvest Operations ─────────────────────────────────────────────────────

    /**
     * @notice Harvest rewards from a single reward source for a user
     */
    function harvest(uint256 sourceId, address user) external nonReentrant returns (uint256 netAmount) {
        RewardSource storage source = rewardSources[sourceId];
        if (source.id == 0) revert SourceNotFound();
        if (!source.isActive) revert SourceNotActive();
        if (user == address(0)) revert ZeroAddress();

        _updatePool(sourceId);

        UserPosition storage position = userPositions[sourceId][user];
        uint256 pending = (position.stakeAmount * source.accRewardPerShare) / SHARE_MULTIPLIER - position.rewardDebt;
        uint256 totalReward = position.accumulatedReward + pending;
        
        if (totalReward == 0) revert NoRewardsToHarvest();

        // Reset user rewards
        position.accumulatedReward = 0;
        position.rewardDebt = (position.stakeAmount * source.accRewardPerShare) / SHARE_MULTIPLIER;

        // Calculate fees
        uint256 feeAmount = calculateHarvestFee(totalReward, source.feeBps);
        netAmount = totalReward - feeAmount;

        // Record history
        HarvestRecord memory record = HarvestRecord({
            sourceId: sourceId,
            user: user,
            harvester: msg.sender,
            rewardAmount: totalReward,
            feeAmount: feeAmount,
            netAmount: netAmount,
            timestamp: block.timestamp
        });

        _harvestHistory.push(record);
        _userHarvestIndices[sourceId][user].push(_harvestHistory.length - 1);

        // Distribute tokens
        if (source.rewardToken != address(0)) {
            // Check contract balance
            uint256 bal = IERC20(source.rewardToken).balanceOf(address(this));
            if (bal < totalReward) revert InsufficientRewardBalance();

            if (feeAmount > 0) {
                IERC20(source.rewardToken).safeTransfer(feeTreasury, feeAmount);
            }
            IERC20(source.rewardToken).safeTransfer(user, netAmount);
        } else {
            // Native ETH transfer
            uint256 bal = address(this).balance;
            if (bal < totalReward) revert InsufficientRewardBalance();

            if (feeAmount > 0) {
                (bool successFee, ) = feeTreasury.call{value: feeAmount}("");
                if (!successFee) revert TransferFailed();
            }
            (bool successNet, ) = user.call{value: netAmount}("");
            if (!successNet) revert TransferFailed();
        }

        emit Harvested(sourceId, user, msg.sender, totalReward, feeAmount, netAmount);
    }

    /**
     * @notice Harvest rewards from multiple sources for a user in a single transaction
     */
    function harvestMultiple(uint256[] calldata sourceIds, address user) external returns (uint256[] memory netAmounts) {
        netAmounts = new uint256[](sourceIds.length);
        for (uint256 i = 0; i < sourceIds.length; i++) {
            netAmounts[i] = this.harvest(sourceIds[i], user);
        }
    }

    // ── Fee Calculation ────────────────────────────────────────────────────────

    /**
     * @notice Calculate harvest fee for a given reward amount and fee BPS
     */
    function calculateHarvestFee(uint256 amount, uint256 feeBps) public pure returns (uint256) {
        if (feeBps > FEE_DENOMINATOR) revert InvalidFeeBps();
        return (amount * feeBps) / FEE_DENOMINATOR;
    }

    // ── Queries ────────────────────────────────────────────────────────────────

    /**
     * @notice Get pending harvestable rewards for a user
     */
    function getPendingRewards(uint256 sourceId, address user) external view returns (uint256) {
        RewardSource memory source = rewardSources[sourceId];
        if (source.id == 0) return 0;
        
        UserPosition memory position = userPositions[sourceId][user];
        uint256 accRewardPerShare = source.accRewardPerShare;
        
        if (block.timestamp > source.lastUpdateTime && source.totalStaked > 0) {
            uint256 elapsed = block.timestamp - source.lastUpdateTime;
            uint256 reward = elapsed * source.rewardRate;
            accRewardPerShare += (reward * SHARE_MULTIPLIER) / source.totalStaked;
        }
        
        return position.accumulatedReward + ((position.stakeAmount * accRewardPerShare) / SHARE_MULTIPLIER - position.rewardDebt);
    }

    /**
     * @notice Get harvest history records for a specific source and user
     */
    function getHarvestHistory(uint256 sourceId, address user) external view returns (HarvestRecord[] memory) {
        uint256[] memory indices = _userHarvestIndices[sourceId][user];
        HarvestRecord[] memory records = new HarvestRecord[](indices.length);
        for (uint256 i = 0; i < indices.length; i++) {
            records[i] = _harvestHistory[indices[i]];
        }
        return records;
    }

    /**
     * @notice Get the total count of harvest history records
     */
    function getHarvestHistoryCount() external view returns (uint256) {
        return _harvestHistory.length;
    }

    /**
     * @notice Get a specific harvest history record by index
     */
    function getHarvestHistoryRecord(uint256 index) external view returns (HarvestRecord memory) {
        return _harvestHistory[index];
    }

    /**
     * @notice Query active reward sources count
     */
    function getActiveSourcesCount() external view returns (uint256 activeCount) {
        for (uint256 i = 1; i <= sourceCount; i++) {
            if (rewardSources[i].isActive) {
                activeCount++;
            }
        }
    }

    // ── Internal Functions ─────────────────────────────────────────────────────

    /**
     * @notice Update pool's reward accumulator
     */
    function _updatePool(uint256 sourceId) internal {
        RewardSource storage source = rewardSources[sourceId];
        if (block.timestamp <= source.lastUpdateTime) {
            return;
        }

        if (source.totalStaked == 0) {
            source.lastUpdateTime = block.timestamp;
            return;
        }

        uint256 elapsed = block.timestamp - source.lastUpdateTime;
        uint256 reward = elapsed * source.rewardRate;
        source.accRewardPerShare += (reward * SHARE_MULTIPLIER) / source.totalStaked;
        source.lastUpdateTime = block.timestamp;
    }

    // To allow receiving native ETH rewards
    receive() external payable {}
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {mulDiv} from "@prb/math/src/Common.sol";

/**
 * @title  RewardDistribution
 * @notice Calculates reward allocations, distributes them fairly, tracks history,
 *         and supports linear vesting schedules.
 *
 * Flow:
 *   1. Owner creates a distribution round with a total reward amount and a list
 *      of recipients with relative weights.
 *   2. Rewards are allocated proportionally to weights.
 *   3. Each allocation may optionally vest linearly over a vesting period.
 *   4. Recipients call claim() to receive vested tokens at any time.
 */
contract RewardDistribution is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Errors ─────────────────────────────────────────────────────────────────
    error ZeroAmount();
    error ZeroAddress();
    error InvalidRecipients();
    error RoundNotFound();
    error RoundAlreadyDistributed();
    error NothingToVest();
    error InvalidVestingPeriod();

    // ── Types ──────────────────────────────────────────────────────────────────

    struct Recipient {
        address account;
        uint256 weight;   // relative weight; allocation = totalReward * weight / totalWeight
    }

    struct Round {
        uint256 totalReward;
        uint256 vestingPeriod;   // seconds; 0 = immediate (no vesting)
        uint256 distributedAt;   // 0 until distribute() is called
        bool    distributed;
        string  description;
    }

    struct VestingSchedule {
        uint256 totalAmount;
        uint256 claimedAmount;
        uint256 startTime;
        uint256 vestingPeriod;   // 0 = fully vested immediately
    }

    // ── Events ─────────────────────────────────────────────────────────────────
    event RoundCreated(uint256 indexed roundId, uint256 totalReward, uint256 vestingPeriod);
    event RoundDistributed(uint256 indexed roundId, uint256 recipientCount);
    event RewardClaimed(uint256 indexed roundId, address indexed recipient, uint256 amount);
    event RewardFunded(uint256 amount);

    // ── State ──────────────────────────────────────────────────────────────────

    IERC20 public immutable rewardToken;

    uint256 public roundCount;
    mapping(uint256 => Round) public rounds;

    // roundId => user => VestingSchedule
    mapping(uint256 => mapping(address => VestingSchedule)) public schedules;

    // Full distribution history: roundId => list of recipients
    mapping(uint256 => Recipient[]) private _roundRecipients;

    // ── Constructor ────────────────────────────────────────────────────────────

    constructor(address _rewardToken) Ownable(msg.sender) {
        if (_rewardToken == address(0)) revert ZeroAddress();
        rewardToken = IERC20(_rewardToken);
    }

    // ── Admin ──────────────────────────────────────────────────────────────────

    /// @notice Fund the contract with reward tokens.
    function fund(uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
        emit RewardFunded(amount);
    }

    /**
     * @notice Create a new distribution round.
     * @param totalReward    Total tokens to distribute in this round.
     * @param vestingPeriod  Seconds over which rewards vest linearly. 0 = no vesting.
     * @param description    Human-readable label.
     * @return roundId       The new round's ID.
     */
    function createRound(uint256 totalReward, uint256 vestingPeriod, string calldata description)
        external
        onlyOwner
        returns (uint256 roundId)
    {
        if (totalReward == 0) revert ZeroAmount();
        roundId = ++roundCount;
        rounds[roundId] = Round({
            totalReward: totalReward,
            vestingPeriod: vestingPeriod,
            distributedAt: 0,
            distributed: false,
            description: description
        });
        emit RoundCreated(roundId, totalReward, vestingPeriod);
    }

    /**
     * @notice Distribute a round to recipients proportionally by weight.
     * @param roundId     Round to distribute.
     * @param recipients  List of recipients with weights. Weights need not sum to any
     *                    specific value; allocations are computed proportionally.
     */
    function distribute(uint256 roundId, Recipient[] calldata recipients) external onlyOwner {
        Round storage round = rounds[roundId];
        if (round.totalReward == 0) revert RoundNotFound();
        if (round.distributed) revert RoundAlreadyDistributed();
        if (recipients.length == 0) revert InvalidRecipients();

        // Compute total weight
        uint256 totalWeight;
        for (uint256 i; i < recipients.length; ++i) {
            if (recipients[i].account == address(0)) revert ZeroAddress();
            totalWeight += recipients[i].weight;
        }
        if (totalWeight == 0) revert InvalidRecipients();

        round.distributed   = true;
        round.distributedAt = block.timestamp;

        uint256 allocated;
        for (uint256 i; i < recipients.length; ++i) {
            uint256 amount;
            if (i == recipients.length - 1) {
                // Last recipient absorbs rounding dust
                amount = round.totalReward - allocated;
            } else {
                amount = mulDiv(round.totalReward, recipients[i].weight, totalWeight);
                allocated += amount;
            }
            if (amount == 0) continue;

            schedules[roundId][recipients[i].account] = VestingSchedule({
                totalAmount:   amount,
                claimedAmount: 0,
                startTime:     block.timestamp,
                vestingPeriod: round.vestingPeriod
            });

            _roundRecipients[roundId].push(recipients[i]);
        }

        emit RoundDistributed(roundId, recipients.length);
    }

    // ── Claiming ───────────────────────────────────────────────────────────────

    /// @notice Claim all currently vested tokens for a given round.
    function claim(uint256 roundId) external nonReentrant {
        VestingSchedule storage vs = schedules[roundId][msg.sender];
        if (vs.totalAmount == 0) revert NothingToVest();

        uint256 vested = _vestedAmount(vs);
        uint256 claimable = vested - vs.claimedAmount;
        if (claimable == 0) revert NothingToVest();

        vs.claimedAmount += claimable;
        rewardToken.safeTransfer(msg.sender, claimable);
        emit RewardClaimed(roundId, msg.sender, claimable);
    }

    // ── Queries ────────────────────────────────────────────────────────────────

    /// @notice Returns the claimable (vested but unclaimed) amount for a user in a round.
    function claimable(uint256 roundId, address user) external view returns (uint256) {
        VestingSchedule storage vs = schedules[roundId][user];
        if (vs.totalAmount == 0) return 0;
        return _vestedAmount(vs) - vs.claimedAmount;
    }

    /// @notice Returns the full vesting schedule for a user in a round.
    function getSchedule(uint256 roundId, address user) external view returns (VestingSchedule memory) {
        return schedules[roundId][user];
    }

    /// @notice Returns round details.
    function getRound(uint256 roundId) external view returns (Round memory) {
        return rounds[roundId];
    }

    /// @notice Returns the recipients of a distribution round.
    function getRoundRecipients(uint256 roundId) external view returns (Recipient[] memory) {
        return _roundRecipients[roundId];
    }

    // ── Internal ───────────────────────────────────────────────────────────────

    function _vestedAmount(VestingSchedule storage vs) internal view returns (uint256) {
        if (vs.vestingPeriod == 0) return vs.totalAmount; // no vesting
        uint256 elapsed = block.timestamp - vs.startTime;
        if (elapsed >= vs.vestingPeriod) return vs.totalAmount;
        return mulDiv(vs.totalAmount, elapsed, vs.vestingPeriod);
    }
}

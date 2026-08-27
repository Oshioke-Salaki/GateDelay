// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title RewardVesting
/// @notice Linear reward vesting with optional cliff periods.
/// @dev Each beneficiary may hold multiple independent schedules. Schedules vest
///      linearly after the cliff and can optionally be revoked by the owner, which
///      pays out accrued tokens to the beneficiary and returns the rest to the owner.
contract RewardVesting is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Errors ─────────────────────────────────────────────────────────────────
    error ZeroAddress();
    error ZeroAmount();
    error ZeroDuration();
    error CliffExceedsDuration();
    error ScheduleNotFound();
    error CliffNotReached();
    error NothingToClaim();
    error NotRevocable();
    error AlreadyRevoked();

    // ── Types ──────────────────────────────────────────────────────────────────

    /// @notice A single linear vesting schedule
    struct VestingSchedule {
        address beneficiary;     // Who receives vested tokens
        uint256 totalAmount;     // Total tokens committed to this schedule
        uint256 claimedAmount;   // Tokens already transferred to beneficiary
        uint256 startTime;       // Unix timestamp when vesting started
        uint256 cliffDuration;   // Seconds before any tokens can be claimed
        uint256 vestingDuration; // Total vesting period in seconds
        bool revocable;          // Whether owner may cancel this schedule
        bool revoked;            // Whether schedule has been cancelled
    }

    // ── Events ─────────────────────────────────────────────────────────────────
    event ScheduleCreated(
        uint256 indexed scheduleId,
        address indexed beneficiary,
        uint256 totalAmount,
        uint256 cliffDuration,
        uint256 vestingDuration
    );
    event TokensClaimed(uint256 indexed scheduleId, address indexed beneficiary, uint256 amount);
    event ScheduleRevoked(uint256 indexed scheduleId, uint256 unvestedAmount);

    // ── State ──────────────────────────────────────────────────────────────────

    /// @notice The ERC20 token subject to vesting
    IERC20 public immutable vestingToken;

    /// @notice Total number of schedules ever created (monotonically increasing)
    uint256 public scheduleCount;

    /// @notice Maps scheduleId => VestingSchedule
    mapping(uint256 => VestingSchedule) private _schedules;

    /// @notice Maps beneficiary address => list of their schedule IDs
    mapping(address => uint256[]) private _beneficiarySchedules;

    // ── Constructor ────────────────────────────────────────────────────────────

    /// @param _vestingToken ERC20 token to be distributed through vesting schedules
    constructor(address _vestingToken) Ownable(msg.sender) {
        if (_vestingToken == address(0)) revert ZeroAddress();
        vestingToken = IERC20(_vestingToken);
    }

    // ── Schedule Management ────────────────────────────────────────────────────

    /// @notice Create a new vesting schedule and pull tokens from the owner
    /// @param beneficiary Address that receives vested tokens
    /// @param amount Total tokens to vest
    /// @param cliffDuration Seconds before any tokens vest (0 = no cliff)
    /// @param vestingDuration Total vesting period in seconds
    /// @param revocable Whether the owner can revoke this schedule
    /// @return scheduleId Identifier of the created schedule
    function createSchedule(
        address beneficiary,
        uint256 amount,
        uint256 cliffDuration,
        uint256 vestingDuration,
        bool revocable
    ) external onlyOwner returns (uint256 scheduleId) {
        if (beneficiary == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (vestingDuration == 0) revert ZeroDuration();
        if (cliffDuration > vestingDuration) revert CliffExceedsDuration();

        vestingToken.safeTransferFrom(msg.sender, address(this), amount);

        scheduleId = scheduleCount++;
        _schedules[scheduleId] = VestingSchedule({
            beneficiary: beneficiary,
            totalAmount: amount,
            claimedAmount: 0,
            startTime: block.timestamp,
            cliffDuration: cliffDuration,
            vestingDuration: vestingDuration,
            revocable: revocable,
            revoked: false
        });

        _beneficiarySchedules[beneficiary].push(scheduleId);

        emit ScheduleCreated(scheduleId, beneficiary, amount, cliffDuration, vestingDuration);
    }

    /// @notice Claim all currently vested tokens for a schedule
    /// @dev Anyone may call on behalf of the beneficiary; tokens always go to beneficiary
    /// @param scheduleId Schedule to claim from
    function claim(uint256 scheduleId) external nonReentrant {
        if (scheduleId >= scheduleCount) revert ScheduleNotFound();

        VestingSchedule storage schedule = _schedules[scheduleId];
        if (schedule.revoked) revert AlreadyRevoked();
        if (block.timestamp < schedule.startTime + schedule.cliffDuration) revert CliffNotReached();

        uint256 claimable = _vestedAmount(schedule) - schedule.claimedAmount;
        if (claimable == 0) revert NothingToClaim();

        schedule.claimedAmount += claimable;
        vestingToken.safeTransfer(schedule.beneficiary, claimable);

        emit TokensClaimed(scheduleId, schedule.beneficiary, claimable);
    }

    /// @notice Revoke a revocable schedule and return unvested tokens to the owner
    /// @dev Vested-but-unclaimed tokens are sent to the beneficiary before revocation
    /// @param scheduleId Schedule to revoke
    function revoke(uint256 scheduleId) external onlyOwner {
        if (scheduleId >= scheduleCount) revert ScheduleNotFound();

        VestingSchedule storage schedule = _schedules[scheduleId];
        if (!schedule.revocable) revert NotRevocable();
        if (schedule.revoked) revert AlreadyRevoked();

        uint256 vested = _vestedAmount(schedule);
        uint256 claimableByBeneficiary = vested - schedule.claimedAmount;
        uint256 unvested = schedule.totalAmount - vested;

        schedule.revoked = true;

        if (claimableByBeneficiary > 0) {
            schedule.claimedAmount += claimableByBeneficiary;
            vestingToken.safeTransfer(schedule.beneficiary, claimableByBeneficiary);
        }

        if (unvested > 0) {
            vestingToken.safeTransfer(owner(), unvested);
        }

        emit ScheduleRevoked(scheduleId, unvested);
    }

    // ── Internal Helpers ───────────────────────────────────────────────────────

    /// @notice Compute total tokens vested under linear schedule at the current time
    function _vestedAmount(VestingSchedule storage schedule) internal view returns (uint256) {
        if (block.timestamp < schedule.startTime + schedule.cliffDuration) return 0;

        uint256 elapsed = block.timestamp - schedule.startTime;
        if (elapsed >= schedule.vestingDuration) return schedule.totalAmount;

        return (schedule.totalAmount * elapsed) / schedule.vestingDuration;
    }

    // ── Query Functions ────────────────────────────────────────────────────────

    /// @notice Get the full vesting schedule by ID
    /// @param scheduleId Schedule to query
    /// @return VestingSchedule struct
    function getSchedule(uint256 scheduleId) external view returns (VestingSchedule memory) {
        if (scheduleId >= scheduleCount) revert ScheduleNotFound();
        return _schedules[scheduleId];
    }

    /// @notice Amount claimable right now for a given schedule
    /// @param scheduleId Schedule to query
    /// @return Tokens available for immediate claim
    function getClaimableAmount(uint256 scheduleId) external view returns (uint256) {
        if (scheduleId >= scheduleCount) revert ScheduleNotFound();
        VestingSchedule storage schedule = _schedules[scheduleId];
        if (schedule.revoked) return 0;
        if (block.timestamp < schedule.startTime + schedule.cliffDuration) return 0;
        return _vestedAmount(schedule) - schedule.claimedAmount;
    }

    /// @notice Total tokens vested so far (including already claimed)
    /// @param scheduleId Schedule to query
    /// @return Cumulative vested amount
    function getVestedAmount(uint256 scheduleId) external view returns (uint256) {
        if (scheduleId >= scheduleCount) revert ScheduleNotFound();
        return _vestedAmount(_schedules[scheduleId]);
    }

    /// @notice All schedule IDs belonging to a beneficiary
    /// @param beneficiary Address to query
    /// @return Array of schedule IDs
    function getBeneficiarySchedules(address beneficiary) external view returns (uint256[] memory) {
        return _beneficiarySchedules[beneficiary];
    }

    /// @notice Seconds remaining until the cliff is reached (0 if already passed)
    /// @param scheduleId Schedule to query
    /// @return Seconds until cliff
    function getTimeToCliff(uint256 scheduleId) external view returns (uint256) {
        if (scheduleId >= scheduleCount) revert ScheduleNotFound();
        VestingSchedule storage schedule = _schedules[scheduleId];
        uint256 cliffTime = schedule.startTime + schedule.cliffDuration;
        if (block.timestamp >= cliffTime) return 0;
        return cliffTime - block.timestamp;
    }

    /// @notice Seconds remaining until the schedule is fully vested (0 if complete)
    /// @param scheduleId Schedule to query
    /// @return Seconds until full vesting
    function getTimeToFullVest(uint256 scheduleId) external view returns (uint256) {
        if (scheduleId >= scheduleCount) revert ScheduleNotFound();
        VestingSchedule storage schedule = _schedules[scheduleId];
        uint256 endTime = schedule.startTime + schedule.vestingDuration;
        if (block.timestamp >= endTime) return 0;
        return endTime - block.timestamp;
    }

    /// @notice Whether the cliff period has been reached for a schedule
    /// @param scheduleId Schedule to query
    /// @return True if cliff has passed
    function isCliffReached(uint256 scheduleId) external view returns (bool) {
        if (scheduleId >= scheduleCount) revert ScheduleNotFound();
        VestingSchedule storage schedule = _schedules[scheduleId];
        return block.timestamp >= schedule.startTime + schedule.cliffDuration;
    }

    /// @notice Total number of schedules ever created
    /// @return scheduleCount
    function getScheduleCount() external view returns (uint256) {
        return scheduleCount;
    }
}

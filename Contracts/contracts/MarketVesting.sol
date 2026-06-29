// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title MarketVesting
/// @notice Token vesting for market participants supporting linear, cliff, and stepped schedules.
/// @dev Each vesting record is self-contained and stores its own token reference, allowing
///      different tokens to be vested per schedule. Progress is tracked as a fraction scaled
///      to 1e18 so callers can display percentages without further math.
contract MarketVesting is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Errors ─────────────────────────────────────────────────────────────────
    error ZeroAddress();
    error ZeroAmount();
    error VestingNotFound();
    error NothingToRelease();
    error NotBeneficiary();
    error InvalidStepCount();
    error VestingRevoked();
    error NotRevocable();
    error AlreadyRevoked();

    // ── Types ──────────────────────────────────────────────────────────────────

    /// @notice Supported vesting curves
    enum VestingType {
        Linear,  // Tokens unlock continuously over the duration
        Cliff,   // All tokens unlock at once at the cliff date
        Stepped  // Tokens unlock in equal increments at each step interval
    }

    /// @notice Complete vesting record for a market participant
    struct VestingRecord {
        address beneficiary;     // Recipient of released tokens
        IERC20 token;            // Token being vested
        uint256 totalAmount;     // Tokens allocated to this schedule
        uint256 releasedAmount;  // Tokens already transferred to beneficiary
        uint256 startTime;       // Unix timestamp when vesting started
        uint256 duration;        // Total vesting period in seconds
        uint256 cliffTime;       // Absolute timestamp before which nothing releases
        VestingType vestingType; // Which release curve applies
        uint256 stepCount;       // Number of equal steps (Stepped type only)
        bool revocable;          // Owner may cancel this record
        bool revoked;            // Whether this record has been cancelled
    }

    // ── Events ─────────────────────────────────────────────────────────────────
    event VestingCreated(
        uint256 indexed vestingId,
        address indexed beneficiary,
        address indexed token,
        uint256 totalAmount,
        VestingType vestingType
    );
    event TokensReleased(uint256 indexed vestingId, address indexed beneficiary, uint256 amount);
    event VestingRevoked(uint256 indexed vestingId, uint256 unvestedReturned);

    // ── State ──────────────────────────────────────────────────────────────────

    /// @notice Total number of vesting records ever created
    uint256 public vestingCount;

    /// @notice Maps vestingId => VestingRecord
    mapping(uint256 => VestingRecord) private _vestings;

    /// @notice Maps beneficiary => list of vesting IDs they own
    mapping(address => uint256[]) private _beneficiaryVestings;

    /// @notice Maps token address => total amount locked in active (non-revoked) vestings
    mapping(address => uint256) public tokenLocked;

    // ── Constructor ────────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ── Vesting Creation ───────────────────────────────────────────────────────

    /// @notice Create a linear vesting schedule where tokens unlock continuously
    /// @param beneficiary Token recipient
    /// @param token ERC20 token to vest
    /// @param amount Total tokens to vest
    /// @param duration Vesting period in seconds
    /// @param cliffDuration Seconds before any tokens can be released (0 = no cliff)
    /// @param revocable Whether owner may cancel this schedule
    /// @return vestingId The created vesting ID
    function createLinearVesting(
        address beneficiary,
        address token,
        uint256 amount,
        uint256 duration,
        uint256 cliffDuration,
        bool revocable
    ) external onlyOwner returns (uint256 vestingId) {
        return _createVesting(beneficiary, token, amount, duration, cliffDuration, VestingType.Linear, 0, revocable);
    }

    /// @notice Create a cliff vesting schedule where all tokens unlock at the cliff date
    /// @param beneficiary Token recipient
    /// @param token ERC20 token to vest
    /// @param amount Total tokens to vest
    /// @param cliffDuration Seconds until the full token release
    /// @param revocable Whether owner may cancel this schedule
    /// @return vestingId The created vesting ID
    function createCliffVesting(
        address beneficiary,
        address token,
        uint256 amount,
        uint256 cliffDuration,
        bool revocable
    ) external onlyOwner returns (uint256 vestingId) {
        return _createVesting(beneficiary, token, amount, cliffDuration, cliffDuration, VestingType.Cliff, 0, revocable);
    }

    /// @notice Create a stepped vesting schedule where equal tranches release at fixed intervals
    /// @param beneficiary Token recipient
    /// @param token ERC20 token to vest
    /// @param amount Total tokens to vest
    /// @param duration Total vesting period in seconds
    /// @param stepCount Number of equal release steps (1–1000)
    /// @param revocable Whether owner may cancel this schedule
    /// @return vestingId The created vesting ID
    function createSteppedVesting(
        address beneficiary,
        address token,
        uint256 amount,
        uint256 duration,
        uint256 stepCount,
        bool revocable
    ) external onlyOwner returns (uint256 vestingId) {
        if (stepCount == 0 || stepCount > 1000) revert InvalidStepCount();
        return _createVesting(beneficiary, token, amount, duration, 0, VestingType.Stepped, stepCount, revocable);
    }

    /// @notice Release all currently available tokens for a vesting record
    /// @dev Only the beneficiary may trigger a release
    /// @param vestingId Vesting to release from
    function release(uint256 vestingId) external nonReentrant {
        if (vestingId >= vestingCount) revert VestingNotFound();

        VestingRecord storage v = _vestings[vestingId];
        if (v.revoked) revert VestingRevoked();
        if (msg.sender != v.beneficiary) revert NotBeneficiary();

        uint256 releasable = _releasableAmount(v);
        if (releasable == 0) revert NothingToRelease();

        v.releasedAmount += releasable;
        tokenLocked[address(v.token)] -= releasable;

        v.token.safeTransfer(v.beneficiary, releasable);

        emit TokensReleased(vestingId, v.beneficiary, releasable);
    }

    /// @notice Cancel a revocable vesting schedule
    /// @dev Vested-but-unreleased tokens go to beneficiary; unvested tokens return to owner
    /// @param vestingId Vesting to cancel
    function revoke(uint256 vestingId) external onlyOwner {
        if (vestingId >= vestingCount) revert VestingNotFound();

        VestingRecord storage v = _vestings[vestingId];
        if (!v.revocable) revert NotRevocable();
        if (v.revoked) revert AlreadyRevoked();

        uint256 totalVested = _vestedAmount(v);
        uint256 claimable = totalVested - v.releasedAmount;
        uint256 unvested = v.totalAmount - totalVested;

        v.revoked = true;

        if (claimable > 0) {
            v.releasedAmount += claimable;
            tokenLocked[address(v.token)] -= claimable;
            v.token.safeTransfer(v.beneficiary, claimable);
        }

        if (unvested > 0) {
            tokenLocked[address(v.token)] -= unvested;
            v.token.safeTransfer(owner(), unvested);
        }

        emit VestingRevoked(vestingId, unvested);
    }

    // ── Internal Helpers ───────────────────────────────────────────────────────

    /// @notice Shared vesting creation logic used by all three public factory functions
    function _createVesting(
        address beneficiary,
        address token,
        uint256 amount,
        uint256 duration,
        uint256 cliffDuration,
        VestingType vestingType,
        uint256 stepCount,
        bool revocable
    ) internal returns (uint256 vestingId) {
        if (beneficiary == address(0)) revert ZeroAddress();
        if (token == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (duration == 0) revert ZeroAmount();

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        vestingId = vestingCount++;
        _vestings[vestingId] = VestingRecord({
            beneficiary: beneficiary,
            token: IERC20(token),
            totalAmount: amount,
            releasedAmount: 0,
            startTime: block.timestamp,
            duration: duration,
            cliffTime: block.timestamp + cliffDuration,
            vestingType: vestingType,
            stepCount: stepCount,
            revocable: revocable,
            revoked: false
        });

        _beneficiaryVestings[beneficiary].push(vestingId);
        tokenLocked[token] += amount;

        emit VestingCreated(vestingId, beneficiary, token, amount, vestingType);
    }

    /// @notice Tokens available for release right now
    function _releasableAmount(VestingRecord storage v) internal view returns (uint256) {
        if (block.timestamp < v.cliffTime) return 0;
        return _vestedAmount(v) - v.releasedAmount;
    }

    /// @notice Total tokens vested based on the schedule's vesting type
    function _vestedAmount(VestingRecord storage v) internal view returns (uint256) {
        uint256 elapsed = block.timestamp - v.startTime;

        if (v.vestingType == VestingType.Cliff) {
            return block.timestamp >= v.cliffTime ? v.totalAmount : 0;
        }

        if (elapsed >= v.duration) return v.totalAmount;

        if (v.vestingType == VestingType.Linear) {
            return (v.totalAmount * elapsed) / v.duration;
        }

        if (v.vestingType == VestingType.Stepped) {
            uint256 stepDuration = v.duration / v.stepCount;
            uint256 completedSteps = elapsed / stepDuration;
            if (completedSteps > v.stepCount) completedSteps = v.stepCount;
            return (v.totalAmount * completedSteps) / v.stepCount;
        }

        return 0;
    }

    // ── Query Functions ────────────────────────────────────────────────────────

    /// @notice Retrieve the full vesting record
    /// @param vestingId Vesting to query
    /// @return VestingRecord struct
    function getVesting(uint256 vestingId) external view returns (VestingRecord memory) {
        if (vestingId >= vestingCount) revert VestingNotFound();
        return _vestings[vestingId];
    }

    /// @notice Tokens available for immediate release
    /// @param vestingId Vesting to query
    /// @return Releasable token amount
    function getReleasableAmount(uint256 vestingId) external view returns (uint256) {
        if (vestingId >= vestingCount) revert VestingNotFound();
        VestingRecord storage v = _vestings[vestingId];
        if (v.revoked) return 0;
        return _releasableAmount(v);
    }

    /// @notice Total tokens vested so far (including already released)
    /// @param vestingId Vesting to query
    /// @return Cumulative vested amount
    function getVestedAmount(uint256 vestingId) external view returns (uint256) {
        if (vestingId >= vestingCount) revert VestingNotFound();
        return _vestedAmount(_vestings[vestingId]);
    }

    /// @notice Vesting progress as a fraction of totalAmount scaled to 1e18
    /// @param vestingId Vesting to query
    /// @return Progress where 1e18 represents 100% vested
    function getVestingProgress(uint256 vestingId) external view returns (uint256) {
        if (vestingId >= vestingCount) revert VestingNotFound();
        VestingRecord storage v = _vestings[vestingId];
        if (v.totalAmount == 0) return 0;
        return (_vestedAmount(v) * 1e18) / v.totalAmount;
    }

    /// @notice All vesting IDs assigned to a beneficiary
    /// @param beneficiary Address to query
    /// @return Array of vesting IDs
    function getBeneficiaryVestings(address beneficiary) external view returns (uint256[] memory) {
        return _beneficiaryVestings[beneficiary];
    }

    /// @notice Whether the cliff timestamp has been reached
    /// @param vestingId Vesting to query
    /// @return True if cliff has passed
    function isCliffPassed(uint256 vestingId) external view returns (bool) {
        if (vestingId >= vestingCount) revert VestingNotFound();
        return block.timestamp >= _vestings[vestingId].cliffTime;
    }

    /// @notice Total number of vesting records created
    /// @return vestingCount
    function getVestingCount() external view returns (uint256) {
        return vestingCount;
    }
}

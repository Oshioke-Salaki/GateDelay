// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title TimelockVesting
/// @notice Linear vesting with a mandatory timelock between queuing and executing each release.
/// @dev A guardian role may authorise early releases (before the normal vesting schedule)
///      without bypassing the timelock safety delay. Revocation pays out accrued tokens
///      immediately and returns unvested tokens to the owner.
contract TimelockVesting is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Errors ─────────────────────────────────────────────────────────────────
    error ZeroAddress();
    error ZeroAmount();
    error VestingNotFound();
    error ReleaseNotFound();
    error TimelockNotExpired();
    error ReleaseNotPending();
    error ReleaseAlreadyQueued();
    error NothingToRelease();
    error NotBeneficiaryOrOwner();
    error NotGuardian();
    error InvalidTimelockDelay();
    error VestingRevoked();
    error NotRevocable();
    error AlreadyRevoked();

    // ── Types ──────────────────────────────────────────────────────────────────

    /// @notice Lifecycle state of a queued release operation
    enum ReleaseStatus {
        None,      // Slot unused
        Pending,   // Queued, timelock running
        Executed,  // Transferred to beneficiary
        Cancelled  // Abandoned before execution
    }

    /// @notice Linear vesting schedule with per-release timelock enforcement
    struct VestingSchedule {
        address beneficiary;     // Token recipient
        IERC20 token;            // Token being vested
        uint256 totalAmount;     // Total tokens committed
        uint256 releasedAmount;  // Tokens already sent to beneficiary
        uint256 startTime;       // Vesting start timestamp
        uint256 vestingDuration; // Total vesting period in seconds
        uint256 cliffDuration;   // Seconds before any tokens vest
        uint256 timelockDelay;   // Required delay between queue and execute
        bool revocable;          // Owner may cancel
        bool revoked;            // Whether cancelled
    }

    /// @notice A release operation queued against a vesting schedule
    struct QueuedRelease {
        uint256 vestingId;       // Parent vesting schedule
        uint256 amount;          // Tokens to transfer on execution
        uint256 queuedAt;        // Timestamp when queued
        uint256 executeAfter;    // Earliest execution timestamp
        ReleaseStatus status;    // Current lifecycle state
        bool isEarlyRelease;     // Guardian-authorised pre-schedule release
    }

    // ── Events ─────────────────────────────────────────────────────────────────
    event VestingCreated(
        uint256 indexed vestingId,
        address indexed beneficiary,
        uint256 totalAmount,
        uint256 timelockDelay
    );
    event ReleaseQueued(
        uint256 indexed releaseId,
        uint256 indexed vestingId,
        uint256 amount,
        uint256 executeAfter
    );
    event ReleaseExecuted(uint256 indexed releaseId, uint256 indexed vestingId, uint256 amount);
    event ReleaseCancelled(uint256 indexed releaseId, uint256 indexed vestingId);
    event EarlyReleaseQueued(uint256 indexed releaseId, uint256 indexed vestingId, address indexed guardian);
    event GuardianUpdated(address indexed oldGuardian, address indexed newGuardian);
    event VestingRevoked(uint256 indexed vestingId, uint256 unvestedAmount);

    // ── Constants ──────────────────────────────────────────────────────────────

    /// @notice Floor on timelockDelay to prevent accidental instant execution
    uint256 public constant MIN_TIMELOCK_DELAY = 1 hours;

    /// @notice Ceiling on timelockDelay to keep schedules usable
    uint256 public constant MAX_TIMELOCK_DELAY = 30 days;

    // ── State ──────────────────────────────────────────────────────────────────

    /// @notice Address authorised to queue early releases
    address public guardian;

    /// @notice Total vesting schedules created
    uint256 public vestingCount;

    /// @notice Total release operations created
    uint256 public releaseCount;

    /// @notice Maps vestingId => VestingSchedule
    mapping(uint256 => VestingSchedule) private _schedules;

    /// @notice Maps releaseId => QueuedRelease
    mapping(uint256 => QueuedRelease) private _releases;

    /// @notice Maps beneficiary => list of vesting IDs
    mapping(address => uint256[]) private _beneficiaryVestings;

    /// @notice Maps vestingId => ordered list of release IDs
    mapping(uint256 => uint256[]) private _vestingReleases;

    /// @notice Whether a vesting currently has a Pending release (prevents double-queuing)
    mapping(uint256 => bool) private _hasPendingRelease;

    // ── Constructor ────────────────────────────────────────────────────────────

    /// @param _guardian Address allowed to queue early releases
    constructor(address _guardian) Ownable(msg.sender) {
        if (_guardian == address(0)) revert ZeroAddress();
        guardian = _guardian;
    }

    // ── Vesting Creation ───────────────────────────────────────────────────────

    /// @notice Create a new timelock vesting schedule
    /// @param beneficiary Token recipient
    /// @param token ERC20 token to vest
    /// @param amount Total tokens to vest
    /// @param vestingDuration Total vesting period in seconds
    /// @param cliffDuration Seconds before linear vesting begins
    /// @param timelockDelay Seconds required between queue and execute (1 hour – 30 days)
    /// @param revocable Whether owner may cancel the schedule
    /// @return vestingId The created schedule ID
    function createVesting(
        address beneficiary,
        address token,
        uint256 amount,
        uint256 vestingDuration,
        uint256 cliffDuration,
        uint256 timelockDelay,
        bool revocable
    ) external onlyOwner returns (uint256 vestingId) {
        if (beneficiary == address(0)) revert ZeroAddress();
        if (token == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (timelockDelay < MIN_TIMELOCK_DELAY || timelockDelay > MAX_TIMELOCK_DELAY) {
            revert InvalidTimelockDelay();
        }

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        vestingId = vestingCount++;
        _schedules[vestingId] = VestingSchedule({
            beneficiary: beneficiary,
            token: IERC20(token),
            totalAmount: amount,
            releasedAmount: 0,
            startTime: block.timestamp,
            vestingDuration: vestingDuration,
            cliffDuration: cliffDuration,
            timelockDelay: timelockDelay,
            revocable: revocable,
            revoked: false
        });

        _beneficiaryVestings[beneficiary].push(vestingId);

        emit VestingCreated(vestingId, beneficiary, amount, timelockDelay);
    }

    // ── Release Management ─────────────────────────────────────────────────────

    /// @notice Queue a release of the currently vested amount, starting the timelock countdown
    /// @dev Snaps the releasable amount at queue time; actual transfer happens on execute
    /// @param vestingId Vesting schedule to release from
    /// @return releaseId The queued release ID
    function queueRelease(uint256 vestingId) external nonReentrant returns (uint256 releaseId) {
        if (vestingId >= vestingCount) revert VestingNotFound();

        VestingSchedule storage schedule = _schedules[vestingId];
        if (schedule.revoked) revert VestingRevoked();
        if (msg.sender != schedule.beneficiary && msg.sender != owner()) revert NotBeneficiaryOrOwner();
        if (_hasPendingRelease[vestingId]) revert ReleaseAlreadyQueued();

        uint256 releasable = _releasableAmount(schedule);
        if (releasable == 0) revert NothingToRelease();

        uint256 executeAfter = block.timestamp + schedule.timelockDelay;
        releaseId = releaseCount++;

        _releases[releaseId] = QueuedRelease({
            vestingId: vestingId,
            amount: releasable,
            queuedAt: block.timestamp,
            executeAfter: executeAfter,
            status: ReleaseStatus.Pending,
            isEarlyRelease: false
        });

        _vestingReleases[vestingId].push(releaseId);
        _hasPendingRelease[vestingId] = true;

        emit ReleaseQueued(releaseId, vestingId, releasable, executeAfter);
    }

    /// @notice Execute a queued release once its timelock has expired
    /// @param releaseId Release operation to execute
    function executeRelease(uint256 releaseId) external nonReentrant {
        if (releaseId >= releaseCount) revert ReleaseNotFound();

        QueuedRelease storage rel = _releases[releaseId];
        if (rel.status != ReleaseStatus.Pending) revert ReleaseNotPending();
        if (block.timestamp < rel.executeAfter) revert TimelockNotExpired();

        VestingSchedule storage schedule = _schedules[rel.vestingId];
        if (schedule.revoked) revert VestingRevoked();

        rel.status = ReleaseStatus.Executed;
        _hasPendingRelease[rel.vestingId] = false;

        schedule.releasedAmount += rel.amount;
        schedule.token.safeTransfer(schedule.beneficiary, rel.amount);

        emit ReleaseExecuted(releaseId, rel.vestingId, rel.amount);
    }

    /// @notice Cancel a pending release before it is executed
    /// @param releaseId Release to cancel
    function cancelRelease(uint256 releaseId) external {
        if (releaseId >= releaseCount) revert ReleaseNotFound();

        QueuedRelease storage rel = _releases[releaseId];
        if (rel.status != ReleaseStatus.Pending) revert ReleaseNotPending();

        VestingSchedule storage schedule = _schedules[rel.vestingId];
        if (msg.sender != schedule.beneficiary && msg.sender != owner()) revert NotBeneficiaryOrOwner();

        rel.status = ReleaseStatus.Cancelled;
        _hasPendingRelease[rel.vestingId] = false;

        emit ReleaseCancelled(releaseId, rel.vestingId);
    }

    /// @notice Guardian queues an early release bypassing normal vesting accrual
    /// @dev The timelock delay still applies; beneficiary receives tokens after it expires
    /// @param vestingId Vesting schedule to draw from
    /// @param amount Amount to release early (capped at unreleased balance)
    /// @return releaseId The queued early release ID
    function queueEarlyRelease(uint256 vestingId, uint256 amount) external nonReentrant returns (uint256 releaseId) {
        if (msg.sender != guardian) revert NotGuardian();
        if (vestingId >= vestingCount) revert VestingNotFound();
        if (amount == 0) revert ZeroAmount();

        VestingSchedule storage schedule = _schedules[vestingId];
        if (schedule.revoked) revert VestingRevoked();
        if (_hasPendingRelease[vestingId]) revert ReleaseAlreadyQueued();

        uint256 remaining = schedule.totalAmount - schedule.releasedAmount;
        if (remaining == 0) revert NothingToRelease();
        if (amount > remaining) amount = remaining;

        uint256 executeAfter = block.timestamp + schedule.timelockDelay;
        releaseId = releaseCount++;

        _releases[releaseId] = QueuedRelease({
            vestingId: vestingId,
            amount: amount,
            queuedAt: block.timestamp,
            executeAfter: executeAfter,
            status: ReleaseStatus.Pending,
            isEarlyRelease: true
        });

        _vestingReleases[vestingId].push(releaseId);
        _hasPendingRelease[vestingId] = true;

        emit EarlyReleaseQueued(releaseId, vestingId, msg.sender);
    }

    /// @notice Revoke a vesting schedule, forwarding accrued tokens and recovering unvested ones
    /// @param vestingId Vesting to revoke
    function revoke(uint256 vestingId) external onlyOwner {
        if (vestingId >= vestingCount) revert VestingNotFound();

        VestingSchedule storage schedule = _schedules[vestingId];
        if (!schedule.revocable) revert NotRevocable();
        if (schedule.revoked) revert AlreadyRevoked();

        uint256 vested = _vestedAmount(schedule);
        uint256 claimable = vested - schedule.releasedAmount;
        uint256 unvested = schedule.totalAmount - vested;

        schedule.revoked = true;
        _hasPendingRelease[vestingId] = false;

        if (claimable > 0) {
            schedule.releasedAmount += claimable;
            schedule.token.safeTransfer(schedule.beneficiary, claimable);
        }

        if (unvested > 0) {
            schedule.token.safeTransfer(owner(), unvested);
        }

        emit VestingRevoked(vestingId, unvested);
    }

    // ── Guardian Management ────────────────────────────────────────────────────

    /// @notice Replace the guardian address
    /// @param newGuardian New guardian (must be non-zero)
    function setGuardian(address newGuardian) external onlyOwner {
        if (newGuardian == address(0)) revert ZeroAddress();
        address old = guardian;
        guardian = newGuardian;
        emit GuardianUpdated(old, newGuardian);
    }

    // ── Internal Helpers ───────────────────────────────────────────────────────

    /// @notice Tokens that can be queued for release under normal vesting rules
    function _releasableAmount(VestingSchedule storage schedule) internal view returns (uint256) {
        if (block.timestamp < schedule.startTime + schedule.cliffDuration) return 0;
        return _vestedAmount(schedule) - schedule.releasedAmount;
    }

    /// @notice Linear vesting amount at the current timestamp
    function _vestedAmount(VestingSchedule storage schedule) internal view returns (uint256) {
        uint256 elapsed = block.timestamp - schedule.startTime;
        if (schedule.vestingDuration == 0 || elapsed >= schedule.vestingDuration) return schedule.totalAmount;
        return (schedule.totalAmount * elapsed) / schedule.vestingDuration;
    }

    // ── Query Functions ────────────────────────────────────────────────────────

    /// @notice Get a vesting schedule by ID
    /// @param vestingId Schedule to query
    /// @return VestingSchedule struct
    function getSchedule(uint256 vestingId) external view returns (VestingSchedule memory) {
        if (vestingId >= vestingCount) revert VestingNotFound();
        return _schedules[vestingId];
    }

    /// @notice Get a queued release operation by ID
    /// @param releaseId Release to query
    /// @return QueuedRelease struct
    function getRelease(uint256 releaseId) external view returns (QueuedRelease memory) {
        if (releaseId >= releaseCount) revert ReleaseNotFound();
        return _releases[releaseId];
    }

    /// @notice All release IDs associated with a vesting schedule
    /// @param vestingId Schedule to query
    /// @return Array of release IDs (in creation order)
    function getVestingReleases(uint256 vestingId) external view returns (uint256[] memory) {
        if (vestingId >= vestingCount) revert VestingNotFound();
        return _vestingReleases[vestingId];
    }

    /// @notice All vesting IDs belonging to a beneficiary
    /// @param beneficiary Address to query
    /// @return Array of vesting IDs
    function getBeneficiaryVestings(address beneficiary) external view returns (uint256[] memory) {
        return _beneficiaryVestings[beneficiary];
    }

    /// @notice Timelock status for the latest pending release on a schedule
    /// @param vestingId Schedule to query
    /// @return hasPending Whether a Pending release exists
    /// @return timeRemaining Seconds until the pending release can execute (0 if ready)
    function getTimelockStatus(uint256 vestingId) external view returns (bool hasPending, uint256 timeRemaining) {
        if (vestingId >= vestingCount) revert VestingNotFound();
        hasPending = _hasPendingRelease[vestingId];
        if (!hasPending) return (false, 0);

        uint256[] storage ids = _vestingReleases[vestingId];
        for (uint256 i = ids.length; i > 0; i--) {
            QueuedRelease storage rel = _releases[ids[i - 1]];
            if (rel.status == ReleaseStatus.Pending) {
                timeRemaining = block.timestamp >= rel.executeAfter ? 0 : rel.executeAfter - block.timestamp;
                return (true, timeRemaining);
            }
        }
    }

    /// @notice Tokens releasable under normal vesting rules right now
    /// @param vestingId Schedule to query
    /// @return Releasable amount
    function getReleasableAmount(uint256 vestingId) external view returns (uint256) {
        if (vestingId >= vestingCount) revert VestingNotFound();
        VestingSchedule storage schedule = _schedules[vestingId];
        if (schedule.revoked) return 0;
        return _releasableAmount(schedule);
    }

    /// @notice Total tokens vested so far under linear schedule
    /// @param vestingId Schedule to query
    /// @return Cumulative vested amount
    function getVestedAmount(uint256 vestingId) external view returns (uint256) {
        if (vestingId >= vestingCount) revert VestingNotFound();
        return _vestedAmount(_schedules[vestingId]);
    }

    /// @notice Whether a Pending release is currently queued for a schedule
    /// @param vestingId Schedule to query
    /// @return True if a release is queued and awaiting execution
    function hasPendingRelease(uint256 vestingId) external view returns (bool) {
        return _hasPendingRelease[vestingId];
    }

    /// @notice Total number of vesting schedules created
    /// @return vestingCount
    function getVestingCount() external view returns (uint256) {
        return vestingCount;
    }

    /// @notice Total number of release operations created
    /// @return releaseCount
    function getReleaseCount() external view returns (uint256) {
        return releaseCount;
    }
}

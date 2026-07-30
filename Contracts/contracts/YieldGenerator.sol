// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PRBMathUD60x18} from "prb-math/PRBMathUD60x18.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/// @title YieldGenerator
/// @notice Generates, tracks, and compounds yield from registered assets
/// @dev Uses PRBMathUD60x18 for fixed-point arithmetic (18-decimal precision)
contract YieldGenerator is Ownable, ReentrancyGuard {
    using PRBMathUD60x18 for uint256;

    // ─────────────────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev Represents a single yield source (a deposited asset)
    struct YieldSource {
        address asset;          // ERC-20 token address (address(0) = native ETH)
        uint256 principal;      // Initial deposit in token units (18-decimal UD60x18)
        uint256 ratePerSecond;  // Annual yield rate expressed as UD60x18 per second
        uint256 depositedAt;    // Timestamp of the deposit
        uint256 lastHarvested;  // Timestamp of last harvest / compound
        uint256 accruedYield;   // Accumulated unharvested yield (UD60x18)
        bool    compounding;    // Whether yield is automatically re-added to principal
        bool    active;         // Whether this source is still active
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice All yield sources, indexed by source ID
    mapping(uint256 => YieldSource) public yieldSources;

    /// @notice Source IDs owned by each user
    mapping(address => uint256[]) private _userSources;

    /// @notice Total yield harvested per user (lifetime, UD60x18)
    mapping(address => uint256) public totalHarvested;

    /// @notice Tracks which user owns each source ID
    mapping(uint256 => address) public sourceOwner;

    uint256 public nextSourceId;

    /// @dev 1e18 = 1.0 in UD60x18 (100% APR per year)
    uint256 private constant SECONDS_PER_YEAR = 365 days;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event SourceRegistered(
        uint256 indexed sourceId,
        address indexed owner,
        address asset,
        uint256 principal,
        uint256 annualRateBps,
        bool compounding
    );
    event YieldHarvested(
        uint256 indexed sourceId,
        address indexed owner,
        uint256 yieldAmount
    );
    event YieldCompounded(
        uint256 indexed sourceId,
        uint256 newPrincipal
    );
    event SourceDeactivated(uint256 indexed sourceId);
    event RateUpdated(uint256 indexed sourceId, uint256 newAnnualRateBps);

    // ─────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────

    error SourceNotActive();
    error NotSourceOwner();
    error ZeroPrincipal();
    error ZeroRate();

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ─────────────────────────────────────────────────────────────────────────
    // External – Write
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Register a new yield source.
    /// @param asset          Token address; use address(0) for native ETH.
    /// @param principal      Amount deposited, in token's base units (must be
    ///                       expressed as UD60x18 — i.e. multiply by 1e18).
    /// @param annualRateBps  Annual percentage yield in basis points (100 bps = 1%).
    /// @param compounding    True → yield is added back to principal each harvest.
    /// @return sourceId      The newly created source's ID.
    function registerSource(
        address asset,
        uint256 principal,
        uint256 annualRateBps,
        bool    compounding
    ) external returns (uint256 sourceId) {
        if (principal == 0) revert ZeroPrincipal();
        if (annualRateBps == 0) revert ZeroRate();

        // Convert bps → per-second UD60x18 rate
        // ratePerSecond = (annualRateBps / 10_000) / SECONDS_PER_YEAR  (as UD60x18)
        uint256 annualRateUD = (annualRateBps * 1e18) / 10_000;
        uint256 ratePerSecond = annualRateUD / SECONDS_PER_YEAR;

        sourceId = nextSourceId++;
        yieldSources[sourceId] = YieldSource({
            asset:         asset,
            principal:     principal,
            ratePerSecond: ratePerSecond,
            depositedAt:   block.timestamp,
            lastHarvested: block.timestamp,
            accruedYield:  0,
            compounding:   compounding,
            active:        true
        });

        sourceOwner[sourceId]       = msg.sender;
        _userSources[msg.sender].push(sourceId);

        emit SourceRegistered(sourceId, msg.sender, asset, principal, annualRateBps, compounding);
    }

    /// @notice Accrue and optionally compound pending yield for a source.
    ///         Anyone may trigger this; only the owner can harvest.
    function accrueYield(uint256 sourceId) public {
        YieldSource storage src = _getActiveSource(sourceId);
        uint256 pending = _pendingYield(src);
        if (pending == 0) return;

        if (src.compounding) {
            src.principal += pending;
            emit YieldCompounded(sourceId, src.principal);
        } else {
            src.accruedYield += pending;
        }
        src.lastHarvested = block.timestamp;
    }

    /// @notice Harvest (claim) all accrued yield for a source.
    /// @return harvested  Amount of yield claimed (UD60x18 units).
    function harvestYield(uint256 sourceId)
        external
        nonReentrant
        returns (uint256 harvested)
    {
        if (sourceOwner[sourceId] != msg.sender) revert NotSourceOwner();
        accrueYield(sourceId);

        YieldSource storage src = yieldSources[sourceId];
        harvested = src.accruedYield;
        src.accruedYield = 0;

        totalHarvested[msg.sender] += harvested;
        emit YieldHarvested(sourceId, msg.sender, harvested);
    }

    /// @notice Deactivate a yield source (owner or contract owner).
    function deactivateSource(uint256 sourceId) external {
        if (sourceOwner[sourceId] != msg.sender && owner() != msg.sender) {
            revert NotSourceOwner();
        }
        // Accrue any remaining yield before deactivating
        accrueYield(sourceId);
        yieldSources[sourceId].active = false;
        emit SourceDeactivated(sourceId);
    }

    /// @notice Update the annual rate of an active source (owner only).
    /// @param newAnnualRateBps  New rate in basis points.
    function updateRate(uint256 sourceId, uint256 newAnnualRateBps) external {
        if (sourceOwner[sourceId] != msg.sender) revert NotSourceOwner();
        if (newAnnualRateBps == 0) revert ZeroRate();

        // Accrue yield at old rate first
        accrueYield(sourceId);

        uint256 annualRateUD = (newAnnualRateBps * 1e18) / 10_000;
        yieldSources[sourceId].ratePerSecond = annualRateUD / SECONDS_PER_YEAR;

        emit RateUpdated(sourceId, newAnnualRateBps);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // External – Read (Queries)
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Pending (not yet accrued) yield for a source.
    function pendingYield(uint256 sourceId) external view returns (uint256) {
        YieldSource storage src = yieldSources[sourceId];
        return _pendingYield(src);
    }

    /// @notice Total claimable yield for a source (accrued + pending).
    function claimableYield(uint256 sourceId) external view returns (uint256) {
        YieldSource storage src = yieldSources[sourceId];
        return src.accruedYield + _pendingYield(src);
    }

    /// @notice Current effective annual rate for a source, in basis points.
    function currentRateBps(uint256 sourceId) external view returns (uint256) {
        YieldSource storage src = yieldSources[sourceId];
        // ratePerSecond * SECONDS_PER_YEAR / 1e18 * 10_000
        return (src.ratePerSecond * SECONDS_PER_YEAR * 10_000) / 1e18;
    }

    /// @notice All source IDs belonging to a user.
    function getUserSources(address user) external view returns (uint256[] memory) {
        return _userSources[user];
    }

    /// @notice Full details for a source.
    function getSource(uint256 sourceId) external view returns (YieldSource memory) {
        return yieldSources[sourceId];
    }

    /// @notice Summary across all active sources for a user.
    /// @return totalPrincipal  Sum of all active principals (UD60x18).
    /// @return totalPending    Sum of all pending + accrued yield (UD60x18).
    function getUserYieldSummary(address user)
        external
        view
        returns (uint256 totalPrincipal, uint256 totalPending)
    {
        uint256[] storage ids = _userSources[user];
        for (uint256 i; i < ids.length; ++i) {
            YieldSource storage src = yieldSources[ids[i]];
            if (!src.active) continue;
            totalPrincipal += src.principal;
            totalPending   += src.accruedYield + _pendingYield(src);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev Linear yield since last harvest: principal × ratePerSecond × elapsed
    function _pendingYield(YieldSource storage src) internal view returns (uint256) {
        if (!src.active) return 0;
        uint256 elapsed = block.timestamp - src.lastHarvested;
        // All values in UD60x18; mul() keeps precision
        return src.principal.mul(src.ratePerSecond).mul(elapsed * 1e18);
    }

    function _getActiveSource(uint256 sourceId)
        internal
        view
        returns (YieldSource storage src)
    {
        src = yieldSources[sourceId];
        if (!src.active) revert SourceNotActive();
    }
}


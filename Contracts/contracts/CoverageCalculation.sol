// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title CoverageCalculation
/// @notice Handles coverage amount calculations, utilization tracking, limit enforcement, and queries.
contract CoverageCalculation {

    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error InvalidCoverageType();
    error InvalidCoverageAmount();
    error InvalidRiskScore();
    error CoverageLimitExceeded();
    error InvalidMultiplier();
    error InvalidUser();
    error InvalidMarket();

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    /// @notice Coverage types with different characteristics
    enum CoverageType {
        BASIC,
        STANDARD,
        PREMIUM,
        PLATINUM
    }

    /// @notice Coverage parameters for each type
    struct CoverageParams {
        uint256 baseCoverage;      // Base coverage amount
        uint256 maxCoverage;       // Maximum coverage limit
        uint256 riskMultiplier;    // Risk-adjusted multiplier (in bps)
        bool active;
    }

    /// @notice Coverage allocation for a user-market pair
    struct CoverageAllocation {
        address user;
        address market;
        CoverageType coverageType;
        uint256 allocatedAmount;
        uint256 utilizationAmount;
        uint256 utilizationPercentage; // in bps
        uint256 remainingCapacity;
        uint256 riskScore;         // 0-10000 (0-100%)
        uint256 adjustedCoverage;
        bool active;
        uint256 lastUpdated;
    }

    /// @notice Risk-adjusted coverage calculation result
    struct CoverageResult {
        uint256 baseCoverage;
        uint256 riskAdjustment;
        uint256 finalCoverage;
        uint256 maxAllowedUtilization;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event CoverageTypeConfigured(
        CoverageType indexed coverageType,
        uint256 baseCoverage,
        uint256 maxCoverage,
        uint256 riskMultiplier
    );

    event CoverageAllocated(
        address indexed user,
        address indexed market,
        CoverageType indexed coverageType,
        uint256 allocatedAmount,
        uint256 riskScore
    );

    event CoverageUtilizationUpdated(
        address indexed user,
        address indexed market,
        uint256 utilizationAmount,
        uint256 utilizationPercentage
    );

    event CoverageLimitEnforced(
        address indexed user,
        address indexed market,
        uint256 requestedAmount,
        uint256 allowedAmount
    );

    event RiskScoreUpdated(
        address indexed user,
        address indexed market,
        uint256 newRiskScore
    );

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant MAX_RISK_SCORE = 10_000; // 100%
    uint256 public constant MAX_UTILIZATION_BPS = 9_500; // 95%
    uint256 public constant DEFAULT_RISK_MULTIPLIER = 8_000; // 80%

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    address public admin;

    /// @dev coverageType => CoverageParams
    mapping(CoverageType => CoverageParams) public coverageConfig;

    /// @dev user => market => CoverageAllocation
    mapping(address => mapping(address => CoverageAllocation)) private _allocations;

    /// @dev user => market array for tracking
    mapping(address => address[]) private _userMarkets;

    /// @dev market => user array for tracking
    mapping(address => address[]) private _marketUsers;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(address _admin) {
        require(_admin != address(0), "Invalid admin");
        admin = _admin;

        // Initialize default coverage configurations
        _initializeDefaults();
    }

    // -------------------------------------------------------------------------
    // Admin functions
    // -------------------------------------------------------------------------

    /// @notice Configure coverage parameters for a coverage type
    function configureCoverageType(
        CoverageType coverageType,
        uint256 baseCoverage,
        uint256 maxCoverage,
        uint256 riskMultiplier
    ) external {
        require(msg.sender == admin, "Not admin");
        require(baseCoverage > 0 && maxCoverage >= baseCoverage, InvalidCoverageAmount());
        require(riskMultiplier > 0 && riskMultiplier <= BPS_DENOMINATOR, InvalidMultiplier());

        coverageConfig[coverageType] = CoverageParams({
            baseCoverage: baseCoverage,
            maxCoverage: maxCoverage,
            riskMultiplier: riskMultiplier,
            active: true
        });

        emit CoverageTypeConfigured(coverageType, baseCoverage, maxCoverage, riskMultiplier);
    }

    /// @notice Update admin address
    function updateAdmin(address newAdmin) external {
        require(msg.sender == admin, "Not admin");
        require(newAdmin != address(0), "Invalid admin");
        admin = newAdmin;
    }

    // -------------------------------------------------------------------------
    // Core calculation functions
    // -------------------------------------------------------------------------

    /// @notice Calculate base coverage for a coverage type
    /// @param coverageType The coverage type
    /// @return baseCoverage The base coverage amount
    function getBaseCoverage(CoverageType coverageType) external view returns (uint256 baseCoverage) {
        CoverageParams memory params = coverageConfig[coverageType];
        require(params.active, InvalidCoverageType());
        return params.baseCoverage;
    }

    /// @notice Calculate coverage amount with risk adjustment
    /// @param coverageType The coverage type
    /// @param riskScore Risk score (0-10000, representing 0-100%)
    /// @return calculation Struct containing base, adjustment, and final coverage
    function calculateCoverage(CoverageType coverageType, uint256 riskScore)
        external
        view
        returns (CoverageResult memory calculation)
    {
        CoverageParams memory params = coverageConfig[coverageType];
        require(params.active, InvalidCoverageType());
        require(riskScore <= MAX_RISK_SCORE, InvalidRiskScore());

        uint256 baseCoverage = params.baseCoverage;

        // Calculate risk adjustment using PRBMath
        // riskAdjustment = baseCoverage * riskMultiplier * riskScore / BPS_DENOMINATOR^2
        uint256 riskAdjustment = (baseCoverage * params.riskMultiplier * riskScore) /
            (BPS_DENOMINATOR * BPS_DENOMINATOR);

        uint256 finalCoverage = baseCoverage + riskAdjustment;

        // Cap at max coverage
        if (finalCoverage > params.maxCoverage) {
            finalCoverage = params.maxCoverage;
        }

        return CoverageResult({
            baseCoverage: baseCoverage,
            riskAdjustment: riskAdjustment,
            finalCoverage: finalCoverage,
            maxAllowedUtilization: (finalCoverage * MAX_UTILIZATION_BPS) / BPS_DENOMINATOR
        });
    }

    /// @notice Allocate coverage for a user-market pair
    /// @param user Address of the user
    /// @param market Address of the market
    /// @param coverageType Type of coverage to allocate
    /// @param riskScore Risk score for adjustment (0-10000)
    /// @return allocatedAmount The final allocated coverage amount
    function allocateCoverage(
        address user,
        address market,
        CoverageType coverageType,
        uint256 riskScore
    ) external returns (uint256 allocatedAmount) {
        require(user != address(0), InvalidUser());
        require(market != address(0), InvalidMarket());
        require(riskScore <= MAX_RISK_SCORE, InvalidRiskScore());

        CoverageParams memory params = coverageConfig[coverageType];
        require(params.active, InvalidCoverageType());

        // Calculate coverage
        CoverageResult memory calc = _calculateCoverageInternal(coverageType, riskScore);

        // Create or update allocation
        CoverageAllocation storage allocation = _allocations[user][market];
        bool isNew = allocation.user == address(0);

        allocation.user = user;
        allocation.market = market;
        allocation.coverageType = coverageType;
        allocation.allocatedAmount = calc.finalCoverage;
        allocation.utilizationAmount = 0;
        allocation.utilizationPercentage = 0;
        allocation.remainingCapacity = calc.finalCoverage;
        allocation.riskScore = riskScore;
        allocation.adjustedCoverage = calc.finalCoverage;
        allocation.active = true;
        allocation.lastUpdated = block.timestamp;

        // Track new allocations
        if (isNew) {
            _userMarkets[user].push(market);
            _marketUsers[market].push(user);
        }

        emit CoverageAllocated(user, market, coverageType, calc.finalCoverage, riskScore);

        return calc.finalCoverage;
    }

    /// @notice Update coverage utilization for a user-market pair
    /// @param user Address of the user
    /// @param market Address of the market
    /// @param utilizationAmount Amount of coverage being utilized
    function updateUtilization(
        address user,
        address market,
        uint256 utilizationAmount
    ) external {
        CoverageAllocation storage allocation = _allocations[user][market];
        require(allocation.active, "Allocation not active");
        require(utilizationAmount <= allocation.allocatedAmount, CoverageLimitExceeded());

        allocation.utilizationAmount = utilizationAmount;
        allocation.remainingCapacity = allocation.allocatedAmount - utilizationAmount;

        if (allocation.allocatedAmount > 0) {
            allocation.utilizationPercentage =
                (utilizationAmount * BPS_DENOMINATOR) / allocation.allocatedAmount;
        }

        allocation.lastUpdated = block.timestamp;

        emit CoverageUtilizationUpdated(user, market, utilizationAmount, allocation.utilizationPercentage);
    }

    /// @notice Update risk score for a user-market pair
    /// @param user Address of the user
    /// @param market Address of the market
    /// @param newRiskScore New risk score (0-10000)
    function updateRiskScore(
        address user,
        address market,
        uint256 newRiskScore
    ) external {
        require(newRiskScore <= MAX_RISK_SCORE, InvalidRiskScore());

        CoverageAllocation storage allocation = _allocations[user][market];
        require(allocation.active, "Allocation not active");

        allocation.riskScore = newRiskScore;

        // Recalculate coverage with new risk score
        CoverageResult memory calc = _calculateCoverageInternal(allocation.coverageType, newRiskScore);
        allocation.adjustedCoverage = calc.finalCoverage;
        allocation.allocatedAmount = calc.finalCoverage;

        // Adjust remaining capacity
        if (allocation.utilizationAmount > allocation.allocatedAmount) {
            allocation.utilizationAmount = allocation.allocatedAmount;
            allocation.utilizationPercentage = BPS_DENOMINATOR;
        } else {
            allocation.remainingCapacity = allocation.allocatedAmount - allocation.utilizationAmount;
        }

        allocation.lastUpdated = block.timestamp;

        emit RiskScoreUpdated(user, market, newRiskScore);
    }

    // -------------------------------------------------------------------------
    // Query functions
    // -------------------------------------------------------------------------

    /// @notice Get coverage allocation for a user-market pair
    /// @param user Address of the user
    /// @param market Address of the market
    /// @return allocation The coverage allocation
    function getAllocation(address user, address market)
        external
        view
        returns (CoverageAllocation memory allocation)
    {
        return _allocations[user][market];
    }

    /// @notice Get total allocated coverage for a user
    /// @param user Address of the user
    /// @return totalAllocated Total allocated coverage
    function getTotalAllocated(address user) external view returns (uint256 totalAllocated) {
        address[] memory markets = _userMarkets[user];
        for (uint256 i = 0; i < markets.length; i++) {
            CoverageAllocation memory allocation = _allocations[user][markets[i]];
            if (allocation.active) {
                totalAllocated += allocation.allocatedAmount;
            }
        }
        return totalAllocated;
    }

    /// @notice Get total utilization for a user
    /// @param user Address of the user
    /// @return totalUtilization Total utilization
    function getTotalUtilization(address user) external view returns (uint256 totalUtilization) {
        address[] memory markets = _userMarkets[user];
        for (uint256 i = 0; i < markets.length; i++) {
            CoverageAllocation memory allocation = _allocations[user][markets[i]];
            if (allocation.active) {
                totalUtilization += allocation.utilizationAmount;
            }
        }
        return totalUtilization;
    }

    /// @notice Get remaining capacity for a user
    /// @param user Address of the user
    /// @return totalRemaining Total remaining capacity
    function getTotalRemainingCapacity(address user) external view returns (uint256 totalRemaining) {
        address[] memory markets = _userMarkets[user];
        for (uint256 i = 0; i < markets.length; i++) {
            CoverageAllocation memory allocation = _allocations[user][markets[i]];
            if (allocation.active) {
                totalRemaining += allocation.remainingCapacity;
            }
        }
        return totalRemaining;
    }

    /// @notice Get markets covered by a user
    /// @param user Address of the user
    /// @return markets Array of market addresses
    function getUserMarkets(address user) external view returns (address[] memory markets) {
        return _userMarkets[user];
    }

    /// @notice Get users covering a market
    /// @param market Address of the market
    /// @return users Array of user addresses
    function getMarketUsers(address market) external view returns (address[] memory users) {
        return _marketUsers[market];
    }

    /// @notice Check if coverage is available for utilization
    /// @param user Address of the user
    /// @param market Address of the market
    /// @param requestedAmount Amount requested for utilization
    /// @return available True if coverage is available
    function isCoverageAvailable(
        address user,
        address market,
        uint256 requestedAmount
    ) external view returns (bool available) {
        CoverageAllocation memory allocation = _allocations[user][market];
        if (!allocation.active) {
            return false;
        }
        
        uint256 newUtilization = allocation.utilizationAmount + requestedAmount;
        uint256 maxAllowedUtilization = (allocation.allocatedAmount * MAX_UTILIZATION_BPS) / BPS_DENOMINATOR;
        
        return newUtilization <= maxAllowedUtilization;
    }

    /// @notice Get coverage type configuration
    /// @param coverageType The coverage type
    /// @return params The coverage parameters
    function getCoverageConfig(CoverageType coverageType)
        external
        view
        returns (CoverageParams memory params)
    {
        return coverageConfig[coverageType];
    }

    /// @notice Get all active allocations for a user
    /// @param user Address of the user
    /// @return allocations Array of active allocations
    function getUserAllocations(address user)
        external
        view
        returns (CoverageAllocation[] memory allocations)
    {
        address[] memory markets = _userMarkets[user];
        CoverageAllocation[] memory result = new CoverageAllocation[](markets.length);

        uint256 count = 0;
        for (uint256 i = 0; i < markets.length; i++) {
            CoverageAllocation memory allocation = _allocations[user][markets[i]];
            if (allocation.active) {
                result[count] = allocation;
                count++;
            }
        }

        // Trim array to actual count
        CoverageAllocation[] memory trimmed = new CoverageAllocation[](count);
        for (uint256 i = 0; i < count; i++) {
            trimmed[i] = result[i];
        }

        return trimmed;
    }

    /// @notice Get portfolio utilization for a user
    /// @param user Address of the user
    /// @return utilization Average utilization percentage across all allocations
    function getPortfolioUtilization(address user) external view returns (uint256 utilization) {
        address[] memory markets = _userMarkets[user];
        if (markets.length == 0) {
            return 0;
        }

        uint256 totalAllocated = 0;
        uint256 totalUtilized = 0;

        for (uint256 i = 0; i < markets.length; i++) {
            CoverageAllocation memory allocation = _allocations[user][markets[i]];
            if (allocation.active) {
                totalAllocated += allocation.allocatedAmount;
                totalUtilized += allocation.utilizationAmount;
            }
        }

        if (totalAllocated == 0) {
            return 0;
        }

        return (totalUtilized * BPS_DENOMINATOR) / totalAllocated;
    }

    // -------------------------------------------------------------------------
    // Internal functions
    // -------------------------------------------------------------------------

    function _initializeDefaults() internal {
        // BASIC: Base 100 ether, Max 500 ether, 70% risk multiplier
        coverageConfig[CoverageType.BASIC] = CoverageParams({
            baseCoverage: 100 ether,
            maxCoverage: 500 ether,
            riskMultiplier: 7_000,
            active: true
        });

        // STANDARD: Base 500 ether, Max 2500 ether, 80% risk multiplier
        coverageConfig[CoverageType.STANDARD] = CoverageParams({
            baseCoverage: 500 ether,
            maxCoverage: 2500 ether,
            riskMultiplier: 8_000,
            active: true
        });

        // PREMIUM: Base 2500 ether, Max 10000 ether, 90% risk multiplier
        coverageConfig[CoverageType.PREMIUM] = CoverageParams({
            baseCoverage: 2500 ether,
            maxCoverage: 10000 ether,
            riskMultiplier: 9_000,
            active: true
        });

        // PLATINUM: Base 10000 ether, Max 50000 ether, 95% risk multiplier
        coverageConfig[CoverageType.PLATINUM] = CoverageParams({
            baseCoverage: 10000 ether,
            maxCoverage: 50000 ether,
            riskMultiplier: 9_500,
            active: true
        });
    }

    function _calculateCoverageInternal(CoverageType coverageType, uint256 riskScore)
        internal
        view
        returns (CoverageResult memory)
    {
        CoverageParams memory params = coverageConfig[coverageType];
        require(params.active, InvalidCoverageType());

        uint256 baseCoverage = params.baseCoverage;

        // Calculate risk adjustment
        uint256 riskAdjustment = (baseCoverage * params.riskMultiplier * riskScore) /
            (BPS_DENOMINATOR * BPS_DENOMINATOR);

        uint256 finalCoverage = baseCoverage + riskAdjustment;

        // Cap at max coverage
        if (finalCoverage > params.maxCoverage) {
            finalCoverage = params.maxCoverage;
        }

        return CoverageResult({
            baseCoverage: baseCoverage,
            riskAdjustment: riskAdjustment,
            finalCoverage: finalCoverage,
            maxAllowedUtilization: (finalCoverage * MAX_UTILIZATION_BPS) / BPS_DENOMINATOR
        });
    }
}

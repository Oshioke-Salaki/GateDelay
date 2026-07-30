// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PositionToken.sol";
import "./MarketFactory.sol";

/// @title RiskAssessment
/// @notice Assesses position risks and monitors risk thresholds
contract RiskAssessment {
    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error RiskThresholdExceeded();
    error InvalidRiskLevel();

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------
    enum RiskLevel { LOW, MEDIUM, HIGH, CRITICAL }

    struct RiskMetrics {
        uint256 exposureScore;
        uint256 concentrationRisk;
        uint256 volatilityScore;
        RiskLevel riskLevel;
        uint256 lastAssessed;
    }

    struct RiskAlert {
        uint256 timestamp;
        RiskLevel level;
        string reason;
        bool acknowledged;
    }

    struct RiskThreshold {
        uint256 maxExposure;
        uint256 maxConcentration;
        uint256 maxVolatility;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event RiskAssessed(
        address indexed user,
        address indexed market,
        RiskLevel level,
        uint256 exposureScore
    );
    event RiskAlertIssued(
        address indexed user,
        address indexed market,
        RiskLevel level,
        string reason
    );
    event RiskThresholdUpdated(
        uint256 maxExposure,
        uint256 maxConcentration,
        uint256 maxVolatility
    );

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------
    uint256 public constant LOW_RISK_THRESHOLD = 2500;      // 25%
    uint256 public constant MEDIUM_RISK_THRESHOLD = 5000;   // 50%
    uint256 public constant HIGH_RISK_THRESHOLD = 7500;     // 75%
    uint256 public constant BPS_DENOMINATOR = 10000;

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    PositionToken public immutable positionToken;
    MarketFactory public immutable marketFactory;

    /// @dev user => market => RiskMetrics
    mapping(address => mapping(address => RiskMetrics)) private _riskMetrics;

    /// @dev user => market => RiskAlert[]
    mapping(address => mapping(address => RiskAlert[])) private _riskAlerts;

    /// @dev Global risk thresholds
    RiskThreshold public riskThreshold;

    /// @dev Admin address
    address public admin;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(address _positionToken, address _marketFactory, address _admin) {
        positionToken = PositionToken(_positionToken);
        marketFactory = MarketFactory(_marketFactory);
        admin = _admin;

        // Set default thresholds
        riskThreshold = RiskThreshold({
            maxExposure: 8000,      // 80%
            maxConcentration: 7000, // 70%
            maxVolatility: 6000     // 60%
        });
    }

    // -------------------------------------------------------------------------
    // External functions
    // -------------------------------------------------------------------------

    /// @notice Assess risk for a user's position
    function assessRisk(address user, address market) external returns (RiskMetrics memory) {
        uint256 yesId = positionToken.yesId(market);
        uint256 noId = positionToken.noId(market);

        uint256 yesBalance = positionToken.balanceOf(user, yesId);
        uint256 noBalance = positionToken.balanceOf(user, noId);
        uint256 totalPosition = yesBalance + noBalance;

        uint256 yesTotalSupply = positionToken.totalSupply(yesId);
        uint256 noTotalSupply = positionToken.totalSupply(noId);
        uint256 totalSupply = yesTotalSupply + noTotalSupply;

        // Calculate exposure (position size relative to total supply)
        uint256 exposureScore = totalSupply > 0 
            ? (totalPosition * BPS_DENOMINATOR) / totalSupply 
            : 0;

        // Calculate concentration risk (imbalance between YES and NO)
        uint256 concentrationRisk = totalPosition > 0
            ? (yesBalance > noBalance 
                ? ((yesBalance - noBalance) * BPS_DENOMINATOR) / totalPosition
                : ((noBalance - yesBalance) * BPS_DENOMINATOR) / totalPosition)
            : 0;

        // Calculate volatility score (simplified: based on position changes)
        uint256 volatilityScore = _calculateVolatility(user, market);

        // Determine risk level
        RiskLevel level = _determineRiskLevel(exposureScore, concentrationRisk, volatilityScore);

        RiskMetrics memory metrics = RiskMetrics({
            exposureScore: exposureScore,
            concentrationRisk: concentrationRisk,
            volatilityScore: volatilityScore,
            riskLevel: level,
            lastAssessed: block.timestamp
        });

        _riskMetrics[user][market] = metrics;

        emit RiskAssessed(user, market, level, exposureScore);

        // Check thresholds and issue alerts if needed
        _checkThresholds(user, market, metrics);

        return metrics;
    }

    /// @notice Get risk metrics for a user
    function getRiskMetrics(address user, address market) external view returns (RiskMetrics memory) {
        return _riskMetrics[user][market];
    }

    /// @notice Get risk alerts for a user
    function getRiskAlerts(address user, address market) external view returns (RiskAlert[] memory) {
        return _riskAlerts[user][market];
    }

    /// @notice Acknowledge a risk alert
    function acknowledgeAlert(address market, uint256 alertIndex) external {
        require(alertIndex < _riskAlerts[msg.sender][market].length, "Invalid alert index");
        _riskAlerts[msg.sender][market][alertIndex].acknowledged = true;
    }

    /// @notice Update risk thresholds (admin only)
    function updateRiskThresholds(
        uint256 maxExposure,
        uint256 maxConcentration,
        uint256 maxVolatility
    ) external {
        require(msg.sender == admin, "Not admin");
        
        riskThreshold = RiskThreshold({
            maxExposure: maxExposure,
            maxConcentration: maxConcentration,
            maxVolatility: maxVolatility
        });

        emit RiskThresholdUpdated(maxExposure, maxConcentration, maxVolatility);
    }

    /// @notice Check if position exceeds risk thresholds
    function isRiskAcceptable(address user, address market) external view returns (bool) {
        RiskMetrics memory metrics = _riskMetrics[user][market];
        
        return metrics.exposureScore <= riskThreshold.maxExposure &&
               metrics.concentrationRisk <= riskThreshold.maxConcentration &&
               metrics.volatilityScore <= riskThreshold.maxVolatility;
    }

    // -------------------------------------------------------------------------
    // Internal functions
    // -------------------------------------------------------------------------

    function _calculateVolatility(address user, address market) internal view returns (uint256) {
        // Simplified volatility calculation
        // In production, this would analyze historical position changes
        RiskMetrics memory prevMetrics = _riskMetrics[user][market];
        return prevMetrics.exposureScore > 0 ? prevMetrics.exposureScore / 2 : 0;
    }

    function _determineRiskLevel(
        uint256 exposure,
        uint256 concentration,
        uint256 volatility
    ) internal pure returns (RiskLevel) {
        uint256 avgRisk = (exposure + concentration + volatility) / 3;

        if (avgRisk >= HIGH_RISK_THRESHOLD) {
            return RiskLevel.CRITICAL;
        } else if (avgRisk >= MEDIUM_RISK_THRESHOLD) {
            return RiskLevel.HIGH;
        } else if (avgRisk >= LOW_RISK_THRESHOLD) {
            return RiskLevel.MEDIUM;
        } else {
            return RiskLevel.LOW;
        }
    }

    function _checkThresholds(address user, address market, RiskMetrics memory metrics) internal {
        if (metrics.exposureScore > riskThreshold.maxExposure) {
            _issueAlert(user, market, metrics.riskLevel, "Exposure threshold exceeded");
        }
        if (metrics.concentrationRisk > riskThreshold.maxConcentration) {
            _issueAlert(user, market, metrics.riskLevel, "Concentration risk threshold exceeded");
        }
        if (metrics.volatilityScore > riskThreshold.maxVolatility) {
            _issueAlert(user, market, metrics.riskLevel, "Volatility threshold exceeded");
        }
    }

    function _issueAlert(address user, address market, RiskLevel level, string memory reason) internal {
        _riskAlerts[user][market].push(RiskAlert({
            timestamp: block.timestamp,
            level: level,
            reason: reason,
            acknowledged: false
        }));

        emit RiskAlertIssued(user, market, level, reason);
    }
}

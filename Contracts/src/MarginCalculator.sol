// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PositionToken.sol";
import "./MarketFactory.sol";

/// @title MarginCalculator
/// @notice Calculates margin requirements and tracks margin utilization
contract MarginCalculator {
    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error InsufficientMargin();
    error InvalidMarginType();
    error MarginCallTriggered();

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------
    enum MarginType { INITIAL, MAINTENANCE, LIQUIDATION }

    struct MarginRequirement {
        uint256 initialMargin;
        uint256 maintenanceMargin;
        uint256 liquidationMargin;
        uint256 currentMargin;
        uint256 utilizationBps;
    }

    struct MarginCall {
        uint256 timestamp;
        uint256 requiredAmount;
        uint256 currentAmount;
        bool resolved;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event MarginCalculated(
        address indexed user,
        address indexed market,
        uint256 initialMargin,
        uint256 maintenanceMargin
    );
    event MarginCallIssued(
        address indexed user,
        address indexed market,
        uint256 requiredAmount,
        uint256 currentAmount
    );
    event MarginCallResolved(
        address indexed user,
        address indexed market,
        uint256 timestamp
    );

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------
    uint256 public constant INITIAL_MARGIN_BPS = 2000;      // 20%
    uint256 public constant MAINTENANCE_MARGIN_BPS = 1500;  // 15%
    uint256 public constant LIQUIDATION_MARGIN_BPS = 1000;  // 10%
    uint256 public constant BPS_DENOMINATOR = 10000;

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    PositionToken public immutable positionToken;
    MarketFactory public immutable marketFactory;

    /// @dev user => market => MarginRequirement
    mapping(address => mapping(address => MarginRequirement)) private _marginRequirements;

    /// @dev user => market => MarginCall[]
    mapping(address => mapping(address => MarginCall[])) private _marginCalls;

    /// @dev user => deposited margin
    mapping(address => uint256) private _depositedMargin;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(address _positionToken, address _marketFactory) {
        positionToken = PositionToken(_positionToken);
        marketFactory = MarketFactory(_marketFactory);
    }

    // -------------------------------------------------------------------------
    // External functions
    // -------------------------------------------------------------------------

    /// @notice Calculate margin requirements for a user's position
    function calculateMarginRequirement(address user, address market) external returns (MarginRequirement memory) {
        uint256 yesId = positionToken.yesId(market);
        uint256 noId = positionToken.noId(market);

        uint256 yesBalance = positionToken.balanceOf(user, yesId);
        uint256 noBalance = positionToken.balanceOf(user, noId);
        uint256 totalPosition = yesBalance + noBalance;

        uint256 initialMargin = (totalPosition * INITIAL_MARGIN_BPS) / BPS_DENOMINATOR;
        uint256 maintenanceMargin = (totalPosition * MAINTENANCE_MARGIN_BPS) / BPS_DENOMINATOR;
        uint256 liquidationMargin = (totalPosition * LIQUIDATION_MARGIN_BPS) / BPS_DENOMINATOR;

        uint256 currentMargin = _depositedMargin[user];
        uint256 utilizationBps = totalPosition > 0 
            ? (currentMargin * BPS_DENOMINATOR) / totalPosition 
            : 0;

        MarginRequirement memory req = MarginRequirement({
            initialMargin: initialMargin,
            maintenanceMargin: maintenanceMargin,
            liquidationMargin: liquidationMargin,
            currentMargin: currentMargin,
            utilizationBps: utilizationBps
        });

        _marginRequirements[user][market] = req;

        emit MarginCalculated(user, market, initialMargin, maintenanceMargin);

        return req;
    }

    /// @notice Deposit margin
    function depositMargin(uint256 amount) external {
        _depositedMargin[msg.sender] += amount;
    }

    /// @notice Withdraw margin (if sufficient)
    function withdrawMargin(uint256 amount) external {
        if (_depositedMargin[msg.sender] < amount) revert InsufficientMargin();
        _depositedMargin[msg.sender] -= amount;
    }

    /// @notice Check if margin call is needed
    function checkMarginCall(address user, address market) external returns (bool) {
        MarginRequirement memory req = _marginRequirements[user][market];
        
        if (req.currentMargin < req.maintenanceMargin) {
            _marginCalls[user][market].push(MarginCall({
                timestamp: block.timestamp,
                requiredAmount: req.maintenanceMargin,
                currentAmount: req.currentMargin,
                resolved: false
            }));

            emit MarginCallIssued(user, market, req.maintenanceMargin, req.currentMargin);
            return true;
        }

        return false;
    }

    /// @notice Resolve margin call by depositing required amount
    function resolveMarginCall(address market) external {
        MarginCall[] storage calls = _marginCalls[msg.sender][market];
        require(calls.length > 0, "No margin calls");

        MarginCall storage lastCall = calls[calls.length - 1];
        require(!lastCall.resolved, "Already resolved");

        MarginRequirement memory req = _marginRequirements[msg.sender][market];
        if (req.currentMargin < lastCall.requiredAmount) revert InsufficientMargin();

        lastCall.resolved = true;
        emit MarginCallResolved(msg.sender, market, block.timestamp);
    }

    /// @notice Get margin requirement for a user
    function getMarginRequirement(address user, address market) external view returns (MarginRequirement memory) {
        return _marginRequirements[user][market];
    }

    /// @notice Get margin calls for a user
    function getMarginCalls(address user, address market) external view returns (MarginCall[] memory) {
        return _marginCalls[user][market];
    }

    /// @notice Get deposited margin for a user
    function getDepositedMargin(address user) external view returns (uint256) {
        return _depositedMargin[user];
    }

    /// @notice Calculate margin utilization
    function getMarginUtilization(address user, address market) external view returns (uint256) {
        return _marginRequirements[user][market].utilizationBps;
    }

    /// @notice Check if user has sufficient margin
    function hasSufficientMargin(address user, address market, MarginType marginType) external view returns (bool) {
        MarginRequirement memory req = _marginRequirements[user][market];
        
        if (marginType == MarginType.INITIAL) {
            return req.currentMargin >= req.initialMargin;
        } else if (marginType == MarginType.MAINTENANCE) {
            return req.currentMargin >= req.maintenanceMargin;
        } else if (marginType == MarginType.LIQUIDATION) {
            return req.currentMargin >= req.liquidationMargin;
        }
        
        revert InvalidMarginType();
    }
}

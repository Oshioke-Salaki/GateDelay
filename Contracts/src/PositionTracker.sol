// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PositionToken.sol";
import "./MarketFactory.sol";

/// @title PositionTracker
/// @notice Tracks user positions across markets with value calculations and change monitoring
contract PositionTracker {
    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error UnauthorizedCaller();
    error InvalidMarket();

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------
    struct Position {
        uint256 yesBalance;
        uint256 noBalance;
        uint256 lastUpdated;
        uint256 totalValue;
    }

    struct PositionChange {
        uint256 timestamp;
        int256 yesChange;
        int256 noChange;
        uint256 newValue;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event PositionUpdated(
        address indexed user,
        address indexed market,
        uint256 yesBalance,
        uint256 noBalance,
        uint256 value
    );
    event PositionValueChanged(
        address indexed user,
        address indexed market,
        uint256 oldValue,
        uint256 newValue
    );

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    PositionToken public immutable positionToken;
    MarketFactory public immutable marketFactory;

    /// @dev user => market => Position
    mapping(address => mapping(address => Position)) private _positions;

    /// @dev user => market => PositionChange[]
    mapping(address => mapping(address => PositionChange[])) private _positionHistory;

    /// @dev user => market[]
    mapping(address => address[]) private _userMarkets;

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

    /// @notice Update position for a user in a market
    function updatePosition(address user, address market) external {
        uint256 yesId = positionToken.yesId(market);
        uint256 noId = positionToken.noId(market);

        uint256 yesBalance = positionToken.balanceOf(user, yesId);
        uint256 noBalance = positionToken.balanceOf(user, noId);

        Position storage pos = _positions[user][market];
        uint256 oldValue = pos.totalValue;

        // Calculate value (simplified: 1:1 with balance)
        uint256 newValue = yesBalance + noBalance;

        // Track if this is a new market for the user
        if (pos.lastUpdated == 0 && (yesBalance > 0 || noBalance > 0)) {
            _userMarkets[user].push(market);
        }

        // Record change
        int256 yesChange = int256(yesBalance) - int256(pos.yesBalance);
        int256 noChange = int256(noBalance) - int256(pos.noBalance);

        if (yesChange != 0 || noChange != 0) {
            _positionHistory[user][market].push(PositionChange({
                timestamp: block.timestamp,
                yesChange: yesChange,
                noChange: noChange,
                newValue: newValue
            }));
        }

        // Update position
        pos.yesBalance = yesBalance;
        pos.noBalance = noBalance;
        pos.lastUpdated = block.timestamp;
        pos.totalValue = newValue;

        emit PositionUpdated(user, market, yesBalance, noBalance, newValue);

        if (oldValue != newValue) {
            emit PositionValueChanged(user, market, oldValue, newValue);
        }
    }

    /// @notice Get position for a user in a market
    function getPosition(address user, address market) external view returns (Position memory) {
        return _positions[user][market];
    }

    /// @notice Get all markets a user has positions in
    function getUserMarkets(address user) external view returns (address[] memory) {
        return _userMarkets[user];
    }

    /// @notice Get position history for a user in a market
    function getPositionHistory(address user, address market) external view returns (PositionChange[] memory) {
        return _positionHistory[user][market];
    }

    /// @notice Calculate current position value
    function calculatePositionValue(address user, address market) external view returns (uint256) {
        uint256 yesId = positionToken.yesId(market);
        uint256 noId = positionToken.noId(market);
        return positionToken.balanceOf(user, yesId) + positionToken.balanceOf(user, noId);
    }

    /// @notice Get total value across all positions for a user
    function getTotalValue(address user) external view returns (uint256 total) {
        address[] memory markets = _userMarkets[user];
        for (uint256 i = 0; i < markets.length; i++) {
            total += _positions[user][markets[i]].totalValue;
        }
    }
}

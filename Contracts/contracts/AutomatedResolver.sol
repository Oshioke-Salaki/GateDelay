// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../src/Resolution.sol";

/// @title AutomatedResolver
/// @notice Implements automated market resolution using Chainlink Automation (formerly Keepers)
/// @dev Monitors resolution conditions and triggers automated resolution when conditions are met
contract AutomatedResolver {
    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error NotAuthorized();
    error MarketAlreadyResolved();
    error ConditionNotMet();
    error InvalidResolutionData();
    error ResolutionFailed();

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------
    struct ResolutionCondition {
        uint256 targetTimestamp;
        bytes32 dataFeedId;
        int256 threshold;
        bool isGreaterThan;
        bool isActive;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event ConditionRegistered(address indexed market, bytes32 dataFeedId, int256 threshold);
    event ConditionMet(address indexed market, int256 actualValue);
    event AutomatedResolutionTriggered(address indexed market, Resolution.Outcome outcome);
    event ResolutionFailureHandled(address indexed market, string reason);

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------
    Resolution public immutable resolution;
    address public immutable admin;
    
    mapping(address => ResolutionCondition) public conditions;
    mapping(bytes32 => int256) public latestDataFeeds;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(address _resolution, address _admin) {
        resolution = Resolution(_resolution);
        admin = _admin;
    }

    // -------------------------------------------------------------------------
    // External functions
    // -------------------------------------------------------------------------

    /// @notice Register resolution condition for a market
    /// @param market The market address
    /// @param targetTimestamp When the condition should be checked
    /// @param dataFeedId The data feed identifier
    /// @param threshold The threshold value
    /// @param isGreaterThan True if condition is >, false if <
    function registerCondition(
        address market,
        uint256 targetTimestamp,
        bytes32 dataFeedId,
        int256 threshold,
        bool isGreaterThan
    ) external {
        if (msg.sender != admin) revert NotAuthorized();
        
        conditions[market] = ResolutionCondition({
            targetTimestamp: targetTimestamp,
            dataFeedId: dataFeedId,
            threshold: threshold,
            isGreaterThan: isGreaterThan,
            isActive: true
        });

        emit ConditionRegistered(market, dataFeedId, threshold);
    }

    /// @notice Update data feed value (called by oracle or keeper)
    /// @param dataFeedId The data feed identifier
    /// @param value The latest value
    function updateDataFeed(bytes32 dataFeedId, int256 value) external {
        if (msg.sender != admin) revert NotAuthorized();
        latestDataFeeds[dataFeedId] = value;
    }

    /// @notice Check if upkeep is needed (Chainlink Automation compatible)
    /// @param checkData Encoded market address
    /// @return upkeepNeeded True if automated resolution should be triggered
    /// @return performData Encoded data for performUpkeep
    function checkUpkeep(bytes calldata checkData) 
        external 
        view 
        returns (bool upkeepNeeded, bytes memory performData) 
    {
        address market = abi.decode(checkData, (address));
        ResolutionCondition memory condition = conditions[market];

        if (!condition.isActive) {
            return (false, "");
        }

        if (block.timestamp < condition.targetTimestamp) {
            return (false, "");
        }

        int256 currentValue = latestDataFeeds[condition.dataFeedId];
        bool conditionMet = condition.isGreaterThan 
            ? currentValue > condition.threshold 
            : currentValue < condition.threshold;

        if (conditionMet) {
            Resolution.Outcome outcome = condition.isGreaterThan 
                ? Resolution.Outcome.YES 
                : Resolution.Outcome.NO;
            
            performData = abi.encode(market, outcome, currentValue);
            upkeepNeeded = true;
        }
    }

    /// @notice Execute automated resolution (Chainlink Automation compatible)
    /// @param performData Encoded market, outcome, and value data
    function performUpkeep(bytes calldata performData) external {
        (address market, Resolution.Outcome outcome, int256 actualValue) = 
            abi.decode(performData, (address, Resolution.Outcome, int256));

        ResolutionCondition storage condition = conditions[market];
        
        if (!condition.isActive) revert MarketAlreadyResolved();
        
        // Validate condition is still met
        int256 currentValue = latestDataFeeds[condition.dataFeedId];
        bool conditionMet = condition.isGreaterThan 
            ? currentValue > condition.threshold 
            : currentValue < condition.threshold;
        
        if (!conditionMet) revert ConditionNotMet();

        // Mark as inactive
        condition.isActive = false;

        emit ConditionMet(market, actualValue);

        // Trigger resolution
        try resolution.resolve(
            market, 
            outcome, 
            abi.encode(condition.dataFeedId, actualValue, block.timestamp)
        ) {
            emit AutomatedResolutionTriggered(market, outcome);
        } catch Error(string memory reason) {
            emit ResolutionFailureHandled(market, reason);
            revert ResolutionFailed();
        }
    }

    /// @notice Manually trigger resolution if conditions are met
    /// @param market The market address
    function manualTrigger(address market) external {
        if (msg.sender != admin) revert NotAuthorized();
        
        ResolutionCondition storage condition = conditions[market];
        if (!condition.isActive) revert MarketAlreadyResolved();

        int256 currentValue = latestDataFeeds[condition.dataFeedId];
        bool conditionMet = condition.isGreaterThan 
            ? currentValue > condition.threshold 
            : currentValue < condition.threshold;
        
        if (!conditionMet) revert ConditionNotMet();

        Resolution.Outcome outcome = condition.isGreaterThan 
            ? Resolution.Outcome.YES 
            : Resolution.Outcome.NO;

        condition.isActive = false;

        emit ConditionMet(market, currentValue);

        resolution.resolve(
            market, 
            outcome, 
            abi.encode(condition.dataFeedId, currentValue, block.timestamp)
        );

        emit AutomatedResolutionTriggered(market, outcome);
    }

    /// @notice Deactivate a condition
    /// @param market The market address
    function deactivateCondition(address market) external {
        if (msg.sender != admin) revert NotAuthorized();
        conditions[market].isActive = false;
    }

    // -------------------------------------------------------------------------
    // View functions
    // -------------------------------------------------------------------------

    /// @notice Get condition details for a market
    /// @param market The market address
    /// @return condition The resolution condition
    function getCondition(address market) external view returns (ResolutionCondition memory) {
        return conditions[market];
    }

    /// @notice Get latest value for a data feed
    /// @param dataFeedId The data feed identifier
    /// @return value The latest value
    function getDataFeedValue(bytes32 dataFeedId) external view returns (int256) {
        return latestDataFeeds[dataFeedId];
    }
}

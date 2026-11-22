// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MarketStrategy
 * @notice Add market strategy management.
 */
contract MarketStrategy is Ownable {
    error ZeroAddress();
    error StrategyExists();
    error StrategyNotFound();
    error StrategyNotActive();

    struct Strategy {
        string name;
        address target;
        bytes defaultData;
        bool active;
    }

    struct Performance {
        uint256 executions;
        uint256 successes;
        uint256 failures;
    }

    mapping(bytes32 => Strategy) public strategies;
    mapping(bytes32 => Performance) public performance;
    bytes32[] public strategyIds;

    event StrategyDefined(bytes32 indexed id, string name, address target);
    event StrategyUpdated(bytes32 indexed id, address target, bool active);
    event StrategyExecuted(bytes32 indexed id, bool success);

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Define market strategies
     * @param id Encoded data used for id.
     * @param name name used by this operation.
     * @param target Address associated with target.
     * @param defaultData Encoded data used for default data.
     * @dev Access: Caller must be the contract owner.
     * @dev Reverts: `ZeroAddress` if `target == address(0)` is true. `StrategyExists` if
     *     `bytes(strategies[id].name).length > 0` is true.
     */
    function defineStrategy(bytes32 id, string calldata name, address target, bytes calldata defaultData) external onlyOwner {
        if (target == address(0)) revert ZeroAddress();
        if (bytes(strategies[id].name).length > 0) revert StrategyExists();

        strategies[id] = Strategy({
            name: name,
            target: target,
            defaultData: defaultData,
            active: true
        });
        strategyIds.push(id);

        emit StrategyDefined(id, name, target);
    }

    /**
     * @notice Handle strategy changes
     * @param id Encoded data used for id.
     * @param target Address associated with target.
     * @param defaultData Encoded data used for default data.
     * @param active Whether active is enabled or selected.
     * @dev Access: Caller must be the contract owner.
     * @dev Reverts: `StrategyNotFound` if `bytes(strategies[id].name).length == 0` is true.
     *     `ZeroAddress` if `target == address(0)` is true.
     */
    function updateStrategy(bytes32 id, address target, bytes calldata defaultData, bool active) external onlyOwner {
        if (bytes(strategies[id].name).length == 0) revert StrategyNotFound();
        if (target == address(0)) revert ZeroAddress();

        strategies[id].target = target;
        strategies[id].defaultData = defaultData;
        strategies[id].active = active;

        emit StrategyUpdated(id, target, active);
    }

    /**
     * @notice Execute strategy actions and track strategy performance
     * @param id Encoded data used for id.
     * @param executionData Encoded data used for execution data.
     * @dev Access: Caller must be the contract owner.
     * @dev Reverts: `StrategyNotFound` if `bytes(strategies[id].name).length == 0` is true.
     *     `StrategyNotActive` if `!strategies[id].active` is true.
     */
    function executeStrategy(bytes32 id, bytes calldata executionData) external onlyOwner {
        if (bytes(strategies[id].name).length == 0) revert StrategyNotFound();
        if (!strategies[id].active) revert StrategyNotActive();

        bytes memory dataToExecute;
        if (executionData.length > 0) {
            dataToExecute = executionData;
        } else {
            dataToExecute = strategies[id].defaultData;
        }
        
        (bool success, ) = strategies[id].target.call(dataToExecute);

        performance[id].executions++;
        if (success) {
            performance[id].successes++;
        } else {
            performance[id].failures++;
        }

        emit StrategyExecuted(id, success);
    }

    /**
     * @notice Provide strategy queries
     * @param id Encoded data used for id.
     * @return Strategy returned by the operation.
     * @dev Access: No caller-specific access restriction is imposed.
     */
    function getStrategy(bytes32 id) external view returns (Strategy memory) {
        return strategies[id];
    }

    /**
     * @notice Provide strategy queries for performance
     * @param id Encoded data used for id.
     * @return Performance returned by the operation.
     * @dev Access: No caller-specific access restriction is imposed.
     */
    function getPerformance(bytes32 id) external view returns (Performance memory) {
        return performance[id];
    }

    /**
     * @notice Provide strategy queries for all IDs
     * @return All strategy ids returned by the operation.
     * @dev Access: No caller-specific access restriction is imposed.
     */
    function getAllStrategyIds() external view returns (bytes32[] memory) {
        return strategyIds;
    }
}

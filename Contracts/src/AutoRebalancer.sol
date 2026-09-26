// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface AutomationCompatibleInterface {
    /// @notice Reports whether upkeep is satisfied.
    /// @param checkData Encoded data used for check data.
    /// @return upkeepNeeded upkeep needed produced by the operation.
    /// @return performData perform data produced by the operation.
    /// @dev Access: The interface specifies no caller restriction; implementations may enforce
    ///     access checks.
    function checkUpkeep(bytes calldata checkData) external returns (bool upkeepNeeded, bytes memory performData);
    /// @notice Executes performUpkeep.
    /// @param performData Encoded data used for perform data.
    /// @dev Access: The interface specifies no caller restriction; implementations may enforce
    ///     access checks.
    function performUpkeep(bytes calldata performData) external;
}

interface IRebalanceExecutor {
    /// @notice Executes executeRebalance.
    /// @param vault Address associated with vault.
    /// @param assets Address associated with assets.
    /// @param balances Numeric balances used by this operation.
    /// @param targetWeightsBps target weights bps expressed in basis points.
    /// @param data Encoded data supplied to the operation.
    /// @return profitLoss profit loss produced by the operation.
    /// @dev Access: The interface specifies no caller restriction; implementations may enforce
    ///     access checks.
    function executeRebalance(
        address vault,
        address[] calldata assets,
        uint256[] calldata balances,
        uint256[] calldata targetWeightsBps,
        bytes calldata data
    ) external returns (int256 profitLoss);
}

contract AutoRebalancer is Ownable, ReentrancyGuard, AutomationCompatibleInterface {
    using SafeERC20 for IERC20;

    uint256 public constant BPS = 10_000;

    struct RebalanceConfig {
        uint256 minDeviationBps;
        uint256 minInterval;
        bool enabled;
    }

    struct RebalanceRecord {
        uint256 id;
        uint256 timestamp;
        address executor;
        int256 profitLoss;
        uint256 totalValueBefore;
        uint256 totalValueAfter;
    }

    address[] private _assets;
    mapping(address => uint256) public targetWeightBps;

    RebalanceConfig public config;
    address public executor;
    bytes public executorData;
    uint256 public lastRebalanceAt;
    uint256 public rebalanceCount;
    int256 public cumulativeProfitLoss;

    mapping(uint256 => RebalanceRecord) private _records;

    event RebalanceParametersSet(uint256 minDeviationBps, uint256 minInterval, bool enabled);
    event TargetWeightsSet(address[] assets, uint256[] weightsBps);
    event ExecutorSet(address indexed executor);
    event ExecutorDataSet(bytes data);
    event RebalanceExecuted(
        uint256 indexed id,
        address indexed executor,
        int256 profitLoss,
        uint256 totalValueBefore,
        uint256 totalValueAfter
    );

    error ZeroAddress();
    error EmptyAssets();
    error ArrayLengthMismatch();
    error InvalidWeights();
    error InvalidDeviation();
    error RebalanceNotNeeded();

    constructor(
        address[] memory assets_,
        uint256[] memory weightsBps_,
        uint256 minDeviationBps_,
        uint256 minInterval_,
        address executor_
    ) Ownable(msg.sender) {
        _setTargetWeights(assets_, weightsBps_);
        _setRebalanceParameters(minDeviationBps_, minInterval_, true);
        _setExecutor(executor_);
    }

    /// @notice Executes setRebalanceParameters.
    /// @param minDeviationBps Minimum deviation bps required.
    /// @param minInterval Minimum interval required.
    /// @param enabled Whether the configuration is enabled.
    /// @dev Access: Caller must be the contract owner.
    function setRebalanceParameters(uint256 minDeviationBps, uint256 minInterval, bool enabled) external onlyOwner {
        _setRebalanceParameters(minDeviationBps, minInterval, enabled);
    }

    /// @notice Executes setTargetWeights.
    /// @param assets_ Address associated with assets_.
    /// @param weightsBps_ weights bps_ expressed in basis points.
    /// @dev Access: Caller must be the contract owner.
    function setTargetWeights(address[] calldata assets_, uint256[] calldata weightsBps_) external onlyOwner {
        _setTargetWeights(assets_, weightsBps_);
    }

    /// @notice Executes setExecutor.
    /// @param executor_ Address associated with executor_.
    /// @dev Access: Caller must be the contract owner.
    function setExecutor(address executor_) external onlyOwner {
        _setExecutor(executor_);
    }

    /// @notice Executes setExecutorData.
    /// @param data Encoded data supplied to the operation.
    /// @dev Access: Caller must be the contract owner.
    function setExecutorData(bytes calldata data) external onlyOwner {
        executorData = data;
        emit ExecutorDataSet(data);
    }

    /// @notice Withdraws.
    /// @param token Token contract address used by the operation.
    /// @param to Destination address for the transfer.
    /// @param amount Amount to process, in the relevant token units.
    /// @dev Access: Caller must be the contract owner.
    /// @dev Reverts: `ZeroAddress` if `to == address(0)` is true.
    function withdraw(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
    }

    /// @notice Reports whether upkeep is satisfied.
    /// @return upkeepNeeded upkeep needed produced by the operation.
    /// @return performData perform data produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function checkUpkeep(bytes calldata) external view returns (bool upkeepNeeded, bytes memory performData) {
        (upkeepNeeded, performData) = _checkRebalance();
    }

    /// @notice Executes performUpkeep.
    /// @param performData Encoded data used for perform data.
    /// @dev Access: No caller-specific access restriction is imposed.
    /// @dev Reverts: `RebalanceNotNeeded` if `!needed` is true.
    function performUpkeep(bytes calldata performData) external nonReentrant {
        (bool needed,) = _checkRebalance();
        if (!needed) revert RebalanceNotNeeded();

        (address[] memory assetsSnapshot, uint256[] memory balancesBefore, uint256 totalBefore) = _snapshot();
        bytes memory data;
        if (performData.length == 0) {
            data = executorData;
        } else {
            data = performData;
        }
        int256 profitLoss = IRebalanceExecutor(executor).executeRebalance(
            address(this),
            assetsSnapshot,
            balancesBefore,
            _targetWeightsArray(assetsSnapshot),
            data
        );

        (,, uint256 totalAfter) = _snapshot();
        lastRebalanceAt = block.timestamp;
        rebalanceCount += 1;
        cumulativeProfitLoss += profitLoss;

        _records[rebalanceCount] = RebalanceRecord({
            id: rebalanceCount,
            timestamp: block.timestamp,
            executor: executor,
            profitLoss: profitLoss,
            totalValueBefore: totalBefore,
            totalValueAfter: totalAfter
        });

        emit RebalanceExecuted(rebalanceCount, executor, profitLoss, totalBefore, totalAfter);
    }

    /// @notice Executes needsRebalance.
    /// @return needed True if needed.
    /// @return maxDeviationBps Rate expressed in basis points.
    /// @dev Access: No caller-specific access restriction is imposed.
    function needsRebalance() external view returns (bool needed, uint256 maxDeviationBps) {
        if (!config.enabled || block.timestamp < lastRebalanceAt + config.minInterval) {
            return (false, 0);
        }
        maxDeviationBps = getMaxDeviationBps();
        needed = maxDeviationBps >= config.minDeviationBps;
    }

    /// @notice Returns assets.
    /// @return Assets returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getAssets() external view returns (address[] memory) {
        return _assets;
    }

    /// @notice Returns current weights.
    /// @return assets_ assets_ produced by the operation.
    /// @return balances Balances corresponding to the returned assets.
    /// @return weightsBps Rate expressed in basis points.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getCurrentWeights()
        external
        view
        returns (address[] memory assets_, uint256[] memory balances, uint256[] memory weightsBps)
    {
        (assets_, balances,) = _snapshot();
        weightsBps = new uint256[](assets_.length);

        uint256 total;
        for (uint256 i; i < balances.length; ++i) total += balances[i];
        if (total == 0) return (assets_, balances, weightsBps);

        for (uint256 i; i < balances.length; ++i) {
            weightsBps[i] = balances[i] * BPS / total;
        }
    }

    /// @notice Returns max deviation bps.
    /// @return maxDeviationBps Rate expressed in basis points.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getMaxDeviationBps() public view returns (uint256 maxDeviationBps) {
        (address[] memory assets_, uint256[] memory balances,) = _snapshot();
        uint256 total;
        for (uint256 i; i < balances.length; ++i) total += balances[i];
        if (total == 0) return 0;

        for (uint256 i; i < assets_.length; ++i) {
            uint256 current = balances[i] * BPS / total;
            uint256 target = targetWeightBps[assets_[i]];
            uint256 deviation = current > target ? current - target : target - current;
            if (deviation > maxDeviationBps) maxDeviationBps = deviation;
        }
    }

    /// @notice Returns rebalance record.
    /// @param id Numeric id used by this operation.
    /// @return Rebalance record returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getRebalanceRecord(uint256 id) external view returns (RebalanceRecord memory) {
        return _records[id];
    }

    /// @notice Returns performance.
    /// @return count Number of items tracked by the contract.
    /// @return totalProfitLoss total profit loss produced by the operation.
    /// @return latestRebalanceAt Unix timestamp of the event.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getPerformance()
        external
        view
        returns (uint256 count, int256 totalProfitLoss, uint256 latestRebalanceAt)
    {
        return (rebalanceCount, cumulativeProfitLoss, lastRebalanceAt);
    }

    function _checkRebalance() internal view returns (bool upkeepNeeded, bytes memory performData) {
        if (!config.enabled || block.timestamp < lastRebalanceAt + config.minInterval) {
            return (false, bytes(""));
        }

        uint256 maxDeviationBps = getMaxDeviationBps();
        upkeepNeeded = maxDeviationBps >= config.minDeviationBps;
        performData = upkeepNeeded ? executorData : bytes("");
    }

    function _setRebalanceParameters(uint256 minDeviationBps, uint256 minInterval, bool enabled) internal {
        if (minDeviationBps == 0 || minDeviationBps > BPS) revert InvalidDeviation();
        config = RebalanceConfig({
            minDeviationBps: minDeviationBps,
            minInterval: minInterval,
            enabled: enabled
        });
        emit RebalanceParametersSet(minDeviationBps, minInterval, enabled);
    }

    function _setTargetWeights(address[] memory assets_, uint256[] memory weightsBps_) internal {
        if (assets_.length == 0) revert EmptyAssets();
        if (assets_.length != weightsBps_.length) revert ArrayLengthMismatch();

        for (uint256 i; i < _assets.length; ++i) {
            targetWeightBps[_assets[i]] = 0;
        }

        uint256 totalWeight;
        for (uint256 i; i < assets_.length; ++i) {
            if (assets_[i] == address(0)) revert ZeroAddress();
            if (weightsBps_[i] == 0) revert InvalidWeights();
            for (uint256 j = i + 1; j < assets_.length; ++j) {
                if (assets_[i] == assets_[j]) revert InvalidWeights();
            }
            totalWeight += weightsBps_[i];
            targetWeightBps[assets_[i]] = weightsBps_[i];
        }
        if (totalWeight != BPS) revert InvalidWeights();

        _assets = assets_;
        emit TargetWeightsSet(assets_, weightsBps_);
    }

    function _setExecutor(address executor_) internal {
        if (executor_ == address(0)) revert ZeroAddress();
        executor = executor_;
        emit ExecutorSet(executor_);
    }

    function _snapshot()
        internal
        view
        returns (address[] memory assets_, uint256[] memory balances, uint256 totalValue)
    {
        assets_ = _assets;
        balances = new uint256[](assets_.length);
        for (uint256 i; i < assets_.length; ++i) {
            balances[i] = IERC20(assets_[i]).balanceOf(address(this));
            totalValue += balances[i];
        }
    }

    function _targetWeightsArray(address[] memory assets_) internal view returns (uint256[] memory weights) {
        weights = new uint256[](assets_.length);
        for (uint256 i; i < assets_.length; ++i) {
            weights[i] = targetWeightBps[assets_[i]];
        }
    }
}

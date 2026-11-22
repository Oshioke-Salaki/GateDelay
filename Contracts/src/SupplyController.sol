// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SupplyController
 * @notice Implements token supply control mechanisms with limits and metrics tracking
 * @dev Manages total supply, supply changes, limits, and provides comprehensive supply queries
 */
contract SupplyController is AccessControl, ReentrancyGuard {
    // ==================== Types ====================
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant CONTROLLER_ROLE = keccak256("CONTROLLER_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    enum SupplyOperation {
        MINT,
        BURN,
        TRANSFER
    }

    struct SupplyMetric {
        uint256 timestamp;
        uint256 amount;
        SupplyOperation operation;
        address executor;
    }

    struct SupplyLimits {
        uint256 cap;
        uint256 floor;
        uint256 maxMintPerTx;
        uint256 maxBurnPerTx;
    }

    // ==================== State ====================

    uint256 public totalSupply;
    uint256 public totalMinted;
    uint256 public totalBurned;

    SupplyLimits public limits;
    bool public limitsEnabled;

    mapping(address => uint256) public userMintCount;
    mapping(address => uint256) public userBurnCount;
    mapping(address => uint256) public lastMintTimestamp;
    mapping(address => uint256) public lastBurnTimestamp;

    SupplyMetric[] public metrics;
    mapping(address => uint256[]) public userMetrics;

    // ==================== Events ====================

    event SupplyCapUpdated(uint256 newCap);
    event SupplyFloorUpdated(uint256 newFloor);
    event MaxMintPerTxUpdated(uint256 newMax);
    event MaxBurnPerTxUpdated(uint256 newMax);
    event LimitsToggled(bool enabled);

    event SupplyMinted(
        address indexed executor,
        uint256 amount,
        uint256 newTotal,
        uint256 timestamp
    );

    event SupplyBurned(
        address indexed executor,
        uint256 amount,
        uint256 newTotal,
        uint256 timestamp
    );

    event SupplyTransferred(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 timestamp
    );

    event MetricsReset(address indexed executor, uint256 timestamp);
    event SupplyReset(address indexed executor, uint256 timestamp);

    // ==================== Constructor ====================

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(CONTROLLER_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);

        totalSupply = 0;
        totalMinted = 0;
        totalBurned = 0;

        limits = SupplyLimits({
            cap: type(uint256).max,
            floor: 0,
            maxMintPerTx: type(uint256).max,
            maxBurnPerTx: type(uint256).max
        });

        limitsEnabled = false;
    }

    // ==================== Configuration ====================

    /// @notice Executes setSupplyCap.
    /// @param newCap New cap value.
    /// @dev Access: Caller must hold the ADMIN_ROLE role.
    /// @dev Reverts: "Cap cannot be less than current supply" if `newCap >= totalSupply` is false.
    ///     "Cap cannot be less than floor" if `newCap >= limits.floor` is false.
    function setSupplyCap(uint256 newCap) external onlyRole(ADMIN_ROLE) {
        require(newCap >= totalSupply, "Cap cannot be less than current supply");
        require(newCap >= limits.floor, "Cap cannot be less than floor");
        limits.cap = newCap;
        emit SupplyCapUpdated(newCap);
    }

    /// @notice Executes setSupplyFloor.
    /// @param newFloor New floor value.
    /// @dev Access: Caller must hold the ADMIN_ROLE role.
    /// @dev Reverts: "Floor cannot be more than current supply" if `newFloor <= totalSupply` is
    ///     false. "Floor cannot be more than cap" if `newFloor <= limits.cap` is false.
    function setSupplyFloor(uint256 newFloor) external onlyRole(ADMIN_ROLE) {
        require(newFloor <= totalSupply, "Floor cannot be more than current supply");
        require(newFloor <= limits.cap, "Floor cannot be more than cap");
        limits.floor = newFloor;
        emit SupplyFloorUpdated(newFloor);
    }

    /// @notice Executes setMaxMintPerTx.
    /// @param newMax New max value.
    /// @dev Access: Caller must hold the ADMIN_ROLE role.
    function setMaxMintPerTx(uint256 newMax) external onlyRole(ADMIN_ROLE) {
        limits.maxMintPerTx = newMax;
        emit MaxMintPerTxUpdated(newMax);
    }

    /// @notice Executes setMaxBurnPerTx.
    /// @param newMax New max value.
    /// @dev Access: Caller must hold the ADMIN_ROLE role.
    function setMaxBurnPerTx(uint256 newMax) external onlyRole(ADMIN_ROLE) {
        limits.maxBurnPerTx = newMax;
        emit MaxBurnPerTxUpdated(newMax);
    }

    /// @notice Executes toggleLimits.
    /// @param enabled Whether the configuration is enabled.
    /// @dev Access: Caller must hold the ADMIN_ROLE role.
    function toggleLimits(bool enabled) external onlyRole(ADMIN_ROLE) {
        limitsEnabled = enabled;
        emit LimitsToggled(enabled);
    }

    // ==================== Supply Control ====================

    /// @notice Mints.
    /// @param amount Amount to process, in the relevant token units.
    /// @return True when the requested condition is met.
    /// @dev Access: Caller must hold the CONTROLLER_ROLE role.
    /// @dev Reverts: "Cannot mint zero amount" if `amount > 0` is false. "Mint exceeds
    ///     per-transaction limit" if `amount <= limits.maxMintPerTx` is false. "Mint exceeds supply
    ///     cap" if `totalSupply + amount <= limits.cap` is false.
    function mint(uint256 amount) external onlyRole(CONTROLLER_ROLE) nonReentrant returns (bool) {
        require(amount > 0, "Cannot mint zero amount");
        
        if (limitsEnabled) {
            require(amount <= limits.maxMintPerTx, "Mint exceeds per-transaction limit");
            require(totalSupply + amount <= limits.cap, "Mint exceeds supply cap");
        }

        totalSupply += amount;
        totalMinted += amount;
        userMintCount[msg.sender]++;
        lastMintTimestamp[msg.sender] = block.timestamp;

        uint256 metricIndex = metrics.length;
        metrics.push(SupplyMetric({
            timestamp: block.timestamp,
            amount: amount,
            operation: SupplyOperation.MINT,
            executor: msg.sender
        }));
        userMetrics[msg.sender].push(metricIndex);

        emit SupplyMinted(msg.sender, amount, totalSupply, block.timestamp);
        return true;
    }

    /// @notice Burns.
    /// @param amount Amount to process, in the relevant token units.
    /// @return True when the requested condition is met.
    /// @dev Access: Caller must hold the CONTROLLER_ROLE role.
    /// @dev Reverts: "Cannot burn zero amount" if `amount > 0` is false. "Cannot burn more than
    ///     total supply" if `amount <= totalSupply` is false. "Burn exceeds per-transaction limit"
    ///     if `amount <= limits.maxBurnPerTx` is false. "Burn would breach supply floor" if
    ///     `totalSupply - amount >= limits.floor` is false.
    function burn(uint256 amount) external onlyRole(CONTROLLER_ROLE) nonReentrant returns (bool) {
        require(amount > 0, "Cannot burn zero amount");
        require(amount <= totalSupply, "Cannot burn more than total supply");
        
        if (limitsEnabled) {
            require(amount <= limits.maxBurnPerTx, "Burn exceeds per-transaction limit");
            require(totalSupply - amount >= limits.floor, "Burn would breach supply floor");
        }

        totalSupply -= amount;
        totalBurned += amount;
        userBurnCount[msg.sender]++;
        lastBurnTimestamp[msg.sender] = block.timestamp;

        uint256 metricIndex = metrics.length;
        metrics.push(SupplyMetric({
            timestamp: block.timestamp,
            amount: amount,
            operation: SupplyOperation.BURN,
            executor: msg.sender
        }));
        userMetrics[msg.sender].push(metricIndex);

        emit SupplyBurned(msg.sender, amount, totalSupply, block.timestamp);
        return true;
    }

    /// @notice Executes recordTransfer.
    /// @param from Source address for the transfer.
    /// @param to Destination address for the transfer.
    /// @param amount Amount to process, in the relevant token units.
    /// @return True when the requested condition is met.
    /// @dev Access: Caller must hold the MANAGER_ROLE role.
    /// @dev Reverts: "Invalid from address" if `from != address(0)` is false. "Invalid to address"
    ///     if `to != address(0)` is false. "Cannot transfer zero amount" if `amount > 0` is false.
    function recordTransfer(
        address from,
        address to,
        uint256 amount
    ) external onlyRole(MANAGER_ROLE) nonReentrant returns (bool) {
        require(from != address(0), "Invalid from address");
        require(to != address(0), "Invalid to address");
        require(amount > 0, "Cannot transfer zero amount");

        uint256 metricIndex = metrics.length;
        metrics.push(SupplyMetric({
            timestamp: block.timestamp,
            amount: amount,
            operation: SupplyOperation.TRANSFER,
            executor: from
        }));
        userMetrics[from].push(metricIndex);

        emit SupplyTransferred(from, to, amount, block.timestamp);
        return true;
    }

    // ==================== Supply Limits & Changes ====================

    /// @notice Returns current supply.
    /// @return Current supply returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getCurrentSupply() external view returns (uint256) {
        return totalSupply;
    }

    /// @notice Returns supply cap.
    /// @return Supply cap returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getSupplyCap() external view returns (uint256) {
        return limits.cap;
    }

    /// @notice Returns supply floor.
    /// @return Supply floor returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getSupplyFloor() external view returns (uint256) {
        return limits.floor;
    }

    /// @notice Returns max mint per tx.
    /// @return Max mint per tx returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getMaxMintPerTx() external view returns (uint256) {
        return limits.maxMintPerTx;
    }

    /// @notice Returns max burn per tx.
    /// @return Max burn per tx returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getMaxBurnPerTx() external view returns (uint256) {
        return limits.maxBurnPerTx;
    }

    /// @notice Returns supply limits.
    /// @return Supply limits returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getSupplyLimits() external view returns (SupplyLimits memory) {
        return limits;
    }

    /// @notice Reports whether mint is satisfied.
    /// @param amount Amount to process, in the relevant token units.
    /// @return True when the requested condition is met.
    /// @dev Access: No caller-specific access restriction is imposed.
    function canMint(uint256 amount) external view returns (bool) {
        if (!limitsEnabled) return true;
        if (amount > limits.maxMintPerTx) return false;
        if (totalSupply + amount > limits.cap) return false;
        return true;
    }

    /// @notice Reports whether burn is satisfied.
    /// @param amount Amount to process, in the relevant token units.
    /// @return True when the requested condition is met.
    /// @dev Access: No caller-specific access restriction is imposed.
    function canBurn(uint256 amount) external view returns (bool) {
        if (!limitsEnabled) return true;
        if (amount > limits.maxBurnPerTx) return false;
        if (totalSupply - amount < limits.floor) return false;
        return true;
    }

    /// @notice Returns supply utilization.
    /// @return Supply utilization returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getSupplyUtilization() external view returns (uint256) {
        if (limits.cap == 0) return 0;
        return (totalSupply * 100) / limits.cap;
    }

    /// @notice Returns remaining mint capacity.
    /// @return Remaining mint capacity returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getRemainingMintCapacity() external view returns (uint256) {
        if (totalSupply >= limits.cap) return 0;
        return limits.cap - totalSupply;
    }

    /// @notice Returns available burn capacity.
    /// @return Available burn capacity returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getAvailableBurnCapacity() external view returns (uint256) {
        if (totalSupply <= limits.floor) return 0;
        return totalSupply - limits.floor;
    }

    // ==================== Metrics & Analytics ====================

    /// @notice Returns total minted.
    /// @return Total minted returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getTotalMinted() external view returns (uint256) {
        return totalMinted;
    }

    /// @notice Returns total burned.
    /// @return Total burned returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getTotalBurned() external view returns (uint256) {
        return totalBurned;
    }

    /// @notice Returns metrics count.
    /// @return Metrics count returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getMetricsCount() external view returns (uint256) {
        return metrics.length;
    }

    /// @notice Returns metric.
    /// @param index Numeric index used by this operation.
    /// @return Metric returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    /// @dev Reverts: "Invalid metric index" if `index < metrics.length` is false.
    function getMetric(uint256 index) external view returns (SupplyMetric memory) {
        require(index < metrics.length, "Invalid metric index");
        return metrics[index];
    }

    /// @notice Returns metrics range.
    /// @param start Numeric start used by this operation.
    /// @param end Numeric end used by this operation.
    /// @return Metrics range returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    /// @dev Reverts: "Invalid range" if `start <= end` is false. "End index out of bounds" if `end
    ///     <= metrics.length` is false.
    function getMetricsRange(uint256 start, uint256 end) external view returns (SupplyMetric[] memory) {
        require(start <= end, "Invalid range");
        require(end <= metrics.length, "End index out of bounds");
        
        SupplyMetric[] memory result = new SupplyMetric[](end - start);
        for (uint256 i = start; i < end; i++) {
            result[i - start] = metrics[i];
        }
        return result;
    }

    /// @notice Returns user metrics count.
    /// @param user User address affected by this operation.
    /// @return User metrics count returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getUserMetricsCount(address user) external view returns (uint256) {
        return userMetrics[user].length;
    }

    /// @notice Returns user metric.
    /// @param user User address affected by this operation.
    /// @param index Numeric index used by this operation.
    /// @return User metric returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    /// @dev Reverts: "Invalid metric index" if `index < userMetrics[user].length` is false.
    function getUserMetric(address user, uint256 index) external view returns (SupplyMetric memory) {
        require(index < userMetrics[user].length, "Invalid metric index");
        uint256 metricIndex = userMetrics[user][index];
        return metrics[metricIndex];
    }

    /// @notice Returns user metrics range.
    /// @param user User address affected by this operation.
    /// @param start Numeric start used by this operation.
    /// @param end Numeric end used by this operation.
    /// @return User metrics range returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    /// @dev Reverts: "Invalid range" if `start <= end` is false. "End index out of bounds" if `end
    ///     <= userMetricIndices.length` is false.
    function getUserMetricsRange(
        address user,
        uint256 start,
        uint256 end
    ) external view returns (SupplyMetric[] memory) {
        require(start <= end, "Invalid range");
        uint256[] storage userMetricIndices = userMetrics[user];
        require(end <= userMetricIndices.length, "End index out of bounds");
        
        SupplyMetric[] memory result = new SupplyMetric[](end - start);
        for (uint256 i = start; i < end; i++) {
            result[i - start] = metrics[userMetricIndices[i]];
        }
        return result;
    }

    /// @notice Returns supply changes since.
    /// @param timestamp Unix timestamp associated with this operation.
    /// @return Supply changes since returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getSupplyChangesSince(uint256 timestamp) external view returns (SupplyMetric[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < metrics.length; i++) {
            if (metrics[i].timestamp >= timestamp) {
                count++;
            }
        }

        SupplyMetric[] memory result = new SupplyMetric[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < metrics.length; i++) {
            if (metrics[i].timestamp >= timestamp) {
                result[index] = metrics[i];
                index++;
            }
        }
        return result;
    }

    /// @notice Returns user stats.
    /// @param user User address affected by this operation.
    /// @return mintCount Number of items tracked by the contract.
    /// @return burnCount Number of items tracked by the contract.
    /// @return lastMint last mint produced by the operation.
    /// @return lastBurn last burn produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getUserStats(address user) external view returns (
        uint256 mintCount,
        uint256 burnCount,
        uint256 lastMint,
        uint256 lastBurn
    ) {
        return (
            userMintCount[user],
            userBurnCount[user],
            lastMintTimestamp[user],
            lastBurnTimestamp[user]
        );
    }

    // ==================== Reset Functions ====================

    /// @notice Executes resetMetrics.
    /// @dev Access: Caller must hold the ADMIN_ROLE role.
    function resetMetrics() external onlyRole(ADMIN_ROLE) {
        delete metrics;
        for (uint256 i = 0; i < metrics.length; i++) {
            delete userMetrics[msg.sender];
        }
        emit MetricsReset(msg.sender, block.timestamp);
    }

    /// @notice Executes resetSupply.
    /// @dev Access: Caller must hold the ADMIN_ROLE role.
    function resetSupply() external onlyRole(ADMIN_ROLE) {
        totalSupply = 0;
        totalMinted = 0;
        totalBurned = 0;
        emit SupplyReset(msg.sender, block.timestamp);
    }

    /// @notice Executes resetUserStats.
    /// @param user User address affected by this operation.
    /// @dev Access: Caller must hold the ADMIN_ROLE role.
    function resetUserStats(address user) external onlyRole(ADMIN_ROLE) {
        userMintCount[user] = 0;
        userBurnCount[user] = 0;
        lastMintTimestamp[user] = 0;
        lastBurnTimestamp[user] = 0;
    }
}

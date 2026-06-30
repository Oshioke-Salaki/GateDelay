// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

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

    function setSupplyCap(uint256 newCap) external onlyRole(ADMIN_ROLE) {
        require(newCap >= totalSupply, "Cap cannot be less than current supply");
        require(newCap >= limits.floor, "Cap cannot be less than floor");
        limits.cap = newCap;
        emit SupplyCapUpdated(newCap);
    }

    function setSupplyFloor(uint256 newFloor) external onlyRole(ADMIN_ROLE) {
        require(newFloor <= totalSupply, "Floor cannot be more than current supply");
        require(newFloor <= limits.cap, "Floor cannot be more than cap");
        limits.floor = newFloor;
        emit SupplyFloorUpdated(newFloor);
    }

    function setMaxMintPerTx(uint256 newMax) external onlyRole(ADMIN_ROLE) {
        limits.maxMintPerTx = newMax;
        emit MaxMintPerTxUpdated(newMax);
    }

    function setMaxBurnPerTx(uint256 newMax) external onlyRole(ADMIN_ROLE) {
        limits.maxBurnPerTx = newMax;
        emit MaxBurnPerTxUpdated(newMax);
    }

    function toggleLimits(bool enabled) external onlyRole(ADMIN_ROLE) {
        limitsEnabled = enabled;
        emit LimitsToggled(enabled);
    }

    // ==================== Supply Control ====================

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

    function getCurrentSupply() external view returns (uint256) {
        return totalSupply;
    }

    function getSupplyCap() external view returns (uint256) {
        return limits.cap;
    }

    function getSupplyFloor() external view returns (uint256) {
        return limits.floor;
    }

    function getMaxMintPerTx() external view returns (uint256) {
        return limits.maxMintPerTx;
    }

    function getMaxBurnPerTx() external view returns (uint256) {
        return limits.maxBurnPerTx;
    }

    function getSupplyLimits() external view returns (SupplyLimits memory) {
        return limits;
    }

    function canMint(uint256 amount) external view returns (bool) {
        if (!limitsEnabled) return true;
        if (amount > limits.maxMintPerTx) return false;
        if (totalSupply + amount > limits.cap) return false;
        return true;
    }

    function canBurn(uint256 amount) external view returns (bool) {
        if (!limitsEnabled) return true;
        if (amount > limits.maxBurnPerTx) return false;
        if (totalSupply - amount < limits.floor) return false;
        return true;
    }

    function getSupplyUtilization() external view returns (uint256) {
        if (limits.cap == 0) return 0;
        return (totalSupply * 100) / limits.cap;
    }

    function getRemainingMintCapacity() external view returns (uint256) {
        if (totalSupply >= limits.cap) return 0;
        return limits.cap - totalSupply;
    }

    function getAvailableBurnCapacity() external view returns (uint256) {
        if (totalSupply <= limits.floor) return 0;
        return totalSupply - limits.floor;
    }

    // ==================== Metrics & Analytics ====================

    function getTotalMinted() external view returns (uint256) {
        return totalMinted;
    }

    function getTotalBurned() external view returns (uint256) {
        return totalBurned;
    }

    function getMetricsCount() external view returns (uint256) {
        return metrics.length;
    }

    function getMetric(uint256 index) external view returns (SupplyMetric memory) {
        require(index < metrics.length, "Invalid metric index");
        return metrics[index];
    }

    function getMetricsRange(uint256 start, uint256 end) external view returns (SupplyMetric[] memory) {
        require(start <= end, "Invalid range");
        require(end <= metrics.length, "End index out of bounds");
        
        SupplyMetric[] memory result = new SupplyMetric[](end - start);
        for (uint256 i = start; i < end; i++) {
            result[i - start] = metrics[i];
        }
        return result;
    }

    function getUserMetricsCount(address user) external view returns (uint256) {
        return userMetrics[user].length;
    }

    function getUserMetric(address user, uint256 index) external view returns (SupplyMetric memory) {
        require(index < userMetrics[user].length, "Invalid metric index");
        uint256 metricIndex = userMetrics[user][index];
        return metrics[metricIndex];
    }

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

    function resetMetrics() external onlyRole(ADMIN_ROLE) {
        delete metrics;
        for (uint256 i = 0; i < metrics.length; i++) {
            delete userMetrics[msg.sender];
        }
        emit MetricsReset(msg.sender, block.timestamp);
    }

    function resetSupply() external onlyRole(ADMIN_ROLE) {
        totalSupply = 0;
        totalMinted = 0;
        totalBurned = 0;
        emit SupplyReset(msg.sender, block.timestamp);
    }

    function resetUserStats(address user) external onlyRole(ADMIN_ROLE) {
        userMintCount[user] = 0;
        userBurnCount[user] = 0;
        lastMintTimestamp[user] = 0;
        lastBurnTimestamp[user] = 0;
    }
}

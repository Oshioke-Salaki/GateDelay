// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {UD60x18, ud, unwrap} from "@prb/math/src/UD60x18.sol";

/// @title Liquidation
/// @notice Manages position liquidations with automated monitoring, penalty calculation, and proceeds distribution
/// @dev Integrates with CollateralVault, MarginCalculator, and PriceOracle for comprehensive liquidation management
contract Liquidation is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Errors ─────────────────────────────────────────────────────────────────
    error ZeroAddress();
    error PositionHealthy();
    error PositionNotLiquidatable();
    error InvalidLiquidationPenalty();
    error InvalidLiquidatorReward();
    error NoLiquidationProceeds();
    error MarketNotRegistered();
    error OracleStale();
    error InsufficientCollateral();

    // ── Types ──────────────────────────────────────────────────────────────────

    struct LiquidationCondition {
        uint256 healthFactor;           // Health factor (18 decimals, < 1e18 = liquidatable)
        uint256 collateralValue;        // Total collateral value in USD (18 decimals)
        uint256 positionValue;          // Total position value in USD (18 decimals)
        uint256 requiredMargin;         // Required maintenance margin
        uint256 currentMargin;          // Current margin deposited
        bool isLiquidatable;            // Whether position can be liquidated
    }

    struct LiquidationExecution {
        address account;                // Account being liquidated
        address market;                 // Market address
        address liquidator;             // Address executing liquidation
        uint256 collateralSeized;       // Amount of collateral seized
        uint256 penaltyAmount;          // Penalty charged to liquidated account
        uint256 liquidatorReward;       // Reward paid to liquidator
        uint256 protocolFee;            // Fee retained by protocol
        uint256 timestamp;              // Execution timestamp
        uint256 healthFactorBefore;     // Health factor before liquidation
    }

    struct LiquidationProceeds {
        uint256 totalSeized;            // Total collateral seized
        uint256 totalPenalties;         // Total penalties collected
        uint256 totalRewards;           // Total rewards paid to liquidators
        uint256 protocolBalance;        // Protocol's share of proceeds
        uint256 liquidationCount;       // Number of liquidations executed
    }

    // ── Events ─────────────────────────────────────────────────────────────────
    event LiquidationExecuted(
        address indexed account,
        address indexed market,
        address indexed liquidator,
        uint256 collateralSeized,
        uint256 penaltyAmount,
        uint256 liquidatorReward,
        uint256 healthFactor
    );
    event LiquidationConditionChecked(
        address indexed account,
        address indexed market,
        uint256 healthFactor,
        bool isLiquidatable
    );
    event PenaltyParametersUpdated(
        uint256 liquidationPenaltyBps,
        uint256 liquidatorRewardBps
    );
    event ProceedsWithdrawn(
        address indexed recipient,
        uint256 amount
    );
    event MarketRegistered(
        address indexed market,
        address indexed collateralToken,
        address indexed priceOracle
    );

    // ── Constants ──────────────────────────────────────────────────────────────
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant HEALTH_FACTOR_LIQUIDATION_THRESHOLD = 1e18; // 1.0 in 18 decimals
    uint256 public constant MIN_LIQUIDATION_PENALTY_BPS = 100;  // 1%
    uint256 public constant MAX_LIQUIDATION_PENALTY_BPS = 2000; // 20%
    uint256 public constant MIN_LIQUIDATOR_REWARD_BPS = 50;     // 0.5%
    uint256 public constant MAX_LIQUIDATOR_REWARD_BPS = 1000;   // 10%

    // ── State ──────────────────────────────────────────────────────────────────

    /// @notice Liquidation penalty in basis points (charged to liquidated account)
    uint256 public liquidationPenaltyBps;

    /// @notice Liquidator reward in basis points (paid from penalty)
    uint256 public liquidatorRewardBps;

    /// @notice CollateralVault contract reference
    address public collateralVault;

    /// @notice MarginCalculator contract reference
    address public marginCalculator;

    /// @notice Market => PriceOracle mapping
    mapping(address => address) public marketPriceOracle;

    /// @notice Market => CollateralToken mapping
    mapping(address => address) public marketCollateralToken;

    /// @notice Account => Market => LiquidationExecution history
    mapping(address => mapping(address => LiquidationExecution[])) public liquidationHistory;

    /// @notice Market => LiquidationProceeds
    mapping(address => LiquidationProceeds) public marketProceeds;

    /// @notice Protocol proceeds balance per token
    mapping(address => uint256) public protocolProceeds;

    /// @notice Whether liquidations are paused
    bool public paused;

    // ── Modifiers ──────────────────────────────────────────────────────────────

    modifier whenNotPaused() {
        require(!paused, "Liquidation: paused");
        _;
    }

    modifier validMarket(address market) {
        if (marketCollateralToken[market] == address(0)) revert MarketNotRegistered();
        _;
    }

    // ── Constructor ────────────────────────────────────────────────────────────

    /// @notice Initialize the Liquidation contract
    /// @param _collateralVault Address of CollateralVault contract
    /// @param _marginCalculator Address of MarginCalculator contract
    /// @param _liquidationPenaltyBps Initial liquidation penalty in bps
    /// @param _liquidatorRewardBps Initial liquidator reward in bps
    constructor(
        address _collateralVault,
        address _marginCalculator,
        uint256 _liquidationPenaltyBps,
        uint256 _liquidatorRewardBps
    ) Ownable(msg.sender) {
        if (_collateralVault == address(0) || _marginCalculator == address(0)) revert ZeroAddress();
        if (_liquidationPenaltyBps < MIN_LIQUIDATION_PENALTY_BPS || _liquidationPenaltyBps > MAX_LIQUIDATION_PENALTY_BPS) {
            revert InvalidLiquidationPenalty();
        }
        if (_liquidatorRewardBps < MIN_LIQUIDATOR_REWARD_BPS || _liquidatorRewardBps > MAX_LIQUIDATOR_REWARD_BPS) {
            revert InvalidLiquidatorReward();
        }

        collateralVault = _collateralVault;
        marginCalculator = _marginCalculator;
        liquidationPenaltyBps = _liquidationPenaltyBps;
        liquidatorRewardBps = _liquidatorRewardBps;
    }

    // ── Admin Functions ────────────────────────────────────────────────────────

    /// @notice Register a market with its collateral token and price oracle
    /// @param market Market address
    /// @param collateralToken Collateral token address
    /// @param priceOracle Price oracle address for this market
    function registerMarket(
        address market,
        address collateralToken,
        address priceOracle
    ) external onlyOwner {
        if (market == address(0) || collateralToken == address(0) || priceOracle == address(0)) {
            revert ZeroAddress();
        }
        marketCollateralToken[market] = collateralToken;
        marketPriceOracle[market] = priceOracle;
        emit MarketRegistered(market, collateralToken, priceOracle);
    }

    /// @notice Update liquidation penalty parameters
    /// @param _liquidationPenaltyBps New liquidation penalty in bps
    /// @param _liquidatorRewardBps New liquidator reward in bps
    function updatePenaltyParameters(
        uint256 _liquidationPenaltyBps,
        uint256 _liquidatorRewardBps
    ) external onlyOwner {
        if (_liquidationPenaltyBps < MIN_LIQUIDATION_PENALTY_BPS || _liquidationPenaltyBps > MAX_LIQUIDATION_PENALTY_BPS) {
            revert InvalidLiquidationPenalty();
        }
        if (_liquidatorRewardBps < MIN_LIQUIDATOR_REWARD_BPS || _liquidatorRewardBps > MAX_LIQUIDATOR_REWARD_BPS) {
            revert InvalidLiquidatorReward();
        }
        liquidationPenaltyBps = _liquidationPenaltyBps;
        liquidatorRewardBps = _liquidatorRewardBps;
        emit PenaltyParametersUpdated(_liquidationPenaltyBps, _liquidatorRewardBps);
    }

    /// @notice Pause or unpause liquidations
    /// @param _paused New pause state
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }

    /// @notice Withdraw protocol proceeds
    /// @param token Token address to withdraw
    /// @param recipient Recipient address
    /// @param amount Amount to withdraw
    function withdrawProtocolProceeds(
        address token,
        address recipient,
        uint256 amount
    ) external onlyOwner nonReentrant {
        if (recipient == address(0)) revert ZeroAddress();
        if (protocolProceeds[token] < amount) revert NoLiquidationProceeds();
        
        protocolProceeds[token] -= amount;
        IERC20(token).safeTransfer(recipient, amount);
        emit ProceedsWithdrawn(recipient, amount);
    }

    // ── Core Liquidation Functions ─────────────────────────────────────────────

    /// @notice Monitor liquidation conditions for an account
    /// @param account Account to check
    /// @param market Market address
    /// @return condition LiquidationCondition struct with health metrics
    function monitorLiquidationCondition(
        address account,
        address market
    ) public view validMarket(market) returns (LiquidationCondition memory condition) {
        // Get margin requirement from MarginCalculator
        (bool success, bytes memory data) = marginCalculator.staticcall(
            abi.encodeWithSignature("getMarginRequirement(address,address)", account, market)
        );
        
        if (!success) {
            return LiquidationCondition({
                healthFactor: type(uint256).max,
                collateralValue: 0,
                positionValue: 0,
                requiredMargin: 0,
                currentMargin: 0,
                isLiquidatable: false
            });
        }

        // Decode margin requirement
        (
            uint256 initialMargin,
            uint256 maintenanceMargin,
            uint256 liquidationMargin,
            uint256 currentMargin,
            // uint256 utilizationBps
        ) = abi.decode(data, (uint256, uint256, uint256, uint256, uint256));

        // Get collateral balance from CollateralVault
        (success, data) = collateralVault.staticcall(
            abi.encodeWithSignature("getBalance(address,address)", market, account)
        );
        uint256 collateralBalance = success ? abi.decode(data, (uint256)) : 0;

        // Calculate health factor: (currentMargin / liquidationMargin) * 1e18
        uint256 healthFactor = liquidationMargin > 0
            ? (currentMargin * 1e18) / liquidationMargin
            : type(uint256).max;

        // Position is liquidatable if health factor < 1.0 or current margin < liquidation margin
        bool isLiquidatable = healthFactor < HEALTH_FACTOR_LIQUIDATION_THRESHOLD 
            || currentMargin < liquidationMargin;

        condition = LiquidationCondition({
            healthFactor: healthFactor,
            collateralValue: collateralBalance,
            positionValue: initialMargin, // Using initial margin as proxy for position value
            requiredMargin: liquidationMargin,
            currentMargin: currentMargin,
            isLiquidatable: isLiquidatable
        });

        emit LiquidationConditionChecked(account, market, healthFactor, isLiquidatable);
    }

    /// @notice Execute liquidation of an undercollateralized position
    /// @param account Account to liquidate
    /// @param market Market address
    /// @return execution LiquidationExecution struct with liquidation details
    function executeLiquidation(
        address account,
        address market
    ) external nonReentrant whenNotPaused validMarket(market) returns (LiquidationExecution memory execution) {
        // Check liquidation conditions
        LiquidationCondition memory condition = monitorLiquidationCondition(account, market);
        
        if (!condition.isLiquidatable) revert PositionNotLiquidatable();
        if (condition.collateralValue == 0) revert InsufficientCollateral();

        // Calculate liquidation amounts
        (
            uint256 collateralToSeize,
            uint256 penaltyAmount,
            uint256 liquidatorReward,
            uint256 protocolFee
        ) = calculateLiquidationPenalty(condition.collateralValue, condition.requiredMargin);

        // Ensure we don't seize more than available
        if (collateralToSeize > condition.collateralValue) {
            collateralToSeize = condition.collateralValue;
        }

        // Execute liquidation through CollateralVault
        address collateralToken = marketCollateralToken[market];
        
        // Transfer liquidator reward
        if (liquidatorReward > 0) {
            (bool success,) = collateralVault.call(
                abi.encodeWithSignature(
                    "liquidate(address,address,uint256,address)",
                    market,
                    account,
                    liquidatorReward,
                    msg.sender
                )
            );
            require(success, "Liquidation: reward transfer failed");
        }

        // Transfer protocol fee
        if (protocolFee > 0) {
            (bool success,) = collateralVault.call(
                abi.encodeWithSignature(
                    "liquidate(address,address,uint256,address)",
                    market,
                    account,
                    protocolFee,
                    address(this)
                )
            );
            require(success, "Liquidation: protocol fee transfer failed");
            protocolProceeds[collateralToken] += protocolFee;
        }

        // Create execution record
        execution = LiquidationExecution({
            account: account,
            market: market,
            liquidator: msg.sender,
            collateralSeized: collateralToSeize,
            penaltyAmount: penaltyAmount,
            liquidatorReward: liquidatorReward,
            protocolFee: protocolFee,
            timestamp: block.timestamp,
            healthFactorBefore: condition.healthFactor
        });

        // Update history and proceeds
        liquidationHistory[account][market].push(execution);
        
        LiquidationProceeds storage proceeds = marketProceeds[market];
        proceeds.totalSeized += collateralToSeize;
        proceeds.totalPenalties += penaltyAmount;
        proceeds.totalRewards += liquidatorReward;
        proceeds.protocolBalance += protocolFee;
        proceeds.liquidationCount += 1;

        emit LiquidationExecuted(
            account,
            market,
            msg.sender,
            collateralToSeize,
            penaltyAmount,
            liquidatorReward,
            condition.healthFactor
        );
    }

    /// @notice Calculate liquidation penalty and distribution
    /// @param collateralValue Total collateral value
    /// @param debtValue Debt value (required margin)
    /// @return collateralToSeize Total collateral to seize
    /// @return penaltyAmount Total penalty amount
    /// @return liquidatorReward Reward for liquidator
    /// @return protocolFee Fee for protocol
    function calculateLiquidationPenalty(
        uint256 collateralValue,
        uint256 debtValue
    ) public view returns (
        uint256 collateralToSeize,
        uint256 penaltyAmount,
        uint256 liquidatorReward,
        uint256 protocolFee
    ) {
        // Calculate base amount to seize (debt + penalty)
        penaltyAmount = (debtValue * liquidationPenaltyBps) / BPS_DENOMINATOR;
        collateralToSeize = debtValue + penaltyAmount;

        // Cap at available collateral
        if (collateralToSeize > collateralValue) {
            collateralToSeize = collateralValue;
            penaltyAmount = collateralValue > debtValue ? collateralValue - debtValue : 0;
        }

        // Calculate liquidator reward from penalty
        liquidatorReward = (penaltyAmount * liquidatorRewardBps) / BPS_DENOMINATOR;
        
        // Protocol gets the rest of the penalty
        protocolFee = penaltyAmount - liquidatorReward;
    }

    // ── Query Functions ────────────────────────────────────────────────────────

    /// @notice Check if a position is liquidatable
    /// @param account Account to check
    /// @param market Market address
    /// @return isLiquidatable Whether the position can be liquidated
    function isPositionLiquidatable(
        address account,
        address market
    ) external view returns (bool) {
        LiquidationCondition memory condition = monitorLiquidationCondition(account, market);
        return condition.isLiquidatable;
    }

    /// @notice Get liquidation history for an account in a market
    /// @param account Account address
    /// @param market Market address
    /// @return executions Array of liquidation executions
    function getLiquidationHistory(
        address account,
        address market
    ) external view returns (LiquidationExecution[] memory) {
        return liquidationHistory[account][market];
    }

    /// @notice Get liquidation proceeds for a market
    /// @param market Market address
    /// @return proceeds LiquidationProceeds struct
    function getMarketProceeds(
        address market
    ) external view returns (LiquidationProceeds memory) {
        return marketProceeds[market];
    }

    /// @notice Get protocol proceeds balance for a token
    /// @param token Token address
    /// @return balance Protocol proceeds balance
    function getProtocolProceeds(address token) external view returns (uint256) {
        return protocolProceeds[token];
    }

    /// @notice Get health factor for an account
    /// @param account Account address
    /// @param market Market address
    /// @return healthFactor Health factor (18 decimals)
    function getHealthFactor(
        address account,
        address market
    ) external view returns (uint256) {
        LiquidationCondition memory condition = monitorLiquidationCondition(account, market);
        return condition.healthFactor;
    }

    /// @notice Batch check liquidation conditions for multiple accounts
    /// @param accounts Array of account addresses
    /// @param market Market address
    /// @return conditions Array of liquidation conditions
    function batchMonitorConditions(
        address[] calldata accounts,
        address market
    ) external view returns (LiquidationCondition[] memory conditions) {
        conditions = new LiquidationCondition[](accounts.length);
        for (uint256 i = 0; i < accounts.length; i++) {
            conditions[i] = monitorLiquidationCondition(accounts[i], market);
        }
    }
}

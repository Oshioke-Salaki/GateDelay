// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title StrategyVault
 * @notice Build vault for strategy execution.
 */
contract StrategyVault is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable asset;
    
    uint256 public totalAssets;
    uint256 public totalProfits;
    uint256 public totalLosses;
    
    struct TradePerformance {
        uint256 tradeCount;
        uint256 totalProfit;
        uint256 totalLoss;
    }
    
    TradePerformance public performance;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event TradeExecuted(address indexed target, bool success, uint256 assetDifference);

    error ZeroAddress();
    error ZeroAmount();
    error InsufficientBalance();

    constructor(address _asset) Ownable(msg.sender) {
        if (_asset == address(0)) revert ZeroAddress();
        asset = IERC20(_asset);
    }

    /**
     * @notice Handle strategy deposits
     * @param amount Amount to process, in the relevant token units.
     * @dev Access: Caller permissions are checked against the sender or assigned roles.
     * @dev Reverts: `ZeroAmount` if `amount == 0` is true.
     */
    function deposit(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        
        asset.safeTransferFrom(msg.sender, address(this), amount);
        totalAssets += amount;
        
        emit Deposited(msg.sender, amount);
    }

    /**
     * @notice Handle strategy withdrawals
     * @param amount Amount to process, in the relevant token units.
     * @dev Access: Caller must be the contract owner.
     * @dev Reverts: `ZeroAmount` if `amount == 0` is true. `InsufficientBalance` if `totalAssets <
     *     amount` is true.
     */
    function withdraw(uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        if (totalAssets < amount) revert InsufficientBalance();
        
        totalAssets -= amount;
        asset.safeTransfer(msg.sender, amount);
        
        emit Withdrawn(msg.sender, amount);
    }

    /**
     * @notice Approve target for trading
     * @param target Address associated with target.
     * @param amount Amount to process, in the relevant token units.
     * @dev Access: Caller must be the contract owner.
     */
    function approveTarget(address target, uint256 amount) external onlyOwner {
        asset.forceApprove(target, amount);
    }

    /**
     * @notice Execute strategy trades and track strategy performance
     * @param target Address associated with target.
     * @param data Encoded data supplied to the operation.
     * @dev Access: Caller must be the contract owner.
     * @dev Reverts: `ZeroAddress` if `target == address(0)` is true.
     */
    function executeTrade(address target, bytes calldata data) external onlyOwner {
        if (target == address(0)) revert ZeroAddress();
        
        uint256 balanceBefore = asset.balanceOf(address(this));
        
        (bool success, ) = target.call(data);
        
        uint256 balanceAfter = asset.balanceOf(address(this));
        
        performance.tradeCount++;

        uint256 diff = 0;
        if (balanceAfter > balanceBefore) {
            uint256 profit = balanceAfter - balanceBefore;
            totalProfits += profit;
            totalAssets += profit;
            performance.totalProfit += profit;
            diff = profit;
        } else if (balanceBefore > balanceAfter) {
            uint256 loss = balanceBefore - balanceAfter;
            totalLosses += loss;
            totalAssets -= loss;
            performance.totalLoss += loss;
            diff = loss;
        }

        emit TradeExecuted(target, success, diff);
    }

    /**
     * @notice Provide vault queries
     * @return Performance returned by the operation.
     * @dev Access: No caller-specific access restriction is imposed.
     */
    function getPerformance() external view returns (TradePerformance memory) {
        return performance;
    }

    /// @notice Returns vault details.
    /// @return _totalAssets total assets produced by the operation.
    /// @return _totalProfits total profits produced by the operation.
    /// @return _totalLosses total losses produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getVaultDetails() external view returns (uint256 _totalAssets, uint256 _totalProfits, uint256 _totalLosses) {
        return (totalAssets, totalProfits, totalLosses);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MarketFactory.sol";

/// @dev Minimal ERC20 interface for collateral token interactions.
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title LiquidityPool
/// @notice Manages collateral deposits and LP token issuance for a single prediction market.
contract LiquidityPool {
    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error ZeroDepositAmount();
    error InsufficientLPBalance();
    error MarketFinalised();
    error NotResolution();
    error InsufficientPoolBalance();

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------
    struct PoolMetrics {
        uint256 totalLiquidity;
        uint256 totalLPSupply;
        uint256 utilisationBps;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event LiquidityChanged(
        address indexed provider,
        bool isDeposit,
        uint256 collateralAmount,
        uint256 lpAmount
    );

    // -------------------------------------------------------------------------
    // Immutable state
    // -------------------------------------------------------------------------
    IERC20 public immutable collateralToken;
    address public immutable market;

    // -------------------------------------------------------------------------
    // Mutable state
    // -------------------------------------------------------------------------
    MarketFactory.MarketStatus public marketStatus;

    uint256 public totalLiquidity;
    uint256 public totalFeesCollected;

    /// @dev Address of the Resolution contract authorised to withdraw for payouts
    address public resolution;

    // Embedded LP token storage
    mapping(address => uint256) private _lpBalances;
    uint256 private _totalLPSupply;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(address _collateralToken, address _market) {
        collateralToken = IERC20(_collateralToken);
        market = _market;
        marketStatus = MarketFactory.MarketStatus.OPEN;
    }

    // -------------------------------------------------------------------------
    // External functions
    // -------------------------------------------------------------------------

    /// @notice Deposit collateral into the pool and receive LP tokens.
    /// @param amount Amount of collateral to deposit (must be > 0).
    function deposit(uint256 amount) external {
        if (amount == 0) revert ZeroDepositAmount();
        if (
            marketStatus == MarketFactory.MarketStatus.RESOLVED ||
            marketStatus == MarketFactory.MarketStatus.CANCELLED
        ) revert MarketFinalised();

        // Transfer collateral from caller (requires prior approval)
        collateralToken.transferFrom(msg.sender, address(this), amount);

        // Calculate LP tokens to mint
        uint256 lpMinted;
        if (totalLiquidity == 0) {
            // First deposit: 1:1 ratio
            lpMinted = amount;
        } else {
            // Subsequent deposits: proportional
            lpMinted = (amount * _totalLPSupply) / totalLiquidity;
        }

        // Mint LP tokens
        _lpBalances[msg.sender] += lpMinted;
        _totalLPSupply += lpMinted;

        // Update total liquidity
        totalLiquidity += amount;

        emit LiquidityChanged(msg.sender, true, amount, lpMinted);
    }

    /// @notice Withdraw collateral by burning LP tokens.
    /// @param lpAmount Amount of LP tokens to burn.
    function withdraw(uint256 lpAmount) external {
        if (_lpBalances[msg.sender] < lpAmount) revert InsufficientLPBalance();

        // Calculate proportional collateral to return
        uint256 collateralOut = (lpAmount * totalLiquidity) / _totalLPSupply;

        // Burn LP tokens
        _lpBalances[msg.sender] -= lpAmount;
        _totalLPSupply -= lpAmount;

        // Update total liquidity
        totalLiquidity -= collateralOut;

        // Transfer collateral to caller
        collateralToken.transfer(msg.sender, collateralOut);

        emit LiquidityChanged(msg.sender, false, collateralOut, lpAmount);
    }

    /// @notice Returns current pool metrics.
    function getPoolMetrics() external view returns (PoolMetrics memory) {
        // amountInUse = 0 (no trading logic yet)
        uint256 utilisationBps = 0;
        if (totalLiquidity > 0) {
            uint256 amountInUse = 0;
            utilisationBps = (amountInUse * 10000) / totalLiquidity;
        }
        return PoolMetrics({
            totalLiquidity: totalLiquidity,
            totalLPSupply: _totalLPSupply,
            utilisationBps: utilisationBps
        });
    }

    /// @notice Returns the LP token balance of an account.
    function lpBalanceOf(address account) external view returns (uint256) {
        return _lpBalances[account];
    }

    /// @notice Update the market status (will be restricted by Resolution contract later).
    function setMarketStatus(MarketFactory.MarketStatus status) external {
        marketStatus = status;
    }

    /// @notice Set the Resolution contract address authorised to withdraw collateral for payouts.
    function setResolution(address _resolution) external {
        resolution = _resolution;
    }

    /// @notice Withdraw collateral to a recipient for payout/refund. Only callable by the Resolution contract.
    function withdrawForResolution(address to, uint256 amount) external {
        if (msg.sender != resolution) revert NotResolution();
        if (amount > totalLiquidity) revert InsufficientPoolBalance();
        totalLiquidity -= amount;
        collateralToken.transfer(to, amount);
    }
}

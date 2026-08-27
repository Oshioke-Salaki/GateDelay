// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title CollateralVault
/// @notice Manages collateral deposits, withdrawals, and liquidations for prediction markets.
contract CollateralVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Errors ─────────────────────────────────────────────────────────────────
    error ZeroAmount();
    error ZeroAddress();
    error InsufficientBalance();
    error NotAuthorized();
    error MarketAlreadyRegistered();
    error MarketNotRegistered();
    error VaultPaused();

    // ── Events ─────────────────────────────────────────────────────────────────
    event Deposited(address indexed market, address indexed depositor, address indexed token, uint256 amount);
    event Withdrawn(address indexed market, address indexed recipient, address indexed token, uint256 amount);
    event Liquidated(address indexed market, address indexed liquidator, address indexed token, uint256 amount);
    event LiquidatorSet(address indexed liquidator, bool approved);
    event MarketRegistered(address indexed market, address indexed collateralToken);
    event PauseToggled(bool paused);

    // ── State ──────────────────────────────────────────────────────────────────

    /// @notice Collateral token for each registered market
    mapping(address => address) public marketCollateralToken;

    /// @notice Total collateral balance per market
    mapping(address => uint256) public marketBalance;

    /// @notice Per-user collateral balance per market
    mapping(address => mapping(address => uint256)) public userBalance;

    /// @notice Approved liquidator addresses
    mapping(address => bool) public isLiquidator;

    /// @notice Whether the vault is paused
    bool public paused;

    // ── Modifiers ──────────────────────────────────────────────────────────────

    modifier whenNotPaused() {
        if (paused) revert VaultPaused();
        _;
    }

    modifier onlyLiquidator() {
        if (!isLiquidator[msg.sender]) revert NotAuthorized();
        _;
    }

    modifier onlyRegistered(address market) {
        if (marketCollateralToken[market] == address(0)) revert MarketNotRegistered();
        _;
    }

    // ── Constructor ────────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ── Admin ──────────────────────────────────────────────────────────────────

    /// @notice Register a market with its collateral token.
    function registerMarket(address market, address collateralToken) external onlyOwner {
        if (market == address(0) || collateralToken == address(0)) revert ZeroAddress();
        if (marketCollateralToken[market] != address(0)) revert MarketAlreadyRegistered();
        marketCollateralToken[market] = collateralToken;
        emit MarketRegistered(market, collateralToken);
    }

    /// @notice Approve or revoke a liquidator.
    function setLiquidator(address liquidator, bool approved) external onlyOwner {
        if (liquidator == address(0)) revert ZeroAddress();
        isLiquidator[liquidator] = approved;
        emit LiquidatorSet(liquidator, approved);
    }

    /// @notice Pause or unpause the vault.
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit PauseToggled(_paused);
    }

    // ── Core functions ─────────────────────────────────────────────────────────

    /// @notice Deposit collateral for a market.
    /// @param market  The registered market address.
    /// @param amount  Amount of collateral to deposit.
    function deposit(address market, uint256 amount)
        external
        nonReentrant
        whenNotPaused
        onlyRegistered(market)
    {
        if (amount == 0) revert ZeroAmount();

        address token = marketCollateralToken[market];
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        userBalance[market][msg.sender] += amount;
        marketBalance[market] += amount;

        emit Deposited(market, msg.sender, token, amount);
    }

    /// @notice Withdraw collateral from a market.
    /// @param market  The registered market address.
    /// @param amount  Amount of collateral to withdraw.
    function withdraw(address market, uint256 amount)
        external
        nonReentrant
        whenNotPaused
        onlyRegistered(market)
    {
        if (amount == 0) revert ZeroAmount();
        if (userBalance[market][msg.sender] < amount) revert InsufficientBalance();

        userBalance[market][msg.sender] -= amount;
        marketBalance[market] -= amount;

        address token = marketCollateralToken[market];
        IERC20(token).safeTransfer(msg.sender, amount);

        emit Withdrawn(market, msg.sender, token, amount);
    }

    /// @notice Liquidate collateral from a market position. Only callable by approved liquidators.
    /// @param market     The registered market address.
    /// @param account    The account being liquidated.
    /// @param amount     Amount of collateral to seize.
    /// @param recipient  Address that receives the seized collateral.
    function liquidate(address market, address account, uint256 amount, address recipient)
        external
        nonReentrant
        onlyLiquidator
        onlyRegistered(market)
    {
        if (amount == 0) revert ZeroAmount();
        if (recipient == address(0)) revert ZeroAddress();
        if (userBalance[market][account] < amount) revert InsufficientBalance();

        userBalance[market][account] -= amount;
        marketBalance[market] -= amount;

        address token = marketCollateralToken[market];
        IERC20(token).safeTransfer(recipient, amount);

        emit Liquidated(market, msg.sender, token, amount);
    }

    // ── Queries ────────────────────────────────────────────────────────────────

    /// @notice Returns the collateral balance of a user in a market.
    function getBalance(address market, address user) external view returns (uint256) {
        return userBalance[market][user];
    }

    /// @notice Returns the total collateral held for a market.
    function getMarketBalance(address market) external view returns (uint256) {
        return marketBalance[market];
    }

    /// @notice Returns the collateral token for a market.
    function getCollateralToken(address market) external view returns (address) {
        return marketCollateralToken[market];
    }
}

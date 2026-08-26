// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20}          from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20}       from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable}         from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable}        from "@openzeppelin/contracts/utils/Pausable.sol";
import {Math}            from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title DepositLogic
/// @notice Handles asset deposits, tracks deposit amounts, calculates deposit shares,
///         supports multiple assets, and provides deposit queries for vaults.
/// @dev Designed to be used as a standalone deposit module or inherited by vault contracts.
///      Uses OpenZeppelin for safe token handling, access control, reentrancy protection,
///      and pausability.
contract DepositLogic is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using Math      for uint256;

    // ─────────────────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Record of a single deposit event.
    struct DepositRecord {
        address token;       // The asset deposited
        uint256 assets;      // Underlying token amount deposited
        uint256 shares;      // Vault shares minted
        uint256 timestamp;   // Block timestamp of deposit
    }

    /// @notice Summary of a user's position in a particular asset.
    struct AssetPosition {
        uint256 totalDeposited;  // Lifetime deposits of this asset
        uint256 totalWithdrawn;  // Lifetime withdrawals of this asset
        uint256 shares;          // Current shares held for this asset
    }

    /// @notice Configuration for a supported asset.
    struct AssetConfig {
        bool    isActive;       // Whether deposits are currently allowed
        uint256 depositCap;     // Maximum total deposits allowed (0 = uncapped)
        uint256 minimumDeposit; // Minimum deposit amount (0 = no minimum)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────────

    uint256 private constant PRECISION = 1e18;

    /// @dev Minimum shares to keep alive to prevent share-price manipulation on first deposit.
    uint256 private constant MINIMUM_SHARES = 1_000;

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Total value locked across all assets (in PRECISION-scaled notional).
    uint256 public totalValueLocked;

    /// @notice Total shares issued across all assets.
    uint256 public totalShares;

    /// @notice Mapping from asset address to its configuration.
    mapping(address => AssetConfig) public assetConfigs;

    /// @notice Supported asset list (for enumeration).
    address[] public supportedAssets;

    /// @notice Per-asset, per-user deposit tracking.
    mapping(address => mapping(address => AssetPosition)) private _assetPositions;

    /// @notice Per-user deposit history across all assets.
    mapping(address => DepositRecord[]) private _depositHistory;

    /// @notice Per-asset total deposits tracked.
    mapping(address => uint256) public assetTotalDeposited;

    /// @notice Per-asset total shares issued.
    mapping(address => uint256) public assetTotalShares;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event AssetDeposited(
        address indexed depositor,
        address indexed token,
        uint256 assets,
        uint256 shares
    );

    event AssetWithdrawn(
        address indexed withdrawer,
        address indexed token,
        uint256 assets,
        uint256 shares
    );

    event AssetAdded(address indexed token, uint256 depositCap, uint256 minimumDeposit);
    event AssetRemoved(address indexed token);
    event AssetConfigUpdated(address indexed token, uint256 depositCap, uint256 minimumDeposit);
    event DepositCapUpdated(address indexed token, uint256 newCap);
    event MinimumDepositUpdated(address indexed token, uint256 newMinimum);

    // ─────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────

    error ZeroAssets();
    error ZeroShares();
    error ZeroAddress();
    error AssetNotSupported(address token);
    error AssetAlreadySupported(address token);
    error DepositCapExceeded(address token, uint256 cap, uint256 attempted);
    error DepositTooSmall(address token, uint256 minimum, uint256 attempted);
    error InsufficientShares(address account, uint256 requested, uint256 available);
    error InsufficientBalance();
    error InvalidRecipient();

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ─────────────────────────────────────────────────────────────────────────
    // Asset Management (Owner)
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Add a new supported asset for deposits.
    /// @param token          The ERC-20 token address.
    /// @param depositCap     Maximum total deposits allowed (0 = uncapped).
    /// @param minimumDeposit Minimum deposit amount (0 = no minimum).
    function addAsset(address token, uint256 depositCap, uint256 minimumDeposit)
        external
        onlyOwner
    {
        if (token == address(0)) revert ZeroAddress();
        if (assetConfigs[token].isActive) revert AssetAlreadySupported(token);

        assetConfigs[token] = AssetConfig({
            isActive:       true,
            depositCap:     depositCap,
            minimumDeposit: minimumDeposit
        });
        supportedAssets.push(token);

        emit AssetAdded(token, depositCap, minimumDeposit);
    }

    /// @notice Remove a supported asset. Reverts if there are active deposits.
    /// @param token The ERC-20 token address to remove.
    function removeAsset(address token) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        if (!assetConfigs[token].isActive) revert AssetNotSupported(token);
        if (assetTotalDeposited[token] > 0) revert InsufficientBalance();

        assetConfigs[token].isActive = false;

        // Remove from supported assets array
        uint256 length = supportedAssets.length;
        for (uint256 i; i < length; ++i) {
            if (supportedAssets[i] == token) {
                supportedAssets[i] = supportedAssets[length - 1];
                supportedAssets.pop();
                break;
            }
        }

        emit AssetRemoved(token);
    }

    /// @notice Update the deposit cap for an asset.
    function setDepositCap(address token, uint256 newCap) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        if (!assetConfigs[token].isActive) revert AssetNotSupported(token);
        assetConfigs[token].depositCap = newCap;
        emit DepositCapUpdated(token, newCap);
    }

    /// @notice Update the minimum deposit for an asset.
    function setMinimumDeposit(address token, uint256 newMinimum) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        if (!assetConfigs[token].isActive) revert AssetNotSupported(token);
        assetConfigs[token].minimumDeposit = newMinimum;
        emit MinimumDepositUpdated(token, newMinimum);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Deposit Logic
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Deposit `assets` amount of `token` and receive vault shares.
    /// @param token   The ERC-20 token to deposit.
    /// @param assets  Amount of underlying token to deposit.
    /// @param receiver Address that will receive the shares credit.
    /// @return shares Number of shares minted for the deposit.
    function deposit(address token, uint256 assets, address receiver)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 shares)
    {
        if (token == address(0)) revert ZeroAddress();
        if (assets == 0) revert ZeroAssets();
        if (receiver == address(0)) revert InvalidRecipient();

        AssetConfig storage config = assetConfigs[token];
        if (!config.isActive) revert AssetNotSupported(token);

        // Check minimum deposit
        if (assets < config.minimumDeposit) {
            revert DepositTooSmall(token, config.minimumDeposit, assets);
        }

        // Calculate shares
        shares = _convertToShares(token, assets);
        if (shares == 0) revert ZeroShares();

        // Check deposit cap
        uint256 newAssetTotal = assetTotalDeposited[token] + assets;
        if (config.depositCap > 0 && newAssetTotal > config.depositCap) {
            revert DepositCapExceeded(token, config.depositCap, newAssetTotal);
        }

        // Transfer tokens from depositor
        IERC20(token).safeTransferFrom(msg.sender, address(this), assets);

        // Update accounting
        _updateDepositAccounting(token, receiver, assets, shares);

        emit AssetDeposited(receiver, token, assets, shares);

        return shares;
    }

    /// @notice Withdraw `shares` worth of `token` from the vault.
    /// @param token   The ERC-20 token to withdraw.
    /// @param shares  Number of shares to redeem.
    /// @param receiver Address that will receive the underlying tokens.
    /// @return assets Amount of underlying tokens returned.
    function withdraw(address token, uint256 shares, address receiver)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 assets)
    {
        if (token == address(0)) revert ZeroAddress();
        if (shares == 0) revert ZeroShares();
        if (receiver == address(0)) revert InvalidRecipient();

        if (!assetConfigs[token].isActive) revert AssetNotSupported(token);

        AssetPosition storage position = _assetPositions[token][msg.sender];
        if (position.shares < shares) {
            revert InsufficientShares(msg.sender, shares, position.shares);
        }

        // Calculate assets to return
        assets = _convertToAssets(token, shares);
        if (assets == 0) revert ZeroAssets();

        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance < assets) revert InsufficientBalance();

        // Update accounting
        position.shares -= shares;
        position.totalWithdrawn += assets;
        assetTotalDeposited[token] -= assets;
        assetTotalShares[token] -= shares;
        totalValueLocked -= assets;
        totalShares -= shares;

        // Transfer tokens to receiver
        IERC20(token).safeTransfer(receiver, assets);

        emit AssetWithdrawn(receiver, token, assets, shares);

        return assets;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal Accounting
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev Update all accounting state after a deposit.
    function _updateDepositAccounting(
        address token,
        address receiver,
        uint256 assets,
        uint256 shares
    ) internal {
        AssetPosition storage position = _assetPositions[token][receiver];

        position.totalDeposited += assets;
        position.shares += shares;

        assetTotalDeposited[token] += assets;
        assetTotalShares[token] += shares;
        totalValueLocked += assets;
        totalShares += shares;

        _depositHistory[receiver].push(DepositRecord({
            token:     token,
            assets:    assets,
            shares:    shares,
            timestamp: block.timestamp
        }));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Share Conversion
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Convert an asset amount to shares for a given token.
    /// @dev Uses the asset's own deposit pool ratio. For first deposit, 1:1 minus minimum shares.
    function _convertToShares(address token, uint256 assets) internal view returns (uint256) {
        uint256 assetSupply = assetTotalShares[token];
        uint256 assetTVL   = assetTotalDeposited[token];

        if (assetSupply == 0 || assetTVL == 0) {
            // First deposit: 1:1 minus minimum shares to seed the vault
            return assets > MINIMUM_SHARES ? assets - MINIMUM_SHARES : assets;
        }
        return assets.mulDiv(assetSupply, assetTVL);
    }

    /// @notice Convert shares back to asset amount for a given token.
    function _convertToAssets(address token, uint256 shares) internal view returns (uint256) {
        uint256 assetSupply = assetTotalShares[token];
        if (assetSupply == 0) return 0;
        return shares.mulDiv(assetTotalDeposited[token], assetSupply);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Queries
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Get the number of supported assets.
    function supportedAssetsCount() external view returns (uint256) {
        return supportedAssets.length;
    }

    /// @notice Check if an asset is supported.
    function isAssetSupported(address token) external view returns (bool) {
        return assetConfigs[token].isActive;
    }

    /// @notice Get the full asset configuration for a token.
    function getAssetConfig(address token) external view returns (AssetConfig memory) {
        return assetConfigs[token];
    }

    /// @notice Get the deposit position of a user for a specific asset.
    function getAssetPosition(address token, address user)
        external
        view
        returns (AssetPosition memory)
    {
        return _assetPositions[token][user];
    }

    /// @notice Get the full deposit history for a user.
    function getDepositHistory(address user)
        external
        view
        returns (DepositRecord[] memory)
    {
        return _depositHistory[user];
    }

    /// @notice Get the number of deposits made by a user.
    function depositCount(address user) external view returns (uint256) {
        return _depositHistory[user].length;
    }

    /// @notice Preview how many shares `assets` would currently mint for a given token.
    function previewDeposit(address token, uint256 assets) external view returns (uint256) {
        return _convertToShares(token, assets);
    }

    /// @notice Preview how many assets `shares` would currently redeem for a given token.
    function previewRedeem(address token, uint256 shares) external view returns (uint256) {
        return _convertToAssets(token, shares);
    }

    /// @notice Get the price per share for a given token (PRECISION-scaled).
    function pricePerShare(address token) external view returns (uint256) {
        uint256 supply = assetTotalShares[token];
        if (supply == 0) return PRECISION;
        return assetTotalDeposited[token].mulDiv(PRECISION, supply);
    }

    /// @notice Get the total value locked for a specific asset.
    function assetTVL(address token) external view returns (uint256) {
        return assetTotalDeposited[token];
    }

    /// @notice Get all supported asset addresses.
    function getSupportedAssets() external view returns (address[] memory) {
        return supportedAssets;
    }

    /// @notice Get summary statistics for a user across all assets.
    function getUserSummary(address user)
        external
        view
        returns (
            uint256 totalDeposits,
            uint256 totalWithdrawals,
            uint256 positionCount
        )
    {
        DepositRecord[] memory history = _depositHistory[user];
        for (uint256 i; i < history.length; ++i) {
            totalDeposits += history[i].assets;
        }
        totalWithdrawals = 0; // withdrawals tracked per-asset position
        positionCount = history.length;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Pause all deposit/withdraw operations.
    function pause() external onlyOwner { _pause(); }

    /// @notice Unpause all deposit/withdraw operations.
    function unpause() external onlyOwner { _unpause(); }

    /// @notice Recover accidentally sent tokens (non-managed).
    function recoverToken(address token, uint256 amount, address to) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        if (to == address(0))    revert ZeroAddress();
        if (amount == 0)         revert ZeroAssets();
        IERC20(token).safeTransfer(to, amount);
    }
}
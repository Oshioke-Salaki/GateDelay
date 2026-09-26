// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20}          from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20}       from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC20}           from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable}         from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable}        from "@openzeppelin/contracts/utils/Pausable.sol";
import {Math}            from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title MarketVault
/// @notice ERC-4626-inspired vault that manages deposits, tracks assets,
///         handles withdrawals, and exposes performance metrics for a single
///         underlying ERC-20 token.
/// @dev Shares represent proportional ownership of vault assets.
///      Performance is measured via a high-water mark and time-weighted APR.
contract MarketVault is ERC20, Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using Math      for uint256;

    // ─────────────────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────────────────

    struct DepositRecord {
        uint256 assets;      // underlying tokens deposited
        uint256 shares;      // vault shares minted
        uint256 timestamp;
    }

    struct WithdrawalRecord {
        uint256 assets;      // underlying tokens withdrawn
        uint256 shares;      // vault shares burned
        uint256 timestamp;
    }

    struct PerformanceSnapshot {
        uint256 totalAssets;  // total vault assets at snapshot time
        uint256 pricePerShare; // assets per share scaled by PRECISION
        uint256 timestamp;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────────

    uint256 private constant PRECISION          = 1e18;
    uint256 private constant SECONDS_PER_YEAR   = 365 days;
    /// @dev Minimum shares kept alive to prevent share-price manipulation on first deposit.
    uint256 private constant MINIMUM_SHARES     = 1_000;

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice The token held by this vault.
    IERC20  public immutable asset;

    // ── Asset tracking ────────────────────────────────────────────────────────
    uint256 public totalDeposited;    // lifetime gross deposits (underlying)
    uint256 public totalWithdrawn;    // lifetime gross withdrawals (underlying)
    uint256 public totalYieldAdded;   // yield injected by owner (underlying)

    // ── Performance ───────────────────────────────────────────────────────────
    uint256 public highWaterMark;     // highest recorded pricePerShare (PRECISION-scaled)
    uint256 public vaultCreatedAt;    // timestamp used for APR window
    PerformanceSnapshot public lastSnapshot;

    // ── Per-user history ──────────────────────────────────────────────────────
    mapping(address => DepositRecord[])    private _depositHistory;
    mapping(address => WithdrawalRecord[]) private _withdrawalHistory;
    mapping(address => uint256)            public  userTotalDeposited;
    mapping(address => uint256)            public  userTotalWithdrawn;

    // ── Withdrawal queue (optional time-lock) ─────────────────────────────────
    uint256 public withdrawalDelay;   // seconds; 0 = instant
    struct PendingWithdrawal {
        uint256 shares;
        uint256 unlocksAt;
    }
    mapping(address => PendingWithdrawal) public pendingWithdrawals;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event Deposit(address indexed depositor, uint256 assets, uint256 shares);
    event WithdrawalQueued(address indexed withdrawer, uint256 shares, uint256 unlocksAt);
    event Withdrawal(address indexed withdrawer, uint256 assets, uint256 shares);
    event YieldAdded(uint256 amount, uint256 newTotalAssets);
    event HighWaterMarkUpdated(uint256 oldMark, uint256 newMark);
    event SnapshotTaken(uint256 totalAssets, uint256 pricePerShare, uint256 timestamp);
    event WithdrawalDelaySet(uint256 delay);
    event VaultPaused();
    event VaultUnpaused();

    // ─────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────

    error ZeroAddress();
    error EmptyShareMetadata();
    error ZeroAssets();
    error ZeroShares();
    error InsufficientShares();
    error WithdrawalLocked(uint256 unlocksAt);
    error NoPendingWithdrawal();
    error ExceedsMaxWithdraw(uint256 maxAssets);
    error InvalidDelay();

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    /// @param _asset           The ERC-20 token this vault manages.
    /// @param _name            Vault share token name.
    /// @param _symbol          Vault share token symbol.
    /// @param _withdrawalDelay Seconds before a queued withdrawal can be executed (0 = instant).
    constructor(
        address _asset,
        string  memory _name,
        string  memory _symbol,
        uint256 _withdrawalDelay
    )
        ERC20(_name, _symbol)
        Ownable(msg.sender)
    {
        if (_asset == address(0)) revert ZeroAddress();
        if (bytes(_name).length == 0 || bytes(_symbol).length == 0) revert EmptyShareMetadata();
        asset            = IERC20(_asset);
        withdrawalDelay  = _withdrawalDelay;
        vaultCreatedAt   = block.timestamp;
        highWaterMark    = PRECISION; // 1.0 — fresh vault starts at par
        _takeSnapshot();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Deposit
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Deposit `assets` tokens and receive vault shares.
    /// @param assets   Amount of underlying token to deposit.
    /// @param receiver Address that will receive the minted shares.
    /// @return shares  Number of shares minted.
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    /// @dev Reverts: `ZeroAssets` if `assets == 0` is true. `ZeroShares` if `shares == 0` is true.
    function deposit(uint256 assets, address receiver)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 shares)
    {
        if (assets == 0) revert ZeroAssets();

        shares = _convertToShares(assets);
        if (shares == 0) revert ZeroShares();

        // Pull tokens first (CEI)
        asset.safeTransferFrom(msg.sender, address(this), assets);

        // Mint shares
        _mint(receiver, shares);

        // Accounting
        totalDeposited             += assets;
        userTotalDeposited[receiver] += assets;
        _depositHistory[receiver].push(
            DepositRecord({assets: assets, shares: shares, timestamp: block.timestamp})
        );

        _updateHighWaterMark();
        emit Deposit(receiver, assets, shares);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Withdrawal (two-phase if delay > 0)
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Initiate a withdrawal. If `withdrawalDelay == 0` it executes
    ///         immediately; otherwise it queues the request for `withdrawalDelay`
    ///         seconds.
    /// @param shares  Number of vault shares to redeem.
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    /// @dev Reverts: `ZeroShares` if `shares == 0` is true. `InsufficientShares` if
    ///     `balanceOf(msg.sender) < shares` is true.
    function requestWithdrawal(uint256 shares) external nonReentrant whenNotPaused {
        if (shares == 0) revert ZeroShares();
        if (balanceOf(msg.sender) < shares) revert InsufficientShares();

        if (withdrawalDelay == 0) {
            _executeWithdrawal(msg.sender, shares);
        } else {
            // Lock the shares immediately so they can't be transferred/double-spent
            _transfer(msg.sender, address(this), shares);
            uint256 unlocksAt = block.timestamp + withdrawalDelay;
            pendingWithdrawals[msg.sender] = PendingWithdrawal({
                shares:    shares,
                unlocksAt: unlocksAt
            });
            emit WithdrawalQueued(msg.sender, shares, unlocksAt);
        }
    }

    /// @notice Execute a previously queued withdrawal after the delay has elapsed.
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    /// @dev Reverts: `NoPendingWithdrawal` if `pw.shares == 0` is true. `WithdrawalLocked` if
    ///     `block.timestamp < pw.unlocksAt` is true.
    function executeWithdrawal() external nonReentrant whenNotPaused {
        PendingWithdrawal memory pw = pendingWithdrawals[msg.sender];
        if (pw.shares == 0) revert NoPendingWithdrawal();
        if (block.timestamp < pw.unlocksAt) revert WithdrawalLocked(pw.unlocksAt);

        delete pendingWithdrawals[msg.sender];

        // Burn the escrowed shares held by the vault contract
        _burn(address(this), pw.shares);
        uint256 assets = _convertToAssets(pw.shares);
        _sendAssets(msg.sender, assets, pw.shares);
    }

    /// @notice Preview how many assets `shares` would currently redeem for.
    /// @param shares Numeric shares used by this operation.
    /// @return Redeem returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function previewRedeem(uint256 shares) external view returns (uint256) {
        return _convertToAssets(shares);
    }

    /// @notice Preview how many shares `assets` would currently mint.
    /// @param assets Numeric assets used by this operation.
    /// @return Deposit returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function previewDeposit(uint256 assets) external view returns (uint256) {
        return _convertToShares(assets);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Yield injection (owner — simulates strategy returns)
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Owner injects `amount` of yield (e.g. from a strategy) into the vault.
    ///         This increases `totalAssets()` without minting new shares, thus
    ///         raising the share price.
    /// @param amount Amount to process, in the relevant token units.
    /// @dev Access: Caller must be the contract owner.
    /// @dev Reverts: `ZeroAssets` if `amount == 0` is true.
    function addYield(uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAssets();
        asset.safeTransferFrom(msg.sender, address(this), amount);
        totalYieldAdded += amount;
        _updateHighWaterMark();
        _takeSnapshot();
        emit YieldAdded(amount, totalAssets());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Executes setWithdrawalDelay.
    /// @param delay Numeric delay used by this operation.
    /// @dev Access: Caller must be the contract owner.
    /// @dev Reverts: `InvalidDelay` if `delay > 30 days` is true.
    function setWithdrawalDelay(uint256 delay) external onlyOwner {
        if (delay > 30 days) revert InvalidDelay();
        withdrawalDelay = delay;
        emit WithdrawalDelaySet(delay);
    }

    /// @notice Pauses.
    /// @dev Access: Caller must be the contract owner.
    function pause()   external onlyOwner { _pause();   emit VaultPaused(); }
    /// @notice Resumes.
    /// @dev Access: Caller must be the contract owner.
    function unpause() external onlyOwner { _unpause(); emit VaultUnpaused(); }

    /// @notice Take a manual performance snapshot.
    /// @dev Access: Caller must be the contract owner.
    function snapshot() external onlyOwner { _takeSnapshot(); }

    // ─────────────────────────────────────────────────────────────────────────
    // Asset tracking queries
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Total underlying tokens currently held by the vault.
    /// @return Value produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function totalAssets() public view returns (uint256) {
        return asset.balanceOf(address(this));
    }

    /// @notice Net assets (totalAssets adjusted for escrowed withdrawal shares).
    /// @return Value produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function netAssets() public view returns (uint256) {
        uint256 escrowedShares = balanceOf(address(this));
        uint256 escrowedAssets = escrowedShares > 0 ? _convertToAssets(escrowedShares) : 0;
        uint256 ta = totalAssets();
        return ta > escrowedAssets ? ta - escrowedAssets : 0;
    }

    /// @notice Price of one vault share in underlying tokens (PRECISION-scaled).
    /// @return Value produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function pricePerShare() public view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return PRECISION;
        return totalAssets().mulDiv(PRECISION, supply);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Performance queries
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Total return since inception as a fraction of initial deposit
    ///         (PRECISION-scaled). E.g. 1.05e18 = 5% gain.
    /// @return Value produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function totalReturn() external view returns (uint256) {
        return pricePerShare(); // starts at PRECISION (1.0)
    }

    /// @notice Gain above the high-water mark (PRECISION-scaled).
    ///         Zero if current price ≤ high-water mark.
    /// @return Value produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function gainAboveHighWaterMark() external view returns (uint256) {
        uint256 pps = pricePerShare();
        return pps > highWaterMark ? pps - highWaterMark : 0;
    }

    /// @notice Annualised return since vault creation (PRECISION-scaled).
    ///         Uses simple (non-compound) annualisation.
    /// @return Value produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function annualisedReturn() external view returns (uint256) {
        uint256 elapsed = block.timestamp - vaultCreatedAt;
        if (elapsed == 0) return 0;
        uint256 pps = pricePerShare();
        if (pps <= PRECISION) return 0;
        // APR = (pps - PRECISION) / PRECISION * (SECONDS_PER_YEAR / elapsed)
        return (pps - PRECISION).mulDiv(SECONDS_PER_YEAR, elapsed);
    }

    /// @notice Absolute profit for a specific user based on their average cost.
    /// @dev    Simple estimation: current value of remaining shares minus net deposited.
    /// @param user User address affected by this operation.
    /// @return Value produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function userProfit(address user) external view returns (int256) {
        uint256 remainingShares = balanceOf(user);
        uint256 currentValue    = _convertToAssets(remainingShares);
        uint256 netDeposited    = userTotalDeposited[user] > userTotalWithdrawn[user]
            ? userTotalDeposited[user] - userTotalWithdrawn[user]
            : 0;
        return int256(currentValue) - int256(netDeposited);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // User history queries
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Returns deposit history.
    /// @param user User address affected by this operation.
    /// @return Deposit history returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getDepositHistory(address user)
        external
        view
        returns (DepositRecord[] memory)
    {
        return _depositHistory[user];
    }

    /// @notice Returns withdrawal history.
    /// @param user User address affected by this operation.
    /// @return Withdrawal history returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getWithdrawalHistory(address user)
        external
        view
        returns (WithdrawalRecord[] memory)
    {
        return _withdrawalHistory[user];
    }

    /// @notice Executes depositCount.
    /// @param user User address affected by this operation.
    /// @return Value produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function depositCount(address user)  external view returns (uint256) { return _depositHistory[user].length;    }
    /// @notice Executes withdrawalCount.
    /// @param user User address affected by this operation.
    /// @return Value produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function withdrawalCount(address user) external view returns (uint256) { return _withdrawalHistory[user].length; }

    /// @notice Max assets the user could withdraw right now.
    /// @param user User address affected by this operation.
    /// @return Value produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function maxWithdraw(address user) external view returns (uint256) {
        return _convertToAssets(balanceOf(user));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────────────────

    function _convertToShares(uint256 assets) internal view returns (uint256) {
        uint256 supply = totalSupply();
        uint256 ta     = totalAssets();
        if (supply == 0 || ta == 0) {
            // First deposit: 1:1 minus minimum shares to seed the vault
            return assets > MINIMUM_SHARES ? assets - MINIMUM_SHARES : assets;
        }
        return assets.mulDiv(supply, ta);
    }

    function _convertToAssets(uint256 shares) internal view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return 0;
        return shares.mulDiv(totalAssets(), supply);
    }

    function _executeWithdrawal(address withdrawer, uint256 shares) internal {
        _burn(withdrawer, shares);
        uint256 assets = _convertToAssets(shares);
        _sendAssets(withdrawer, assets, shares);
    }

    function _sendAssets(address to, uint256 assets, uint256 shares) internal {
        totalWithdrawn             += assets;
        userTotalWithdrawn[to]     += assets;
        _withdrawalHistory[to].push(
            WithdrawalRecord({assets: assets, shares: shares, timestamp: block.timestamp})
        );
        asset.safeTransfer(to, assets);
        emit Withdrawal(to, assets, shares);
    }

    function _updateHighWaterMark() internal {
        uint256 pps = pricePerShare();
        if (pps > highWaterMark) {
            emit HighWaterMarkUpdated(highWaterMark, pps);
            highWaterMark = pps;
        }
    }

    function _takeSnapshot() internal {
        uint256 pps = pricePerShare();
        lastSnapshot = PerformanceSnapshot({
            totalAssets:   totalAssets(),
            pricePerShare: pps,
            timestamp:     block.timestamp
        });
        emit SnapshotTaken(totalAssets(), pps, block.timestamp);
    }
}

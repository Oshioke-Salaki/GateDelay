// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20}           from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit}     from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes}      from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {ERC20Burnable}   from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {Ownable}         from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable}        from "@openzeppelin/contracts/utils/Pausable.sol";
import {Math}            from "@openzeppelin/contracts/utils/math/Math.sol";
import {IERC20}          from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20}       from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title VaultShares
/// @notice ERC-20 vault share token that represents proportional ownership of an
///         underlying asset pool. Supports minting/burning by a designated vault,
///         on-chain value calculation, transfer controls, ERC-2612 permit, and
///         ERC-20Votes governance weight.
/// @dev Ownership of this contract belongs to the vault address (set at construction).
///      The vault is the only address that may mint or burn shares.
contract VaultShares is
    ERC20,
    ERC20Burnable,
    ERC20Permit,
    ERC20Votes,
    Ownable,
    ReentrancyGuard,
    Pausable
{
    using Math      for uint256;
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Snapshot of a holder's balance at a particular block (for off-chain
    ///         queries and historical auditing — separate from ERC20Votes checkpoints).
    struct BalanceSnapshot {
        uint256 shares;
        uint256 blockNumber;
        uint256 timestamp;
    }

    /// @notice Transfer record stored per sender.
    struct TransferRecord {
        address from;
        address to;
        uint256 amount;
        uint256 timestamp;
    }

    /// @notice Issuance record written on every mint.
    struct IssuanceRecord {
        address recipient;
        uint256 shares;
        uint256 assetsDeposited; // underlying tokens that backs these shares
        uint256 timestamp;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────────

    uint256 private constant PRECISION = 1e18;

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice The ERC-20 token that backs vault shares (e.g. USDC, WETH).
    IERC20  public immutable underlyingAsset;

    /// @notice Address of the vault contract allowed to mint / burn shares.
    address public vault;

    // ── Supply tracking ──────────────────────────────────────────────────────
    uint256 public totalSharesIssued;   // lifetime cumulative minted (never decremented)
    uint256 public totalSharesBurned;   // lifetime cumulative burned

    // ── Asset / value tracking ───────────────────────────────────────────────
    /// @notice Total underlying tokens managed by the vault (updated by vault only).
    uint256 public totalManagedAssets;

    // ── Per-holder records ───────────────────────────────────────────────────
    mapping(address => IssuanceRecord[])  private _issuanceHistory;
    mapping(address => TransferRecord[])  private _transferHistory;
    mapping(address => BalanceSnapshot[]) private _balanceSnapshots;

    // ── Transfer allowlist / blocklist ───────────────────────────────────────
    /// @notice When true only whitelisted addresses may send or receive shares.
    bool public transferRestricted;
    mapping(address => bool) public transferWhitelist;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event SharesIssued(address indexed recipient, uint256 shares, uint256 assetsDeposited);
    event SharesBurned(address indexed from, uint256 shares);
    event TotalManagedAssetsUpdated(uint256 oldAmount, uint256 newAmount);
    event VaultUpdated(address indexed oldVault, address indexed newVault);
    event TransferRestrictionToggled(bool restricted);
    event WhitelistUpdated(address indexed account, bool status);
    event BalanceSnapshotTaken(address indexed account, uint256 shares, uint256 blockNumber);

    // ─────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────

    error OnlyVault();
    error ZeroAddress();
    error ZeroAmount();
    error TransferNotAllowed(address from, address to);
    error InsufficientShares(address account, uint256 requested, uint256 available);

    // ─────────────────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────────────────

    modifier onlyVault() {
        if (msg.sender != vault) revert OnlyVault();
        _;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    /// @param _name             ERC-20 name (e.g. "GateDelay Vault Share").
    /// @param _symbol           ERC-20 symbol (e.g. "gvUSDC").
    /// @param _underlyingAsset  The token deposited into the vault.
    /// @param _vault            Address of the controlling vault (minter / burner).
    constructor(
        string  memory _name,
        string  memory _symbol,
        address _underlyingAsset,
        address _vault
    )
        ERC20(_name, _symbol)
        ERC20Permit(_name)
        Ownable(msg.sender)
    {
        if (_underlyingAsset == address(0)) revert ZeroAddress();
        if (_vault           == address(0)) revert ZeroAddress();

        underlyingAsset = IERC20(_underlyingAsset);
        vault           = _vault;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Share issuance (vault only)
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Mint `shares` to `recipient` representing `assetsDeposited` underlying tokens.
    /// @dev Called by the vault after it has received the underlying tokens.
    function issueShares(
        address recipient,
        uint256 shares,
        uint256 assetsDeposited
    ) external onlyVault whenNotPaused {
        if (recipient == address(0)) revert ZeroAddress();
        if (shares == 0)             revert ZeroAmount();

        _mint(recipient, shares);

        totalSharesIssued  += shares;
        totalManagedAssets += assetsDeposited;

        _issuanceHistory[recipient].push(IssuanceRecord({
            recipient:       recipient,
            shares:          shares,
            assetsDeposited: assetsDeposited,
            timestamp:       block.timestamp
        }));

        _recordSnapshot(recipient);
        emit SharesIssued(recipient, shares, assetsDeposited);
    }

    /// @notice Burn `shares` from `holder` on withdrawal.
    /// @dev Called by the vault when it releases underlying tokens back to the user.
    function redeemShares(address holder, uint256 shares)
        external
        onlyVault
        whenNotPaused
    {
        if (holder == address(0)) revert ZeroAddress();
        if (shares == 0)         revert ZeroAmount();
        if (balanceOf(holder) < shares)
            revert InsufficientShares(holder, shares, balanceOf(holder));

        _burn(holder, shares);
        totalSharesBurned  += shares;

        _recordSnapshot(holder);
        emit SharesBurned(holder, shares);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Asset management (vault only)
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Update the total assets under management (called when yield accrues
    ///         or assets change so that `shareValue` stays accurate).
    function setTotalManagedAssets(uint256 newTotal)
        external
        onlyVault
    {
        uint256 old = totalManagedAssets;
        totalManagedAssets = newTotal;
        emit TotalManagedAssetsUpdated(old, newTotal);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Value calculation
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Price of one share in underlying tokens (PRECISION-scaled).
    ///         Returns PRECISION (1.0) when no shares exist yet.
    function pricePerShare() public view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return PRECISION;
        return totalManagedAssets.mulDiv(PRECISION, supply);
    }

    /// @notice Underlying asset value of `shares` at the current share price.
    function shareValue(uint256 shares) public view returns (uint256) {
        return shares.mulDiv(totalManagedAssets, _nonZeroSupply());
    }

    /// @notice Underlying asset value of all shares held by `account`.
    function accountValue(address account) external view returns (uint256) {
        uint256 bal = balanceOf(account);
        if (bal == 0) return 0;
        return shareValue(bal);
    }

    /// @notice How many shares `assets` underlying tokens would currently buy.
    function assetsToShares(uint256 assets) external view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0 || totalManagedAssets == 0) return assets; // 1:1 at inception
        return assets.mulDiv(supply, totalManagedAssets);
    }

    /// @notice How many underlying tokens `shares` would currently redeem for.
    function sharesToAssets(uint256 shares) external view returns (uint256) {
        return shareValue(shares);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Transfer controls
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Enable or disable transfer restrictions (owner only).
    ///         When restricted, only whitelisted addresses may send or receive.
    function setTransferRestriction(bool restricted) external onlyOwner {
        transferRestricted = restricted;
        emit TransferRestrictionToggled(restricted);
    }

    /// @notice Add or remove an address from the transfer whitelist.
    function setWhitelist(address account, bool status) external onlyOwner {
        if (account == address(0)) revert ZeroAddress();
        transferWhitelist[account] = status;
        emit WhitelistUpdated(account, status);
    }

    /// @notice Batch whitelist update for gas efficiency.
    function batchSetWhitelist(address[] calldata accounts, bool status) external onlyOwner {
        for (uint256 i; i < accounts.length; ++i) {
            if (accounts[i] == address(0)) revert ZeroAddress();
            transferWhitelist[accounts[i]] = status;
            emit WhitelistUpdated(accounts[i], status);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Transfer vault control to a new address (e.g. upgraded vault).
    function setVault(address newVault) external onlyOwner {
        if (newVault == address(0)) revert ZeroAddress();
        emit VaultUpdated(vault, newVault);
        vault = newVault;
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /// @notice Take a manual balance snapshot for `account`.
    function takeSnapshot(address account) external {
        _recordSnapshot(account);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Queries
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Full issuance history for a holder.
    function getIssuanceHistory(address account)
        external view returns (IssuanceRecord[] memory)
    {
        return _issuanceHistory[account];
    }

    /// @notice Full transfer history for a sender.
    function getTransferHistory(address account)
        external view returns (TransferRecord[] memory)
    {
        return _transferHistory[account];
    }

    /// @notice All historical balance snapshots for an account.
    function getBalanceSnapshots(address account)
        external view returns (BalanceSnapshot[] memory)
    {
        return _balanceSnapshots[account];
    }

    /// @notice Number of times shares were issued to `account`.
    function issuanceCount(address account) external view returns (uint256) {
        return _issuanceHistory[account].length;
    }

    /// @notice Number of outgoing transfers recorded for `account`.
    function transferCount(address account) external view returns (uint256) {
        return _transferHistory[account].length;
    }

    /// @notice Net shares in circulation (issued minus burned).
    function circulatingShares() external view returns (uint256) {
        return totalSupply();
    }

    /// @notice Returns key share supply statistics in one call.
    function supplyStats()
        external view
        returns (
            uint256 current,
            uint256 issued,
            uint256 burned,
            uint256 managedAssets,
            uint256 pps
        )
    {
        current       = totalSupply();
        issued        = totalSharesIssued;
        burned        = totalSharesBurned;
        managedAssets = totalManagedAssets;
        pps           = pricePerShare();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ERC-20 overrides (transfer hooks & restriction enforcement)
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev Hook called on every token transfer (including mint / burn).
    function _update(address from, address to, uint256 amount)
        internal
        override(ERC20, ERC20Votes)
        whenNotPaused
    {
        // Restriction check (skipped for mints [from==0] and burns [to==0])
        if (transferRestricted && from != address(0) && to != address(0)) {
            if (!transferWhitelist[from] && !transferWhitelist[to]) {
                revert TransferNotAllowed(from, to);
            }
        }

        super._update(from, to, amount);

        // Record outbound transfers (skip mint / burn)
        if (from != address(0) && to != address(0)) {
            _transferHistory[from].push(TransferRecord({
                from:      from,
                to:        to,
                amount:    amount,
                timestamp: block.timestamp
            }));
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ERC-20Votes / Permit nonce override (required by OZ v5)
    // ─────────────────────────────────────────────────────────────────────────

    function nonces(address owner)
        public view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    function _recordSnapshot(address account) internal {
        _balanceSnapshots[account].push(BalanceSnapshot({
            shares:      balanceOf(account),
            blockNumber: block.number,
            timestamp:   block.timestamp
        }));
        emit BalanceSnapshotTaken(account, balanceOf(account), block.number);
    }

    /// @dev Returns totalSupply, substituting 1 to avoid divide-by-zero in
    ///      value calculations when supply is zero.
    function _nonZeroSupply() internal view returns (uint256) {
        uint256 s = totalSupply();
        return s == 0 ? 1 : s;
    }
}

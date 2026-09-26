// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title Whitelist
/// @notice Manages market access whitelisting with batch updates, guards, and queryable history.
/// @dev Threat Assumptions:
/// - The contract owner is fully trusted and their keys are not compromised.
/// - The owner will promptly remove any whitelisted account that becomes compromised or malicious.
/// - The whitelist does not protect against compromised accounts until the owner explicitly revokes their access.
contract Whitelist is Ownable {
    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error ZeroAddress();
    error AlreadyWhitelisted(address account);
    error NotWhitelisted(address account);

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------
    struct WhitelistChange {
        address account;
        address operator;
        bool whitelisted;
        uint64 timestamp;
    }

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    mapping(address => bool) private _whitelisted;
    mapping(address => uint256) private _whitelistedIndexPlusOne;
    mapping(address => uint64) private _lastUpdatedAt;
    mapping(address => address) private _lastUpdatedBy;

    address[] private _whitelistedAccounts;
    WhitelistChange[] private _changes;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event Whitelisted(address indexed account, address indexed operator);
    event Unwhitelisted(address indexed account, address indexed operator);
    event WhitelistChanged(address indexed account, address indexed operator, bool whitelisted);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(address initialOwner) Ownable(initialOwner) {}

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------
    modifier onlyWhitelisted(address account) {
        if (!_whitelisted[account]) revert NotWhitelisted(account);
        _;
    }

    modifier onlyWhitelistedCaller() {
        if (!_whitelisted[msg.sender]) revert NotWhitelisted(msg.sender);
        _;
    }

    // -------------------------------------------------------------------------
    // Whitelist management
    // -------------------------------------------------------------------------
    /// @notice Executes whitelist.
    /// @param account Account address affected by this operation.
    /// @dev Access: Caller must be the contract owner.
    function whitelist(address account) external onlyOwner {
        _whitelist(account);
    }

    /// @notice Executes unwhitelist.
    /// @param account Account address affected by this operation.
    /// @dev Access: Caller must be the contract owner.
    function unwhitelist(address account) external onlyOwner {
        _unwhitelist(account);
    }

    /// @notice Executes whitelistBatch.
    /// @param accounts Address associated with accounts.
    /// @dev Access: Caller must be the contract owner.
    function whitelistBatch(address[] calldata accounts) external onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) {
            _whitelist(accounts[i]);
        }
    }

    /// @notice Executes unwhitelistBatch.
    /// @param accounts Address associated with accounts.
    /// @dev Access: Caller must be the contract owner.
    function unwhitelistBatch(address[] calldata accounts) external onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) {
            _unwhitelist(accounts[i]);
        }
    }

    /// @notice Alias for integrations that prefer allowlist-style naming.
    /// @param account Account address affected by this operation.
    /// @dev Access: Caller must be the contract owner.
    function addToWhitelist(address account) external onlyOwner {
        _whitelist(account);
    }

    /// @notice Alias for integrations that prefer allowlist-style naming.
    /// @param account Account address affected by this operation.
    /// @dev Access: Caller must be the contract owner.
    function removeFromWhitelist(address account) external onlyOwner {
        _unwhitelist(account);
    }

    // -------------------------------------------------------------------------
    // Access checks
    // -------------------------------------------------------------------------
    /// @notice Reports whether access allowed is satisfied.
    /// @param account Account address affected by this operation.
    /// @return True when the requested condition is met.
    /// @dev Access: No caller-specific access restriction is imposed.
    function isAccessAllowed(address account) public view returns (bool) {
        return _whitelisted[account];
    }

    /// @notice Executes requireWhitelisted.
    /// @param account Account address affected by this operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    /// @dev Reverts: `NotWhitelisted` if `!_whitelisted[account]` is true.
    function requireWhitelisted(address account) external view {
        if (!_whitelisted[account]) revert NotWhitelisted(account);
    }

    // -------------------------------------------------------------------------
    // Queries
    // -------------------------------------------------------------------------
    /// @notice Reports whether whitelisted is satisfied.
    /// @param account Account address affected by this operation.
    /// @return True when the requested condition is met.
    /// @dev Access: No caller-specific access restriction is imposed.
    function isWhitelisted(address account) public view returns (bool) {
        return _whitelisted[account];
    }

    /// @notice Returns whitelisted accounts.
    /// @return Whitelisted accounts returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getWhitelistedAccounts() external view returns (address[] memory) {
        return _whitelistedAccounts;
    }

    /// @notice Returns whitelisted count.
    /// @return Whitelisted count returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getWhitelistedCount() external view returns (uint256) {
        return _whitelistedAccounts.length;
    }

    /// @notice Returns whitelist change count.
    /// @return Whitelist change count returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getWhitelistChangeCount() external view returns (uint256) {
        return _changes.length;
    }

    /// @notice Returns whitelist change.
    /// @param index Numeric index used by this operation.
    /// @return Whitelist change returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getWhitelistChange(uint256 index) external view returns (WhitelistChange memory) {
        return _changes[index];
    }

    /// @notice Returns whitelist changes.
    /// @param offset Numeric offset used by this operation.
    /// @param limit Numeric limit used by this operation.
    /// @return page page produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function listWhitelistChanges(uint256 offset, uint256 limit)
        external
        view
        returns (WhitelistChange[] memory page)
    {
        uint256 total = _changes.length;
        if (offset >= total || limit == 0) return new WhitelistChange[](0);

        uint256 end = offset + limit;
        if (end > total) end = total;

        page = new WhitelistChange[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            page[i - offset] = _changes[i];
        }
    }

    /// @notice Executes lastUpdatedAt.
    /// @param account Account address affected by this operation.
    /// @return Value produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function lastUpdatedAt(address account) external view returns (uint64) {
        return _lastUpdatedAt[account];
    }

    /// @notice Executes lastUpdatedBy.
    /// @param account Account address affected by this operation.
    /// @return Value produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function lastUpdatedBy(address account) external view returns (address) {
        return _lastUpdatedBy[account];
    }

    /// @notice Returns whitelist metadata.
    /// @param account Account address affected by this operation.
    /// @return whitelisted whitelisted produced by the operation.
    /// @return updatedAt Unix timestamp of the event.
    /// @return updatedBy updated by produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getWhitelistMetadata(address account)
        external
        view
        returns (bool whitelisted, uint64 updatedAt, address updatedBy)
    {
        return (_whitelisted[account], _lastUpdatedAt[account], _lastUpdatedBy[account]);
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------
    function _whitelist(address account) internal {
        if (account == address(0)) revert ZeroAddress();
        if (_whitelisted[account]) revert AlreadyWhitelisted(account);

        _whitelisted[account] = true;
        _whitelistedIndexPlusOne[account] = _whitelistedAccounts.length + 1;
        _whitelistedAccounts.push(account);

        _recordChange(account, true);

        emit Whitelisted(account, msg.sender);
        emit WhitelistChanged(account, msg.sender, true);
    }

    function _unwhitelist(address account) internal {
        if (account == address(0)) revert ZeroAddress();
        if (!_whitelisted[account]) revert NotWhitelisted(account);

        _whitelisted[account] = false;
        _removeWhitelistedAccount(account);

        _recordChange(account, false);

        emit Unwhitelisted(account, msg.sender);
        emit WhitelistChanged(account, msg.sender, false);
    }

    function _removeWhitelistedAccount(address account) internal {
        uint256 index = _whitelistedIndexPlusOne[account] - 1;
        uint256 lastIndex = _whitelistedAccounts.length - 1;

        if (index != lastIndex) {
            address lastAccount = _whitelistedAccounts[lastIndex];
            _whitelistedAccounts[index] = lastAccount;
            _whitelistedIndexPlusOne[lastAccount] = index + 1;
        }

        _whitelistedAccounts.pop();
        delete _whitelistedIndexPlusOne[account];
    }

    function _recordChange(address account, bool whitelisted) internal {
        uint64 timestamp = uint64(block.timestamp);
        _lastUpdatedAt[account] = timestamp;
        _lastUpdatedBy[account] = msg.sender;
        _changes.push(WhitelistChange({
            account: account,
            operator: msg.sender,
            whitelisted: whitelisted,
            timestamp: timestamp
        }));
    }
}

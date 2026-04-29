// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title Whitelist
/// @notice Manages market access whitelisting with batch updates, guards, and queryable history.
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
    function whitelist(address account) external onlyOwner {
        _whitelist(account);
    }

    function unwhitelist(address account) external onlyOwner {
        _unwhitelist(account);
    }

    function whitelistBatch(address[] calldata accounts) external onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) {
            _whitelist(accounts[i]);
        }
    }

    function unwhitelistBatch(address[] calldata accounts) external onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) {
            _unwhitelist(accounts[i]);
        }
    }

    /// @notice Alias for integrations that prefer allowlist-style naming.
    function addToWhitelist(address account) external onlyOwner {
        _whitelist(account);
    }

    /// @notice Alias for integrations that prefer allowlist-style naming.
    function removeFromWhitelist(address account) external onlyOwner {
        _unwhitelist(account);
    }

    // -------------------------------------------------------------------------
    // Access checks
    // -------------------------------------------------------------------------
    function isAccessAllowed(address account) public view returns (bool) {
        return _whitelisted[account];
    }

    function requireWhitelisted(address account) external view {
        if (!_whitelisted[account]) revert NotWhitelisted(account);
    }

    // -------------------------------------------------------------------------
    // Queries
    // -------------------------------------------------------------------------
    function isWhitelisted(address account) public view returns (bool) {
        return _whitelisted[account];
    }

    function getWhitelistedAccounts() external view returns (address[] memory) {
        return _whitelistedAccounts;
    }

    function getWhitelistedCount() external view returns (uint256) {
        return _whitelistedAccounts.length;
    }

    function getWhitelistChangeCount() external view returns (uint256) {
        return _changes.length;
    }

    function getWhitelistChange(uint256 index) external view returns (WhitelistChange memory) {
        return _changes[index];
    }

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

    function lastUpdatedAt(address account) external view returns (uint64) {
        return _lastUpdatedAt[account];
    }

    function lastUpdatedBy(address account) external view returns (address) {
        return _lastUpdatedBy[account];
    }

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

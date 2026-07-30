// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title Blacklist
/// @notice Manages a blacklist of blocked addresses with batch operations and query support.
contract Blacklist is Ownable {
    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------
    error InvalidAddress();
    error AlreadyBlacklisted(address account);
    error NotBlacklisted(address account);
    error Blacklisted(address account);

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event Blacklisted(address indexed account, address indexed operator);
    event Unblacklisted(address indexed account, address indexed operator);

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    mapping(address => bool) private _blacklisted;
    address[] private _blacklistedAccounts;

    constructor() Ownable(msg.sender) {}

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------
    modifier notBlacklisted(address account) {
        if (_blacklisted[account]) revert Blacklisted(account);
        _;
    }

    // -------------------------------------------------------------------------
    // Blacklist management
    // -------------------------------------------------------------------------
    function blacklist(address account) external onlyOwner {
        _blacklist(account);
    }

    function blacklistBatch(address[] calldata accounts) external onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) {
            _blacklist(accounts[i]);
        }
    }

    function unblacklist(address account) external onlyOwner {
        if (account == address(0)) revert InvalidAddress();
        if (!_blacklisted[account]) revert NotBlacklisted(account);

        _blacklisted[account] = false;
        _removeBlacklisted(account);

        emit Unblacklisted(account, msg.sender);
    }

    function unblacklistBatch(address[] calldata accounts) external onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) {
            unblacklist(accounts[i]);
        }
    }

    // -------------------------------------------------------------------------
    // Queries
    // -------------------------------------------------------------------------
    function isBlacklisted(address account) public view returns (bool) {
        return _blacklisted[account];
    }

    function getBlacklistedAccounts() external view returns (address[] memory) {
        return _blacklistedAccounts;
    }

    function getBlacklistedCount() external view returns (uint256) {
        return _blacklistedAccounts.length;
    }

    function requireNotBlacklisted(address account) external view {
        if (_blacklisted[account]) revert Blacklisted(account);
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------
    function _blacklist(address account) internal {
        if (account == address(0)) revert InvalidAddress();
        if (_blacklisted[account]) revert AlreadyBlacklisted(account);

        _blacklisted[account] = true;
        _blacklistedAccounts.push(account);

        emit Blacklisted(account, msg.sender);
    }

    function _removeBlacklisted(address account) internal {
        address[] storage accounts = _blacklistedAccounts;
        for (uint256 i = 0; i < accounts.length; i++) {
            if (accounts[i] == account) {
                accounts[i] = accounts[accounts.length - 1];
                accounts.pop();
                break;
            }
        }
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Proxy
/// @notice Transparent proxy pattern for upgradeable contracts.
contract Proxy {
    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error ZeroImplementation();
    error DelegateCallFailed();
    error InvalidProxyAdmin();

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    /// @dev Implementation contract address (stored at slot 0)
    address private _implementation;

    /// @dev Proxy admin address (stored at slot 1)
    address private _proxyAdmin;

    /// @dev Upgrade history tracking
    address[] private _upgradeHistory;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event Upgraded(address indexed newImplementation, address indexed admin);
    event AdminChanged(address indexed oldAdmin, address indexed newAdmin);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(address implementation, address admin) {
        if (implementation == address(0)) revert ZeroImplementation();
        if (admin == address(0)) revert InvalidProxyAdmin();

        _implementation = implementation;
        _proxyAdmin = admin;
        _upgradeHistory.push(implementation);
    }

    // -------------------------------------------------------------------------
    // Admin functions
    // -------------------------------------------------------------------------

    /// @notice Upgrade the implementation contract.
    /// @param newImplementation Address of the new implementation.
    function upgradeTo(address newImplementation) external {
        if (msg.sender != _proxyAdmin) revert InvalidProxyAdmin();
        if (newImplementation == address(0)) revert ZeroImplementation();

        _implementation = newImplementation;
        _upgradeHistory.push(newImplementation);

        emit Upgraded(newImplementation, msg.sender);
    }

    /// @notice Change the proxy admin.
    /// @param newAdmin Address of the new admin.
    function changeAdmin(address newAdmin) external {
        if (msg.sender != _proxyAdmin) revert InvalidProxyAdmin();
        if (newAdmin == address(0)) revert InvalidProxyAdmin();

        address oldAdmin = _proxyAdmin;
        _proxyAdmin = newAdmin;

        emit AdminChanged(oldAdmin, newAdmin);
    }

    // -------------------------------------------------------------------------
    // Query functions
    // -------------------------------------------------------------------------

    /// @notice Get the current implementation address.
    function getImplementation() external view returns (address) {
        return _implementation;
    }

    /// @notice Get the current proxy admin.
    function getAdmin() external view returns (address) {
        return _proxyAdmin;
    }

    /// @notice Get the upgrade history.
    function getUpgradeHistory() external view returns (address[] memory) {
        return _upgradeHistory;
    }

    /// @notice Get the number of upgrades.
    function getUpgradeCount() external view returns (uint256) {
        return _upgradeHistory.length;
    }

    // -------------------------------------------------------------------------
    // Fallback
    // -------------------------------------------------------------------------

    /// @notice Delegate all calls to the implementation contract.
    fallback() external payable {
        address impl = _implementation;
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }

    /// @notice Accept ETH transfers.
    receive() external payable {}
}

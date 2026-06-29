// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title UUPSUpgradeable
/// @notice Universal Upgradeable Proxy Standard (UUPS) implementation.
abstract contract UUPSUpgradeable {
    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error NotAuthorizedToUpgrade();
    error InvalidImplementation();
    error UpgradeFailed();

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    /// @dev Implementation contract address (stored at specific slot)
    bytes32 private constant IMPLEMENTATION_SLOT =
        bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);

    /// @dev Upgrade history
    address[] private _upgradeHistory;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event Upgraded(address indexed newImplementation);

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    /// @notice Ensure only authorized addresses can upgrade.
    modifier onlyProxy() {
        require(
            address(this) != _getImplementation(),
            "Function must be called through proxy"
        );
        _;
    }

    // -------------------------------------------------------------------------
    // Internal functions
    // -------------------------------------------------------------------------

    /// @notice Get the current implementation address.
    function _getImplementation() internal view returns (address impl) {
        bytes32 slot = IMPLEMENTATION_SLOT;
        assembly {
            impl := sload(slot)
        }
    }

    /// @notice Set the implementation address.
    function _setImplementation(address newImplementation) internal {
        if (newImplementation == address(0)) revert InvalidImplementation();

        bytes32 slot = IMPLEMENTATION_SLOT;
        assembly {
            sstore(slot, newImplementation)
        }

        _upgradeHistory.push(newImplementation);
    }

    /// @notice Authorize an upgrade (must be implemented by child contract).
    function _authorizeUpgrade(address newImplementation) internal virtual;

    // -------------------------------------------------------------------------
    // External functions
    // -------------------------------------------------------------------------

    /// @notice Upgrade to a new implementation.
    /// @param newImplementation Address of the new implementation.
    function upgradeTo(address newImplementation) external onlyProxy {
        _authorizeUpgrade(newImplementation);
        _setImplementation(newImplementation);
        emit Upgraded(newImplementation);
    }

    /// @notice Upgrade to a new implementation and call a function.
    /// @param newImplementation Address of the new implementation.
    /// @param data Encoded function call data.
    function upgradeToAndCall(address newImplementation, bytes calldata data)
        external
        onlyProxy
    {
        _authorizeUpgrade(newImplementation);
        _setImplementation(newImplementation);
        emit Upgraded(newImplementation);

        if (data.length > 0) {
            (bool success, ) = address(this).delegatecall(data);
            if (!success) revert UpgradeFailed();
        }
    }

    /// @notice Get the current implementation.
    function getImplementation() external view returns (address) {
        return _getImplementation();
    }

    /// @notice Get upgrade history.
    function getUpgradeHistory() external view returns (address[] memory) {
        return _upgradeHistory;
    }

    /// @notice Get the number of upgrades.
    function getUpgradeCount() external view returns (uint256) {
        return _upgradeHistory.length;
    }

    /// @notice Check if an address is the current implementation.
    function isImplementation(address account) external view returns (bool) {
        return account == _getImplementation();
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title UpgradeableMarket
/// @notice Implements UUPS upgradeable pattern for market contracts.
contract UpgradeableMarket is Initializable, UUPSUpgradeable, Ownable {
    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event UpgradeAuthorized(address indexed newImplementation, address indexed authorizer);
    event UpgradeExecuted(address indexed oldImplementation, address indexed newImplementation);

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    uint256 private _version;
    address[] private _upgradeHistory;
    mapping(address => uint256) private _upgradeTimestamps;
    bool private _upgradeLocked;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor() {
        _disableInitializers();
    }

    // -------------------------------------------------------------------------
    // Initialization
    // -------------------------------------------------------------------------

    /// @notice Initialize the contract.
    function initialize() public initializer {
        _version = 1;
        _upgradeHistory.push(address(this));
        _upgradeLocked = false;
    }

    // -------------------------------------------------------------------------
    // Upgrade Management
    // -------------------------------------------------------------------------

    /// @notice Authorize an upgrade to a new implementation.
    /// @param newImplementation The address of the new implementation.
    function authorizeUpgrade(address newImplementation) public override onlyOwner {
        require(newImplementation != address(0), "Invalid implementation");
        require(newImplementation != _getImplementation(), "Same implementation");
        require(!_upgradeLocked, "Upgrade locked");
        
        emit UpgradeAuthorized(newImplementation, msg.sender);
    }

    /// @notice Execute the upgrade to a new implementation.
    /// @param newImplementation The address of the new implementation.
    function upgradeToAndCall(address newImplementation, bytes memory data) public payable override onlyOwner {
        require(newImplementation != address(0), "Invalid implementation");
        require(!_upgradeLocked, "Upgrade locked");
        
        address oldImplementation = _getImplementation();
        
        // Validate upgrade safety
        _validateUpgradeSafety(oldImplementation, newImplementation);
        
        // Execute upgrade
        _upgradeToAndCallUUPS(newImplementation, data, false);
        
        // Record upgrade
        _version++;
        _upgradeHistory.push(newImplementation);
        _upgradeTimestamps[newImplementation] = block.timestamp;
        
        emit UpgradeExecuted(oldImplementation, newImplementation);
    }

    /// @notice Lock upgrades to prevent further changes.
    function lockUpgrades() external onlyOwner {
        require(!_upgradeLocked, "Already locked");
        _upgradeLocked = true;
    }

    /// @notice Unlock upgrades to allow changes.
    function unlockUpgrades() external onlyOwner {
        require(_upgradeLocked, "Not locked");
        _upgradeLocked = false;
    }

    /// @notice Check if upgrades are locked.
    function isUpgradeLocked() external view returns (bool) {
        return _upgradeLocked;
    }

    /// @notice Get the current version.
    function getVersion() external view returns (uint256) {
        return _version;
    }

    /// @notice Get the upgrade history.
    function getUpgradeHistory() external view returns (address[] memory) {
        return _upgradeHistory;
    }

    /// @notice Get the timestamp of an upgrade.
    /// @param implementation The implementation address.
    function getUpgradeTimestamp(address implementation) external view returns (uint256) {
        return _upgradeTimestamps[implementation];
    }

    /// @notice Get the current implementation address.
    function getImplementation() external view returns (address) {
        return _getImplementation();
    }

    // -------------------------------------------------------------------------
    // Safety Validation
    // -------------------------------------------------------------------------

    /// @notice Validate upgrade safety.
    /// @param oldImplementation The old implementation address.
    /// @param newImplementation The new implementation address.
    function _validateUpgradeSafety(address oldImplementation, address newImplementation) internal view {
        require(oldImplementation != address(0), "Invalid old implementation");
        require(newImplementation != address(0), "Invalid new implementation");
        
        // Check that new implementation is a contract
        uint256 size;
        assembly {
            size := extcodesize(newImplementation)
        }
        require(size > 0, "New implementation not a contract");
    }

    /// @notice Get the current implementation address.
    function _getImplementation() internal view returns (address) {
        return _implementation();
    }

    /// @notice Execute upgrade with call.
    function _upgradeToAndCallUUPS(
        address newImplementation,
        bytes memory data,
        bool forceCall
    ) internal {
        _upgradeToAndCall(newImplementation, data, forceCall);
    }

    // -------------------------------------------------------------------------
    // Market Operations (Example)
    // -------------------------------------------------------------------------

    /// @notice Example market operation.
    function executeMarketOperation() external returns (bool) {
        return true;
    }

    /// @notice Get contract state for validation.
    function getContractState() external view returns (uint256 version, bool locked) {
        return (_version, _upgradeLocked);
    }
}

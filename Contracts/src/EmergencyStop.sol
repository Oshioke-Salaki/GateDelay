// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title EmergencyStop
/// @notice Implements emergency stop functionality for critical operations.
contract EmergencyStop is AccessControl {
    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    bytes32 public constant RECOVERY_ROLE = keccak256("RECOVERY_ROLE");

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event EmergencyStopActivated(address indexed activator, string reason);
    event EmergencyStopDeactivated(address indexed deactivator);
    event RecoveryInitiated(address indexed initiator);
    event RecoveryCompleted(address indexed completer);

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    bool private _emergencyActive;
    string private _emergencyReason;
    address private _emergencyActivatedBy;
    uint256 private _emergencyActivatedAt;
    bool private _recoveryInProgress;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(address emergencyAdmin) {
        require(emergencyAdmin != address(0), "Invalid admin address");
        _grantRole(DEFAULT_ADMIN_ROLE, emergencyAdmin);
        _grantRole(EMERGENCY_ROLE, emergencyAdmin);
        _grantRole(RECOVERY_ROLE, emergencyAdmin);
    }

    // -------------------------------------------------------------------------
    // Emergency Stop Management
    // -------------------------------------------------------------------------

    /// @notice Activate emergency stop.
    /// @param reason The reason for emergency stop.
    function activateEmergencyStop(string calldata reason) external onlyRole(EMERGENCY_ROLE) {
        require(!_emergencyActive, "Emergency already active");
        require(bytes(reason).length > 0, "Reason required");
        
        _emergencyActive = true;
        _emergencyReason = reason;
        _emergencyActivatedBy = msg.sender;
        _emergencyActivatedAt = block.timestamp;
        
        emit EmergencyStopActivated(msg.sender, reason);
    }

    /// @notice Deactivate emergency stop.
    function deactivateEmergencyStop() external onlyRole(EMERGENCY_ROLE) {
        require(_emergencyActive, "Emergency not active");
        
        _emergencyActive = false;
        _emergencyReason = "";
        _emergencyActivatedBy = address(0);
        _emergencyActivatedAt = 0;
        
        emit EmergencyStopDeactivated(msg.sender);
    }

    /// @notice Check if emergency stop is active.
    function isEmergencyActive() external view returns (bool) {
        return _emergencyActive;
    }

    /// @notice Get emergency stop reason.
    function getEmergencyReason() external view returns (string memory) {
        return _emergencyReason;
    }

    /// @notice Get address that activated emergency stop.
    function getEmergencyActivatedBy() external view returns (address) {
        return _emergencyActivatedBy;
    }

    /// @notice Get timestamp when emergency was activated.
    function getEmergencyActivatedAt() external view returns (uint256) {
        return _emergencyActivatedAt;
    }

    // -------------------------------------------------------------------------
    // Recovery Management
    // -------------------------------------------------------------------------

    /// @notice Initiate recovery process.
    function initiateRecovery() external onlyRole(RECOVERY_ROLE) {
        require(_emergencyActive, "Emergency not active");
        require(!_recoveryInProgress, "Recovery already in progress");
        
        _recoveryInProgress = true;
        emit RecoveryInitiated(msg.sender);
    }

    /// @notice Complete recovery process.
    function completeRecovery() external onlyRole(RECOVERY_ROLE) {
        require(_recoveryInProgress, "Recovery not in progress");
        
        _recoveryInProgress = false;
        _emergencyActive = false;
        _emergencyReason = "";
        _emergencyActivatedBy = address(0);
        _emergencyActivatedAt = 0;
        
        emit RecoveryCompleted(msg.sender);
    }

    /// @notice Check if recovery is in progress.
    function isRecoveryInProgress() external view returns (bool) {
        return _recoveryInProgress;
    }

    // -------------------------------------------------------------------------
    // Permission Management
    // -------------------------------------------------------------------------

    /// @notice Grant emergency role to an address.
    /// @param account The address to grant role to.
    function grantEmergencyRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "Invalid address");
        _grantRole(EMERGENCY_ROLE, account);
    }

    /// @notice Revoke emergency role from an address.
    /// @param account The address to revoke role from.
    function revokeEmergencyRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "Invalid address");
        _revokeRole(EMERGENCY_ROLE, account);
    }

    /// @notice Grant recovery role to an address.
    /// @param account The address to grant role to.
    function grantRecoveryRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "Invalid address");
        _grantRole(RECOVERY_ROLE, account);
    }

    /// @notice Revoke recovery role from an address.
    /// @param account The address to revoke role from.
    function revokeRecoveryRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "Invalid address");
        _revokeRole(RECOVERY_ROLE, account);
    }

    /// @notice Check if address has emergency role.
    function hasEmergencyRole(address account) external view returns (bool) {
        return hasRole(EMERGENCY_ROLE, account);
    }

    /// @notice Check if address has recovery role.
    function hasRecoveryRole(address account) external view returns (bool) {
        return hasRole(RECOVERY_ROLE, account);
    }

    // -------------------------------------------------------------------------
    // Modifiers for Protected Operations
    // -------------------------------------------------------------------------

    /// @notice Modifier to restrict operations during emergency.
    modifier whenNotEmergency() {
        require(!_emergencyActive, "Emergency stop active");
        _;
    }

    /// @notice Modifier to allow operations only during emergency.
    modifier whenEmergency() {
        require(_emergencyActive, "Emergency stop not active");
        _;
    }
}

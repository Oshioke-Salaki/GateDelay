// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title EmergencyStop
/// @notice Tracks a protocol-wide emergency state and a gated recovery flow.
/// @dev
/// This contract exposes two operational roles:
/// - `EMERGENCY_ROLE` can activate or manually clear the emergency stop.
/// - `RECOVERY_ROLE` can start and complete a structured recovery flow.
///
/// Integrating contracts can inherit `whenNotEmergency` for normal operations
/// and `whenEmergency` for actions that should only run during remediation.
contract EmergencyStop is AccessControl {
    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    bytes32 public constant RECOVERY_ROLE = keccak256("RECOVERY_ROLE");

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    /// @notice Emitted when an authorized account activates the emergency stop.
    /// @param activator Account that enabled the emergency stop.
    /// @param reason Human-readable explanation for the incident.
    event EmergencyStopActivated(address indexed activator, string reason);

    /// @notice Emitted when an authorized account manually deactivates the stop.
    /// @param deactivator Account that cleared the emergency state.
    event EmergencyStopDeactivated(address indexed deactivator);

    /// @notice Emitted when the recovery workflow begins.
    /// @param initiator Account that started recovery while the stop is active.
    event RecoveryInitiated(address indexed initiator);

    /// @notice Emitted when recovery finishes and the emergency state is reset.
    /// @param completer Account that completed the recovery flow.
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
    /// @param emergencyAdmin Account that receives admin, emergency, and recovery roles.
    constructor(address emergencyAdmin) {
        require(emergencyAdmin != address(0), "Invalid admin address");
        _grantRole(DEFAULT_ADMIN_ROLE, emergencyAdmin);
        _grantRole(EMERGENCY_ROLE, emergencyAdmin);
        _grantRole(RECOVERY_ROLE, emergencyAdmin);
    }

    // -------------------------------------------------------------------------
    // Emergency Stop Management
    // -------------------------------------------------------------------------

    /// @notice Activates the emergency stop and records incident metadata.
    /// @dev Reverts if the stop is already active or the reason is empty.
    /// @param reason Short description of why the protocol was halted.
    function activateEmergencyStop(string calldata reason) external onlyRole(EMERGENCY_ROLE) {
        require(!_emergencyActive, "Emergency already active");
        require(bytes(reason).length > 0, "Reason required");
        
        _emergencyActive = true;
        _emergencyReason = reason;
        _emergencyActivatedBy = msg.sender;
        _emergencyActivatedAt = block.timestamp;
        
        emit EmergencyStopActivated(msg.sender, reason);
    }

    /// @notice Clears the emergency stop without using the recovery workflow.
    /// @dev Intended for authorized responders once the incident is resolved.
    function deactivateEmergencyStop() external onlyRole(EMERGENCY_ROLE) {
        require(_emergencyActive, "Emergency not active");
        
        _emergencyActive = false;
        _emergencyReason = "";
        _emergencyActivatedBy = address(0);
        _emergencyActivatedAt = 0;
        
        emit EmergencyStopDeactivated(msg.sender);
    }

    /// @notice Returns whether the emergency stop is currently active.
    /// @return True when protected operations should remain halted.
    function isEmergencyActive() external view returns (bool) {
        return _emergencyActive;
    }

    /// @notice Returns the reason attached to the current emergency state.
    /// @return The incident reason, or an empty string when inactive.
    function getEmergencyReason() external view returns (string memory) {
        return _emergencyReason;
    }

    /// @notice Returns the account that last activated the emergency stop.
    /// @return The activating address, or `address(0)` when inactive.
    function getEmergencyActivatedBy() external view returns (address) {
        return _emergencyActivatedBy;
    }

    /// @notice Returns when the emergency stop was last activated.
    /// @return Unix timestamp of activation, or zero when inactive.
    function getEmergencyActivatedAt() external view returns (uint256) {
        return _emergencyActivatedAt;
    }

    // -------------------------------------------------------------------------
    // Recovery Management
    // -------------------------------------------------------------------------

    /// @notice Starts the recovery workflow while an emergency is active.
    /// @dev Reverts unless the stop is active and no recovery is already running.
    function initiateRecovery() external onlyRole(RECOVERY_ROLE) {
        require(_emergencyActive, "Emergency not active");
        require(!_recoveryInProgress, "Recovery already in progress");
        
        _recoveryInProgress = true;
        emit RecoveryInitiated(msg.sender);
    }

    /// @notice Completes recovery and resets all emergency metadata.
    /// @dev This also deactivates the emergency stop.
    function completeRecovery() external onlyRole(RECOVERY_ROLE) {
        require(_recoveryInProgress, "Recovery not in progress");
        
        _recoveryInProgress = false;
        _emergencyActive = false;
        _emergencyReason = "";
        _emergencyActivatedBy = address(0);
        _emergencyActivatedAt = 0;
        
        emit RecoveryCompleted(msg.sender);
    }

    /// @notice Returns whether a recovery workflow is currently underway.
    /// @return True when recovery has been initiated but not completed.
    function isRecoveryInProgress() external view returns (bool) {
        return _recoveryInProgress;
    }

    // -------------------------------------------------------------------------
    // Permission Management
    // -------------------------------------------------------------------------

    /// @notice Grants the emergency responder role.
    /// @param account Address that should be allowed to toggle the stop.
    function grantEmergencyRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "Invalid address");
        _grantRole(EMERGENCY_ROLE, account);
    }

    /// @notice Revokes the emergency responder role.
    /// @param account Address that should no longer be allowed to toggle the stop.
    function revokeEmergencyRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "Invalid address");
        _revokeRole(EMERGENCY_ROLE, account);
    }

    /// @notice Grants the recovery operator role.
    /// @param account Address that should be allowed to run recovery.
    function grantRecoveryRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "Invalid address");
        _grantRole(RECOVERY_ROLE, account);
    }

    /// @notice Revokes the recovery operator role.
    /// @param account Address that should no longer be allowed to run recovery.
    function revokeRecoveryRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "Invalid address");
        _revokeRole(RECOVERY_ROLE, account);
    }

    /// @notice Checks whether an account has the emergency responder role.
    /// @param account Address to inspect.
    /// @return True when the account has `EMERGENCY_ROLE`.
    function hasEmergencyRole(address account) external view returns (bool) {
        return hasRole(EMERGENCY_ROLE, account);
    }

    /// @notice Checks whether an account has the recovery operator role.
    /// @param account Address to inspect.
    /// @return True when the account has `RECOVERY_ROLE`.
    function hasRecoveryRole(address account) external view returns (bool) {
        return hasRole(RECOVERY_ROLE, account);
    }

    // -------------------------------------------------------------------------
    // Modifiers for Protected Operations
    // -------------------------------------------------------------------------

    /// @notice Restricts execution to periods without an active emergency stop.
    modifier whenNotEmergency() {
        require(!_emergencyActive, "Emergency stop active");
        _;
    }

    /// @notice Restricts execution to periods with an active emergency stop.
    modifier whenEmergency() {
        require(_emergencyActive, "Emergency stop not active");
        _;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title MarketPauser
/// @notice Implements pausable functionality with role-based access control for market pause operations.
/// Supports emergency pausing and tracks all pause operations.
contract MarketPauser is Pausable, AccessControl {
    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant EMERGENCY_PAUSER_ROLE = keccak256("EMERGENCY_PAUSER_ROLE");

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event MarketPaused(address indexed pauser, string reason, bool isEmergency);
    event MarketUnpaused(address indexed unpauser);
    event PauserRoleGranted(address indexed account, address indexed grantor);
    event PauserRoleRevoked(address indexed account, address indexed revoker);
    event EmergencyPauserRoleGranted(address indexed account, address indexed grantor);
    event EmergencyPauserRoleRevoked(address indexed account, address indexed revoker);

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    /// @dev Tracks pause operation details
    struct PauseInfo {
        address pausedBy;
        uint64 pausedAt;
        string reason;
        bool isEmergency;
    }

    PauseInfo private _lastPauseInfo;
    uint256 private _totalPauseCount;
    bool private _emergencyPaused;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    /// @notice Initialize the MarketPauser with default admin and pauser roles.
    /// @param admin The address to grant DEFAULT_ADMIN_ROLE and PAUSER_ROLE.
    /// @param emergencyAdmin The address to grant EMERGENCY_PAUSER_ROLE.
    constructor(address admin, address emergencyAdmin) {
        require(admin != address(0), "Invalid admin address");
        require(emergencyAdmin != address(0), "Invalid emergency admin address");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(EMERGENCY_PAUSER_ROLE, emergencyAdmin);
    }

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------
    modifier onlyPauser() {
        if (!hasRole(PAUSER_ROLE, msg.sender) && !hasRole(EMERGENCY_PAUSER_ROLE, msg.sender)) {
            revert AccessControl.AccessDenied();
        }
        _;
    }

    modifier onlyEmergencyPauser() {
        if (!hasRole(EMERGENCY_PAUSER_ROLE, msg.sender)) {
            revert AccessControl.AccessDenied();
        }
        _;
    }

    // -------------------------------------------------------------------------
    // Pause Management
    // -------------------------------------------------------------------------
    
    /// @notice Pause the market with a reason.
    /// @dev Can be called by any account with PAUSER_ROLE or EMERGENCY_PAUSER_ROLE.
    /// @param reason The reason for pausing the market.
    function pause(string calldata reason) external onlyPauser {
        require(!paused(), "Market already paused");
        require(bytes(reason).length > 0, "Reason required");

        bool isEmergency = hasRole(EMERGENCY_PAUSER_ROLE, msg.sender);
        
        _lastPauseInfo = PauseInfo({
            pausedBy: msg.sender,
            pausedAt: uint64(block.timestamp),
            reason: reason,
            isEmergency: isEmergency
        });
        
        _totalPauseCount += 1;
        _emergencyPaused = isEmergency;

        _pause();
        emit MarketPaused(msg.sender, reason, isEmergency);
    }

    /// @notice Unpause the market.
    /// @dev Can only be called by accounts with PAUSER_ROLE or EMERGENCY_PAUSER_ROLE.
    function unpause() external onlyPauser {
        require(paused(), "Market not paused");

        _emergencyPaused = false;
        _unpause();
        emit MarketUnpaused(msg.sender);
    }

    /// @notice Emergency pause the market without a reason.
    /// @dev Can only be called by accounts with EMERGENCY_PAUSER_ROLE.
    /// This is for critical situations where speed is essential.
    function emergencyPause() external onlyEmergencyPauser {
        require(!paused(), "Market already paused");

        _lastPauseInfo = PauseInfo({
            pausedBy: msg.sender,
            pausedAt: uint64(block.timestamp),
            reason: "Emergency pause",
            isEmergency: true
        });
        
        _totalPauseCount += 1;
        _emergencyPaused = true;

        _pause();
        emit MarketPaused(msg.sender, "Emergency pause", true);
    }

    // -------------------------------------------------------------------------
    // Role Management
    // -------------------------------------------------------------------------
    
    /// @notice Grant PAUSER_ROLE to an account.
    /// @dev Can only be called by DEFAULT_ADMIN_ROLE.
    /// @param account The account to grant the role to.
    function grantPauserRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "Invalid address");
        grantRole(PAUSER_ROLE, account);
        emit PauserRoleGranted(account, msg.sender);
    }

    /// @notice Revoke PAUSER_ROLE from an account.
    /// @dev Can only be called by DEFAULT_ADMIN_ROLE.
    /// @param account The account to revoke the role from.
    function revokePauserRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(hasRole(PAUSER_ROLE, account), "Account does not have pauser role");
        revokeRole(PAUSER_ROLE, account);
        emit PauserRoleRevoked(account, msg.sender);
    }

    /// @notice Grant EMERGENCY_PAUSER_ROLE to an account.
    /// @dev Can only be called by DEFAULT_ADMIN_ROLE.
    /// @param account The account to grant the role to.
    function grantEmergencyPauserRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "Invalid address");
        grantRole(EMERGENCY_PAUSER_ROLE, account);
        emit EmergencyPauserRoleGranted(account, msg.sender);
    }

    /// @notice Revoke EMERGENCY_PAUSER_ROLE from an account.
    /// @dev Can only be called by DEFAULT_ADMIN_ROLE.
    /// @param account The account to revoke the role from.
    function revokeEmergencyPauserRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(hasRole(EMERGENCY_PAUSER_ROLE, account), "Account does not have emergency pauser role");
        revokeRole(EMERGENCY_PAUSER_ROLE, account);
        emit EmergencyPauserRoleRevoked(account, msg.sender);
    }

    // -------------------------------------------------------------------------
    // Query Functions
    // -------------------------------------------------------------------------
    
    /// @notice Check if the market is currently paused.
    /// @return True if paused, false otherwise.
    function isPaused() external view returns (bool) {
        return paused();
    }

    /// @notice Check if the market is in emergency pause state.
    /// @return True if emergency paused, false otherwise.
    function isEmergencyPaused() external view returns (bool) {
        return _emergencyPaused;
    }

    /// @notice Get the address that last paused the market.
    /// @return The address of the last pauser.
    function getPausedBy() external view returns (address) {
        return _lastPauseInfo.pausedBy;
    }

    /// @notice Get the timestamp when the market was last paused.
    /// @return The timestamp of the last pause.
    function getPausedAt() external view returns (uint256) {
        return _lastPauseInfo.pausedAt;
    }

    /// @notice Get the reason for the last pause.
    /// @return The reason string.
    function getPauseReason() external view returns (string memory) {
        return _lastPauseInfo.reason;
    }

    /// @notice Check if the last pause was an emergency pause.
    /// @return True if the last pause was emergency, false otherwise.
    function getLastPauseIsEmergency() external view returns (bool) {
        return _lastPauseInfo.isEmergency;
    }

    /// @notice Get complete pause information for the last pause operation.
    /// @return pausedBy The address that paused.
    /// @return pausedAt The timestamp of pause.
    /// @return reason The reason for pause.
    /// @return isEmergency Whether it was an emergency pause.
    function getLastPauseInfo() external view returns (
        address pausedBy,
        uint256 pausedAt,
        string memory reason,
        bool isEmergency
    ) {
        return (
            _lastPauseInfo.pausedBy,
            _lastPauseInfo.pausedAt,
            _lastPauseInfo.reason,
            _lastPauseInfo.isEmergency
        );
    }

    /// @notice Get the total number of pause operations.
    /// @return The count of pause operations.
    function getTotalPauseCount() external view returns (uint256) {
        return _totalPauseCount;
    }

    /// @notice Check if an account has PAUSER_ROLE.
    /// @param account The account to check.
    /// @return True if the account has pauser role.
    function isPauser(address account) external view returns (bool) {
        return hasRole(PAUSER_ROLE, account);
    }

    /// @notice Check if an account has EMERGENCY_PAUSER_ROLE.
    /// @param account The account to check.
    /// @return True if the account has emergency pauser role.
    function isEmergencyPauser(address account) external view returns (bool) {
        return hasRole(EMERGENCY_PAUSER_ROLE, account);
    }

    /// @notice Check if an account has either pauser or emergency pauser role.
    /// @param account The account to check.
    /// @return True if the account can pause.
    function canPause(address account) external view returns (bool) {
        return hasRole(PAUSER_ROLE, account) || hasRole(EMERGENCY_PAUSER_ROLE, account);
    }
}

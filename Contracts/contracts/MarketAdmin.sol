// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title MarketAdmin
/// @notice Manages admin roles and permissions for market operations.
contract MarketAdmin is AccessControl {
    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MARKET_OPERATOR_ROLE = keccak256("MARKET_OPERATOR_ROLE");

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
    event OperatorAdded(address indexed operator);
    event OperatorRemoved(address indexed operator);

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    address private _currentAdmin;
    address[] private _adminHistory;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(address initialAdmin) {
        require(initialAdmin != address(0), "Invalid admin address");
        
        _currentAdmin = initialAdmin;
        _adminHistory.push(initialAdmin);
        
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(ADMIN_ROLE, initialAdmin);
    }

    // -------------------------------------------------------------------------
    // Admin Management
    // -------------------------------------------------------------------------

    /// @notice Transfer admin role to a new address.
    /// @param newAdmin The address to transfer admin role to.
    function transferAdmin(address newAdmin) external onlyRole(ADMIN_ROLE) {
        require(newAdmin != address(0), "Invalid admin address");
        require(newAdmin != _currentAdmin, "Already admin");
        
        address previousAdmin = _currentAdmin;
        
        _revokeRole(ADMIN_ROLE, previousAdmin);
        _revokeRole(DEFAULT_ADMIN_ROLE, previousAdmin);
        
        _currentAdmin = newAdmin;
        _adminHistory.push(newAdmin);
        
        _grantRole(DEFAULT_ADMIN_ROLE, newAdmin);
        _grantRole(ADMIN_ROLE, newAdmin);
        
        emit AdminTransferred(previousAdmin, newAdmin);
    }

    /// @notice Get the current admin address.
    function getCurrentAdmin() external view returns (address) {
        return _currentAdmin;
    }

    /// @notice Get the admin history.
    function getAdminHistory() external view returns (address[] memory) {
        return _adminHistory;
    }

    // -------------------------------------------------------------------------
    // Operator Management
    // -------------------------------------------------------------------------

    /// @notice Add a market operator.
    /// @param operator The address to grant operator role to.
    function addOperator(address operator) external onlyRole(ADMIN_ROLE) {
        require(operator != address(0), "Invalid operator address");
        _grantRole(MARKET_OPERATOR_ROLE, operator);
        emit OperatorAdded(operator);
    }

    /// @notice Remove a market operator.
    /// @param operator The address to revoke operator role from.
    function removeOperator(address operator) external onlyRole(ADMIN_ROLE) {
        require(operator != address(0), "Invalid operator address");
        _revokeRole(MARKET_OPERATOR_ROLE, operator);
        emit OperatorRemoved(operator);
    }

    /// @notice Check if an address is an operator.
    /// @param operator The address to check.
    function isOperator(address operator) external view returns (bool) {
        return hasRole(MARKET_OPERATOR_ROLE, operator);
    }

    /// @notice Check if an address is an admin.
    /// @param admin The address to check.
    function isAdmin(address admin) external view returns (bool) {
        return hasRole(ADMIN_ROLE, admin);
    }
}

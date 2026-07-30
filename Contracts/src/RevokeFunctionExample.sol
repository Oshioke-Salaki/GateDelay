// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./RevokeFunction.sol";

/// @title RevokeFunctionExample
/// @notice Example contract demonstrating how to integrate RevokeFunction for access control
/// @dev This contract shows various patterns for using RevokeFunction in real-world scenarios
contract RevokeFunctionExample {
    // -------------------------------------------------------------------------
    // State Variables
    // -------------------------------------------------------------------------
    
    RevokeFunction public immutable revokeFunction;
    address public owner;
    
    uint256 public totalExecutions;
    uint256 public totalTransfers;
    uint256 public totalMints;
    
    mapping(address => uint256) public userExecutions;
    mapping(address => uint256) public userTransfers;
    mapping(address => uint256) public balances;
    
    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    
    event FunctionExecuted(address indexed user, uint256 timestamp);
    event TokensTransferred(address indexed from, address indexed to, uint256 amount);
    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);
    event AdminActionPerformed(address indexed admin, string action);
    
    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------
    
    error NotAuthorized();
    error InsufficientBalance();
    error InvalidAmount();
    error ContractRevoked();
    
    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    
    constructor(address _revokeFunction) {
        revokeFunction = RevokeFunction(_revokeFunction);
        owner = msg.sender;
    }
    
    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------
    
    /// @notice Requires caller to have execute permission
    modifier onlyExecutor() {
        if (!revokeFunction.hasPermission(msg.sender, revokeFunction.EXECUTE_PERMISSION())) {
            revert NotAuthorized();
        }
        _;
    }
    
    /// @notice Requires caller to have transfer permission
    modifier onlyTransferer() {
        if (!revokeFunction.hasPermission(msg.sender, revokeFunction.TRANSFER_PERMISSION())) {
            revert NotAuthorized();
        }
        _;
    }
    
    /// @notice Requires caller to have mint permission
    modifier onlyMinter() {
        if (!revokeFunction.hasPermission(msg.sender, revokeFunction.MINT_PERMISSION())) {
            revert NotAuthorized();
        }
        _;
    }
    
    /// @notice Requires caller to have burn permission
    modifier onlyBurner() {
        if (!revokeFunction.hasPermission(msg.sender, revokeFunction.BURN_PERMISSION())) {
            revert NotAuthorized();
        }
        _;
    }
    
    /// @notice Requires caller to have admin permission
    modifier onlyAdmin() {
        if (!revokeFunction.hasPermission(msg.sender, revokeFunction.ADMIN_PERMISSION())) {
            revert NotAuthorized();
        }
        _;
    }
    
    /// @notice Checks if this contract is not revoked
    modifier notRevoked() {
        if (revokeFunction.isContractRevoked(address(this))) {
            revert ContractRevoked();
        }
        _;
    }
    
    // -------------------------------------------------------------------------
    // Example Functions with Single Permission
    // -------------------------------------------------------------------------
    
    /// @notice Execute a function (requires EXECUTE_PERMISSION)
    function execute() external onlyExecutor notRevoked {
        userExecutions[msg.sender]++;
        totalExecutions++;
        
        emit FunctionExecuted(msg.sender, block.timestamp);
    }
    
    /// @notice Transfer tokens (requires TRANSFER_PERMISSION)
    function transfer(address to, uint256 amount) external onlyTransferer notRevoked {
        if (balances[msg.sender] < amount) revert InsufficientBalance();
        if (amount == 0) revert InvalidAmount();
        
        balances[msg.sender] -= amount;
        balances[to] += amount;
        
        userTransfers[msg.sender]++;
        totalTransfers++;
        
        emit TokensTransferred(msg.sender, to, amount);
    }
    
    /// @notice Mint tokens (requires MINT_PERMISSION)
    function mint(address to, uint256 amount) external onlyMinter notRevoked {
        if (amount == 0) revert InvalidAmount();
        
        balances[to] += amount;
        totalMints++;
        
        emit TokensMinted(to, amount);
    }
    
    /// @notice Burn tokens (requires BURN_PERMISSION)
    function burn(uint256 amount) external onlyBurner notRevoked {
        if (balances[msg.sender] < amount) revert InsufficientBalance();
        if (amount == 0) revert InvalidAmount();
        
        balances[msg.sender] -= amount;
        
        emit TokensBurned(msg.sender, amount);
    }
    
    // -------------------------------------------------------------------------
    // Example Functions with Multiple Permissions
    // -------------------------------------------------------------------------
    
    /// @notice Admin function requiring multiple permissions
    /// @dev Requires both ADMIN_PERMISSION and EXECUTE_PERMISSION
    function adminExecute(string calldata action) external notRevoked {
        bytes32[] memory required = new bytes32[](2);
        required[0] = revokeFunction.ADMIN_PERMISSION();
        required[1] = revokeFunction.EXECUTE_PERMISSION();
        
        if (!revokeFunction.hasAllPermissions(msg.sender, required)) {
            revert NotAuthorized();
        }
        
        emit AdminActionPerformed(msg.sender, action);
    }
    
    /// @notice Function requiring any of multiple permissions
    /// @dev Requires either ADMIN_PERMISSION or EXECUTE_PERMISSION
    function flexibleExecute() external notRevoked {
        bytes32[] memory accepted = new bytes32[](2);
        accepted[0] = revokeFunction.ADMIN_PERMISSION();
        accepted[1] = revokeFunction.EXECUTE_PERMISSION();
        
        if (!revokeFunction.hasAnyPermission(msg.sender, accepted)) {
            revert NotAuthorized();
        }
        
        totalExecutions++;
        emit FunctionExecuted(msg.sender, block.timestamp);
    }
    
    /// @notice Privileged transfer requiring admin permission
    function adminTransfer(address from, address to, uint256 amount) external onlyAdmin notRevoked {
        if (balances[from] < amount) revert InsufficientBalance();
        if (amount == 0) revert InvalidAmount();
        
        balances[from] -= amount;
        balances[to] += amount;
        
        emit TokensTransferred(from, to, amount);
    }
    
    // -------------------------------------------------------------------------
    // View Functions
    // -------------------------------------------------------------------------
    
    /// @notice Check if user can execute
    function canExecute(address user) external view returns (bool) {
        return revokeFunction.hasPermission(user, revokeFunction.EXECUTE_PERMISSION());
    }
    
    /// @notice Check if user can transfer
    function canTransfer(address user) external view returns (bool) {
        return revokeFunction.hasPermission(user, revokeFunction.TRANSFER_PERMISSION());
    }
    
    /// @notice Check if user can mint
    function canMint(address user) external view returns (bool) {
        return revokeFunction.hasPermission(user, revokeFunction.MINT_PERMISSION());
    }
    
    /// @notice Check if user can burn
    function canBurn(address user) external view returns (bool) {
        return revokeFunction.hasPermission(user, revokeFunction.BURN_PERMISSION());
    }
    
    /// @notice Check if user is admin
    function isAdmin(address user) external view returns (bool) {
        return revokeFunction.hasPermission(user, revokeFunction.ADMIN_PERMISSION());
    }
    
    /// @notice Get all permissions for a user
    function getUserPermissions(address user) external view returns (bytes32[] memory) {
        return revokeFunction.getAccountPermissions(user);
    }
    
    /// @notice Get user's permission count
    function getUserPermissionCount(address user) external view returns (uint256) {
        return revokeFunction.getAccountPermissionCount(user);
    }
    
    /// @notice Check if this contract is revoked
    function isRevoked() external view returns (bool) {
        return revokeFunction.isContractRevoked(address(this));
    }
    
    /// @notice Get revocation details for this contract
    function getRevocationDetails() external view returns (RevokeFunction.ContractRevocation memory) {
        return revokeFunction.getContractRevocation(address(this));
    }
    
    /// @notice Get user's revocation history
    function getUserRevocationHistory(address user) 
        external 
        view 
        returns (RevokeFunction.PartialRevoke[] memory) 
    {
        return revokeFunction.getPartialRevokes(user);
    }
    
    /// @notice Get user's recent revocations
    function getUserRecentRevocations(address user, uint256 count) 
        external 
        view 
        returns (RevokeFunction.PartialRevoke[] memory) 
    {
        return revokeFunction.getRecentPartialRevokes(user, count);
    }
    
    // -------------------------------------------------------------------------
    // Utility Functions
    // -------------------------------------------------------------------------
    
    /// @notice Get user statistics
    function getUserStats(address user) 
        external 
        view 
        returns (
            uint256 executions,
            uint256 transfers,
            uint256 balance,
            uint256 permissionCount
        ) 
    {
        executions = userExecutions[user];
        transfers = userTransfers[user];
        balance = balances[user];
        permissionCount = revokeFunction.getAccountPermissionCount(user);
    }
    
    /// @notice Get contract statistics
    function getContractStats() 
        external 
        view 
        returns (
            uint256 executions,
            uint256 transfers,
            uint256 mints,
            bool revoked
        ) 
    {
        executions = totalExecutions;
        transfers = totalTransfers;
        mints = totalMints;
        revoked = revokeFunction.isContractRevoked(address(this));
    }
    
    /// @notice Check if user has elevated privileges
    function hasElevatedPrivileges(address user) external view returns (bool) {
        bytes32[] memory elevated = new bytes32[](2);
        elevated[0] = revokeFunction.ADMIN_PERMISSION();
        elevated[1] = revokeFunction.MINT_PERMISSION();
        
        return revokeFunction.hasAnyPermission(user, elevated);
    }
    
    /// @notice Check if user has full access
    function hasFullAccess(address user) external view returns (bool) {
        bytes32[] memory allPerms = new bytes32[](5);
        allPerms[0] = revokeFunction.EXECUTE_PERMISSION();
        allPerms[1] = revokeFunction.TRANSFER_PERMISSION();
        allPerms[2] = revokeFunction.MINT_PERMISSION();
        allPerms[3] = revokeFunction.BURN_PERMISSION();
        allPerms[4] = revokeFunction.ADMIN_PERMISSION();
        
        return revokeFunction.hasAllPermissions(user, allPerms);
    }
}

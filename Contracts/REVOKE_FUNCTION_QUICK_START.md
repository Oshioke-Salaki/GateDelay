# RevokeFunction Quick Start Guide

## Installation

1. Ensure you have Foundry installed:
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

2. Install dependencies:
```bash
forge install
```

3. Build the contract:
```bash
forge build
```

4. Run tests:
```bash
forge test --match-contract RevokeFunctionTest -vv
```

## Quick Usage

### Deploy
```solidity
RevokeFunction revokeFunc = new RevokeFunction();
```

### Grant Permission
```solidity
// Single permission
revokeFunc.grantPermission(userAddress, revokeFunc.EXECUTE_PERMISSION());

// Multiple permissions
bytes32[] memory perms = new bytes32[](2);
perms[0] = revokeFunc.EXECUTE_PERMISSION();
perms[1] = revokeFunc.TRANSFER_PERMISSION();
revokeFunc.grantPermissions(userAddress, perms);
```

### Revoke Permission
```solidity
// Single permission
revokeFunc.revokePermission(userAddress, revokeFunc.EXECUTE_PERMISSION(), "Reason");

// Multiple permissions (partial revoke)
bytes32[] memory perms = new bytes32[](2);
perms[0] = revokeFunc.EXECUTE_PERMISSION();
perms[1] = revokeFunc.TRANSFER_PERMISSION();
revokeFunc.revokePermissions(userAddress, perms, "Reason");

// All permissions
revokeFunc.revokeAllPermissions(userAddress, "Reason");
```

### Check Permission
```solidity
bool hasPermission = revokeFunc.hasPermission(userAddress, revokeFunc.EXECUTE_PERMISSION());
```

### Revoke Contract
```solidity
// Revoke
revokeFunc.revokeContract(contractAddress, "Security issue");

// Check status
bool isRevoked = revokeFunc.isContractRevoked(contractAddress);

// Reinstate
revokeFunc.reinstateContract(contractAddress);
```

### Query Operations
```solidity
// Get user's permissions
bytes32[] memory permissions = revokeFunc.getAccountPermissions(userAddress);

// Get permission holders
address[] memory holders = revokeFunc.getPermissionHolders(revokeFunc.EXECUTE_PERMISSION());

// Get revocation history
RevokeFunction.PartialRevoke[] memory revokes = revokeFunc.getPartialRevokes(userAddress);

// Get revoked contracts
address[] memory revokedContracts = revokeFunc.getAllRevokedContracts();
```

## Common Patterns

### Pattern 1: Role-Based Access Control
```solidity
contract MyContract {
    RevokeFunction public revokeFunc;
    
    constructor(address _revokeFunc) {
        revokeFunc = RevokeFunction(_revokeFunc);
    }
    
    modifier onlyExecutor() {
        require(
            revokeFunc.hasPermission(msg.sender, revokeFunc.EXECUTE_PERMISSION()),
            "Not authorized"
        );
        _;
    }
    
    function execute() external onlyExecutor {
        // Protected function
    }
}
```

### Pattern 2: Multi-Permission Check
```solidity
function adminFunction() external {
    bytes32[] memory required = new bytes32[](2);
    required[0] = revokeFunc.ADMIN_PERMISSION();
    required[1] = revokeFunc.EXECUTE_PERMISSION();
    
    require(
        revokeFunc.hasAllPermissions(msg.sender, required),
        "Missing required permissions"
    );
    
    // Admin function logic
}
```

### Pattern 3: Audit Trail
```solidity
function auditUser(address user) external view returns (
    bytes32[] memory currentPermissions,
    RevokeFunction.PartialRevoke[] memory revokeHistory
) {
    currentPermissions = revokeFunc.getAccountPermissions(user);
    revokeHistory = revokeFunc.getPartialRevokes(user);
}
```

### Pattern 4: Contract Status Check
```solidity
function isContractActive(address contractAddr) external view returns (bool) {
    if (revokeFunc.isContractRevoked(contractAddr)) {
        RevokeFunction.RevocationStatus status = revokeFunc.getRevocationStatus(contractAddr);
        return status == RevokeFunction.RevocationStatus.Active;
    }
    return true;
}
```

## Testing Your Integration

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "./RevokeFunction.sol";

contract MyIntegrationTest is Test {
    RevokeFunction revokeFunc;
    address owner = address(0x1);
    address user = address(0x2);
    
    function setUp() public {
        vm.prank(owner);
        revokeFunc = new RevokeFunction();
    }
    
    function testIntegration() public {
        // Grant permission
        vm.prank(owner);
        revokeFunc.grantPermission(user, revokeFunc.EXECUTE_PERMISSION());
        
        // Verify
        assertTrue(revokeFunc.hasPermission(user, revokeFunc.EXECUTE_PERMISSION()));
        
        // Revoke
        vm.prank(owner);
        revokeFunc.revokePermission(user, revokeFunc.EXECUTE_PERMISSION(), "Test");
        
        // Verify
        assertFalse(revokeFunc.hasPermission(user, revokeFunc.EXECUTE_PERMISSION()));
    }
}
```

## Troubleshooting

### Issue: "Ownable: caller is not the owner"
**Solution**: Ensure you're calling administrative functions from the owner address.

### Issue: "PermissionNotGranted"
**Solution**: Grant the permission before trying to revoke it.

### Issue: "ContractAlreadyRevoked"
**Solution**: Check if contract is already revoked before revoking again.

### Issue: Gas costs too high
**Solution**: Use batch operations (`grantPermissions`, `revokePermissions`) instead of individual calls.

## Best Practices

1. **Always provide meaningful reasons** when revoking permissions for audit trail
2. **Use batch operations** when dealing with multiple permissions
3. **Check permissions before operations** to fail fast
4. **Monitor revocation history** for compliance and security
5. **Test thoroughly** before deploying to production
6. **Use events** to track all permission changes
7. **Document custom permissions** if you add new permission types

## Performance Tips

- Use `hasPermission()` for single permission checks (O(1))
- Use `hasAnyPermission()` when user needs at least one permission
- Use `hasAllPermissions()` when user needs all permissions
- Cache permission checks if checking multiple times in same transaction
- Use `getRecentPartialRevokes()` instead of `getPartialRevokes()` for large histories

## Security Checklist

- [ ] Only owner can grant/revoke permissions
- [ ] All permission changes are logged via events
- [ ] Revocation reasons are recorded for audit
- [ ] Input validation prevents invalid states
- [ ] No reentrancy vulnerabilities
- [ ] Gas limits are reasonable
- [ ] Tests cover all edge cases
- [ ] Access control is properly implemented

## Next Steps

1. Review the full documentation: `REVOKE_FUNCTION_DOCUMENTATION.md`
2. Examine the test suite: `test/RevokeFunction.t.sol`
3. Integrate into your contract
4. Write integration tests
5. Deploy to testnet
6. Audit before mainnet deployment

## Support

For issues or questions:
- Review the test suite for examples
- Check the full documentation
- Examine the contract source code
- Test on a local network first

## Version History

- **v1.0.0** - Initial release with full revoke functionality

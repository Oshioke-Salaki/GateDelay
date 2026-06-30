# FlashBorrow - Quick Start Guide

## What is FlashBorrow?

FlashBorrow enables users to borrow tokens within a single transaction, with mandatory repayment before the transaction completes. This is useful for arbitrage, liquidations, and other capital-efficient strategies.

## Key Features

- ⚡ **Flash Loans**: Borrow and repay in one transaction
- 🔒 **Secure**: Reentrancy protection and balance verification
- 📊 **Activity Tracking**: Monitor borrowing patterns
- 🎯 **Flexible Limits**: Per-account and global borrow caps
- 🔍 **Query Functions**: Comprehensive data access

## Quick Start

### Deploy the Contract

```solidity
// Deploy with initial owner and global limit
FlashBorrow flashBorrow = new FlashBorrow(
    ownerAddress,      // Initial owner
    1000000 ether      // Global borrow limit (0 = unlimited)
);
```

### Implement a Borrower

```solidity
contract MyBorrower is IFlashBorrowReceiver {
    function executeFlashBorrow(
        address token,
        uint256 amount,
        bytes calldata data
    ) external override {
        // 1. Use the borrowed tokens
        // ... your logic ...
        
        // 2. Repay the loan (REQUIRED!)
        IERC20(token).transfer(msg.sender, amount);
    }
}
```

### Execute a Flash Borrow

```solidity
flashBorrow.flashBorrow(
    tokenAddress,           // Token to borrow
    100 ether,             // Amount to borrow
    address(myBorrower),   // Receiver contract
    ""                     // Optional data
);
```

## Administrative Functions

```solidity
// Set per-account limit
flashBorrow.setBorrowLimit(userAddress, 500 ether);

// Set global limit
flashBorrow.setGlobalBorrowLimit(10000 ether);
```

## Query Functions

```solidity
// Check limits
uint256 accountLimit = flashBorrow.borrowLimit(userAddress);
uint256 globalLimit = flashBorrow.globalBorrowLimit();
uint256 remaining = flashBorrow.remainingBorrowLimit(userAddress);

// Check activity
uint256 count = flashBorrow.borrowCount(userAddress);
uint256 total = flashBorrow.totalBorrowed(userAddress);
uint256 lastBlock = flashBorrow.lastBorrowBlock(userAddress);
```

## Important Notes

⚠️ **Repayment is Mandatory**: The borrowed amount MUST be returned before the transaction ends, or it will revert.

⚠️ **Receiver Must Be Contract**: The receiver address must be a deployed contract implementing `IFlashBorrowReceiver`.

⚠️ **Reentrancy Protected**: The contract uses OpenZeppelin's ReentrancyGuard for security.

## Testing

Run the comprehensive test suite:

```bash
cd Contracts
forge test --match-contract FlashBorrowTest -vvv
```

## Files

- **Contract**: `contracts/FlashBorrow.sol`
- **Tests**: `test/FlashBorrow.t.sol`
- **Documentation**: `FLASHBORROW_DOCUMENTATION.md`

## Support

For detailed documentation, see `FLASHBORROW_DOCUMENTATION.md`.

## License

MIT

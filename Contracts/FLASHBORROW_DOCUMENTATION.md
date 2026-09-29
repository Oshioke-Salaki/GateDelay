# FlashBorrow Implementation Documentation

## Overview
The FlashBorrow contract enables flash loan functionality for markets, allowing users to borrow tokens within a single transaction with mandatory same-transaction repayment.

## Features Implemented

### ✅ 1. Flash Borrowing Support
- **Function**: `flashBorrow(address token, uint256 amount, address receiver, bytes calldata data)`
- Allows borrowing of ERC20 tokens with same-transaction repayment
- Uses reentrancy protection for security
- Validates receiver is a contract
- Checks sufficient liquidity before lending

### ✅ 2. Borrow Repayments
- **Automatic Verification**: Ensures borrowed amount is returned before transaction completes
- **Callback Pattern**: Receiver must implement `IFlashBorrowReceiver` interface
- **Repayment Enforcement**: Reverts with `RepaymentRequired` error if funds not returned
- **Event Emission**: Emits `FlashBorrowRepaid` event on successful repayment

### ✅ 3. Borrow Limits Control
- **Per-Account Limits**: `setBorrowLimit(address account, uint256 limit)` - Owner can set individual borrower limits
- **Global Limits**: `setGlobalBorrowLimit(uint256 limit)` - Owner can set system-wide borrow cap
- **Flexible Configuration**: 0 value means unlimited
- **Effective Limit**: Uses the minimum of account and global limits
- **Events**: Emits `BorrowLimitUpdated` and `GlobalBorrowLimitUpdated` events

### ✅ 4. Activity Tracking
- **Borrow Count**: Tracks number of flash borrows per address
- **Total Borrowed**: Cumulative amount borrowed by each address
- **Last Borrow Block**: Records block number of most recent borrow
- **Persistent Storage**: Activity data stored in `BorrowActivity` struct

### ✅ 5. Borrow Queries
- `borrowLimit(address account)` - Returns per-account borrow limit
- `globalBorrowLimit()` - Returns global borrow limit
- `borrowCount(address borrower)` - Returns number of borrows
- `totalBorrowed(address borrower)` - Returns cumulative borrowed amount
- `lastBorrowBlock(address borrower)` - Returns last borrow block number
- `remainingBorrowLimit(address account)` - Returns effective remaining limit

## Technical Implementation

### Security Features
1. **ReentrancyGuard**: Prevents reentrancy attacks
2. **Ownable**: Access control for administrative functions
3. **SafeERC20**: Safe token transfer operations
4. **Input Validation**: Checks for zero addresses and amounts
5. **Balance Verification**: Ensures repayment before state updates

### Contract Architecture
```solidity
FlashBorrow
├── Ownable (OpenZeppelin)
├── ReentrancyGuard (OpenZeppelin)
└── SafeERC20 (OpenZeppelin)
```

### State Variables
- `_borrowLimit`: Mapping of per-account borrow limits
- `_borrowActivity`: Mapping of borrower activity data
- `_globalBorrowLimit`: System-wide borrow cap

### Events
- `FlashBorrowExecuted`: Emitted when flash borrow is initiated
- `FlashBorrowRepaid`: Emitted when flash borrow is repaid
- `BorrowLimitUpdated`: Emitted when account limit is updated
- `GlobalBorrowLimitUpdated`: Emitted when global limit is updated

### Custom Errors
- `ZeroAddress`: Invalid zero address provided
- `ZeroAmount`: Invalid zero amount provided
- `InsufficientLiquidity`: Not enough tokens in contract
- `BorrowLimitExceeded`: Borrow amount exceeds limit
- `UnsupportedReceiver`: Receiver is not a contract
- `RepaymentRequired`: Borrowed funds not returned

## Testing

### Test Coverage
The test suite (`FlashBorrow.t.sol`) includes:

1. **Successful Flash Borrow**: Verifies basic functionality
2. **Event Emission**: Checks all events are emitted correctly
3. **Repayment Enforcement**: Tests repayment requirement
4. **Borrow Limit Enforcement**: Tests per-account limits
5. **Global Limit Enforcement**: Tests system-wide limits
6. **Activity Accumulation**: Tests tracking across multiple borrows
7. **Access Control**: Tests owner-only functions
8. **Remaining Limit Calculation**: Tests effective limit calculation

### Running Tests
```bash
cd Contracts
forge test --match-contract FlashBorrowTest -vvv
```

## Usage Example

### For Borrowers
```solidity
// 1. Implement IFlashBorrowReceiver
contract MyFlashBorrower is IFlashBorrowReceiver {
    function executeFlashBorrow(
        address token,
        uint256 amount,
        bytes calldata data
    ) external override {
        // Use borrowed tokens
        // ... your logic here ...
        
        // Repay the loan
        IERC20(token).transfer(msg.sender, amount);
    }
}

// 2. Execute flash borrow
flashBorrow.flashBorrow(
    tokenAddress,
    borrowAmount,
    address(myBorrower),
    customData
);
```

### For Administrators
```solidity
// Set per-account limit
flashBorrow.setBorrowLimit(borrowerAddress, 1000 ether);

// Set global limit
flashBorrow.setGlobalBorrowLimit(10000 ether);

// Query activity
uint256 count = flashBorrow.borrowCount(borrowerAddress);
uint256 total = flashBorrow.totalBorrowed(borrowerAddress);
```

## Integration with Markets

The FlashBorrow contract can be integrated with market contracts to:
1. Provide liquidity for arbitrage opportunities
2. Enable capital-efficient trading strategies
3. Support liquidation mechanisms
4. Facilitate market making activities

## Gas Optimization

The contract uses several gas optimization techniques:
1. Custom errors instead of revert strings
2. Efficient storage packing in `BorrowActivity` struct
3. Minimal state updates
4. SafeERC20 for optimized token operations

## Acceptance Criteria Status

| Criteria | Status | Evidence |
|----------|--------|----------|
| Borrowing is supported | ✅ | `flashBorrow()` function implemented |
| Repayments work | ✅ | Balance verification and `RepaymentRequired` error |
| Limits are controlled | ✅ | `setBorrowLimit()` and `setGlobalBorrowLimit()` |
| Activity is tracked | ✅ | `BorrowActivity` struct with count, total, and block |
| Queries work | ✅ | 6 query functions implemented |

## Dependencies

- OpenZeppelin Contracts v5.0+
  - `@openzeppelin/contracts/access/Ownable.sol`
  - `@openzeppelin/contracts/utils/ReentrancyGuard.sol`
  - `@openzeppelin/contracts/token/ERC20/IERC20.sol`
  - `@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol`

## License

MIT License

## Version

Solidity: ^0.8.24

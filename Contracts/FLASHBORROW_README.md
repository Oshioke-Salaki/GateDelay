# FlashBorrow - Quick Start Guide

## What is FlashBorrow?

FlashBorrow enables users to borrow tokens within a single transaction, with mandatory repayment before the transaction completes. This is useful for arbitrage, liquidations, and other capital-efficient strategies.

## Key Features

- ⚡ **Flash Loans**: Borrow and repay in one transaction
- 🔒 **Secure**: Reentrancy protection and balance verification
- 📊 **Activity Tracking**: Monitor borrowing patterns
- 🎯 **Flexible Limits**: Per-account and global borrow caps
- 🔍 **Query Functions**: Comprehensive data access

## Requirements & pinned dependencies

Build and test this contract with the exact versions pinned in the repo — do not
let them float. Bump deliberately and in one place.

| Dependency | Pinned version | Pinned in |
|---|---|---|
| Solidity (`solc`) | `0.8.28` | `Contracts/foundry.toml` → `[profile.default] solc` |
| Contract pragma | `^0.8.20` | `src/FlashBorrow.sol` |
| Foundry / `forge` | `1.1.0` | `Contracts/foundry.toml` → `[toolchain] forge`; `.github/workflows/*` |
| OpenZeppelin Contracts | `v5.6.1` | `Contracts/foundry.lock` → `lib/openzeppelin-contracts` |
| `forge-std` | `v1.16.0` | `Contracts/foundry.lock` → `lib/forge-std` |

`FlashBorrow` imports `Ownable`, `ReentrancyGuard`, `IERC20`, and `SafeERC20`
from `@openzeppelin/contracts` (remapped in `Contracts/remappings.txt`). It
targets OpenZeppelin `v5.x`, whose `Ownable` requires an initial owner — the
`FlashBorrow` constructor supplies `msg.sender`, so the deployer becomes the
owner and only the global limit is passed at deploy time.

## Quick Start

### Deploy the Contract

```solidity
// The deployer (msg.sender) becomes the owner; only the global limit is passed.
FlashBorrow flashBorrow = new FlashBorrow(
    1_000_000 ether     // Global borrow limit (0 = unlimited)
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

- **Contract**: `Contracts/src/FlashBorrow.sol`
- **Tests**: `Contracts/test/FlashBorrow.t.sol` (contract `FlashBorrowTest`)
- **Documentation**: `Contracts/FLASHBORROW_DOCUMENTATION.md`

## Support

For detailed documentation, see `FLASHBORROW_DOCUMENTATION.md`.

## License

MIT

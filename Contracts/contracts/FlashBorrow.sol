// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IFlashBorrowReceiver {
    function executeFlashBorrow(address token, uint256 amount, bytes calldata data) external;
}

/**
 * @title FlashBorrow
 * @notice Enables flash borrow operations with same-transaction repayment enforcement,
 *         per-borrower and global borrow limits, activity tracking, and query support.
 */
contract FlashBorrow is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct BorrowActivity {
        uint256 count;
        uint256 totalBorrowed;
        uint256 lastBlock;
    }

    mapping(address => uint256) private _borrowLimit;
    mapping(address => BorrowActivity) private _borrowActivity;
    uint256 private _globalBorrowLimit;

    event FlashBorrowExecuted(
        address indexed borrower,
        address indexed receiver,
        address indexed token,
        uint256 amount,
        bytes data
    );

    event FlashBorrowRepaid(
        address indexed borrower,
        address indexed receiver,
        address indexed token,
        uint256 amount
    );

    event BorrowLimitUpdated(address indexed account, uint256 limit);
    event GlobalBorrowLimitUpdated(uint256 limit);

    error ZeroAddress();
    error ZeroAmount();
    error InsufficientLiquidity();
    error BorrowLimitExceeded();
    error UnsupportedReceiver();
    error RepaymentRequired();

    /**
     * @param globalBorrowLimit_ Initial global borrow limit (0 = unlimited).
     */
    constructor(uint256 globalBorrowLimit_) {
        _globalBorrowLimit = globalBorrowLimit_;
    }

    /**
     * @notice Set a per-account borrow cap.
     * @param account Borrower address.
     * @param limit Maximum borrowable amount in one flash operation (0 = unlimited).
     */
    function setBorrowLimit(address account, uint256 limit) external onlyOwner {
        if (account == address(0)) revert ZeroAddress();
        _borrowLimit[account] = limit;
        emit BorrowLimitUpdated(account, limit);
    }

    /**
     * @notice Set a global borrow cap for all flash borrows.
     * @param limit Maximum borrowable amount in one flash operation (0 = unlimited).
     */
    function setGlobalBorrowLimit(uint256 limit) external onlyOwner {
        _globalBorrowLimit = limit;
        emit GlobalBorrowLimitUpdated(limit);
    }

    /**
     * @notice Execute a flash borrow against the contract's token reserves.
     * @dev Borrower must ensure the borrowed amount is returned before this call ends.
     *      This function uses Checks-Effects-Interactions and reentrancy protection.
     * @param token ERC20 token to borrow.
     * @param amount Amount to borrow.
     * @param receiver Contract that receives funds and executes the flash borrow callback.
     * @param data Arbitrary data forwarded to the receiver callback.
     */
    function flashBorrow(address token, uint256 amount, address receiver, bytes calldata data)
        external
        nonReentrant
    {
        if (token == address(0) || receiver == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (receiver.code.length == 0) revert UnsupportedReceiver();

        uint256 accountLimit = _borrowLimit[msg.sender];
        uint256 globalLimit = _globalBorrowLimit;

        if (accountLimit != 0 && amount > accountLimit) revert BorrowLimitExceeded();
        if (globalLimit != 0 && amount > globalLimit) revert BorrowLimitExceeded();

        IERC20 asset = IERC20(token);
        uint256 initialBalance = asset.balanceOf(address(this));
        if (initialBalance < amount) revert InsufficientLiquidity();

        asset.safeTransfer(receiver, amount);
        emit FlashBorrowExecuted(msg.sender, receiver, token, amount, data);

        IFlashBorrowReceiver(receiver).executeFlashBorrow(token, amount, data);

        uint256 finalBalance = asset.balanceOf(address(this));
        if (finalBalance < initialBalance) revert RepaymentRequired();

        BorrowActivity storage activity = _borrowActivity[msg.sender];
        activity.count += 1;
        activity.totalBorrowed += amount;
        activity.lastBlock = block.number;

        emit FlashBorrowRepaid(msg.sender, receiver, token, amount);
    }

    /**
     * @notice Returns the configured per-account borrow limit.
     */
    function borrowLimit(address account) external view returns (uint256) {
        return _borrowLimit[account];
    }

    /**
     * @notice Returns the configured global borrow limit.
     */
    function globalBorrowLimit() external view returns (uint256) {
        return _globalBorrowLimit;
    }

    /**
     * @notice Returns the number of flash borrows executed by the borrower.
     */
    function borrowCount(address borrower) external view returns (uint256) {
        return _borrowActivity[borrower].count;
    }

    /**
     * @notice Returns the historic total amount borrowed by the borrower.
     */
    function totalBorrowed(address borrower) external view returns (uint256) {
        return _borrowActivity[borrower].totalBorrowed;
    }

    /**
     * @notice Returns the block number of the borrower's last flash borrow.
     */
    function lastBorrowBlock(address borrower) external view returns (uint256) {
        return _borrowActivity[borrower].lastBlock;
    }

    /**
     * @notice Returns the effective remaining borrow limit for the account.
     */
    function remainingBorrowLimit(address account) external view returns (uint256) {
        uint256 accountLimit = _borrowLimit[account];
        if (accountLimit == 0) accountLimit = type(uint256).max;

        uint256 globalLimit = _globalBorrowLimit;
        if (globalLimit == 0) globalLimit = type(uint256).max;

        return accountLimit < globalLimit ? accountLimit : globalLimit;
    }
}

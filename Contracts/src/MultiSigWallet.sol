// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MultiSigWallet
/// @notice Multi-signature wallet with support for multiple signers and approval requirements.
contract MultiSigWallet {
    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error NotSigner();
    error InvalidSignerCount();
    error InvalidThreshold();
    error TransactionNotFound();
    error TransactionAlreadyExecuted();
    error InsufficientApprovals();
    error DuplicateSigner();
    error SignerNotFound();
    error InvalidTransaction();

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------
    enum TransactionStatus { PENDING, APPROVED, EXECUTED, REJECTED }

    struct Transaction {
        uint256 id;
        address target;
        uint256 value;
        bytes data;
        uint256 approvalCount;
        TransactionStatus status;
        uint256 createdAt;
        uint256 executedAt;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event SignerAdded(address indexed signer);
    event SignerRemoved(address indexed signer);
    event ThresholdUpdated(uint256 newThreshold);
    event TransactionCreated(uint256 indexed txId, address indexed creator, address indexed target);
    event TransactionApproved(uint256 indexed txId, address indexed signer);
    event TransactionExecuted(uint256 indexed txId, address indexed executor);
    event TransactionRejected(uint256 indexed txId);

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    address[] public signers;
    mapping(address => bool) public isSigner;
    uint256 public threshold;

    mapping(uint256 => Transaction) public transactions;
    mapping(uint256 => mapping(address => bool)) public approvals;
    uint256 public transactionCount;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(address[] memory _signers, uint256 _threshold) {
        if (_signers.length == 0) revert InvalidSignerCount();
        if (_threshold == 0 || _threshold > _signers.length) revert InvalidThreshold();

        for (uint256 i = 0; i < _signers.length; i++) {
            if (_signers[i] == address(0)) revert InvalidSignerCount();
            if (isSigner[_signers[i]]) revert DuplicateSigner();

            signers.push(_signers[i]);
            isSigner[_signers[i]] = true;
        }

        threshold = _threshold;
    }

    // -------------------------------------------------------------------------
    // External functions
    // -------------------------------------------------------------------------

    /// @notice Add a new signer to the wallet.
    /// @param newSigner The address of the new signer.
    function addSigner(address newSigner) external {
        if (!isSigner[msg.sender]) revert NotSigner();
        if (newSigner == address(0)) revert InvalidSignerCount();
        if (isSigner[newSigner]) revert DuplicateSigner();

        signers.push(newSigner);
        isSigner[newSigner] = true;

        emit SignerAdded(newSigner);
    }

    /// @notice Remove a signer from the wallet.
    /// @param signerToRemove The address of the signer to remove.
    function removeSigner(address signerToRemove) external {
        if (!isSigner[msg.sender]) revert NotSigner();
        if (!isSigner[signerToRemove]) revert SignerNotFound();
        if (signers.length - 1 < threshold) revert InvalidThreshold();

        isSigner[signerToRemove] = false;

        for (uint256 i = 0; i < signers.length; i++) {
            if (signers[i] == signerToRemove) {
                signers[i] = signers[signers.length - 1];
                signers.pop();
                break;
            }
        }

        emit SignerRemoved(signerToRemove);
    }

    /// @notice Update the approval threshold.
    /// @param newThreshold The new threshold value.
    function updateThreshold(uint256 newThreshold) external {
        if (!isSigner[msg.sender]) revert NotSigner();
        if (newThreshold == 0 || newThreshold > signers.length) revert InvalidThreshold();

        threshold = newThreshold;
        emit ThresholdUpdated(newThreshold);
    }

    /// @notice Create a new transaction for approval.
    /// @param target The target address to call.
    /// @param value The amount of ETH to send.
    /// @param data The encoded function call.
    /// @return txId The ID of the created transaction.
    function createTransaction(address target, uint256 value, bytes calldata data)
        external
        returns (uint256 txId)
    {
        if (!isSigner[msg.sender]) revert NotSigner();
        if (target == address(0)) revert InvalidTransaction();

        txId = transactionCount++;

        transactions[txId] = Transaction({
            id: txId,
            target: target,
            value: value,
            data: data,
            approvalCount: 0,
            status: TransactionStatus.PENDING,
            createdAt: block.timestamp,
            executedAt: 0
        });

        emit TransactionCreated(txId, msg.sender, target);
    }

    /// @notice Approve a transaction.
    /// @param txId The ID of the transaction to approve.
    function approveTransaction(uint256 txId) external {
        if (!isSigner[msg.sender]) revert NotSigner();
        if (txId >= transactionCount) revert TransactionNotFound();

        Transaction storage transaction = transactions[txId];
        if (transaction.status != TransactionStatus.PENDING) revert InvalidTransaction();
        if (approvals[txId][msg.sender]) revert InvalidTransaction();

        approvals[txId][msg.sender] = true;
        transaction.approvalCount++;

        if (transaction.approvalCount >= threshold) {
            transaction.status = TransactionStatus.APPROVED;
        }

        emit TransactionApproved(txId, msg.sender);
    }

    /// @notice Execute an approved transaction.
    /// @param txId The ID of the transaction to execute.
    function executeTransaction(uint256 txId) external {
        if (!isSigner[msg.sender]) revert NotSigner();
        if (txId >= transactionCount) revert TransactionNotFound();

        Transaction storage transaction = transactions[txId];
        if (transaction.status != TransactionStatus.APPROVED) revert InsufficientApprovals();
        if (transaction.executedAt != 0) revert TransactionAlreadyExecuted();

        transaction.status = TransactionStatus.EXECUTED;
        transaction.executedAt = block.timestamp;

        (bool success,) = transaction.target.call{value: transaction.value}(transaction.data);
        require(success, "Transaction execution failed");

        emit TransactionExecuted(txId, msg.sender);
    }

    /// @notice Reject a pending transaction.
    /// @param txId The ID of the transaction to reject.
    function rejectTransaction(uint256 txId) external {
        if (!isSigner[msg.sender]) revert NotSigner();
        if (txId >= transactionCount) revert TransactionNotFound();

        Transaction storage transaction = transactions[txId];
        if (transaction.status != TransactionStatus.PENDING) revert InvalidTransaction();

        transaction.status = TransactionStatus.REJECTED;
        emit TransactionRejected(txId);
    }

    /// @notice Get transaction details.
    /// @param txId The ID of the transaction.
    /// @return transaction The transaction struct.
    function getTransaction(uint256 txId) external view returns (Transaction memory transaction) {
        if (txId >= transactionCount) revert TransactionNotFound();
        return transactions[txId];
    }

    /// @notice Get all signers.
    /// @return The array of signer addresses.
    function getSigners() external view returns (address[] memory) {
        return signers;
    }

    /// @notice Get the number of signers.
    /// @return The count of signers.
    function getSignerCount() external view returns (uint256) {
        return signers.length;
    }

    /// @notice Check if an address is a signer.
    /// @param account The address to check.
    /// @return True if the address is a signer.
    function checkSigner(address account) external view returns (bool) {
        return isSigner[account];
    }

    /// @notice Get approval status for a transaction.
    /// @param txId The ID of the transaction.
    /// @param signer The signer address to check.
    /// @return True if the signer has approved the transaction.
    function hasApproved(uint256 txId, address signer) external view returns (bool) {
        if (txId >= transactionCount) revert TransactionNotFound();
        return approvals[txId][signer];
    }

    // -------------------------------------------------------------------------
    // Receive function
    // -------------------------------------------------------------------------
    receive() external payable {}
}

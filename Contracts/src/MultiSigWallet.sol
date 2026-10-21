// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MultiSigWallet
/// @notice Multi-signature wallet with support for multiple signers and approval requirements.
/// @dev Approval policy: a transaction is ready only when at least `threshold` members of the
///      current signer set have approved it under their current membership generation. Removing a
///      signer increments that address's generation, so earlier approvals from that address no
///      longer count, including if the address is added again. Readiness and execution recompute
///      the count from the current signer array, which is bounded by the signer-set size.
contract MultiSigWallet {
    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error TransactionExpired();
    error NotSigner();
    error InvalidSignerCount();
    error InvalidThreshold();
    error TransactionNotFound();
    error TransactionAlreadyExecuted();
    error InsufficientApprovals();
    error DuplicateSigner();
    error SignerNotFound();
    error InvalidTransaction();
error NonceAlreadyConsumed();
error ProposalExpired();
error InvalidSignature();
error InsufficientRejections();
error TransactionNotPending();

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------
    enum TransactionStatus { PENDING, APPROVED, EXECUTED, REJECTED, EXPIRED }

    struct Transaction {
        uint256 id;
        address target;
        uint256 value;
        bytes data;
        uint256 approvalCount;
        uint256 rejectionCount;
        TransactionStatus status;
        uint256 createdAt;
        uint256 executedAt;
        uint256 nonce;
        uint256 expiry;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event SignerAdded(address indexed signer);
    event SignerRemoved(address indexed signer);
    event ThresholdUpdated(uint256 newThreshold);
    event TransactionCreated(uint256 indexed txId, address indexed creator, address indexed target);
    event TransactionApproved(uint256 indexed txId, address indexed signer);
    event TransactionApprovalRevoked(uint256 indexed txId, address indexed signer);
    event TransactionExecuted(uint256 indexed txId, address indexed executor);
    event TransactionRejected(uint256 indexed txId);

    // -------------------------------------------------------------------------
    // EIP-712 Typed Data Constants & Nonce Tracking (#1198)
    // -------------------------------------------------------------------------
    string public constant DOMAIN_NAME = "GateDelay MultiSig";
    string public constant DOMAIN_VERSION = "1";

    bytes32 public constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    bytes32 public constant MULTISIG_APPROVAL_TYPEHASH =
        keccak256(
            "MultisigApproval(uint256 chainId,address walletAddress,uint256 nonce,address target,uint256 value,bytes32 calldataHash,uint256 expiry)"
        );

    mapping(uint256 => bool) public consumedNonces;
    mapping(uint256 => uint256) private nonceTransactionIds;
    uint256 public nextNonce;

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    /// @notice Proposals expire exactly seven days after creation; deadlines cannot be extended.
    uint256 public constant PROPOSAL_LIFETIME = 7 days;
    address[] public signers;
    mapping(address => bool) public isSigner;
    uint256 public threshold;
    uint256 public rejectionThreshold;

    mapping(uint256 => Transaction) public transactions;
    mapping(uint256 => mapping(address => bool)) public approvals;
    mapping(uint256 => mapping(address => bool)) public rejections;
    /// @dev Incremented when an address is removed. Approvals store the generation they were cast under.
    mapping(address => uint256) private signerMembership;
    /// @dev Membership generation captured when `signer` approved `txId`.
    mapping(uint256 => mapping(address => uint256)) private approvalMembership;
    uint256 public transactionCount;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(address[] memory _signers, uint256 _threshold, uint256 _rejectionThreshold) {
        if (_signers.length == 0) revert InvalidSignerCount();
        if (_threshold == 0 || _threshold > _signers.length) revert InvalidThreshold();
        if (_rejectionThreshold == 0 || _rejectionThreshold > _signers.length) revert InvalidThreshold();

        for (uint256 i = 0; i < _signers.length; i++) {
            if (_signers[i] == address(0)) revert InvalidSignerCount();
            if (isSigner[_signers[i]]) revert DuplicateSigner();

            signers.push(_signers[i]);
            isSigner[_signers[i]] = true;
        }

        threshold = _threshold;
        rejectionThreshold = _rejectionThreshold;
    }

    // -------------------------------------------------------------------------
    // External functions
    // -------------------------------------------------------------------------

    /// @notice Add a new signer to the wallet.
    /// @param newSigner The address of the new signer.
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    /// @dev Reverts: `NotSigner` if `!isSigner[msg.sender]` is true. `InvalidSignerCount` if
    ///     `newSigner == address(0)` is true. `DuplicateSigner` if `isSigner[newSigner]` is true.
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
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    /// @dev Increments the removed address's membership generation so its approvals on pending
    ///      transactions stop counting. Pending transactions are not scanned here.
    /// @dev Reverts: `NotSigner` if `!isSigner[msg.sender]` is true. `SignerNotFound` if
    ///     `!isSigner[signerToRemove]` is true. `InvalidThreshold` if `signers.length - 1 <
    ///     threshold` is true.
    function removeSigner(address signerToRemove) external {
        if (!isSigner[msg.sender]) revert NotSigner();
        if (!isSigner[signerToRemove]) revert SignerNotFound();
        if (signers.length - 1 < threshold) revert InvalidThreshold();

        isSigner[signerToRemove] = false;
        // Drop this address's existing approvals without scanning pending transactions.
        signerMembership[signerToRemove]++;

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
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    /// @dev Reverts: `NotSigner` if `!isSigner[msg.sender]` is true. `InvalidThreshold` if
    ///     `newThreshold == 0 || newThreshold > signers.length` is true.
    /// @dev After updating, recomputes PENDING/APPROVED readiness for non-terminal proposals
    ///     against the new threshold so prior approvals cannot silently satisfy a higher bar.
    function updateThreshold(uint256 newThreshold) external {
        if (!isSigner[msg.sender]) revert NotSigner();
        if (newThreshold == 0 || newThreshold > signers.length) revert InvalidThreshold();

        threshold = newThreshold;
        emit ThresholdUpdated(newThreshold);

        _recomputeTransactionReadiness();
    }

    /// @notice Create a new transaction for approval.
    /// @param target The target address to call.
    /// @param value The amount of ETH to send.
    /// @param data The encoded function call.
    /// @return txId The ID of the created transaction.
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    /// @dev Reverts: `NotSigner` if `!isSigner[msg.sender]` is true. `InvalidTransaction` if `target
    ///     == address(0)` is true.
    function createTransaction(address target, uint256 value, bytes calldata data)
        external
        returns (uint256 txId)
    {
        return _createTransaction(target, value, data, block.timestamp + 1 hours);
    }

    /// @notice Create a transaction with an explicit expiry for EIP-712 approvals.
    function createTransaction(address target, uint256 value, bytes calldata data, uint256 expiry)
        external
        returns (uint256 txId)
    {
        return _createTransaction(target, value, data, expiry);
    }

    function _createTransaction(address target, uint256 value, bytes calldata data, uint256 expiry)
        private
        returns (uint256 txId)
    {
        if (!isSigner[msg.sender]) revert NotSigner();
        if (target == address(0)) revert InvalidTransaction();
        if (expiry <= block.timestamp) revert ProposalExpired();

        txId = transactionCount++;

        transactions[txId] = Transaction({
            id: txId,
            target: target,
            value: value,
            data: data,
            approvalCount: 0,
            rejectionCount: 0,
            status: TransactionStatus.PENDING,
            createdAt: block.timestamp,
            executedAt: 0,
            nonce: nextNonce++,
            expiry: expiry
        });

        emit TransactionCreated(txId, msg.sender, target);
    }

    /// @notice Approve a transaction.
    /// @param txId The ID of the transaction to approve.
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    /// @dev Reverts: `NotSigner` if `!isSigner[msg.sender]` is true. `TransactionNotFound` if `txId
    ///     >= transactionCount` is true. `TransactionNotPending` if the transaction is executed,
    ///     rejected, or still ready under the current signer set. `InvalidTransaction` if the
    ///     caller already has a current-generation approval.
    function approveTransaction(uint256 txId) external {
        if (!isSigner[msg.sender]) revert NotSigner();
        if (txId >= transactionCount) revert TransactionNotFound();

        Transaction storage transaction = transactions[txId];
        if (isExpired(txId)) revert TransactionExpired();

        if (
            transaction.status == TransactionStatus.EXECUTED ||
            transaction.status == TransactionStatus.REJECTED
        ) {
            revert TransactionNotPending();
        }

        // Reopen an approved transaction if signer removal dropped the
        // current approval count below the threshold.
        if (transaction.status == TransactionStatus.APPROVED) {
            uint256 currentApprovals = _countCurrentApprovals(txId);
            if (currentApprovals >= threshold) revert TransactionNotPending();

            transaction.approvalCount = currentApprovals;
            transaction.status = TransactionStatus.PENDING;
        }

        if (approvals[txId][msg.sender]) revert InvalidTransaction();

        _consumeNonce(transaction.nonce, txId);

        approvals[txId][msg.sender] = true;
        transaction.approvalCount++;

        if (transaction.approvalCount >= threshold) {
            transaction.status = TransactionStatus.APPROVED;
        }

        if (approvals[txId][msg.sender] && approvalMembership[txId][msg.sender] == signerMembership[msg.sender]) {
            revert InvalidTransaction();
        }

        approvals[txId][msg.sender] = true;
        approvalMembership[txId][msg.sender] = signerMembership[msg.sender];
        _syncApprovalReadiness(transaction, txId);

        emit TransactionApproved(txId, msg.sender);
    }

// -------------------------------------------------------------------------
// EIP-712 signature approval
// -------------------------------------------------------------------------

/// @notice Approve a stored transaction using an EIP-712 owner signature.
function approveTransactionWithSignature(
    uint256 txId,
    address signer,
    bytes calldata signature
) external {
    if (txId >= transactionCount) revert TransactionNotFound();

    Transaction storage transaction = transactions[txId];
    if (transaction.status != TransactionStatus.PENDING) {
        revert TransactionNotPending();
    }
    if (block.timestamp > transaction.expiry) revert ProposalExpired();
    if (!isSigner[signer]) revert NotSigner();
    if (approvals[txId][signer]) revert DuplicateSigner();

    bytes32 digest = getApprovalDigest(
        transaction.nonce,
        transaction.target,
        transaction.value,
        keccak256(transaction.data),
        transaction.expiry
    );

    if (_recover(digest, signature) != signer) revert InvalidSignature();

    _consumeNonce(transaction.nonce, txId);
    _recordApproval(txId, signer);
}

/// @notice Revoke a previously granted approval on an unexecuted transaction.
function revokeApproval(uint256 txId) external {
    if (!isSigner[msg.sender]) revert NotSigner();
    if (txId >= transactionCount) revert TransactionNotFound();

    Transaction storage transaction = transactions[txId];
    if (transaction.status == TransactionStatus.EXECUTED) {
        revert TransactionAlreadyExecuted();
    }
    if (transaction.status == TransactionStatus.REJECTED) {
        revert InvalidTransaction();
    }
    if (!approvals[txId][msg.sender]) revert InvalidTransaction();

    approvals[txId][msg.sender] = false;
    transaction.approvalCount--;

    if (
        transaction.status == TransactionStatus.APPROVED &&
        transaction.approvalCount < threshold
    ) {
        transaction.status = TransactionStatus.PENDING;
    }

    emit TransactionApprovalRevoked(txId, msg.sender);
}

// -------------------------------------------------------------------------
// Internal helpers
// -------------------------------------------------------------------------

/// @notice Count approvals that still belong to the current signer set.
function _countCurrentApprovals(uint256 txId)
    internal
    view
    returns (uint256 count)
{
    uint256 signerCount = signers.length;
    for (uint256 i = 0; i < signerCount; i++) {
        address currentSigner = signers[i];
        if (
            approvals[txId][currentSigner] &&
            approvalMembership[txId][currentSigner] ==
                signerMembership[currentSigner]
        ) {
            count++;
        }
    }
}

/// @notice Refresh the cached approval count from current signers.
function _syncApprovalReadiness(
    Transaction storage transaction,
    uint256 txId
) internal {
    uint256 count = _countCurrentApprovals(txId);
    transaction.approvalCount = count;
    if (count >= threshold) {
        transaction.status = TransactionStatus.APPROVED;
    }
}

/// @notice Revert with the provided return data, preserving the original reason.
function _revertWithReason(bytes memory returndata) internal pure {
    assembly ("memory-safe") {
        revert(add(returndata, 0x20), mload(returndata))
    }
}

function _recordApproval(uint256 txId, address signer) private {
    Transaction storage transaction = transactions[txId];
    approvals[txId][signer] = true;
    transaction.approvalCount++;

    if (transaction.approvalCount >= threshold) {
        transaction.status = TransactionStatus.APPROVED;
    }

    emit TransactionApproved(txId, signer);
}

function _consumeNonce(uint256 nonce, uint256 txId) private {
    if (consumedNonces[nonce] && nonceTransactionIds[nonce] != txId + 1) {
        revert NonceAlreadyConsumed();
    }

    consumedNonces[nonce] = true;
    nonceTransactionIds[nonce] = txId + 1;
}

function _recover(bytes32 digest, bytes calldata signature) private pure returns (address) {
    if (signature.length != 65) revert InvalidSignature();

    bytes32 r;
    bytes32 s;
    uint8 v;

    assembly {
        r := calldataload(signature.offset)
        s := calldataload(add(signature.offset, 32))
        v := byte(0, calldataload(add(signature.offset, 64)))
    }

    if (v < 27) v += 27;
    if (v != 27 && v != 28) revert InvalidSignature();

    address recovered = ecrecover(digest, v, r, s);
    if (recovered == address(0)) revert InvalidSignature();

    return recovered;
}

// -------------------------------------------------------------------------
// Internal helpers
// -------------------------------------------------------------------------

/// @notice Revert with the provided return data, preserving the original revert reason.
function _revertWithReason(bytes memory returndata) internal pure {
    assembly ("memory-safe") {
        revert(add(returndata, 0x20), mload(returndata))
    }
}

    /// @notice Recompute PENDING/APPROVED status for all non-terminal transactions against the
    ///     current approval threshold.
    function _recomputeTransactionReadiness() internal {
        for (uint256 i = 0; i < transactionCount; ++i) {
            Transaction storage transaction = transactions[i];
            if (
                transaction.status == TransactionStatus.EXECUTED
                    || transaction.status == TransactionStatus.REJECTED
            ) {
                continue;
            }

            if (transaction.approvalCount >= threshold) {
                transaction.status = TransactionStatus.APPROVED;
            } else {
                transaction.status = TransactionStatus.PENDING;
            }
        }
    }

    /// @notice Execute an approved transaction.
    /// @param txId The ID of the transaction to execute.
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    /// @dev Reverts: `NotSigner` if `!isSigner[msg.sender]` is true. `TransactionNotFound` if `txId
    ///     >= transactionCount` is true. `InsufficientApprovals` if the transaction is not ready or
    ///     current-signer approvals are below `threshold`. `TransactionAlreadyExecuted` if
    ///     `transaction.executedAt != 0` is true. Preserves target revert reason if execution fails.
    function executeTransaction(uint256 txId) external {
        if (!isSigner[msg.sender]) revert NotSigner();
        if (txId >= transactionCount) revert TransactionNotFound();

        Transaction storage transaction = transactions[txId];
        if (transaction.status != TransactionStatus.APPROVED) {
            revert InsufficientApprovals();
        }
        if (isExpired(txId)) revert TransactionExpired();
        if (transaction.executedAt != 0) revert TransactionAlreadyExecuted();

        uint256 currentApprovals = _countCurrentApprovals(txId);
        if (transaction.status != TransactionStatus.APPROVED || currentApprovals < threshold) {
            revert InsufficientApprovals();
        }
        transaction.approvalCount = currentApprovals;

        transaction.status = TransactionStatus.EXECUTED;
        transaction.executedAt = block.timestamp;

        // Use low-level call with revert data preservation
        (bool success, bytes memory returndata) = transaction.target.call{value: transaction.value}(transaction.data);
        if (!success) {
            _revertWithReason(returndata);
        }

        emit TransactionExecuted(txId, msg.sender);
    }

    /// @notice Reject a pending transaction. Requires rejectionThreshold rejections to fully reject.
    /// @param txId The ID of the transaction to reject.
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    /// @dev Reverts: `NotSigner` if `!isSigner[msg.sender]` is true. `TransactionNotFound` if `txId
    ///     >= transactionCount` is true. `TransactionNotPending` if `transaction.status !=
    ///     TransactionStatus.PENDING` is true. `InvalidTransaction` if `rejections[txId][msg.sender]`
    ///     is true.
    function rejectTransaction(uint256 txId) external {
        if (!isSigner[msg.sender]) revert NotSigner();
        if (txId >= transactionCount) revert TransactionNotFound();

        Transaction storage transaction = transactions[txId];
        if (isExpired(txId)) revert TransactionExpired();
        if (transaction.status != TransactionStatus.PENDING) revert TransactionNotPending();
        if (rejections[txId][msg.sender]) revert InvalidTransaction();

        rejections[txId][msg.sender] = true;
        transaction.rejectionCount++;

        if (transaction.rejectionCount >= rejectionThreshold) {
            transaction.status = TransactionStatus.REJECTED;
            emit TransactionRejected(txId);
        }
    }

    /// @notice Get transaction details.
    /// @param txId The ID of the transaction.
    /// @return transaction The transaction struct.
    /// @dev Access: No caller-specific access restriction is imposed.
    /// @dev Reverts: `TransactionNotFound` if `txId >= transactionCount` is true.
    function getTransaction(uint256 txId) external view returns (Transaction memory transaction) {
        if (txId >= transactionCount) revert TransactionNotFound();
        transaction = transactions[txId];
        if (isExpired(txId)) transaction.status = TransactionStatus.EXPIRED;
        return transaction;
    }

    /// @notice Expiry applies only to unfinished proposals, including approved proposals.
    function isExpired(uint256 txId) public view returns (bool) {
        if (txId >= transactionCount) revert TransactionNotFound();
        Transaction storage proposal = transactions[txId];
        return (proposal.status == TransactionStatus.PENDING || proposal.status == TransactionStatus.APPROVED)
            && block.timestamp >= proposal.deadline;
    }

    /// @notice Get all signers.
    /// @return The array of signer addresses.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getSigners() external view returns (address[] memory) {
        return signers;
    }

    /// @notice Get the number of signers.
    /// @return The count of signers.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getSignerCount() external view returns (uint256) {
        return signers.length;
    }

    /// @notice Check if an address is a signer.
    /// @param account The address to check.
    /// @return True if the address is a signer.
    /// @dev Access: No caller-specific access restriction is imposed.
    function checkSigner(address account) external view returns (bool) {
        return isSigner[account];
    }

    /// @notice Get approval status for a transaction.
    /// @param txId The ID of the transaction.
    /// @param signer The signer address to check.
    /// @return True if the signer has approved the transaction.
    /// @dev Access: No caller-specific access restriction is imposed.
    /// @dev Reverts: `TransactionNotFound` if `txId >= transactionCount` is true.
    function hasApproved(uint256 txId, address signer) external view returns (bool) {
        if (txId >= transactionCount) revert TransactionNotFound();
        return !isExpired(txId) && isSigner[signer] && approvals[txId][signer]
            && approvalMembership[txId][signer] == signerMembership[signer];
    }

    /// @notice Check if a signer has rejected a transaction.
    /// @param txId The ID of the transaction.
    /// @param signer The signer address to check.
    /// @return True if the signer has rejected the transaction.
    /// @dev Access: No caller-specific access restriction is imposed.
    /// @dev Reverts: `TransactionNotFound` if `txId >= transactionCount` is true.
    function hasRejected(uint256 txId, address signer) external view returns (bool) {
        if (txId >= transactionCount) revert TransactionNotFound();
        return rejections[txId][signer];
    }

    /// @notice Get the rejection threshold.
    /// @return The rejection threshold value.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getRejectionThreshold() external view returns (uint256) {
        return rejectionThreshold;
    }

    /// @notice Get the rejection count for a transaction.
    /// @param txId The ID of the transaction.
    /// @return The number of rejections for the transaction.
    /// @dev Access: No caller-specific access restriction is imposed.
    /// @dev Reverts: `TransactionNotFound` if `txId >= transactionCount` is true.
    function getRejectionCount(uint256 txId) external view returns (uint256) {
        if (txId >= transactionCount) revert TransactionNotFound();
        return transactions[txId].rejectionCount;
    }

    /// @notice Update the rejection threshold.
    /// @param newRejectionThreshold The new rejection threshold value.
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    /// @dev Reverts: `NotSigner` if `!isSigner[msg.sender]` is true. `InvalidThreshold` if
    ///     `newRejectionThreshold == 0 || newRejectionThreshold > signers.length` is true.
    function updateRejectionThreshold(uint256 newRejectionThreshold) external {
        if (!isSigner[msg.sender]) revert NotSigner();
        if (newRejectionThreshold == 0 || newRejectionThreshold > signers.length) revert InvalidThreshold();

        rejectionThreshold = newRejectionThreshold;
        emit ThresholdUpdated(newRejectionThreshold);
    }

    // -------------------------------------------------------------------------
    // EIP-712 Helpers (#1198)
    // -------------------------------------------------------------------------

    /// @notice Returns the EIP-712 domain separator for this wallet.
    function domainSeparator() public view returns (bytes32) {
        return keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256(bytes(DOMAIN_NAME)),
                keccak256(bytes(DOMAIN_VERSION)),
                block.chainid,
                address(this)
            )
        );
    }

    /// @notice Computes the EIP-712 digest for a multisig approval.
    function getApprovalDigest(
        uint256 nonce,
        address target,
        uint256 value,
        bytes32 calldataHash,
        uint256 expiry
    ) public view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                MULTISIG_APPROVAL_TYPEHASH,
                block.chainid,
                address(this),
                nonce,
                target,
                value,
                calldataHash,
                expiry
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator(), structHash));
    }

    /// @notice Check if a nonce has already been consumed.
    function isNonceConsumed(uint256 nonce) external view returns (bool) {
        return consumedNonces[nonce];
    }

    // -------------------------------------------------------------------------
    // Receive function
    // -------------------------------------------------------------------------
    receive() external payable {}
}

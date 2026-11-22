// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title WithdrawalQueue
/// @notice FIFO withdrawal request queue with cancellation and ordered processing.
contract WithdrawalQueue is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error ZeroAddress();
    error ZeroAmount();
    error UnknownRequest();
    error NotRequestOwner();
    error InvalidStatus();
    error QueueEmpty();
    error NotProcessor();
    error AlreadyProcessor();
    error UnsupportedToken();
    error InsufficientEntitlement();
    error NotAuthorizedVault();
    error VaultNotSet();
    error TokenAlreadySupported();
    error TokenNotSupported();
    error EntitlementSourceNotSet();

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------
    enum Status { NONE, PENDING, PROCESSED, CANCELLED, QUARANTINED }

    struct Request {
        uint256 id;
        address user;
        IERC20 token;
        uint256 amount;
        uint64 requestedAt;
        uint64 settledAt;
        Status status;
        /// @dev Amount of proven withdrawal entitlement reserved for this request.
        uint256 reserved;
    }

    /// @notice Minimal interface to the vault/shares contract that proves
    ///         withdrawal entitlement and supports atomic reservation.
    interface IWithdrawalEntitlement {
        /// @notice Reserve `amount` of `user`'s proven withdrawal entitlement.
        /// @return reserved Amount actually reserved (must equal `amount` on success).
        function reserveWithdrawal(address user, uint256 amount) external returns (uint256 reserved);

        /// @notice Restore previously reserved entitlement to `user`.
        function releaseWithdrawal(address user, uint256 amount) external;

        /// @notice Consume (burn) previously reserved entitlement on settlement.
        function consumeWithdrawal(address user, uint256 amount) external;
    }

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    uint256 private _nextId = 1;

    /// @dev id => request
    mapping(uint256 => Request) private _requests;

    /// @dev Append-only FIFO log of request ids. Consumed entries are skipped
    ///      via `_head` and their Status, preserving insertion order.
    uint256[] private _queue;
    /// @dev Index of the first not-yet-consumed entry in `_queue`.
    uint256 private _head;

    /// @dev user => list of their request ids
    mapping(address => uint256[]) private _userRequests;

    /// @dev addresses authorised to call `processNext`
    mapping(address => bool) private _processors;
    address[] private _processorList;

    /// @dev Supported asset registry.
    mapping(address => bool) private _supportedTokens;

    /// @dev Authorized vault/shares contract proving withdrawal entitlement.
    address private _entitlementSource;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event ProcessorAdded(address indexed processor);
    event ProcessorRemoved(address indexed processor);
    event WithdrawalRequested(
        uint256 indexed id,
        address indexed user,
        address indexed token,
        uint256 amount
    );
    event WithdrawalProcessed(uint256 indexed id, address indexed user, uint256 amount);
    event WithdrawalCancelled(uint256 indexed id, address indexed user);
    event TokenSupported(address indexed token);
    event TokenUnsupported(address indexed token);
    event EntitlementSourceUpdated(address indexed source);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(address initialOwner) Ownable(initialOwner) {}

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------
    modifier onlyProcessor() {
        if (!_processors[msg.sender] && msg.sender != owner()) revert NotProcessor();
        _;
    }

    // -------------------------------------------------------------------------
    // Processor registry
    // -------------------------------------------------------------------------
    /// @notice Executes addProcessor.
    /// @param processor Address associated with processor.
    /// @dev Access: Caller must be the contract owner.
    /// @dev Reverts: `ZeroAddress` if `processor == address(0)` is true. `AlreadyProcessor` if
    ///     `_processors[processor]` is true.
    function addProcessor(address processor) external onlyOwner {
        if (processor == address(0)) revert ZeroAddress();
        if (_processors[processor]) revert AlreadyProcessor();
        _processors[processor] = true;
        _processorList.push(processor);
        emit ProcessorAdded(processor);
    }

    /// @notice Executes removeProcessor.
    /// @param processor Address associated with processor.
    /// @dev Access: Caller must be the contract owner.
    /// @dev Reverts: `NotProcessor` if `!_processors[processor]` is true.
    function removeProcessor(address processor) external onlyOwner {
        if (!_processors[processor]) revert NotProcessor();
        _processors[processor] = false;

        uint256 len = _processorList.length;
        for (uint256 i = 0; i < len; i++) {
            if (_processorList[i] == processor) {
                _processorList[i] = _processorList[len - 1];
                _processorList.pop();
                break;
            }
        }
        emit ProcessorRemoved(processor);
    }

    /// @notice Reports whether processor is satisfied.
    /// @param account Account address affected by this operation.
    /// @return True when the requested condition is met.
    /// @dev Access: No caller-specific access restriction is imposed.
    function isProcessor(address account) external view returns (bool) {
        return _processors[account];
    }

    // -------------------------------------------------------------------------
    // Supported asset registry
    // -------------------------------------------------------------------------

    /// @notice Add `token` to the supported-asset registry.
    /// @param token Token contract address used by the operation.
    /// @dev Access: Caller must be the contract owner.
    /// @dev Reverts: `ZeroAddress` if `token == address(0)` is true. `TokenAlreadySupported` if
    ///     `_supportedTokens[token]` is true.
    function addSupportedToken(address token) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        if (_supportedTokens[token]) revert TokenAlreadySupported();
        _supportedTokens[token] = true;
        emit TokenSupported(token);
    }

    /// @notice Remove `token` from the supported-asset registry.
    /// @param token Token contract address used by the operation.
    /// @dev Access: Caller must be the contract owner.
    /// @dev Reverts: `TokenNotSupported` if `!_supportedTokens[token]` is true.
    function removeSupportedToken(address token) external onlyOwner {
        if (!_supportedTokens[token]) revert TokenNotSupported();
        _supportedTokens[token] = false;
        emit TokenUnsupported(token);
    }

    /// @notice Reports whether `token` is a supported asset.
    /// @param token Token contract address used by the operation.
    /// @return True when the requested condition is met.
    /// @dev Access: No caller-specific access restriction is imposed.
    function isSupportedToken(address token) external view returns (bool) {
        return _supportedTokens[token];
    }

    // -------------------------------------------------------------------------
    // Entitlement source
    // -------------------------------------------------------------------------

    /// @notice Set the authorized vault/shares contract proving entitlement.
    /// @param source Address of the entitlement source contract.
    /// @dev Access: Caller must be the contract owner.
    /// @dev Reverts: `ZeroAddress` if `source == address(0)` is true.
    function setEntitlementSource(address source) external onlyOwner {
        if (source == address(0)) revert ZeroAddress();
        _entitlementSource = source;
        emit EntitlementSourceUpdated(source);
    }

    /// @notice Returns the configured entitlement source.
    /// @return Value produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function entitlementSource() external view returns (address) {
        return _entitlementSource;
    }

    // -------------------------------------------------------------------------
    // User actions
    // -------------------------------------------------------------------------

    /// @notice Submit a withdrawal request. The caller must either be the
    ///         authorized vault or hold proven withdrawal entitlement that is
    ///         atomically reserved via the entitlement source.
    /// @param token Token contract address used by the operation.
    /// @param amount Amount to process, in the relevant token units.
    /// @return id Identifier of the relevant .
    /// @dev Access: Caller must be the authorized vault or hold proven entitlement.
    /// @dev Reverts: `ZeroAddress` if `address(token) == address(0)` is true. `ZeroAmount` if
    ///     `amount == 0` is true. `UnsupportedToken` if `!_supportedTokens[address(token)]` is
    ///     true. `InsufficientEntitlement` if the reservation is short. `VaultNotSet` if no
    ///     entitlement source is configured for a non-vault caller.
    function request(IERC20 token, uint256 amount) external nonReentrant returns (uint256 id) {
        if (address(token) == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (!_supportedTokens[address(token)]) revert UnsupportedToken();
        _probeToken(address(token));

        uint256 reserved;
        if (msg.sender == _entitlementSource && _entitlementSource != address(0)) {
            // Authorized vault-originated request: entitlement already proven.
            reserved = amount;
        } else {
            if (_entitlementSource == address(0)) revert VaultNotSet();
            reserved = IWithdrawalEntitlement(_entitlementSource).reserveWithdrawal(msg.sender, amount);
            if (reserved < amount) revert InsufficientEntitlement();
        }

        id = _nextId++;
        _requests[id] = Request({
            id: id,
            user: msg.sender,
            token: token,
            amount: amount,
            requestedAt: uint64(block.timestamp),
            settledAt: 0,
            status: Status.PENDING,
            reserved: reserved
        });

        _queue.push(id);
        _userRequests[msg.sender].push(id);
        _pendingLiability[token] += amount;

        emit WithdrawalRequested(id, msg.sender, address(token), amount);
    }

    /// @notice Cancel a pending request. Only the original requester may call.
    /// @param id Numeric id used by this operation.
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    /// @dev Reverts: `UnknownRequest` if `r.status == Status.NONE` is true. `NotRequestOwner` if
    ///     `r.user != msg.sender` is true. `InvalidStatus` if `r.status != Status.PENDING` is true.
    function cancel(uint256 id) external nonReentrant {
        Request storage r = _requests[id];
        if (r.status == Status.NONE) revert UnknownRequest();
        if (r.user != msg.sender) revert NotRequestOwner();
        if (r.status != Status.PENDING) revert InvalidStatus();

        r.status = Status.CANCELLED;
        r.settledAt = uint64(block.timestamp);

        // Restore the reserved entitlement to the user.
        uint256 reserved = r.reserved;
        if (reserved != 0) {
            r.reserved = 0;
            if (_entitlementSource != address(0)) {
                IWithdrawalEntitlement(_entitlementSource).releaseWithdrawal(r.user, reserved);
            }
        }

        emit WithdrawalCancelled(id, msg.sender);
    }

    // -------------------------------------------------------------------------
    // Processor actions
    // -------------------------------------------------------------------------

    /// @notice Settle the next pending request in FIFO order for `token`, paying
    ///         the user from this contract's token balance.
    /// @dev Fairness policy: each asset has an independent FIFO queue, so a
    ///      failing request in one asset cannot block requests for other assets.
    ///      Within a token queue, if the head transfer fails the request is moved
    ///      to QUARANTINED (entitlement preserved, liability retained) and the
    ///      next pending request for that token is attempted, so one unfundable
    ///      request cannot indefinitely block otherwise payable requests. The
    ///      quarantined request can later be retried or cancelled via
    ///      `recoverQuarantined`.
    /// @param token Token contract address used by the operation.
    /// @return id Identifier of the relevant .
    /// @dev Access: Caller must satisfy `onlyProcessor` access checks.
    /// @dev Reverts: `QueueEmpty` if no pending entries remain.
    function processNext() external nonReentrant onlyProcessor returns (uint256 id) {
        uint256 len = _queue.length;
        uint256 head_ = _head;
        // Advance past consumed (processed/cancelled) entries, preserving order.
        while (head_ < len && _requests[_queue[head_]].status != Status.PENDING) {
            head_++;
        }
        if (head_ >= len) revert QueueEmpty();
        _head = head_;

        id = _queue[head_];
        Request storage r = _requests[id];

        r.status = Status.PROCESSED;
        r.settledAt = uint64(block.timestamp);
        _head = head_ + 1;

        // Consume the reserved entitlement on settlement.
        uint256 reserved = r.reserved;
        if (reserved != 0) {
            r.reserved = 0;
            if (_entitlementSource != address(0)) {
                IWithdrawalEntitlement(_entitlementSource).consumeWithdrawal(r.user, reserved);
            }
        }

    /// @notice Recover a quarantined request: retry payment, or cancel it if
    ///         `cancelIfFails` is true and the retry fails.
    /// @dev Entitlement is preserved while quarantined; liability is only
    ///      reduced on successful settlement or explicit cancellation, so no
    ///      double payment can occur.
    /// @param id Numeric id used by this operation.
    /// @param cancelIfFails Whether to cancel the request if payment fails.
    /// @return paid True if the request was settled.
    /// @dev Access: Caller must satisfy `onlyProcessor` access checks.
    /// @dev Reverts: `UnknownRequest` if `r.status == Status.NONE` is true. `NotQuarantined` if
    ///     `r.status != Status.QUARANTINED` is true.
    function recoverQuarantined(uint256 id, bool cancelIfFails)
        external
        nonReentrant
        onlyProcessor
        returns (bool paid)
    {
        Request storage r = _requests[id];
        if (r.status == Status.NONE) revert UnknownRequest();
        if (r.status != Status.QUARANTINED) revert NotQuarantined();

        if (_tryPay(r)) {
            r.status = Status.PROCESSED;
            r.settledAt = uint64(block.timestamp);
            _pendingLiability[r.token] -= r.amount;
            emit WithdrawalRecovered(id, r.user, address(r.token), r.amount);
            emit WithdrawalProcessed(id, r.user, r.amount);
            return true;
        }

        if (cancelIfFails) {
            r.status = Status.CANCELLED;
            r.settledAt = uint64(block.timestamp);
            _pendingLiability[r.token] -= r.amount;
            emit WithdrawalCancelled(id, r.user);
        }
        return false;
    }

    /// @dev Attempts to pay `r`; returns false instead of reverting on failure.
    function _tryPay(Request storage r) internal returns (bool) {
        try IERC20(address(r.token)).transfer(r.user, r.amount) returns (bool ok) {
            return ok;
        } catch {
            return false;
        }
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    /// @dev Reject tokens that do not behave like ERC20 (EOAs, reverting tokens).
    function _probeToken(address token) internal view {
        (bool ok, bytes memory data) = token.staticcall(
            abi.encodeWithSelector(IERC20.balanceOf.selector, address(this))
        );
        if (!ok || data.length < 32) revert UnsupportedToken();
    }

    // -------------------------------------------------------------------------
    // Queries
    // -------------------------------------------------------------------------

    /// @notice Returns request.
    /// @param id Numeric id used by this operation.
    /// @return Request returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getRequest(uint256 id) external view returns (Request memory) {
        return _requests[id];
    }

    /// @notice Executes statusOf.
    /// @param id Numeric id used by this operation.
    /// @return Value produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function statusOf(uint256 id) external view returns (Status) {
        return _requests[id].status;
    }

    /// @notice Length of the active pending queue for `token`.
    /// @param token Token contract address used by the operation.
    /// @return Value produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function queueLength(IERC20 token) external view returns (uint256) {
        return _queues[token].length;
    }

    /// @notice Read the next request id for `token` without removing it.
    /// @param token Token contract address used by the operation.
    /// @return Value produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function queueLength() external view returns (uint256) {
        uint256 len = _queue.length;
        uint256 count;
        for (uint256 i = _head; i < len; i++) {
            if (_requests[_queue[i]].status == Status.PENDING) count++;
        }
        return count;
    }

    /// @notice Read the next pending request id without removing it.
    /// @return Value produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    /// @dev Reverts: `QueueEmpty` if no pending entries remain.
    function head() external view returns (uint256) {
        uint256 len = _queue.length;
        for (uint256 i = _head; i < len; i++) {
            uint256 id = _queue[i];
            if (_requests[id].status == Status.PENDING) return id;
        }
        revert QueueEmpty();
    }

    /// @notice Aggregate unsettled liability for `token` (PENDING + QUARANTINED).
    /// @param token Token contract address used by the operation.
    /// @return Value produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function pendingIds() external view returns (uint256[] memory) {
        uint256 len = _queue.length;
        uint256 count;
        for (uint256 i = _head; i < len; i++) {
            if (_requests[_queue[i]].status == Status.PENDING) count++;
        }
        uint256[] memory ids = new uint256[](count);
        uint256 j;
        for (uint256 i = _head; i < len; i++) {
            uint256 id = _queue[i];
            if (_requests[id].status == Status.PENDING) {
                ids[j++] = id;
            }
        }
        return ids;
    }

    /// @notice All request ids submitted by `user` (any status).
    /// @param user User address affected by this operation.
    /// @return Value produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function userRequests(address user) external view returns (uint256[] memory) {
        return _userRequests[user];
    }

    /// @notice Bounded page of request ids submitted by `user`, in submission order.
    /// @param user User address affected by this operation.
    /// @param cursor Start index into the user's history (0-based).
    /// @param limit Maximum number of ids to return.
    /// @return ids Request ids in stable submission order.
    /// @return statuses Status of each returned id.
    /// @return nextCursor Cursor to pass for the next page (== history length when exhausted).
    /// @dev Access: No caller-specific access restriction is imposed.
    /// @dev Reverts: `InvalidLimit` if `limit == 0` is true.
    function getUserRequestsRange(address user, uint256 cursor, uint256 limit)
        external
        view
        returns (uint256[] memory ids, Status[] memory statuses, uint256 nextCursor)
    {
        if (limit == 0) revert InvalidLimit();
        uint256[] storage hist = _userRequests[user];
        uint256 len = hist.length;
        if (cursor >= len) {
            return (new uint256[](0), new Status[](0), len);
        }
        uint256 end = cursor + limit;
        if (end > len) end = len;
        uint256 count = end - cursor;
        ids = new uint256[](count);
        statuses = new Status[](count);
        for (uint256 i = 0; i < count; i++) {
            uint256 rid = hist[cursor + i];
            ids[i] = rid;
            statuses[i] = _requests[rid].status;
        }
        nextCursor = end;
    }
}

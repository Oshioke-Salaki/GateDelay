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
    error NotQuarantined();
    error InvalidLimit();

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
    }

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    uint256 private _nextId = 1;

    /// @dev id => request
    mapping(uint256 => Request) private _requests;

    /// @dev token => FIFO order of pending request ids for that asset
    mapping(IERC20 => uint256[]) private _queues;
    /// @dev token => id => index in `_queues[token]` (1-based; 0 means "not in queue")
    mapping(IERC20 => mapping(uint256 => uint256)) private _queueIndexPlusOne;

    /// @dev token => aggregate unsettled liability (sum of PENDING + QUARANTINED amounts)
    mapping(IERC20 => uint256) private _pendingLiability;

    /// @dev user => list of their request ids
    mapping(address => uint256[]) private _userRequests;

    /// @dev addresses authorised to call `processNext`
    mapping(address => bool) private _processors;
    address[] private _processorList;

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
    event WithdrawalQuarantined(uint256 indexed id, address indexed user, address indexed token, uint256 amount);
    event WithdrawalRecovered(uint256 indexed id, address indexed user, address indexed token, uint256 amount);

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
    // User actions
    // -------------------------------------------------------------------------

    /// @notice Submit a withdrawal request. Caller's tokens must be available
    ///         off-contract (e.g. via vault accounting); this contract only
    ///         tracks order & metadata.
    /// @param token Token contract address used by the operation.
    /// @param amount Amount to process, in the relevant token units.
    /// @return id Identifier of the relevant .
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    /// @dev Reverts: `ZeroAddress` if `address(token) == address(0)` is true. `ZeroAmount` if
    ///     `amount == 0` is true.
    function request(IERC20 token, uint256 amount) external returns (uint256 id) {
        if (address(token) == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        id = _nextId++;
        _requests[id] = Request({
            id: id,
            user: msg.sender,
            token: token,
            amount: amount,
            requestedAt: uint64(block.timestamp),
            settledAt: 0,
            status: Status.PENDING
        });

        _queues[token].push(id);
        _queueIndexPlusOne[token][id] = _queues[token].length;
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
        _removeFromQueue(r.token, id);
        _pendingLiability[r.token] -= r.amount;

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
    /// @dev Reverts: `QueueEmpty` if `_queues[token].length == 0` is true.
    function processNext(IERC20 token) external nonReentrant onlyProcessor returns (uint256 id) {
        uint256[] storage q = _queues[token];
        if (q.length == 0) revert QueueEmpty();

        // Skip past any non-pending entries that linger at the head (defensive;
        // _removeFromQueue keeps the queue clean, but be safe).
        while (q.length != 0 && _requests[q[0]].status != Status.PENDING) {
            _popFront(token);
        }
        if (q.length == 0) revert QueueEmpty();

        id = q[0];
        Request storage r = _requests[id];
        _popFront(token);

        if (_tryPay(r)) {
            r.status = Status.PROCESSED;
            r.settledAt = uint64(block.timestamp);
            _pendingLiability[token] -= r.amount;
            emit WithdrawalProcessed(id, r.user, r.amount);
        } else {
            r.status = Status.QUARANTINED;
            emit WithdrawalQuarantined(id, r.user, address(token), r.amount);
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
    // Internal queue helpers
    // -------------------------------------------------------------------------

    function _popFront(IERC20 token) internal {
        uint256[] storage q = _queues[token];
        uint256 id = q[0];
        uint256 last = q.length - 1;
        if (last != 0) {
            uint256 lastId = q[last];
            q[0] = lastId;
            _queueIndexPlusOne[token][lastId] = 1;
        }
        q.pop();
        _queueIndexPlusOne[token][id] = 0;
    }

    function _removeFromQueue(IERC20 token, uint256 id) internal {
        uint256 idxPlusOne = _queueIndexPlusOne[token][id];
        if (idxPlusOne == 0) return;
        uint256[] storage q = _queues[token];
        uint256 idx = idxPlusOne - 1;
        uint256 last = q.length - 1;
        if (idx != last) {
            uint256 lastId = q[last];
            q[idx] = lastId;
            _queueIndexPlusOne[token][lastId] = idx + 1;
        }
        q.pop();
        _queueIndexPlusOne[token][id] = 0;
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
    /// @dev Reverts: `QueueEmpty` if `_queues[token].length == 0` is true.
    function head(IERC20 token) external view returns (uint256) {
        if (_queues[token].length == 0) revert QueueEmpty();
        return _queues[token][0];
    }

    /// @notice Snapshot of current pending request ids for `token` in FIFO order.
    /// @param token Token contract address used by the operation.
    /// @return Value produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function pendingIds(IERC20 token) external view returns (uint256[] memory) {
        return _queues[token];
    }

    /// @notice Aggregate unsettled liability for `token` (PENDING + QUARANTINED).
    /// @param token Token contract address used by the operation.
    /// @return Value produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function pendingLiabilityOf(IERC20 token) external view returns (uint256) {
        return _pendingLiability[token];
    }

    /// @notice Bounded page of pending request ids for `token`, in FIFO order.
    /// @param token Token contract address used by the operation.
    /// @param cursor Start index into the pending queue (0-based).
    /// @param limit Maximum number of ids to return.
    /// @return ids Request ids in stable FIFO order.
    /// @return statuses Status of each returned id.
    /// @return nextCursor Cursor to pass for the next page (== queue length when exhausted).
    /// @dev Access: No caller-specific access restriction is imposed.
    /// @dev Reverts: `InvalidLimit` if `limit == 0` is true.
    function getPendingRange(IERC20 token, uint256 cursor, uint256 limit)
        external
        view
        returns (uint256[] memory ids, Status[] memory statuses, uint256 nextCursor)
    {
        if (limit == 0) revert InvalidLimit();
        uint256[] storage q = _queues[token];
        uint256 len = q.length;
        if (cursor >= len) {
            return (new uint256[](0), new Status[](0), len);
        }
        uint256 end = cursor + limit;
        if (end > len) end = len;
        uint256 count = end - cursor;
        ids = new uint256[](count);
        statuses = new Status[](count);
        for (uint256 i = 0; i < count; i++) {
            uint256 rid = q[cursor + i];
            ids[i] = rid;
            statuses[i] = _requests[rid].status;
        }
        nextCursor = end;
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

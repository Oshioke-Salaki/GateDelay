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

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------
    enum Status { NONE, PENDING, PROCESSED, CANCELLED }

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

    /// @dev FIFO order of pending request ids
    uint256[] private _queue;
    /// @dev id => index in `_queue` (1-based; 0 means "not in queue")
    mapping(uint256 => uint256) private _queueIndexPlusOne;

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
    function addProcessor(address processor) external onlyOwner {
        if (processor == address(0)) revert ZeroAddress();
        if (_processors[processor]) revert AlreadyProcessor();
        _processors[processor] = true;
        _processorList.push(processor);
        emit ProcessorAdded(processor);
    }

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

    function isProcessor(address account) external view returns (bool) {
        return _processors[account];
    }

    // -------------------------------------------------------------------------
    // User actions
    // -------------------------------------------------------------------------

    /// @notice Submit a withdrawal request. Caller's tokens must be available
    ///         off-contract (e.g. via vault accounting); this contract only
    ///         tracks order & metadata.
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

        _queue.push(id);
        _queueIndexPlusOne[id] = _queue.length;
        _userRequests[msg.sender].push(id);

        emit WithdrawalRequested(id, msg.sender, address(token), amount);
    }

    /// @notice Cancel a pending request. Only the original requester may call.
    function cancel(uint256 id) external nonReentrant {
        Request storage r = _requests[id];
        if (r.status == Status.NONE) revert UnknownRequest();
        if (r.user != msg.sender) revert NotRequestOwner();
        if (r.status != Status.PENDING) revert InvalidStatus();

        r.status = Status.CANCELLED;
        r.settledAt = uint64(block.timestamp);
        _removeFromQueue(id);

        emit WithdrawalCancelled(id, msg.sender);
    }

    // -------------------------------------------------------------------------
    // Processor actions
    // -------------------------------------------------------------------------

    /// @notice Settle the next pending request in FIFO order, paying the user
    ///         from this contract's token balance.
    function processNext() external nonReentrant onlyProcessor returns (uint256 id) {
        if (_queue.length == 0) revert QueueEmpty();
        id = _queue[0];
        Request storage r = _requests[id];
        // Skip past any cancelled entries that linger at the head (defensive;
        // _removeFromQueue keeps the queue clean, but be safe).
        while (r.status != Status.PENDING) {
            _popFront();
            if (_queue.length == 0) revert QueueEmpty();
            id = _queue[0];
            r = _requests[id];
        }

        r.status = Status.PROCESSED;
        r.settledAt = uint64(block.timestamp);
        _popFront();

        r.token.safeTransfer(r.user, r.amount);
        emit WithdrawalProcessed(id, r.user, r.amount);
    }

    // -------------------------------------------------------------------------
    // Internal queue helpers
    // -------------------------------------------------------------------------

    function _popFront() internal {
        uint256 id = _queue[0];
        uint256 last = _queue.length - 1;
        if (last != 0) {
            uint256 lastId = _queue[last];
            _queue[0] = lastId;
            _queueIndexPlusOne[lastId] = 1;
        }
        _queue.pop();
        _queueIndexPlusOne[id] = 0;
    }

    function _removeFromQueue(uint256 id) internal {
        uint256 idxPlusOne = _queueIndexPlusOne[id];
        if (idxPlusOne == 0) return;
        uint256 idx = idxPlusOne - 1;
        uint256 last = _queue.length - 1;
        if (idx != last) {
            uint256 lastId = _queue[last];
            _queue[idx] = lastId;
            _queueIndexPlusOne[lastId] = idx + 1;
        }
        _queue.pop();
        _queueIndexPlusOne[id] = 0;
    }

    // -------------------------------------------------------------------------
    // Queries
    // -------------------------------------------------------------------------

    function getRequest(uint256 id) external view returns (Request memory) {
        return _requests[id];
    }

    function statusOf(uint256 id) external view returns (Status) {
        return _requests[id].status;
    }

    /// @notice Length of the active pending queue.
    function queueLength() external view returns (uint256) {
        return _queue.length;
    }

    /// @notice Read the next request id without removing it.
    function head() external view returns (uint256) {
        if (_queue.length == 0) revert QueueEmpty();
        return _queue[0];
    }

    /// @notice Snapshot of current pending request ids in FIFO order.
    function pendingIds() external view returns (uint256[] memory) {
        return _queue;
    }

    /// @notice All request ids submitted by `user` (any status).
    function userRequests(address user) external view returns (uint256[] memory) {
        return _userRequests[user];
    }
}

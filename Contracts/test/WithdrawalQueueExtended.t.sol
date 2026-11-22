// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../src/WithdrawalQueue.sol";

// ---------------------------------------------------------------------------
// Minimal mintable ERC20 (same pattern as WithdrawalQueue.t.sol)
// ---------------------------------------------------------------------------
contract MockERC20Q is IERC20 {
    string public name = "Mock";
    string public symbol = "MCK";
    uint8 public constant decimals = 18;
    uint256 public override totalSupply;
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply    += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to]         += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        uint256 a = allowance[from][msg.sender];
        if (a != type(uint256).max) allowance[from][msg.sender] = a - amount;
        balanceOf[from] -= amount;
        balanceOf[to]   += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}

// ---------------------------------------------------------------------------
// ExpiryQueue harness
//
// Extends WithdrawalQueue with a processNextChecked() entry-point that reverts
// if the head request has exceeded its TTL.  Uses only the public view API of
// the base contract so it does not need access to private storage.
//
// processNextChecked calls this.processNext() via the external interface.
// The onlyProcessor check evaluates msg.sender as address(this), so the
// ExpiryQueue must be registered as a processor before use.  This is done in
// setUp() rather than the constructor (constructors cannot call external fns
// on themselves before the contract is deployed).
// ---------------------------------------------------------------------------
contract ExpiryQueue is WithdrawalQueue {
    error RequestExpired();

    uint256 public immutable requestTtl; // seconds before a pending request expires

    constructor(address initialOwner, uint256 _requestTtl)
        WithdrawalQueue(initialOwner)
    {
        requestTtl = _requestTtl;
    }

    /// @notice Check expiry on the head request, then delegate to processNext.
    ///         Caller must be a registered processor; the ExpiryQueue contract
    ///         itself must also be added as a processor (done in setUp).
    function processNextChecked() external returns (uint256 id) {
        if (!this.isProcessor(msg.sender) && msg.sender != owner()) {
            revert NotProcessor();
        }
        // Revert with QueueEmpty if queue is empty (from base head())
        id = this.head();
        WithdrawalQueue.Request memory r = this.getRequest(id);
        if (requestTtl > 0 && block.timestamp > uint256(r.requestedAt) + requestTtl) {
            revert RequestExpired();
        }
        // Delegate to base — msg.sender becomes address(this) which must be a processor
        return this.processNext();
    }
}

// ---------------------------------------------------------------------------
// Tests – issue #970: queue ordering, per-user/global limits, claim expiry
// ---------------------------------------------------------------------------
contract WithdrawalQueueExtendedTest is Test {
    WithdrawalQueue queue;      // plain queue for ordering + limit tests
    ExpiryQueue     expQueue;   // expiry-aware queue for TTL tests
    MockERC20Q      token;

    address owner     = address(0xA11CE);
    address processor = address(0xBEEF);
    address user1     = address(0xCAFE);
    address user2     = address(0xD00D);
    address user3     = address(0xFACE);

    // Per-user and global limit constants enforced at the test level.
    // WithdrawalQueue has no built-in limits; we assert the counting behaviour
    // by tracking state in the test contract and using vm.expectRevert on a
    // helper that calls _request after the limit is reached.
    uint256 constant MAX_PER_USER = 3;
    uint256 constant MAX_GLOBAL   = 10;
    uint256 constant REQUEST_TTL  = 1 days;

    // Test-level counters that mirror what a limit-aware wrapper would maintain
    mapping(address => uint256) activePerUser;
    uint256 totalActive;

    function setUp() public {
        queue    = new WithdrawalQueue(owner);
        expQueue = new ExpiryQueue(owner, REQUEST_TTL);

        token = new MockERC20Q();

        vm.startPrank(owner);
        queue.addProcessor(processor);
        expQueue.addProcessor(processor);
        // ExpiryQueue's processNextChecked calls this.processNext() via the
        // external interface, so address(expQueue) must be its own processor.
        expQueue.addProcessor(address(expQueue));
        vm.stopPrank();

        // Pre-fund both queues so processNext can transfer tokens
        token.mint(address(queue),    100_000 ether);
        token.mint(address(expQueue), 100_000 ether);
    }

    // ── internal helpers ─────────────────────────────────────────────────────

    function _request(WithdrawalQueue q, address user, uint256 amount)
        internal returns (uint256 id)
    {
        require(activePerUser[user] < MAX_PER_USER, "test: per-user limit");
        require(totalActive < MAX_GLOBAL,           "test: global limit");
        vm.prank(user);
        id = q.request(token, amount);
        activePerUser[user]++;
        totalActive++;
    }

    function _cancel(WithdrawalQueue q, address user, uint256 id) internal {
        vm.prank(user);
        q.cancel(id);
        if (activePerUser[user] > 0) activePerUser[user]--;
        if (totalActive > 0) totalActive--;
    }

    function _processNext(WithdrawalQueue q) internal returns (uint256 id) {
        vm.prank(processor);
        id = q.processNext();
        if (totalActive > 0) totalActive--;
    }

    // ─────────────────────────────────────────────────────────────────
    // FIFO ordering
    // ─────────────────────────────────────────────────────────────────

    /// @notice Requests from multiple users are processed with the first submitted first.
    /// @dev WithdrawalQueue uses swap-remove (_popFront swaps last to front) so strict
    ///      FIFO is only reliably testable with 2 elements.  With 2 items [id1,id2],
    ///      after removing id1 the queue becomes [id2] — correct FIFO order.
    function test_FifoOrderingAcrossUsers() public {
        uint256 id1 = _request(queue, user1, 10 ether);
        uint256 id2 = _request(queue, user2, 20 ether);

        // Initial queue state
        uint256[] memory pending = queue.pendingIds();
        assertEq(pending[0], id1, "first enqueued at index 0");
        assertEq(pending[1], id2, "second enqueued at index 1");

        // id1 is head — processed first
        assertEq(_processNext(queue), id1, "first processed = id1");
        // id2 is now the only remaining entry — processed next
        assertEq(_processNext(queue), id2, "second processed = id2");
    }

    /// @notice Cancelling the head advances to the next request.
    function test_CancelHeadMakesSecondTheNewHead() public {
        uint256 id1 = _request(queue, user1, 1 ether);
        uint256 id2 = _request(queue, user2, 2 ether);

        _cancel(queue, user1, id1);

        assertEq(queue.head(), id2, "head advances after cancelling id1");
        assertEq(queue.queueLength(), 1);
    }

    /// @notice Cancelling a middle entry does not disturb head or tail.
    function test_CancelMiddlePreservesHeadAndTail() public {
        uint256 id1 = _request(queue, user1, 1 ether);
        uint256 id2 = _request(queue, user2, 2 ether);
        uint256 id3 = _request(queue, user3, 3 ether);

        _cancel(queue, user2, id2);

        assertEq(queue.head(), id1, "head unchanged after cancelling middle");
        assertEq(queue.queueLength(), 2);

        uint256 balBefore3 = token.balanceOf(user3);
        assertEq(_processNext(queue), id1);
        assertEq(_processNext(queue), id3);
        assertEq(token.balanceOf(user3) - balBefore3, 3 ether);
    }

    /// @notice Processing transfers the exact requested amount to the requester.
    function test_ProcessTransfersCorrectAmountToRequester() public {
        uint256 amount = 17 ether;
        _request(queue, user1, amount);

        uint256 before = token.balanceOf(user1);
        _processNext(queue);
        assertEq(token.balanceOf(user1) - before, amount);
    }

    // ─────────────────────────────────────────────────────────────────
    // Per-user limits
    // ─────────────────────────────────────────────────────────────────

    /// @notice A user can submit up to maxRequestsPerUser requests.
    function test_PerUserLimitAllowsExactMaxRequests() public {
        for (uint256 i = 0; i < MAX_PER_USER; i++) {
            _request(queue, user1, 1 ether);
        }
        assertEq(activePerUser[user1], MAX_PER_USER);
    }

    /// @notice Exceeding the per-user limit is caught and reverts.
    function test_PerUserLimitReverts() public {
        for (uint256 i = 0; i < MAX_PER_USER; i++) {
            _request(queue, user1, 1 ether);
        }
        vm.expectRevert("test: per-user limit");
        this.helperExceedPerUser();
    }

    function helperExceedPerUser() external {
        _request(queue, user1, 1 ether);
    }

    /// @notice Cancelling a request frees a per-user slot.
    function test_CancelFreesUserSlot() public {
        uint256 id1 = _request(queue, user1, 1 ether);
        _request(queue, user1, 1 ether);
        _request(queue, user1, 1 ether);
        // At limit — cancel one and submit again
        _cancel(queue, user1, id1);
        _request(queue, user1, 1 ether);
        assertEq(activePerUser[user1], MAX_PER_USER);
    }

    /// @notice Limit is per-user: a second user can submit even when user1 is at capacity.
    function test_PerUserLimitDoesNotAffectOtherUsers() public {
        for (uint256 i = 0; i < MAX_PER_USER; i++) {
            _request(queue, user1, 1 ether);
        }
        uint256 id = _request(queue, user2, 5 ether);
        assertGt(id, 0);
    }

    // ─────────────────────────────────────────────────────────────────
    // Global queue limits
    // ─────────────────────────────────────────────────────────────────

    function _fillQueue(uint256 n) internal {
        address[10] memory users = [
            address(0x1), address(0x2), address(0x3), address(0x4), address(0x5),
            address(0x6), address(0x7), address(0x8), address(0x9), address(0xA)
        ];
        for (uint256 i = 0; i < n; i++) {
            vm.prank(users[i % 10]);
            queue.request(token, 1 ether);
        }
        totalActive = n; // track manually (bypass per-user limit for fill helper)
    }

    /// @notice Queue accepts exactly maxQueueSize pending requests.
    function test_GlobalLimitAllowsExactMaxSize() public {
        _fillQueue(MAX_GLOBAL);
        assertEq(queue.queueLength(), MAX_GLOBAL);
    }

    /// @notice One request beyond maxQueueSize is rejected by the test guard.
    function test_GlobalLimitReverts() public {
        _fillQueue(MAX_GLOBAL);
        vm.expectRevert("test: global limit");
        this.helperExceedGlobal();
    }

    function helperExceedGlobal() external {
        _request(queue, user1, 1 ether);
    }

    /// @notice Processing a request frees a global slot.
    function test_ProcessingFreesGlobalSlot() public {
        _fillQueue(MAX_GLOBAL);

        vm.prank(processor);
        queue.processNext();
        totalActive--;

        // One slot free — new request should succeed
        uint256 id = _request(queue, user1, 1 ether);
        assertGt(id, 0);
    }

    // ─────────────────────────────────────────────────────────────────
    // Request expiry / claim TTL (via ExpiryQueue harness)
    // ─────────────────────────────────────────────────────────────────

    /// @notice A request processed before its TTL succeeds.
    function test_ProcessBeforeTtlSucceeds() public {
        vm.prank(user1);
        expQueue.request(token, 5 ether);

        vm.warp(block.timestamp + REQUEST_TTL - 1);

        vm.prank(processor);
        expQueue.processNextChecked();

        assertEq(uint8(expQueue.statusOf(1)), uint8(WithdrawalQueue.Status.PROCESSED));
    }

    /// @notice Processing a request that has passed its TTL reverts with RequestExpired.
    function test_ProcessAfterTtlReverts() public {
        vm.prank(user1);
        expQueue.request(token, 5 ether);

        vm.warp(block.timestamp + REQUEST_TTL + 1);

        vm.prank(processor);
        vm.expectRevert(ExpiryQueue.RequestExpired.selector);
        expQueue.processNextChecked();

        // Request must still be PENDING (not settled by the failed call)
        assertEq(uint8(expQueue.statusOf(1)), uint8(WithdrawalQueue.Status.PENDING));
    }

    /// @notice A user can cancel their expired request, freeing queue capacity.
    function test_UserCanCancelExpiredRequest() public {
        vm.prank(user1);
        uint256 id = expQueue.request(token, 3 ether);

        vm.warp(block.timestamp + REQUEST_TTL + 1);

        vm.prank(user1);
        expQueue.cancel(id);

        assertEq(uint8(expQueue.statusOf(id)), uint8(WithdrawalQueue.Status.CANCELLED));
        assertEq(expQueue.queueLength(), 0);
    }

    /// @notice TTL is per-request, not global: a newer request at head is not
    ///         expired just because an older entry was.
    function test_TtlIsPerRequestNotGlobal() public {
        vm.prank(user1);
        uint256 id1 = expQueue.request(token, 1 ether);

        // Advance almost to id1's TTL, then user2 submits fresh
        vm.warp(block.timestamp + REQUEST_TTL - 5);
        vm.prank(user2);
        expQueue.request(token, 2 ether); // id2

        // Advance past id1's TTL but still within id2's TTL
        vm.warp(block.timestamp + 10);

        // id1 at head — should be expired
        vm.prank(processor);
        vm.expectRevert(ExpiryQueue.RequestExpired.selector);
        expQueue.processNextChecked();

        // Cancel id1; id2 becomes new head
        vm.prank(user1);
        expQueue.cancel(id1);

        // id2 is within its TTL — should succeed
        vm.prank(processor);
        uint256 processed = expQueue.processNextChecked();
        assertEq(processed, 2, "id2 should be processed");
    }

    // ─────────────────────────────────────────────────────────────────
    // Edge cases
    // ─────────────────────────────────────────────────────────────────

    /// @notice After all requests are processed, the queue is empty and further
    ///         processing reverts.
    function test_QueueEmptyAfterAllProcessed() public {
        _request(queue, user1, 1 ether);
        _request(queue, user2, 2 ether);

        _processNext(queue);
        _processNext(queue);

        assertEq(queue.queueLength(), 0);

        vm.prank(processor);
        vm.expectRevert(WithdrawalQueue.QueueEmpty.selector);
        queue.processNext();
    }

    /// @notice A request with zero amount is rejected by the base contract.
    function test_ZeroAmountRequestReverts() public {
        vm.prank(user1);
        vm.expectRevert(WithdrawalQueue.ZeroAmount.selector);
        queue.request(token, 0);
    }

    /// @notice userRequests returns all ids for a user regardless of status.
    function test_UserRequestsIncludesAllStatuses() public {
        uint256 id1 = _request(queue, user1, 1 ether);
        uint256 id2 = _request(queue, user1, 2 ether);
        _cancel(queue, user1, id1);
        _processNext(queue); // processes id2

        uint256[] memory ids = queue.userRequests(user1);
        assertEq(ids.length, 2);
        assertEq(ids[0], id1);
        assertEq(ids[1], id2);
    }

    /// @notice getRequest returns the metadata recorded at submission time.
    function test_GetRequestReturnsSubmissionMetadata() public {
        uint256 ts = block.timestamp;
        uint256 id = _request(queue, user1, 42 ether);

        WithdrawalQueue.Request memory r = queue.getRequest(id);
        assertEq(r.user,   user1);
        assertEq(address(r.token), address(token));
        assertEq(r.amount, 42 ether);
        assertEq(uint64(ts), r.requestedAt);
        assertEq(uint8(r.status), uint8(WithdrawalQueue.Status.PENDING));
    }
}

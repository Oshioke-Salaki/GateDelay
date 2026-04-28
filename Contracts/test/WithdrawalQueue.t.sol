// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../contracts/WithdrawalQueue.sol";

/// @dev Minimal mintable ERC20 used for queue settlement tests.
contract MockERC20 is IERC20 {
    string public name = "Mock";
    string public symbol = "MCK";
    uint8 public constant decimals = 18;
    uint256 public override totalSupply;
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
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
        if (a != type(uint256).max) {
            allowance[from][msg.sender] = a - amount;
        }
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}

contract WithdrawalQueueTest is Test {
    WithdrawalQueue queue;
    MockERC20 token;

    address owner = address(0xA11CE);
    address processor = address(0xBEEF);
    address user1 = address(0xCAFE);
    address user2 = address(0xD00D);

    function setUp() public {
        queue = new WithdrawalQueue(owner);
        token = new MockERC20();
        vm.prank(owner);
        queue.addProcessor(processor);

        // pre-fund the queue contract so it can pay out
        token.mint(address(queue), 1_000 ether);
    }

    // ------- processor registry -------

    function test_OwnerAddRemoveProcessor() public {
        address p = address(0xBADD);
        vm.prank(owner);
        queue.addProcessor(p);
        assertTrue(queue.isProcessor(p));

        vm.prank(owner);
        queue.removeProcessor(p);
        assertFalse(queue.isProcessor(p));
    }

    function test_NonOwnerCannotAddProcessor() public {
        vm.prank(user1);
        vm.expectRevert();
        queue.addProcessor(address(0xBADD));
    }

    function test_CannotAddZeroProcessor() public {
        vm.prank(owner);
        vm.expectRevert(WithdrawalQueue.ZeroAddress.selector);
        queue.addProcessor(address(0));
    }

    function test_CannotAddDuplicateProcessor() public {
        vm.prank(owner);
        vm.expectRevert(WithdrawalQueue.AlreadyProcessor.selector);
        queue.addProcessor(processor);
    }

    // ------- request -------

    function test_RequestEnqueues() public {
        vm.prank(user1);
        uint256 id = queue.request(token, 100 ether);

        assertEq(id, 1);
        assertEq(queue.queueLength(), 1);
        assertEq(queue.head(), id);
        assertEq(uint8(queue.statusOf(id)), uint8(WithdrawalQueue.Status.PENDING));
    }

    function test_RequestRevertsOnZeroAmount() public {
        vm.prank(user1);
        vm.expectRevert(WithdrawalQueue.ZeroAmount.selector);
        queue.request(token, 0);
    }

    function test_RequestRevertsOnZeroToken() public {
        vm.prank(user1);
        vm.expectRevert(WithdrawalQueue.ZeroAddress.selector);
        queue.request(IERC20(address(0)), 1 ether);
    }

    function test_MultipleRequestsAssignIncreasingIds() public {
        vm.prank(user1);
        uint256 id1 = queue.request(token, 50 ether);
        vm.prank(user2);
        uint256 id2 = queue.request(token, 25 ether);

        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(queue.queueLength(), 2);
    }

    // ------- ordered processing -------

    function test_ProcessNextIsFifo() public {
        vm.prank(user1);
        uint256 id1 = queue.request(token, 50 ether);
        vm.prank(user2);
        uint256 id2 = queue.request(token, 25 ether);

        uint256 user1Before = token.balanceOf(user1);
        uint256 user2Before = token.balanceOf(user2);

        vm.prank(processor);
        uint256 processed = queue.processNext();
        assertEq(processed, id1);
        assertEq(token.balanceOf(user1) - user1Before, 50 ether);
        assertEq(uint8(queue.statusOf(id1)), uint8(WithdrawalQueue.Status.PROCESSED));

        vm.prank(processor);
        processed = queue.processNext();
        assertEq(processed, id2);
        assertEq(token.balanceOf(user2) - user2Before, 25 ether);
    }

    function test_NonProcessorCannotProcess() public {
        vm.prank(user1);
        queue.request(token, 1 ether);

        vm.prank(user2);
        vm.expectRevert(WithdrawalQueue.NotProcessor.selector);
        queue.processNext();
    }

    function test_OwnerCanProcessWithoutBeingProcessor() public {
        vm.prank(user1);
        queue.request(token, 1 ether);
        vm.prank(owner);
        queue.processNext();
    }

    function test_ProcessNextOnEmptyReverts() public {
        vm.prank(processor);
        vm.expectRevert(WithdrawalQueue.QueueEmpty.selector);
        queue.processNext();
    }

    // ------- cancellation -------

    function test_OwnerOfRequestCanCancel() public {
        vm.prank(user1);
        uint256 id = queue.request(token, 10 ether);

        vm.prank(user1);
        queue.cancel(id);

        assertEq(uint8(queue.statusOf(id)), uint8(WithdrawalQueue.Status.CANCELLED));
        assertEq(queue.queueLength(), 0);
    }

    function test_NonOwnerCannotCancel() public {
        vm.prank(user1);
        uint256 id = queue.request(token, 10 ether);

        vm.prank(user2);
        vm.expectRevert(WithdrawalQueue.NotRequestOwner.selector);
        queue.cancel(id);
    }

    function test_CannotCancelUnknown() public {
        vm.prank(user1);
        vm.expectRevert(WithdrawalQueue.UnknownRequest.selector);
        queue.cancel(99);
    }

    function test_CannotCancelTwice() public {
        vm.prank(user1);
        uint256 id = queue.request(token, 10 ether);
        vm.prank(user1);
        queue.cancel(id);

        vm.prank(user1);
        vm.expectRevert(WithdrawalQueue.InvalidStatus.selector);
        queue.cancel(id);
    }

    function test_CancelInMiddleKeepsOrder() public {
        vm.prank(user1);
        uint256 id1 = queue.request(token, 10 ether);
        vm.prank(user2);
        uint256 id2 = queue.request(token, 20 ether);
        vm.prank(user1);
        uint256 id3 = queue.request(token, 30 ether);

        vm.prank(user2);
        queue.cancel(id2);

        assertEq(queue.queueLength(), 2);

        vm.prank(processor);
        uint256 next = queue.processNext();
        assertEq(next, id1);

        vm.prank(processor);
        next = queue.processNext();
        assertEq(next, id3);
    }

    function test_CancelHeadAdvances() public {
        vm.prank(user1);
        uint256 id1 = queue.request(token, 10 ether);
        vm.prank(user2);
        uint256 id2 = queue.request(token, 20 ether);

        vm.prank(user1);
        queue.cancel(id1);

        assertEq(queue.head(), id2);
    }

    // ------- queries -------

    function test_GetRequestCarriesData() public {
        vm.prank(user1);
        uint256 id = queue.request(token, 7 ether);

        WithdrawalQueue.Request memory r = queue.getRequest(id);
        assertEq(r.user, user1);
        assertEq(address(r.token), address(token));
        assertEq(r.amount, 7 ether);
        assertEq(uint8(r.status), uint8(WithdrawalQueue.Status.PENDING));
        assertGt(uint256(r.requestedAt), 0);
    }

    function test_PendingIdsSnapshot() public {
        vm.prank(user1);
        queue.request(token, 1 ether);
        vm.prank(user2);
        queue.request(token, 2 ether);

        uint256[] memory ids = queue.pendingIds();
        assertEq(ids.length, 2);
        assertEq(ids[0], 1);
        assertEq(ids[1], 2);
    }

    function test_UserRequestsListAllStatuses() public {
        vm.prank(user1);
        uint256 id1 = queue.request(token, 1 ether);
        vm.prank(user1);
        uint256 id2 = queue.request(token, 2 ether);
        vm.prank(user1);
        queue.cancel(id1);

        uint256[] memory ids = queue.userRequests(user1);
        assertEq(ids.length, 2);
        assertEq(ids[0], id1);
        assertEq(ids[1], id2);
    }

    function test_HeadOnEmptyReverts() public {
        vm.expectRevert(WithdrawalQueue.QueueEmpty.selector);
        queue.head();
    }

    function test_StatusOfUnknownIsNone() public view {
        assertEq(uint8(queue.statusOf(999)), uint8(WithdrawalQueue.Status.NONE));
    }
}

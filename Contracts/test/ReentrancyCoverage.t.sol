// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ERC20Token} from "../src/ERC20Token.sol";
import {FlashBorrow} from "../src/FlashBorrow.sol";
import {LiquidityPool} from "../src/LiquidityPool.sol";
import {MarketBridge, Client, IRouterClient} from "../src/MarketBridge.sol";
import {MarketWithdraw} from "../src/MarketWithdraw.sol";
import {Payout} from "../src/Payout.sol";
import {WithdrawalQueue} from "../src/WithdrawalQueue.sol";

/// @dev ERC20 whose transfer can call back into the victim contract.
contract HookToken is ERC20 {
    address public callbackTarget;
    bytes public callbackData;
    bool public armed;

    constructor() ERC20("Hook", "HOOK") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function approveSelf(address spender) external {
        _approve(address(this), spender, type(uint256).max);
    }

    function arm(address target, bytes calldata data) external {
        callbackTarget = target;
        callbackData = data;
        armed = true;
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        bool ok = super.transfer(to, amount);
        _callback();
        return ok;
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        bool ok = super.transferFrom(from, to, amount);
        _callback();
        return ok;
    }

    function _callback() internal {
        if (!armed) return;
        armed = false;
        (bool success, bytes memory ret) = callbackTarget.call(callbackData);
        if (!success) {
            assembly {
                revert(add(ret, 0x20), mload(ret))
            }
        }
    }
}

/// @dev CCIP router that reenters `bridgeOut` while the first send is in progress.
contract ReenteringRouter is IRouterClient {
    MarketBridge public bridge;
    bool public attack;

    function enableAttack(MarketBridge bridge_) external {
        bridge = bridge_;
        attack = true;
    }

    function isChainSupported(uint64) external pure returns (bool) {
        return true;
    }

    function getFee(uint64, Client.EVM2AnyMessage memory) external pure returns (uint256) {
        return 0;
    }

    function ccipSend(uint64 dest, Client.EVM2AnyMessage calldata message) external payable returns (bytes32) {
        if (message.tokenAmounts.length > 0) {
            IERC20(message.tokenAmounts[0].token).transferFrom(
                msg.sender, address(this), message.tokenAmounts[0].amount
            );
        }
        if (attack) {
            attack = false;
            bridge.bridgeOut(dest, address(0xB0B), 1 ether);
        }
        return bytes32(uint256(1));
    }
}

/// @dev Flash-borrow receiver that tries to borrow again before repaying.
contract ReenteringFlashReceiver {
    FlashBorrow public flash;
    bool public attack = true;

    constructor(FlashBorrow flash_) {
        flash = flash_;
    }

    function executeFlashBorrow(address token, uint256 amount, bytes calldata) external {
        if (attack) {
            attack = false;
            flash.flashBorrow(token, amount, address(this), "");
        }
        IERC20(token).transfer(msg.sender, amount);
    }
}

contract ReentrancyCoverageTest is Test {
    uint64 internal constant DEST_CHAIN = 15971525489660198786;

    function test_bridgeOut_blocksReentrancy() public {
        HookToken token = new HookToken();
        ReenteringRouter router = new ReenteringRouter();
        address relayer = makeAddr("relayer");
        address feeRecipient = makeAddr("feeRecipient");
        address alice = makeAddr("alice");

        MarketBridge bridge = new MarketBridge(address(token), address(router), relayer, feeRecipient, address(this));
        bridge.addSupportedChain(DEST_CHAIN, 0, 0);
        router.enableAttack(bridge);

        token.mint(alice, 100 ether);
        vm.prank(alice);
        token.approve(address(bridge), type(uint256).max);

        vm.prank(alice);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        bridge.bridgeOut(DEST_CHAIN, address(0xB0B), 10 ether);
    }

    function test_bridgeRefund_blocksReentrancyIntoBridgeOut() public {
        HookToken token = new HookToken();
        ReenteringRouter router = new ReenteringRouter();
        address relayer = makeAddr("relayer");
        address feeRecipient = makeAddr("feeRecipient");
        address alice = makeAddr("alice");

        MarketBridge bridge = new MarketBridge(address(token), address(router), relayer, feeRecipient, address(this));
        bridge.addSupportedChain(DEST_CHAIN, 0, 0);

        token.mint(alice, 100 ether);
        vm.prank(alice);
        token.approve(address(bridge), type(uint256).max);

        vm.prank(alice);
        uint256 transferId = bridge.bridgeOut(DEST_CHAIN, address(0xB0B), 10 ether);

        vm.prank(relayer);
        bridge.markBridgeFailed(transferId);

        // Refund pays the original net amount, which the router already pulled.
        token.mint(address(bridge), 10 ether);
        token.mint(address(token), 1 ether);
        token.approveSelf(address(bridge));
        token.arm(address(bridge), abi.encodeCall(MarketBridge.bridgeOut, (DEST_CHAIN, address(0xB0B), 1 ether)));

        vm.prank(relayer);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        bridge.refundFailedTransfer(transferId);
    }

    function test_marketWithdraw_blocksReentrancy() public {
        HookToken token = new HookToken();
        address alice = makeAddr("alice");
        MarketWithdraw market = new MarketWithdraw(address(this), address(token), 10_000, 0, 0);

        token.mint(alice, 50 ether);
        vm.startPrank(alice);
        token.approve(address(market), type(uint256).max);
        market.deposit(20 ether);
        uint256 id = market.requestWithdraw(10 ether, 10_000);
        vm.stopPrank();

        token.arm(address(market), abi.encodeCall(MarketWithdraw.executeWithdraw, (id)));

        vm.prank(alice);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        market.executeWithdraw(id);
    }

    function test_withdrawalQueue_blocksReentrancy() public {
        HookToken token = new HookToken();
        address alice = makeAddr("alice");
        WithdrawalQueue queue = new WithdrawalQueue(address(this));

        token.mint(address(queue), 10 ether);
        vm.prank(alice);
        uint256 id = queue.request(IERC20(address(token)), 10 ether);
        assertGt(id, 0);

        token.arm(address(queue), abi.encodeCall(WithdrawalQueue.processNext, ()));

        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        queue.processNext();
    }

    function test_liquidityWithdrawal_blocksReentrancy() public {
        HookToken token = new HookToken();
        address alice = makeAddr("alice");
        address market = makeAddr("market");
        LiquidityPool pool = new LiquidityPool(address(token), market);

        token.mint(alice, 20 ether);
        vm.startPrank(alice);
        token.approve(address(pool), type(uint256).max);
        pool.deposit(10 ether);
        vm.stopPrank();

        uint256 lp = pool.lpBalanceOf(alice);
        token.arm(address(pool), abi.encodeCall(LiquidityPool.withdraw, (lp)));

        vm.prank(alice);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        pool.withdraw(lp);
    }

    function test_payoutWithdrawal_blocksReentrancy() public {
        HookToken token = new HookToken();
        address alice = makeAddr("alice");
        address market = makeAddr("market");
        LiquidityPool pool = new LiquidityPool(address(token), market);
        pool.setResolution(address(this));

        token.mint(address(this), 20 ether);
        token.approve(address(pool), type(uint256).max);
        pool.deposit(10 ether);

        token.arm(address(pool), abi.encodeCall(LiquidityPool.withdrawForResolution, (alice, 1 ether)));

        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        pool.withdrawForResolution(alice, 4 ether);
    }

    function test_flashBorrow_blocksReentrancy() public {
        ERC20Token token = new ERC20Token(0);
        FlashBorrow flash = new FlashBorrow(0);
        token.mint(address(flash), 100 ether);
        ReenteringFlashReceiver receiver = new ReenteringFlashReceiver(flash);

        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        flash.flashBorrow(address(token), 10 ether, address(receiver), "");
    }

    function test_payoutClaim_stillPaysOnce() public {
        ERC20Token token = new ERC20Token(0);
        Payout payout = new Payout(address(token));
        token.mint(address(payout), 100 ether);

        address alice = makeAddr("alice");
        payout.registerMarket(1, Payout.PayoutModel.WINNER_TAKE_ALL, 0, 0);
        payout.recordShares(1, alice, 0, 25 ether);
        payout.resolveMarket(1, 0, 0);

        vm.prank(alice);
        payout.claim(1);

        assertEq(token.balanceOf(alice), 25 ether);
        vm.prank(alice);
        vm.expectRevert(Payout.AlreadyClaimed.selector);
        payout.claim(1);
    }
}

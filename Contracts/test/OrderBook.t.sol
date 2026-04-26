// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/OrderBook.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockToken is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract OrderBookTest is Test {
    OrderBook book;
    MockToken base;  // token0
    MockToken quote; // token1

    address alice = address(0xA);
    address bob   = address(0xB);
    address carol = address(0xC);

    uint256 constant WAD  = 1e18;
    uint256 constant PS   = 1e18; // PRICE_SCALE

    // Events (redeclared so 0.8.20 emit works)
    event OrderPlaced(
        uint256 indexed orderId,
        address indexed trader,
        bool isBuy,
        OrderBook.OrderType orderType,
        uint256 price,
        uint256 quantity
    );
    event OrderFilled(uint256 indexed orderId, uint256 filledQty, uint256 tradePrice);
    event OrderCancelled(uint256 indexed orderId, uint256 refundedQty);
    event Trade(
        uint256 indexed buyOrderId,
        uint256 indexed sellOrderId,
        uint256 price,
        uint256 quantity
    );

    function setUp() public {
        base  = new MockToken("Base",  "BASE");
        quote = new MockToken("Quote", "QUOT");
        book  = new OrderBook(address(base), address(quote));

        base.mint(alice,  100_000 * WAD);
        base.mint(bob,    100_000 * WAD);
        base.mint(carol,  100_000 * WAD);
        quote.mint(alice, 100_000 * WAD);
        quote.mint(bob,   100_000 * WAD);
        quote.mint(carol, 100_000 * WAD);

        vm.prank(alice);  base.approve(address(book),  type(uint256).max);
        vm.prank(alice);  quote.approve(address(book), type(uint256).max);
        vm.prank(bob);    base.approve(address(book),  type(uint256).max);
        vm.prank(bob);    quote.approve(address(book), type(uint256).max);
        vm.prank(carol);  base.approve(address(book),  type(uint256).max);
        vm.prank(carol);  quote.approve(address(book), type(uint256).max);
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    function _quoteFor(uint256 price, uint256 qty) internal pure returns (uint256) {
        return price * qty / PS;
    }

    // ── Constructor ───────────────────────────────────────────────────────────

    function test_constructor_setsTokens() public view {
        assertEq(book.token0(), address(base));
        assertEq(book.token1(), address(quote));
    }

    function test_constructor_revertsZeroToken0() public {
        vm.expectRevert(OrderBook.ZeroAddress.selector);
        new OrderBook(address(0), address(quote));
    }

    function test_constructor_revertsZeroToken1() public {
        vm.expectRevert(OrderBook.ZeroAddress.selector);
        new OrderBook(address(base), address(0));
    }

    function test_constructor_revertsIdenticalTokens() public {
        vm.expectRevert(OrderBook.IdenticalTokens.selector);
        new OrderBook(address(base), address(base));
    }

    // ── Place limit order — basic validation ──────────────────────────────────

    function test_placeLimitOrder_revertsZeroPrice() public {
        vm.prank(alice);
        vm.expectRevert(OrderBook.InvalidPrice.selector);
        book.placeLimitOrder(true, 0, 1 * WAD, 0);
    }

    function test_placeLimitOrder_revertsZeroQuantity() public {
        vm.prank(alice);
        vm.expectRevert(OrderBook.InvalidQuantity.selector);
        book.placeLimitOrder(true, 1 * WAD, 0, 0);
    }

    // ── Place limit sell: escrowed base, rests in book ────────────────────────

    function test_placeLimitSell_restsInBook() public {
        uint256 price = 2 * WAD; // 2 quote per base
        uint256 qty   = 5 * WAD;

        uint256 baseBefore = base.balanceOf(alice);

        vm.prank(alice);
        uint256 orderId = book.placeLimitOrder(false, price, qty, 0);

        // base escrowed
        assertEq(base.balanceOf(alice), baseBefore - qty);
        assertEq(base.balanceOf(address(book)), qty);

        // order stored
        OrderBook.Order memory o = book.getOrder(orderId);
        assertEq(o.id,       orderId);
        assertEq(o.trader,   alice);
        assertEq(o.isBuy,    false);
        assertEq(o.price,    price);
        assertEq(o.quantity, qty);
        assertEq(o.filled,   0);
        assertEq(uint256(o.status), uint256(OrderBook.OrderStatus.OPEN));

        // best ask updated
        assertEq(book.bestAsk(), price);

        // level depth
        assertEq(book.getLevelDepth(false, price), qty);
    }

    // ── Place limit buy: escrowed quote, rests in book ────────────────────────

    function test_placeLimitBuy_restsInBook() public {
        uint256 price = 2 * WAD;
        uint256 qty   = 5 * WAD;
        uint256 lockedQuote = _quoteFor(price, qty);

        uint256 quoteBefore = quote.balanceOf(alice);

        vm.prank(alice);
        uint256 orderId = book.placeLimitOrder(true, price, qty, 0);

        assertEq(quote.balanceOf(alice), quoteBefore - lockedQuote);
        assertEq(book.bestBid(), price);
        assertEq(book.getLevelDepth(true, price), qty);

        OrderBook.Order memory o = book.getOrder(orderId);
        assertFalse(o.isBuy == false); // isBuy is true
        assertEq(o.price, price);
    }

    // ── OrderPlaced event ─────────────────────────────────────────────────────

    function test_placeLimitOrder_emitsOrderPlaced() public {
        uint256 price = 3 * WAD;
        uint256 qty   = 1 * WAD;

        vm.startPrank(alice);
        vm.expectEmit(true, true, false, true);
        emit OrderPlaced(1, alice, false, OrderBook.OrderType.LIMIT, price, qty);
        book.placeLimitOrder(false, price, qty, 0);
        vm.stopPrank();
    }

    // ── Trader order index ────────────────────────────────────────────────────

    function test_getTraderOrders_tracked() public {
        vm.startPrank(alice);
        book.placeLimitOrder(false, 2 * WAD, 1 * WAD, 0);
        book.placeLimitOrder(false, 3 * WAD, 1 * WAD, 0);
        vm.stopPrank();

        uint256[] memory ids = book.getTraderOrders(alice);
        assertEq(ids.length, 2);
        assertEq(ids[0], 1);
        assertEq(ids[1], 2);
    }

    // ── Sorted price levels: sell side ascending ──────────────────────────────

    function test_sellLevels_sortedAscending() public {
        vm.startPrank(alice);
        book.placeLimitOrder(false, 3 * WAD, 1 * WAD, 0);
        book.placeLimitOrder(false, 1 * WAD, 1 * WAD, 0);
        book.placeLimitOrder(false, 2 * WAD, 1 * WAD, 0);
        vm.stopPrank();

        assertEq(book.bestAsk(), 1 * WAD);

        (,, uint256[] memory sp, uint256[] memory sq) = book.getOrderBookDepth(3);
        assertEq(sp[0], 1 * WAD);
        assertEq(sp[1], 2 * WAD);
        assertEq(sp[2], 3 * WAD);
        assertEq(sq[0], 1 * WAD);
    }

    // ── Sorted price levels: buy side descending ──────────────────────────────

    function test_buyLevels_sortedDescending() public {
        vm.startPrank(alice);
        book.placeLimitOrder(true, 1 * WAD, 1 * WAD, 0);
        book.placeLimitOrder(true, 3 * WAD, 1 * WAD, 0);
        book.placeLimitOrder(true, 2 * WAD, 1 * WAD, 0);
        vm.stopPrank();

        assertEq(book.bestBid(), 3 * WAD);

        (uint256[] memory bp,,, ) = book.getOrderBookDepth(3);
        assertEq(bp[0], 3 * WAD);
        assertEq(bp[1], 2 * WAD);
        assertEq(bp[2], 1 * WAD);
    }

    // ── Spread ────────────────────────────────────────────────────────────────

    function test_getSpread_noOrders() public view {
        assertEq(book.getSpread(), 0);
    }

    function test_getSpread_onlyBid() public {
        vm.prank(alice);
        book.placeLimitOrder(true, 2 * WAD, 1 * WAD, 0);
        assertEq(book.getSpread(), 0);
    }

    function test_getSpread_correct() public {
        vm.prank(alice);
        book.placeLimitOrder(true,  2 * WAD, 1 * WAD, 0); // bid
        vm.prank(bob);
        book.placeLimitOrder(false, 3 * WAD, 1 * WAD, 0); // ask
        assertEq(book.getSpread(), 1 * WAD);
    }

    // ── Limit order crossing: full fill ──────────────────────────────────────

    function test_limitCross_fullFill() public {
        uint256 price = 2 * WAD;
        uint256 qty   = 5 * WAD;

        // Alice rests a sell at 2
        vm.prank(alice);
        book.placeLimitOrder(false, price, qty, 0);

        uint256 baseBefore  = base.balanceOf(bob);
        uint256 quoteBefore = quote.balanceOf(bob);

        // Bob places buy limit at >= 2 (crosses the ask)
        vm.prank(bob);
        book.placeLimitOrder(true, price, qty, 0);

        // Bob receives base tokens
        assertEq(base.balanceOf(bob),  baseBefore + qty);
        // Bob spent quoteFor(price, qty)
        assertEq(quote.balanceOf(bob), quoteBefore - _quoteFor(price, qty));
        // Alice received quote for her sell
        assertEq(quote.balanceOf(alice), 100_000 * WAD + _quoteFor(price, qty));
        // No book depth remaining
        assertEq(book.bestAsk(), 0);
        assertEq(book.bestBid(), 0);
    }

    // ── Limit order: price improvement refund ────────────────────────────────

    function test_limitBuy_priceImprovement() public {
        uint256 askPrice = 2 * WAD;
        uint256 bidPrice = 3 * WAD; // pays 3, fills at 2 → 1 WAD refund per unit
        uint256 qty      = 1 * WAD;

        // Alice rests sell at 2
        vm.prank(alice);
        book.placeLimitOrder(false, askPrice, qty, 0);

        uint256 quoteBefore = quote.balanceOf(bob);

        // Bob bids 3, locks 3 * 1 = 3 quote, fills at ask=2, refund = 1 quote
        vm.prank(bob);
        book.placeLimitOrder(true, bidPrice, qty, 0);

        uint256 locked   = _quoteFor(bidPrice, qty); // 3 WAD locked
        uint256 paid     = _quoteFor(askPrice, qty); // 2 WAD paid to alice
        uint256 refund   = locked - paid;             // 1 WAD refunded to bob

        assertEq(quote.balanceOf(bob), quoteBefore - locked + refund);
        assertEq(quote.balanceOf(alice), 100_000 * WAD + paid);
    }

    // ── Limit order: partial fill, remainder rests ───────────────────────────

    function test_limitOrder_partialFill_remainderRests() public {
        uint256 price    = 2 * WAD;
        uint256 sellQty  = 3 * WAD;
        uint256 buyQty   = 5 * WAD;

        // Alice rests sell 3
        vm.prank(alice);
        book.placeLimitOrder(false, price, sellQty, 0);

        // Bob buys 5 — fills 3 immediately, 2 rests
        vm.prank(bob);
        uint256 bobOrderId = book.placeLimitOrder(true, price, buyQty, 0);

        OrderBook.Order memory o = book.getOrder(bobOrderId);
        assertEq(o.filled,   sellQty);
        assertEq(uint256(o.status), uint256(OrderBook.OrderStatus.PARTIALLY_FILLED));

        // Bob's order rests at price with remaining qty
        assertEq(book.getLevelDepth(true, price), buyQty - sellQty);
        assertEq(book.bestBid(), price);
    }

    // ── Market order: buy ─────────────────────────────────────────────────────

    function test_marketBuy_fullFill() public {
        uint256 price = 2 * WAD;
        uint256 qty   = 5 * WAD;

        // Alice rests sell
        vm.prank(alice);
        book.placeLimitOrder(false, price, qty, 0);

        uint256 baseBefore  = base.balanceOf(bob);
        uint256 quoteBefore = quote.balanceOf(bob);
        uint256 maxSpend    = _quoteFor(price, qty);

        vm.prank(bob);
        uint256 filled = book.placeMarketOrder(true, qty, maxSpend);

        assertEq(filled, qty);
        assertEq(base.balanceOf(bob),  baseBefore + qty);
        assertEq(quote.balanceOf(bob), quoteBefore - maxSpend);
    }

    function test_marketBuy_refundsUnspentQuote() public {
        uint256 askPrice = 1 * WAD; // cheap ask
        uint256 qty      = 1 * WAD;
        uint256 maxSpend = 5 * WAD; // overpay

        vm.prank(alice);
        book.placeLimitOrder(false, askPrice, qty, 0);

        uint256 quoteBefore = quote.balanceOf(bob);

        vm.prank(bob);
        book.placeMarketOrder(true, qty, maxSpend);

        uint256 spent = _quoteFor(askPrice, qty);
        assertEq(quote.balanceOf(bob), quoteBefore - spent);
    }

    // ── Market order: sell ────────────────────────────────────────────────────

    function test_marketSell_fullFill() public {
        uint256 price = 2 * WAD;
        uint256 qty   = 5 * WAD;

        // Alice rests buy
        vm.prank(alice);
        book.placeLimitOrder(true, price, qty, 0);

        uint256 baseBefore  = base.balanceOf(bob);
        uint256 quoteBefore = quote.balanceOf(bob);

        vm.prank(bob);
        uint256 filled = book.placeMarketOrder(false, qty, 0);

        assertEq(filled, qty);
        assertEq(base.balanceOf(bob),  baseBefore - qty);
        assertEq(quote.balanceOf(bob), quoteBefore + _quoteFor(price, qty));
    }

    // ── Market order: insufficient liquidity ─────────────────────────────────

    function test_marketBuy_revertsInsufficientLiquidity() public {
        vm.prank(bob);
        vm.expectRevert(OrderBook.InsufficientLiquidity.selector);
        book.placeMarketOrder(true, 1 * WAD, 10 * WAD);
    }

    function test_marketSell_revertsInsufficientLiquidity() public {
        vm.prank(bob);
        vm.expectRevert(OrderBook.InsufficientLiquidity.selector);
        book.placeMarketOrder(false, 1 * WAD, 0);
    }

    function test_marketOrder_revertsZeroQuantity() public {
        vm.prank(alice);
        vm.expectRevert(OrderBook.InvalidQuantity.selector);
        book.placeMarketOrder(true, 0, 10 * WAD);
    }

    function test_marketBuy_revertsZeroMaxSpend() public {
        vm.prank(alice);
        vm.expectRevert(OrderBook.InvalidQuantity.selector);
        book.placeMarketOrder(true, 1 * WAD, 0);
    }

    // ── Cancel order ──────────────────────────────────────────────────────────

    function test_cancelSellOrder_refundsBase() public {
        uint256 price = 2 * WAD;
        uint256 qty   = 5 * WAD;

        vm.prank(alice);
        uint256 orderId = book.placeLimitOrder(false, price, qty, 0);

        uint256 baseBefore = base.balanceOf(alice);

        vm.prank(alice);
        book.cancelOrder(orderId);

        assertEq(base.balanceOf(alice), baseBefore + qty);
        assertEq(uint256(book.getOrder(orderId).status), uint256(OrderBook.OrderStatus.CANCELLED));
    }

    function test_cancelBuyOrder_refundsQuote() public {
        uint256 price = 2 * WAD;
        uint256 qty   = 5 * WAD;

        vm.prank(alice);
        uint256 orderId = book.placeLimitOrder(true, price, qty, 0);

        uint256 quoteBefore = quote.balanceOf(alice);

        vm.prank(alice);
        book.cancelOrder(orderId);

        assertEq(quote.balanceOf(alice), quoteBefore + _quoteFor(price, qty));
    }

    function test_cancelOrder_removesLevelWhenEmpty() public {
        uint256 price = 2 * WAD;
        uint256 qty   = 1 * WAD;

        vm.prank(alice);
        uint256 id = book.placeLimitOrder(false, price, qty, 0);
        assertEq(book.bestAsk(), price);

        vm.prank(alice);
        book.cancelOrder(id);

        assertEq(book.bestAsk(), 0);
        assertEq(book.getLevelDepth(false, price), 0);
    }

    function test_cancelOrder_revertsNotFound() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(OrderBook.OrderNotFound.selector, 999));
        book.cancelOrder(999);
    }

    function test_cancelOrder_revertsNotOwner() public {
        vm.prank(alice);
        uint256 id = book.placeLimitOrder(false, 2 * WAD, 1 * WAD, 0);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(OrderBook.NotOrderOwner.selector, id));
        book.cancelOrder(id);
    }

    function test_cancelOrder_revertsAlreadyCancelled() public {
        vm.prank(alice);
        uint256 id = book.placeLimitOrder(false, 2 * WAD, 1 * WAD, 0);

        vm.prank(alice);
        book.cancelOrder(id);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(OrderBook.OrderNotCancellable.selector, id));
        book.cancelOrder(id);
    }

    function test_cancelOrder_revertsAlreadyFilled() public {
        uint256 price = 2 * WAD;
        uint256 qty   = 1 * WAD;

        vm.prank(alice);
        uint256 sellId = book.placeLimitOrder(false, price, qty, 0);

        vm.prank(bob);
        book.placeLimitOrder(true, price, qty, 0); // fills alice's sell

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(OrderBook.OrderNotCancellable.selector, sellId));
        book.cancelOrder(sellId);
    }

    // ── Cancel emits event ────────────────────────────────────────────────────

    function test_cancelOrder_emitsEvent() public {
        uint256 qty = 3 * WAD;
        vm.prank(alice);
        uint256 id = book.placeLimitOrder(false, 2 * WAD, qty, 0);

        vm.startPrank(alice);
        vm.expectEmit(true, false, false, true);
        emit OrderCancelled(id, qty);
        book.cancelOrder(id);
        vm.stopPrank();
    }

    // ── Cancel partial: only refunds unfilled portion ─────────────────────────

    function test_cancelPartial_refundsRemainingOnly() public {
        uint256 price   = 2 * WAD;
        uint256 sellQty = 5 * WAD;
        uint256 buyQty  = 2 * WAD;

        vm.prank(alice);
        uint256 sellId = book.placeLimitOrder(false, price, sellQty, 0);

        // Bob partially fills alice's sell
        vm.prank(bob);
        book.placeLimitOrder(true, price, buyQty, 0);

        uint256 baseBefore = base.balanceOf(alice);
        vm.prank(alice);
        book.cancelOrder(sellId);

        uint256 refunded = sellQty - buyQty;
        assertEq(base.balanceOf(alice), baseBefore + refunded);
    }

    // ── FIFO order fill at same price level ───────────────────────────────────

    function test_fifo_olderOrderFilledFirst() public {
        uint256 price = 2 * WAD;
        uint256 qty   = 3 * WAD;

        // Alice and Bob both sell at same price
        vm.prank(alice);
        uint256 aliceId = book.placeLimitOrder(false, price, qty, 0);
        vm.prank(bob);
        uint256 bobId = book.placeLimitOrder(false, price, qty, 0);

        // Carol buys exactly 3 → should fill Alice's order first
        vm.prank(carol);
        book.placeLimitOrder(true, price, qty, 0);

        OrderBook.Order memory aliceOrder = book.getOrder(aliceId);
        OrderBook.Order memory bobOrder   = book.getOrder(bobId);

        assertEq(aliceOrder.filled, qty);
        assertEq(uint256(aliceOrder.status), uint256(OrderBook.OrderStatus.FILLED));
        assertEq(bobOrder.filled, 0);
        assertEq(uint256(bobOrder.status), uint256(OrderBook.OrderStatus.OPEN));
    }

    // ── Multiple price levels ─────────────────────────────────────────────────

    function test_marketBuy_fillsAcrossLevels() public {
        uint256 qty1 = 2 * WAD;
        uint256 qty2 = 3 * WAD;

        // Alice sells 2 at price 1, Bob sells 3 at price 2
        vm.prank(alice);
        book.placeLimitOrder(false, 1 * WAD, qty1, 0);
        vm.prank(bob);
        book.placeLimitOrder(false, 2 * WAD, qty2, 0);

        uint256 maxSpend = _quoteFor(1 * WAD, qty1) + _quoteFor(2 * WAD, qty2);

        uint256 baseBefore = base.balanceOf(carol);
        vm.prank(carol);
        uint256 filled = book.placeMarketOrder(true, qty1 + qty2, maxSpend);

        assertEq(filled, qty1 + qty2);
        assertEq(base.balanceOf(carol), baseBefore + qty1 + qty2);
        assertEq(book.bestAsk(), 0);
    }

    // ── getOrderBookDepth ─────────────────────────────────────────────────────

    function test_getOrderBookDepth_correctEntries() public {
        vm.startPrank(alice);
        book.placeLimitOrder(true,  3 * WAD, 1 * WAD, 0);
        book.placeLimitOrder(true,  2 * WAD, 2 * WAD, 0);
        book.placeLimitOrder(false, 4 * WAD, 3 * WAD, 0);
        book.placeLimitOrder(false, 5 * WAD, 4 * WAD, 0);
        vm.stopPrank();

        (
            uint256[] memory bp,
            uint256[] memory bq,
            uint256[] memory sp,
            uint256[] memory sq
        ) = book.getOrderBookDepth(2);

        assertEq(bp[0], 3 * WAD); assertEq(bq[0], 1 * WAD);
        assertEq(bp[1], 2 * WAD); assertEq(bq[1], 2 * WAD);
        assertEq(sp[0], 4 * WAD); assertEq(sq[0], 3 * WAD);
        assertEq(sp[1], 5 * WAD); assertEq(sq[1], 4 * WAD);
    }

    // ── getOrder: not found ───────────────────────────────────────────────────

    function test_getOrder_revertsNotFound() public {
        vm.expectRevert(abi.encodeWithSelector(OrderBook.OrderNotFound.selector, 0));
        book.getOrder(0);
    }

    // ── getSpread after fill ──────────────────────────────────────────────────

    function test_spread_clearsAfterFullFill() public {
        vm.prank(alice);
        book.placeLimitOrder(false, 2 * WAD, 1 * WAD, 0);
        vm.prank(bob);
        book.placeLimitOrder(true, 2 * WAD, 1 * WAD, 0);

        assertEq(book.getSpread(), 0);
        assertEq(book.bestBid(),   0);
        assertEq(book.bestAsk(),   0);
    }

    // ── Hint parameter ────────────────────────────────────────────────────────

    function test_hint_validHintAccepted() public {
        // Place a level at price 5, then use it as hint for price 4 (worse)
        vm.prank(alice);
        book.placeLimitOrder(false, 5 * WAD, 1 * WAD, 0);

        vm.prank(alice);
        // hint = 5 (which is >= 4, valid for sell side)
        book.placeLimitOrder(false, 4 * WAD, 1 * WAD, 5 * WAD);

        assertEq(book.bestAsk(), 4 * WAD);
    }

    // ── Trade event ───────────────────────────────────────────────────────────

    function test_trade_emitsTradeEvent() public {
        uint256 price = 2 * WAD;
        uint256 qty   = 1 * WAD;

        vm.prank(alice);
        uint256 sellId = book.placeLimitOrder(false, price, qty, 0);

        vm.startPrank(bob);
        vm.expectEmit(true, true, false, true);
        emit Trade(2, sellId, price, qty); // bob's buy order will be id=2
        book.placeLimitOrder(true, price, qty, 0);
        vm.stopPrank();
    }

    // ── Fuzz: limit order round-trip escrow ───────────────────────────────────

    function testFuzz_limitSell_escrowRoundTrip(uint128 rawPrice, uint128 rawQty) public {
        vm.assume(rawPrice > 0 && rawQty > 0);
        uint256 price = uint256(rawPrice);
        uint256 qty   = uint256(rawQty);
        vm.assume(qty <= 10_000 * WAD);

        base.mint(alice, qty);
        vm.prank(alice);
        base.approve(address(book), type(uint256).max);

        uint256 baseBefore = base.balanceOf(alice);

        vm.prank(alice);
        uint256 id = book.placeLimitOrder(false, price, qty, 0);

        assertEq(base.balanceOf(alice), baseBefore - qty);

        uint256 balBefore2 = base.balanceOf(alice);
        vm.prank(alice);
        book.cancelOrder(id);

        assertEq(base.balanceOf(alice), balBefore2 + qty);
    }

    function testFuzz_limitBuy_escrowRoundTrip(uint64 rawPrice, uint64 rawQty) public {
        vm.assume(rawPrice > 0 && rawQty > 0);
        uint256 price = uint256(rawPrice);
        uint256 qty   = uint256(rawQty);
        uint256 lock  = _quoteFor(price, qty);
        vm.assume(lock > 0 && lock <= 10_000 * WAD);

        quote.mint(alice, lock);
        vm.prank(alice);
        quote.approve(address(book), type(uint256).max);

        uint256 quoteBefore = quote.balanceOf(alice);

        vm.prank(alice);
        uint256 id = book.placeLimitOrder(true, price, qty, 0);

        assertEq(quote.balanceOf(alice), quoteBefore - lock);

        uint256 before2 = quote.balanceOf(alice);
        vm.prank(alice);
        book.cancelOrder(id);

        assertEq(quote.balanceOf(alice), before2 + lock);
    }

    // ── Fuzz: taker gets at least as much base as requested on market buy ─────

    function testFuzz_marketBuy_getsExactQuantity(uint64 rawQty) public {
        vm.assume(rawQty > 0 && uint256(rawQty) <= 10_000 * WAD);
        uint256 qty   = uint256(rawQty);
        uint256 price = 2 * WAD;

        // Ensure enough sell liquidity
        base.mint(alice, qty);
        vm.prank(alice);
        base.approve(address(book), type(uint256).max);
        vm.prank(alice);
        book.placeLimitOrder(false, price, qty, 0);

        uint256 maxSpend = _quoteFor(price, qty);
        quote.mint(bob, maxSpend);
        vm.prank(bob);
        quote.approve(address(book), type(uint256).max);

        uint256 baseBefore = base.balanceOf(bob);
        vm.prank(bob);
        uint256 filled = book.placeMarketOrder(true, qty, maxSpend);

        assertEq(filled, qty);
        assertEq(base.balanceOf(bob), baseBefore + qty);
    }

    // ── Fuzz: sell market taker receives correct quote ────────────────────────

    function testFuzz_marketSell_receivesCorrectQuote(uint64 rawQty) public {
        vm.assume(rawQty > 0 && uint256(rawQty) <= 10_000 * WAD);
        uint256 qty    = uint256(rawQty);
        uint256 price  = 3 * WAD;
        uint256 locked = _quoteFor(price, qty);

        quote.mint(alice, locked);
        vm.prank(alice);
        quote.approve(address(book), type(uint256).max);
        vm.prank(alice);
        book.placeLimitOrder(true, price, qty, 0); // alice rests buy

        base.mint(bob, qty);
        vm.prank(bob);
        base.approve(address(book), type(uint256).max);

        uint256 quoteBefore = quote.balanceOf(bob);
        vm.prank(bob);
        book.placeMarketOrder(false, qty, 0);

        assertEq(quote.balanceOf(bob), quoteBefore + locked);
    }
}

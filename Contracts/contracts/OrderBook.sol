// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20}         from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20}      from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable}        from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title  OrderBook
 * @notice On-chain central limit order book (CLOB) for a base/quote token pair.
 *
 * Architecture
 * ────────────
 * • Price levels are stored in a sorted doubly-linked list.
 *   Buy side: descending (head = best bid = highest price).
 *   Sell side: ascending (head = best ask = lowest price).
 * • Each price level holds a FIFO queue of order IDs (oldest filled first).
 * • Prices are expressed as quote-token units per base-token unit,
 *   multiplied by PRICE_SCALE (1e18) to avoid decimals.
 *
 * Token flow
 * ──────────
 * • Limit buy  → escrow price * quantity quote tokens upfront.
 * • Limit sell → escrow quantity base tokens upfront.
 * • On fill: taker receives counterpart tokens; maker receives counterpart
 *   tokens. Buy takers receive price improvement (refund of the excess quote
 *   that was locked above the maker's ask price).
 * • Cancel → refund escrowed tokens proportional to unfilled quantity.
 *
 * Order types
 * ───────────
 * • LIMIT  – rests in the book at a specified price if not immediately filled.
 * • MARKET – fills at the best available price(s); reverts if not fully filled.
 */
contract OrderBook is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Constants ──────────────────────────────────────────────────────────────

    uint256 public constant PRICE_SCALE = 1e18;

    // ── Types ──────────────────────────────────────────────────────────────────

    enum OrderType   { LIMIT, MARKET }
    enum OrderStatus { OPEN, PARTIALLY_FILLED, FILLED, CANCELLED }

    struct Order {
        uint256     id;
        address     trader;
        bool        isBuy;
        OrderType   orderType;
        uint256     price;       // limit price (0 for MARKET)
        uint256     quantity;    // total base-token amount
        uint256     filled;      // base-token amount filled so far
        OrderStatus status;
        uint256     nextAtLevel; // next order id in the FIFO queue at this price
        uint256     timestamp;
    }

    /**
     * @dev Doubly-linked list node for a price level.
     *      `prev` points to the adjacent *better* price (higher for buys,
     *      lower for sells). `next` points to the adjacent *worse* price.
     *      0 means "end of list" for both directions.
     */
    struct PriceLevel {
        uint256 totalQuantity; // sum of all unfilled, non-cancelled quantities
        uint256 orderHead;     // id of the oldest (first-to-fill) order
        uint256 orderTail;     // id of the most-recently-added order
        uint256 prev;          // adjacent better price  (0 = this is the best)
        uint256 next;          // adjacent worse price   (0 = this is the worst)
    }

    // ── State ──────────────────────────────────────────────────────────────────

    address public immutable token0; // base token
    address public immutable token1; // quote token

    uint256 private _nextOrderId;
    mapping(uint256 => Order)     private _orders;
    mapping(address => uint256[]) private _traderOrders;

    uint256 public bestBid; // best buy price  (0 = no bids)
    uint256 public bestAsk; // best sell price (0 = no asks)

    mapping(uint256 => PriceLevel) private _buyLevels;  // price → buy level
    mapping(uint256 => PriceLevel) private _sellLevels; // price → sell level

    // ── Events ─────────────────────────────────────────────────────────────────

    event OrderPlaced(
        uint256 indexed orderId,
        address indexed trader,
        bool isBuy,
        OrderType orderType,
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

    // ── Errors ─────────────────────────────────────────────────────────────────

    error ZeroAddress();
    error IdenticalTokens();
    error InvalidPrice();
    error InvalidQuantity();
    error OrderNotFound(uint256 orderId);
    error NotOrderOwner(uint256 orderId);
    error OrderNotCancellable(uint256 orderId);
    error InsufficientLiquidity();

    // ── Constructor ────────────────────────────────────────────────────────────

    constructor(address token0_, address token1_) Ownable(msg.sender) {
        if (token0_ == address(0) || token1_ == address(0)) revert ZeroAddress();
        if (token0_ == token1_) revert IdenticalTokens();
        token0 = token0_;
        token1 = token1_;
        _nextOrderId = 1;
    }

    // ── Order placement ────────────────────────────────────────────────────────

    /**
     * @notice Place a limit order. Matches immediately against the resting book;
     *         any unfilled remainder is added at the specified price level.
     *
     * @param isBuy    true = buy base token, false = sell base token.
     * @param price    Limit price: quote per base, scaled by PRICE_SCALE.
     * @param quantity Base-token amount to trade.
     * @param hint     An existing price level near the insertion point to
     *                 reduce traversal cost. Pass 0 to start from the best price.
     * @return orderId Unique order identifier.
     */
    function placeLimitOrder(
        bool    isBuy,
        uint256 price,
        uint256 quantity,
        uint256 hint
    ) external nonReentrant returns (uint256 orderId) {
        if (price == 0)    revert InvalidPrice();
        if (quantity == 0) revert InvalidQuantity();

        if (isBuy) {
            IERC20(token1).safeTransferFrom(msg.sender, address(this), _quoteFor(price, quantity));
        } else {
            IERC20(token0).safeTransferFrom(msg.sender, address(this), quantity);
        }

        orderId = _createOrder(msg.sender, isBuy, OrderType.LIMIT, price, quantity);
        emit OrderPlaced(orderId, msg.sender, isBuy, OrderType.LIMIT, price, quantity);

        uint256 remaining = _matchLimit(orderId, isBuy, price, quantity);

        if (remaining > 0) {
            _addToLevel(isBuy, price, orderId, remaining, hint);
        }
    }

    /**
     * @notice Place a market order. Fills at the best available prices and
     *         reverts if not completely filled.
     *
     * @param isBuy       true = buy, false = sell.
     * @param quantity    Base-token amount to trade.
     * @param maxSpend    Maximum quote tokens to spend (buy orders only; ignored for sells).
     * @return filled     Base-token amount filled (always equals quantity on success).
     */
    function placeMarketOrder(
        bool    isBuy,
        uint256 quantity,
        uint256 maxSpend
    ) external nonReentrant returns (uint256 filled) {
        if (quantity == 0) revert InvalidQuantity();

        if (isBuy) {
            if (maxSpend == 0) revert InvalidQuantity();
            IERC20(token1).safeTransferFrom(msg.sender, address(this), maxSpend);
        } else {
            IERC20(token0).safeTransferFrom(msg.sender, address(this), quantity);
        }

        uint256 orderId = _createOrder(msg.sender, isBuy, OrderType.MARKET, 0, quantity);
        emit OrderPlaced(orderId, msg.sender, isBuy, OrderType.MARKET, 0, quantity);

        (uint256 remaining, uint256 quoteUsed) = _matchMarket(orderId, isBuy, quantity, maxSpend);

        if (remaining > 0) {
            if (isBuy) IERC20(token1).safeTransfer(msg.sender, maxSpend - quoteUsed);
            else        IERC20(token0).safeTransfer(msg.sender, remaining);
            revert InsufficientLiquidity();
        }

        if (isBuy && maxSpend > quoteUsed) {
            IERC20(token1).safeTransfer(msg.sender, maxSpend - quoteUsed);
        }

        filled = quantity;
    }

    // ── Cancellation ───────────────────────────────────────────────────────────

    /**
     * @notice Cancel a resting order and refund escrowed tokens.
     *         Uses lazy deletion: the order stays in its FIFO queue but is
     *         skipped by the matching engine.
     */
    function cancelOrder(uint256 orderId) external nonReentrant {
        Order storage o = _orders[orderId];
        if (o.id == 0)         revert OrderNotFound(orderId);
        if (o.trader != msg.sender) revert NotOrderOwner(orderId);
        if (o.status == OrderStatus.FILLED || o.status == OrderStatus.CANCELLED)
            revert OrderNotCancellable(orderId);

        uint256 remaining = o.quantity - o.filled;
        o.status = OrderStatus.CANCELLED;

        // Subtract from level quantity immediately so the book depth is accurate.
        mapping(uint256 => PriceLevel) storage levels = o.isBuy ? _buyLevels : _sellLevels;
        PriceLevel storage level = levels[o.price];
        if (level.totalQuantity >= remaining) {
            level.totalQuantity -= remaining;
        } else {
            level.totalQuantity = 0;
        }
        if (level.totalQuantity == 0) {
            _removePriceLevel(o.isBuy, o.price);
        }

        if (o.isBuy) {
            IERC20(token1).safeTransfer(msg.sender, _quoteFor(o.price, remaining));
        } else {
            IERC20(token0).safeTransfer(msg.sender, remaining);
        }

        emit OrderCancelled(orderId, remaining);
    }

    // ── Queries ────────────────────────────────────────────────────────────────

    function getOrder(uint256 orderId) external view returns (Order memory) {
        if (_orders[orderId].id == 0) revert OrderNotFound(orderId);
        return _orders[orderId];
    }

    function getTraderOrders(address trader) external view returns (uint256[] memory) {
        return _traderOrders[trader];
    }

    function getSpread() external view returns (uint256) {
        if (bestBid == 0 || bestAsk == 0) return 0;
        return bestAsk > bestBid ? bestAsk - bestBid : 0;
    }

    function getLevelDepth(bool isBuy, uint256 price) external view returns (uint256) {
        return isBuy ? _buyLevels[price].totalQuantity : _sellLevels[price].totalQuantity;
    }

    /**
     * @notice Return the top `levels` price levels on each side of the book.
     * @return buyPrices  Prices descending (best bid first).
     * @return buyQtys    Total unfilled quantity at each buy price.
     * @return sellPrices Prices ascending (best ask first).
     * @return sellQtys   Total unfilled quantity at each sell price.
     */
    function getOrderBookDepth(uint256 levels)
        external
        view
        returns (
            uint256[] memory buyPrices,
            uint256[] memory buyQtys,
            uint256[] memory sellPrices,
            uint256[] memory sellQtys
        )
    {
        buyPrices  = new uint256[](levels);
        buyQtys    = new uint256[](levels);
        sellPrices = new uint256[](levels);
        sellQtys   = new uint256[](levels);

        uint256 price = bestBid;
        for (uint256 i; i < levels && price != 0; ++i) {
            buyPrices[i] = price;
            buyQtys[i]   = _buyLevels[price].totalQuantity;
            price        = _buyLevels[price].next;
        }

        price = bestAsk;
        for (uint256 i; i < levels && price != 0; ++i) {
            sellPrices[i] = price;
            sellQtys[i]   = _sellLevels[price].totalQuantity;
            price         = _sellLevels[price].next;
        }
    }

    // ── Internal: matching ─────────────────────────────────────────────────────

    function _matchLimit(
        uint256 takerOrderId,
        bool    isBuy,
        uint256 limitPrice,
        uint256 quantity
    ) internal returns (uint256 remaining) {
        remaining = quantity;

        if (isBuy) {
            uint256 askPrice = bestAsk;
            while (remaining > 0 && askPrice != 0 && askPrice <= limitPrice) {
                remaining -= _fillLevel(takerOrderId, true, askPrice, remaining);
                if (_sellLevels[askPrice].totalQuantity == 0) {
                    uint256 next = _sellLevels[askPrice].next;
                    _removePriceLevel(false, askPrice);
                    askPrice = next;
                } else {
                    break;
                }
            }
        } else {
            uint256 bidPrice = bestBid;
            while (remaining > 0 && bidPrice != 0 && bidPrice >= limitPrice) {
                remaining -= _fillLevel(takerOrderId, false, bidPrice, remaining);
                if (_buyLevels[bidPrice].totalQuantity == 0) {
                    uint256 next = _buyLevels[bidPrice].next;
                    _removePriceLevel(true, bidPrice);
                    bidPrice = next;
                } else {
                    break;
                }
            }
        }

        uint256 totalFilled = quantity - remaining;
        if (totalFilled > 0) {
            _orders[takerOrderId].filled += totalFilled;
            _orders[takerOrderId].status  = remaining == 0
                ? OrderStatus.FILLED
                : OrderStatus.PARTIALLY_FILLED;
        }
    }

    function _matchMarket(
        uint256 takerOrderId,
        bool    isBuy,
        uint256 quantity,
        uint256 maxSpend
    ) internal returns (uint256 remaining, uint256 quoteUsed) {
        remaining = quantity;
        quoteUsed = 0;

        if (isBuy) {
            uint256 askPrice = bestAsk;
            while (remaining > 0 && askPrice != 0) {
                uint256 budget     = maxSpend - quoteUsed;
                uint256 maxFillQty = budget * PRICE_SCALE / askPrice;
                if (maxFillQty == 0) break;
                uint256 toFill  = remaining < maxFillQty ? remaining : maxFillQty;
                uint256 gotFill = _fillLevel(takerOrderId, true, askPrice, toFill);
                remaining  -= gotFill;
                quoteUsed  += _quoteFor(askPrice, gotFill);
                if (_sellLevels[askPrice].totalQuantity == 0) {
                    uint256 next = _sellLevels[askPrice].next;
                    _removePriceLevel(false, askPrice);
                    askPrice = next;
                } else {
                    break;
                }
            }
        } else {
            uint256 bidPrice = bestBid;
            while (remaining > 0 && bidPrice != 0) {
                uint256 gotFill = _fillLevel(takerOrderId, false, bidPrice, remaining);
                remaining  -= gotFill;
                quoteUsed  += _quoteFor(bidPrice, gotFill);
                if (_buyLevels[bidPrice].totalQuantity == 0) {
                    uint256 next = _buyLevels[bidPrice].next;
                    _removePriceLevel(true, bidPrice);
                    bidPrice = next;
                } else {
                    break;
                }
            }
        }

        uint256 totalFilled = quantity - remaining;
        if (totalFilled > 0) {
            _orders[takerOrderId].filled += totalFilled;
            _orders[takerOrderId].status  = remaining == 0
                ? OrderStatus.FILLED
                : OrderStatus.PARTIALLY_FILLED;
        }
    }

    /**
     * @dev Fill up to `maxFill` base tokens from the resting orders at `levelPrice`.
     *      Skips CANCELLED/FILLED orders (lazy cleanup). Returns amount filled.
     */
    function _fillLevel(
        uint256 takerOrderId,
        bool    takerIsBuy,
        uint256 levelPrice,
        uint256 maxFill
    ) internal returns (uint256 totalFilled) {
        mapping(uint256 => PriceLevel) storage levels = takerIsBuy ? _sellLevels : _buyLevels;
        PriceLevel storage level = levels[levelPrice];
        totalFilled = 0;

        while (totalFilled < maxFill && level.orderHead != 0) {
            Order storage maker = _orders[level.orderHead];

            // Lazy cleanup: skip inactive orders and advance the queue head.
            if (maker.status == OrderStatus.CANCELLED || maker.status == OrderStatus.FILLED) {
                level.orderHead = maker.nextAtLevel;
                if (level.orderHead == 0) level.orderTail = 0;
                continue;
            }

            uint256 makerRemaining = maker.quantity - maker.filled;
            uint256 fillQty        = maxFill - totalFilled;
            if (fillQty > makerRemaining) fillQty = makerRemaining;

            maker.filled += fillQty;
            maker.status  = maker.filled == maker.quantity
                ? OrderStatus.FILLED
                : OrderStatus.PARTIALLY_FILLED;

            level.totalQuantity = level.totalQuantity >= fillQty
                ? level.totalQuantity - fillQty
                : 0;

            _settle(takerOrderId, level.orderHead, takerIsBuy, levelPrice, fillQty);

            totalFilled += fillQty;

            emit Trade(
                takerIsBuy ? takerOrderId : level.orderHead,
                takerIsBuy ? level.orderHead : takerOrderId,
                levelPrice,
                fillQty
            );
            emit OrderFilled(level.orderHead, fillQty, levelPrice);
            emit OrderFilled(takerOrderId,    fillQty, levelPrice);

            if (maker.status == OrderStatus.FILLED) {
                level.orderHead = maker.nextAtLevel;
                if (level.orderHead == 0) level.orderTail = 0;
            } else {
                break; // maker partially filled — stop, they stay at the head
            }
        }
    }

    /**
     * @dev Transfer tokens between taker and maker for a single fill.
     *      Trade price is always the maker's resting price (levelPrice).
     */
    function _settle(
        uint256 takerOrderId,
        uint256 makerOrderId,
        bool    takerIsBuy,
        uint256 levelPrice,
        uint256 fillQty
    ) internal {
        Order storage taker = _orders[takerOrderId];
        Order storage maker = _orders[makerOrderId];
        uint256 quoteAmt    = _quoteFor(levelPrice, fillQty);

        if (takerIsBuy) {
            // Maker is a resting sell: locked fillQty token0.
            IERC20(token0).safeTransfer(taker.trader, fillQty);   // base  → taker
            IERC20(token1).safeTransfer(maker.trader, quoteAmt);  // quote → maker

            // Price improvement: taker locked at their limit price, pays maker's ask.
            if (taker.orderType == OrderType.LIMIT && taker.price > levelPrice) {
                uint256 improvement = _quoteFor(taker.price - levelPrice, fillQty);
                if (improvement > 0) IERC20(token1).safeTransfer(taker.trader, improvement);
            }
        } else {
            // Maker is a resting buy: locked maker.price * maker.quantity token1.
            IERC20(token0).safeTransfer(maker.trader, fillQty);   // base  → maker
            IERC20(token1).safeTransfer(taker.trader, quoteAmt);  // quote → taker
        }
    }

    // ── Internal: sorted price-level list ─────────────────────────────────────

    function _addToLevel(
        bool    isBuy,
        uint256 price,
        uint256 orderId,
        uint256 quantity,
        uint256 hint
    ) internal {
        mapping(uint256 => PriceLevel) storage levels = isBuy ? _buyLevels : _sellLevels;
        PriceLevel storage level = levels[price];

        if (level.orderHead == 0 && level.totalQuantity == 0) {
            _insertPriceLevel(isBuy, price, hint);
        }

        if (level.orderTail == 0) {
            level.orderHead = orderId;
            level.orderTail = orderId;
        } else {
            _orders[level.orderTail].nextAtLevel = orderId;
            level.orderTail = orderId;
        }

        level.totalQuantity += quantity;
    }

    /**
     * @dev Insert a new price into the sorted doubly-linked list.
     *      Buy side: descending. Sell side: ascending.
     *      `hint` is a starting point for traversal to reduce gas on large books.
     */
    function _insertPriceLevel(bool isBuy, uint256 price, uint256 hint) internal {
        mapping(uint256 => PriceLevel) storage levels = isBuy ? _buyLevels : _sellLevels;

        if (isBuy) {
            if (bestBid == 0) { bestBid = price; return; }
            if (price > bestBid) {
                levels[price].next  = bestBid;
                levels[bestBid].prev = price;
                bestBid = price;
                return;
            }
            // Start from hint if it's a valid, worse-than-or-equal-to-price level.
            uint256 cur = (hint != 0 && levels[hint].totalQuantity > 0 && hint <= price)
                ? hint
                : bestBid;
            // Traverse descending until cur > price >= cur.next
            while (cur != 0) {
                uint256 nxt = levels[cur].next;
                if (nxt == 0 || nxt < price) {
                    levels[price].prev = cur;
                    levels[price].next = nxt;
                    levels[cur].next   = price;
                    if (nxt != 0) levels[nxt].prev = price;
                    return;
                }
                cur = nxt;
            }
        } else {
            if (bestAsk == 0) { bestAsk = price; return; }
            if (price < bestAsk) {
                levels[price].next   = bestAsk;
                levels[bestAsk].prev = price;
                bestAsk = price;
                return;
            }
            uint256 cur = (hint != 0 && levels[hint].totalQuantity > 0 && hint >= price)
                ? hint
                : bestAsk;
            // Traverse ascending until cur < price <= cur.next
            while (cur != 0) {
                uint256 nxt = levels[cur].next;
                if (nxt == 0 || nxt > price) {
                    levels[price].prev = cur;
                    levels[price].next = nxt;
                    levels[cur].next   = price;
                    if (nxt != 0) levels[nxt].prev = price;
                    return;
                }
                cur = nxt;
            }
        }
    }

    function _removePriceLevel(bool isBuy, uint256 price) internal {
        mapping(uint256 => PriceLevel) storage levels = isBuy ? _buyLevels : _sellLevels;
        uint256 prev = levels[price].prev;
        uint256 next = levels[price].next;

        if (prev != 0) {
            levels[prev].next = next;
        } else {
            if (isBuy) bestBid = next;
            else        bestAsk = next;
        }
        if (next != 0) levels[next].prev = prev;

        delete levels[price];
    }

    // ── Internal: helpers ──────────────────────────────────────────────────────

    function _createOrder(
        address   trader,
        bool      isBuy,
        OrderType orderType,
        uint256   price,
        uint256   quantity
    ) internal returns (uint256 orderId) {
        orderId = _nextOrderId++;
        Order storage o = _orders[orderId];
        o.id        = orderId;
        o.trader    = trader;
        o.isBuy     = isBuy;
        o.orderType = orderType;
        o.price     = price;
        o.quantity  = quantity;
        o.status    = OrderStatus.OPEN;
        o.timestamp = block.timestamp;
        _traderOrders[trader].push(orderId);
    }

    /// @dev quote = price * quantity / PRICE_SCALE
    function _quoteFor(uint256 price, uint256 quantity) internal pure returns (uint256) {
        return price * quantity / PRICE_SCALE;
    }
}

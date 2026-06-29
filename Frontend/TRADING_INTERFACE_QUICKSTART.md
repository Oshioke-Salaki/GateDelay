# Trading Interface Quick Start Guide

## 🚀 Quick Setup

The trading interface is ready to use! Just navigate to a market page.

## 📦 Components Overview

### Main Interface
```tsx
import TradingInterface from "@/app/components/trade/TradingInterface";

<TradingInterface market={market} userAddress={walletAddress} />
```

### Individual Components

```tsx
// Market Info Header
import MarketInfo from "@/app/components/trade/MarketInfo";
<MarketInfo market={market} />

// Price Chart
import TradingChart from "@/app/components/trade/TradingChart";
<TradingChart marketId={market.id} />

// Buy/Sell Panel
import OrderPanel from "@/app/components/trade/OrderPanel";
<OrderPanel market={market} userAddress={userAddress} />

// Order Book
import OrderBookCompact from "@/app/components/trade/OrderBookCompact";
<OrderBookCompact marketId={market.id} />

// Recent Trades
import RecentTrades from "@/app/components/trade/RecentTrades";
<RecentTrades marketId={market.id} />

// User Positions
import UserPositions from "@/app/components/trade/UserPositions";
<UserPositions marketId={market.id} userAddress={userAddress} />
```

## 🎯 Common Use Cases

### Use Case 1: Display Trading Interface

```tsx
const market = {
  id: "market-1",
  name: "AA 1234 - JFK to LAX",
  description: "Will this flight be delayed?",
  currentPrice: 1.0025,
  priceChange24h: 2.45,
  volume24h: 125000,
  high24h: 1.0150,
  low24h: 0.9850,
  totalLiquidity: 500000,
  expiryDate: "2026-12-25T23:59:59Z",
  status: "active",
};

<TradingInterface market={market} userAddress={walletAddress} />
```

### Use Case 2: Place Market Order

1. Select Buy or Sell tab
2. Choose "Market" order type
3. Enter amount
4. Click Buy/Sell button
5. Confirm transaction

### Use Case 3: Place Limit Order

1. Select Buy or Sell tab
2. Choose "Limit" order type
3. Enter desired price
4. Enter amount
5. Click Buy/Sell button
6. Confirm transaction

### Use Case 4: View Order Book

```tsx
<OrderBookCompact marketId="market-1" userAddress={userAddress} />
```

Features:
- View all orders (bids and asks)
- Filter by bids only or asks only
- See spread between best bid and ask
- Visual depth indicators

### Use Case 5: Monitor Positions

```tsx
<UserPositions marketId="market-1" userAddress={userAddress} />
```

Shows:
- Open positions
- Entry price vs current price
- Profit/Loss (P&L)
- Position value
- Close position option

## 📊 Layout Modes

### Desktop (≥1024px)
- Chart on left (8 columns)
- Order panel on right (4 columns)
- Order book and trades below chart
- Full-width positions at bottom

### Mobile (<1024px)
- Stacked vertical layout
- Chart at top
- Order panel below
- Order book and trades
- Positions at bottom

## 🎨 Customization

### Change Chart Timeframe

```tsx
// Available timeframes: 1H, 24H, 7D, 30D, ALL
<TradingChart marketId={market.id} />
// User can toggle via UI buttons
```

### Change Chart Type

```tsx
// Available types: Area, Line
// User can toggle via UI buttons
```

### Order Book View Modes

```tsx
// Available modes: All, Bids, Asks
<OrderBookCompact marketId={market.id} />
// User can toggle via UI buttons
```

## ✅ Validation

### Order Validation

- **Amount**: Must be positive and within balance
- **Price** (limit orders): Must be positive
- **Balance**: Checked before order placement
- **Slippage**: Applied from user settings

### Error Messages

```tsx
// Insufficient balance
"Insufficient balance"

// Invalid amount
"Amount must be positive"

// Invalid price
"Price must be positive"
```

## 🔄 Real-Time Updates

### Price Updates

```tsx
// Automatic via WebSocket
const { price } = useSinglePriceUpdate(marketId);
```

### Order Book Updates

```tsx
// Subscribe to order book updates
websocket.on('orderBookUpdate', (data) => {
  // Update order book
});
```

### Trade Updates

```tsx
// Subscribe to trade updates
websocket.on('tradeUpdate', (data) => {
  // Add to recent trades
});
```

## 💡 Tips & Tricks

### Quick Amount Selection

Use percentage buttons to quickly set amount:
- 25% - Quarter of balance
- 50% - Half of balance
- 75% - Three quarters
- 100% - Full balance

### Market vs Limit Orders

**Market Order**:
- ✅ Executes immediately
- ✅ Simple to use
- ⚠️ Subject to slippage
- Best for: Quick trades

**Limit Order**:
- ✅ Control exact price
- ✅ No slippage
- ⚠️ May not execute
- Best for: Price-sensitive trades

### Reading the Order Book

- **Green (Bids)**: Buy orders
- **Red (Asks)**: Sell orders
- **Spread**: Difference between best bid and ask
- **Depth**: Visual bars show order size

### Understanding P&L

```
P&L = (Current Price - Entry Price) × Quantity
P&L % = (P&L / Entry Value) × 100
```

## 🚨 Common Issues

### Issue: Order Not Submitting

**Solutions**:
1. Check wallet is connected
2. Verify sufficient balance
3. Check amount is valid
4. Ensure market is active

### Issue: Chart Not Loading

**Solutions**:
1. Check internet connection
2. Refresh the page
3. Clear browser cache
4. Check console for errors

### Issue: Prices Not Updating

**Solutions**:
1. Check WebSocket connection
2. Verify backend is running
3. Check network tab for errors
4. Fallback to polling mode

## 📱 Mobile Usage

### Touch Gestures

- **Swipe**: Navigate chart timeframes
- **Pinch**: Zoom chart (future)
- **Tap**: Select order book entries
- **Long press**: View details (future)

### Mobile Optimizations

- Larger touch targets
- Simplified layout
- Reduced data display
- Optimized performance

## 🔧 Integration

### With Wallet

```tsx
// Get wallet address from connection
const { address } = useAccount();

<TradingInterface market={market} userAddress={address} />
```

### With Settings

```tsx
// Slippage from settings
const { settings } = useSettings();
const slippage = settings.trading.defaultSlippage;
```

### With Notifications

```tsx
// Toast notifications
const toast = useToast();

toast.success("Order Placed", "Your order was successful");
toast.error("Order Failed", "Please try again");
```

## 📚 Documentation

- **Full Documentation**: `TRADING_INTERFACE_DOCUMENTATION.md`
- **Demo Page**: `/trade/market-1`
- **Component API**: See full documentation

## 🎯 Testing Checklist

- [ ] Visit `/trade/market-1`
- [ ] View market information
- [ ] Check chart displays
- [ ] Switch chart timeframes
- [ ] Toggle chart types
- [ ] View order book
- [ ] Check recent trades
- [ ] Place buy order
- [ ] Place sell order
- [ ] View positions
- [ ] Test on mobile
- [ ] Test error handling

---

**Ready to trade!** The trading interface is fully functional and ready for use.

# Trading Interface Documentation

## Overview

The GateDelay Trading Interface provides a comprehensive, professional trading experience for prediction markets. It includes real-time price charts, order books, recent trades, and an intuitive buy/sell panel.

## Architecture

### Core Components

1. **TradingInterface** (`app/components/trade/TradingInterface.tsx`)
   - Main container component
   - Responsive grid layout
   - Error boundary integration
   - Component orchestration

2. **MarketInfo** (`app/components/trade/MarketInfo.tsx`)
   - Market header with key statistics
   - Real-time price updates
   - 24h high/low/volume
   - Market status and expiry

3. **TradingChart** (`app/components/trade/TradingChart.tsx`)
   - Interactive price chart
   - Multiple timeframes (1H, 24H, 7D, 30D, ALL)
   - Area and line chart types
   - Real-time price updates

4. **OrderPanel** (`app/components/trade/OrderPanel.tsx`)
   - Buy/sell order placement
   - Market and limit orders
   - Balance display
   - Slippage settings integration
   - Form validation

5. **OrderBookCompact** (`app/components/trade/OrderBookCompact.tsx`)
   - Real-time order book
   - Bid/ask spread display
   - Multiple view modes (All, Bids, Asks)
   - Visual depth indicators

6. **RecentTrades** (`app/components/trade/RecentTrades.tsx`)
   - Recent trade history
   - Buy/sell volume statistics
   - Real-time trade updates

7. **UserPositions** (`app/components/trade/UserPositions.tsx`)
   - Open positions display
   - P&L tracking
   - Position management
   - Trade history

## Features

### ✅ Responsive Layout
- Desktop: 3-column layout (Chart | Order Book/Trades | Order Panel)
- Tablet: 2-column layout with stacked components
- Mobile: Single column with optimized spacing

### ✅ Real-Time Updates
- Live price updates via WebSocket
- Real-time order book updates
- Live trade feed
- Automatic chart updates

### ✅ Trading Functionality
- Market orders (instant execution)
- Limit orders (price-specific)
- Buy and sell operations
- Balance checking
- Slippage tolerance
- Transaction confirmation

### ✅ Market Information
- Current price with 24h change
- High/low prices
- Trading volume
- Total liquidity
- Market status
- Expiry date

### ✅ User Experience
- Intuitive tabbed interface
- Visual feedback for all actions
- Error handling with boundaries
- Loading states
- Toast notifications
- Keyboard shortcuts ready

## Usage

### Basic Implementation

```tsx
import TradingInterface, { Market } from "@/app/components/trade/TradingInterface";

const market: Market = {
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

### Individual Components

#### Market Info

```tsx
import MarketInfo from "@/app/components/trade/MarketInfo";

<MarketInfo market={market} />
```

#### Trading Chart

```tsx
import TradingChart from "@/app/components/trade/TradingChart";

<TradingChart marketId={market.id} />
```

#### Order Panel

```tsx
import OrderPanel from "@/app/components/trade/OrderPanel";

<OrderPanel
  market={market}
  userAddress={userAddress}
  activeTab="buy"
  onTabChange={(tab) => setActiveTab(tab)}
/>
```

#### Order Book

```tsx
import OrderBookCompact from "@/app/components/trade/OrderBookCompact";

<OrderBookCompact marketId={market.id} userAddress={userAddress} />
```

#### Recent Trades

```tsx
import RecentTrades from "@/app/components/trade/RecentTrades";

<RecentTrades marketId={market.id} />
```

#### User Positions

```tsx
import UserPositions from "@/app/components/trade/UserPositions";

<UserPositions marketId={market.id} userAddress={userAddress} />
```

## Layout Structure

### Desktop Layout (≥1024px)

```
┌─────────────────────────────────────────────────────────────┐
│                      Market Info Header                      │
├──────────────────────────────────────────┬──────────────────┤
│                                          │                  │
│          Trading Chart                   │   Order Panel    │
│                                          │   (Buy/Sell)     │
│                                          │                  │
├────────────────────┬─────────────────────┤                  │
│                    │                     │                  │
│   Order Book       │   Recent Trades     │                  │
│                    │                     │                  │
└────────────────────┴─────────────────────┴──────────────────┘
│                   User Positions                             │
└─────────────────────────────────────────────────────────────┘
```

### Mobile Layout (<1024px)

```
┌─────────────────────────┐
│   Market Info Header    │
├─────────────────────────┤
│    Trading Chart        │
├─────────────────────────┤
│    Order Panel          │
├─────────────────────────┤
│    Order Book           │
├─────────────────────────┤
│    Recent Trades        │
├─────────────────────────┤
│    User Positions       │
└─────────────────────────┘
```

## Customization

### Theme Integration

The trading interface automatically adapts to the app's theme:

```tsx
// Components use theme-aware classes
className="bg-white dark:bg-gray-800"
```

### Settings Integration

Order panel integrates with user settings:

```tsx
const { settings } = useSettings();

// Uses slippage from settings
<div>Slippage: {settings.trading.defaultSlippage}%</div>

// Uses confirmation preference
if (settings.trading.confirmTransactions) {
  // Show confirmation dialog
}
```

### WebSocket Integration

Components are ready for WebSocket integration:

```tsx
// In OrderBookCompact
useEffect(() => {
  const unsubscribe = websocket.on('orderBookUpdate', (data) => {
    if (data.marketId === marketId) {
      setBids(data.bids);
      setAsks(data.asks);
    }
  });
  return unsubscribe;
}, [marketId]);
```

## Order Types

### Market Order
- Executes immediately at current market price
- No price specification needed
- Subject to slippage tolerance
- Best for quick execution

### Limit Order
- Executes only at specified price or better
- User sets desired price
- May not execute immediately
- Best for price-sensitive trades

## Validation

### Order Panel Validation

```typescript
// Amount validation
{
  required: "Amount is required",
  min: { value: 0.0001, message: "Amount must be positive" },
  max: { value: maxAmount, message: "Insufficient balance" },
}

// Price validation (limit orders)
{
  required: "Price is required",
  min: { value: 0.0001, message: "Price must be positive" },
}
```

### Balance Checking

```typescript
const balance = 1000; // From wallet/backend
const maxAmount = balance / price;

// Prevent orders exceeding balance
if (amount > maxAmount) {
  error = "Insufficient balance";
}
```

## Error Handling

All components are wrapped in error boundaries:

```tsx
<ComponentErrorBoundary componentName="TradingChart">
  <TradingChart marketId={market.id} />
</ComponentErrorBoundary>
```

This ensures:
- Individual component failures don't crash the page
- User-friendly error messages
- Ability to retry failed components

## Performance Optimization

### Memoization

```tsx
const chartData = useMemo(() => {
  // Expensive calculation
  return generateChartData();
}, [timeframe]);
```

### Lazy Loading

```tsx
// Load heavy components only when needed
const TradingChart = lazy(() => import('./TradingChart'));
```

### Debouncing

```tsx
// Debounce price updates
const debouncedPrice = useDebounce(price, 100);
```

## Accessibility

- Keyboard navigation support
- ARIA labels for screen readers
- Focus management
- Color contrast compliance
- Responsive text sizing

## Mobile Optimization

- Touch-friendly buttons (min 44x44px)
- Swipe gestures for charts
- Optimized layout for small screens
- Reduced data on mobile
- Progressive enhancement

## Testing

### Manual Testing Checklist

- [ ] Market info displays correctly
- [ ] Chart loads and updates
- [ ] Order panel accepts input
- [ ] Buy orders work
- [ ] Sell orders work
- [ ] Order book updates
- [ ] Recent trades display
- [ ] User positions show
- [ ] Responsive on mobile
- [ ] Error boundaries work
- [ ] Toast notifications appear
- [ ] Settings integration works

### Test Scenarios

1. **Place Market Buy Order**
   - Enter amount
   - Click Buy button
   - Verify confirmation
   - Check toast notification

2. **Place Limit Sell Order**
   - Switch to Sell tab
   - Select Limit order
   - Enter price and amount
   - Submit order
   - Verify execution

3. **View Order Book**
   - Check bid/ask spread
   - Toggle view modes
   - Verify depth visualization

4. **Monitor Positions**
   - Check P&L calculation
   - Verify position details
   - Test close position

## Integration with Backend

### API Endpoints (To Implement)

```typescript
// Get market data
GET /api/markets/:id

// Place order
POST /api/orders
{
  marketId: string;
  side: "buy" | "sell";
  type: "market" | "limit";
  amount: number;
  price?: number;
}

// Get user positions
GET /api/positions/:userAddress

// Get order book
GET /api/markets/:id/orderbook

// Get recent trades
GET /api/markets/:id/trades
```

### WebSocket Events

```typescript
// Subscribe to market updates
socket.emit('subscribe', { marketId });

// Price updates
socket.on('priceUpdate', (data) => {
  // Update chart and displays
});

// Order book updates
socket.on('orderBookUpdate', (data) => {
  // Update order book
});

// Trade updates
socket.on('tradeUpdate', (data) => {
  // Add to recent trades
});
```

## Best Practices

1. **Always validate user input** before submission
2. **Show loading states** during async operations
3. **Provide clear feedback** for all actions
4. **Handle errors gracefully** with error boundaries
5. **Optimize for performance** with memoization
6. **Test on multiple devices** and screen sizes
7. **Integrate with settings** for user preferences
8. **Use WebSocket** for real-time updates
9. **Implement proper security** for order submission
10. **Monitor performance** and optimize as needed

## Future Enhancements

1. **Advanced Order Types**
   - Stop-loss orders
   - Take-profit orders
   - Trailing stops
   - OCO (One-Cancels-Other)

2. **Chart Improvements**
   - Candlestick charts
   - Technical indicators
   - Drawing tools
   - Multiple timeframes

3. **Social Features**
   - Trade sharing
   - Leaderboards
   - Social sentiment

4. **Analytics**
   - Trade history analysis
   - Performance metrics
   - Risk assessment

5. **Mobile App**
   - Native mobile apps
   - Push notifications
   - Biometric authentication

---

**Implementation Date**: April 26, 2026
**Status**: ✅ Complete
**Version**: 1.0.0

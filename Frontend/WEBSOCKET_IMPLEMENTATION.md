# WebSocket Real-Time Price Updates Implementation

## Overview

This implementation provides real-time price updates across the GateDelay application using WebSocket connections with automatic fallback to polling when WebSocket connections fail.

## Architecture

### Core Components

1. **`useWebSocket` Hook** (`hooks/useWebSocket.ts`)
   - Low-level WebSocket connection management
   - Handles connection lifecycle (connect, disconnect, reconnect)
   - Manages subscriptions to market data
   - Implements automatic reconnection with exponential backoff
   - Provides polling fallback mechanism

2. **`WebSocketProvider` Component** (`app/components/WebSocketProvider.tsx`)
   - Global WebSocket state management
   - Centralized price data storage
   - Connection status notifications via toast
   - Automatic fallback to REST API polling

3. **`usePriceUpdates` Hook** (`hooks/usePriceUpdates.ts`)
   - High-level hook for subscribing to market prices
   - Automatic subscription management
   - Price change calculations
   - Helper functions for accessing price data

4. **`PriceDisplay` Component** (`app/components/market/PriceDisplay.tsx`)
   - Reusable component for displaying real-time prices
   - Visual feedback for price changes (flash animations)
   - Connection status indicators
   - Configurable display options

## Features

### ✅ Real-Time Updates
- Instant price updates via WebSocket
- No page refresh required
- Visual feedback with flash animations (green for increase, red for decrease)

### ✅ Connection Management
- Automatic connection on mount
- Graceful disconnection on unmount
- Automatic reconnection with configurable attempts
- Connection status tracking and display

### ✅ Fallback Mechanism
- Automatic fallback to REST API polling when WebSocket fails
- Configurable polling interval
- Seamless transition between WebSocket and polling
- User notifications for connection issues

### ✅ Performance Optimization
- Efficient subscription management
- Batched market subscriptions
- Minimal re-renders with proper memoization
- Cleanup of unused subscriptions

### ✅ Error Handling
- Graceful error handling for connection failures
- User-friendly error messages
- Retry logic with exponential backoff
- Fallback to offline mode

## Usage

### Basic Setup

The WebSocketProvider is already integrated into the root layout:

```tsx
// app/layout.tsx
import { WebSocketProvider } from "./components/WebSocketProvider";

export default function RootLayout({ children }) {
  return (
    <WebSocketProvider>
      {children}
    </WebSocketProvider>
  );
}
```

### Using Price Updates in Components

#### Single Market Price

```tsx
import { useSinglePriceUpdate } from "@/hooks/usePriceUpdates";

function MarketDetail({ marketId }) {
  const { price, isLoading, isConnected } = useSinglePriceUpdate(marketId);

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <p>Current Price: ${price?.currentPrice.toFixed(4)}</p>
      <p>Change: {price?.changePercent.toFixed(2)}%</p>
      <p>Status: {isConnected ? "Live" : "Offline"}</p>
    </div>
  );
}
```

#### Multiple Markets

```tsx
import { usePriceUpdates } from "@/hooks/usePriceUpdates";

function MarketList({ marketIds }) {
  const { prices, isConnected, getPrice } = usePriceUpdates({
    marketIds,
    autoSubscribe: true,
    onUpdate: (updatedPrices) => {
      console.log("Prices updated:", updatedPrices);
    },
  });

  return (
    <div>
      {marketIds.map((id) => {
        const price = getPrice(id);
        return (
          <div key={id}>
            {price?.currentPrice.toFixed(4)}
          </div>
        );
      })}
    </div>
  );
}
```

#### Using the PriceDisplay Component

```tsx
import PriceDisplay from "@/app/components/market/PriceDisplay";

function Market({ marketId }) {
  return (
    <PriceDisplay
      marketId={marketId}
      showChange={true}
      showVolume={true}
      size="lg"
    />
  );
}
```

### Manual Subscription Management

```tsx
import { useWebSocketContext } from "@/app/components/WebSocketProvider";

function CustomComponent() {
  const websocket = useWebSocketContext();

  useEffect(() => {
    // Subscribe to markets
    websocket.subscribe(["market-1", "market-2"]);

    // Unsubscribe on cleanup
    return () => {
      websocket.unsubscribe(["market-1", "market-2"]);
    };
  }, [websocket]);

  return <div>Status: {websocket.status}</div>;
}
```

## Configuration

### Environment Variables

Create a `.env.local` file in the Frontend directory:

```env
# Backend API URL
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000

# WebSocket Configuration
NEXT_PUBLIC_WS_RECONNECT_ATTEMPTS=5
NEXT_PUBLIC_WS_RECONNECT_DELAY=2000
NEXT_PUBLIC_WS_POLLING_INTERVAL=30000
NEXT_PUBLIC_WS_ENABLE_POLLING_FALLBACK=true
```

### WebSocketProvider Props

```tsx
<WebSocketProvider
  backendUrl="http://localhost:3000"  // Backend URL
  authToken={userToken}                // JWT token for authentication
  enablePollingFallback={true}         // Enable REST API fallback
/>
```

## Backend Integration

The implementation connects to the existing NestJS WebSocket gateway:

### Connection
- **Namespace**: `/prices`
- **Authentication**: JWT token via `auth.token` or `Authorization` header
- **Transport**: WebSocket with polling fallback

### Events

#### Client → Server

**Subscribe to Markets**
```typescript
socket.emit('subscribe', { marketIds: ['market-1', 'market-2'] });
```

**Unsubscribe from Markets**
```typescript
socket.emit('unsubscribe', { marketIds: ['market-1'] });
```

#### Server → Client

**Price Update**
```typescript
socket.on('priceUpdate', (data: {
  marketId: string;
  price: number;
  volume: number;
  timestamp: number;
}) => {
  // Handle price update
});
```

**Market Data**
```typescript
socket.on('marketData', (data: Record<string, unknown>) => {
  // Handle general market data
});
```

## Performance Considerations

### Optimization Strategies

1. **Subscription Batching**: Multiple markets are subscribed in a single request
2. **Selective Re-renders**: Components only re-render when their specific market data changes
3. **Memoization**: Price calculations are memoized to prevent unnecessary computations
4. **Cleanup**: Automatic unsubscription when components unmount

### Scalability

- **Connection Limits**: Backend enforces max 5 connections per user
- **Market Limits**: No hard limit on subscribed markets, but consider performance
- **Update Frequency**: Backend controls update frequency to prevent overwhelming clients

## Testing

### Manual Testing

1. **Start Backend**:
   ```bash
   cd Backend
   npm run start:dev
   ```

2. **Start Frontend**:
   ```bash
   cd Frontend
   npm run dev
   ```

3. **Test Scenarios**:
   - ✅ Connect to WebSocket and verify "Live" status
   - ✅ Subscribe to markets and verify price updates
   - ✅ Disconnect backend and verify fallback to polling
   - ✅ Reconnect backend and verify automatic reconnection
   - ✅ Test with multiple markets simultaneously

### Testing Connection Failures

```typescript
// Simulate connection failure
const websocket = useWebSocketContext();
websocket.disconnect();

// Verify fallback to polling
// Check for warning toast notification
```

## Troubleshooting

### Common Issues

**1. WebSocket Connection Fails**
- Check `NEXT_PUBLIC_BACKEND_URL` environment variable
- Verify backend is running and accessible
- Check CORS configuration in backend
- Verify JWT token is valid

**2. No Price Updates**
- Check if markets are subscribed: `websocket.subscribe(['market-id'])`
- Verify backend is broadcasting updates
- Check browser console for errors
- Verify WebSocket connection status

**3. Polling Fallback Not Working**
- Ensure `enablePollingFallback={true}` in WebSocketProvider
- Verify REST API endpoint exists: `/api/market-data/prices`
- Check network tab for polling requests

**4. Performance Issues**
- Reduce number of subscribed markets
- Increase polling interval
- Check for memory leaks (unsubscribe on unmount)
- Monitor browser performance tab

## Future Enhancements

### Potential Improvements

1. **Order Book Updates**: Extend to support real-time order book data
2. **Trade History**: Add real-time trade execution updates
3. **User Notifications**: Push notifications for price alerts
4. **Chart Integration**: Real-time chart updates with price data
5. **Compression**: Implement message compression for bandwidth optimization
6. **Batching**: Batch multiple price updates for efficiency
7. **Caching**: Implement intelligent caching strategies
8. **Analytics**: Track WebSocket performance metrics

## API Reference

### useWebSocket Hook

```typescript
const {
  status,           // 'connected' | 'disconnected' | 'connecting' | 'error'
  error,            // Error object if connection failed
  isConnected,      // Boolean connection status
  lastUpdate,       // Timestamp of last update
  connect,          // Function to manually connect
  disconnect,       // Function to manually disconnect
  subscribe,        // Function to subscribe to markets
  unsubscribe,      // Function to unsubscribe from markets
  on,               // Function to add event listener
  off,              // Function to remove event listener
  emit,             // Function to emit events
  socket,           // Raw Socket.io socket instance
} = useWebSocket(config);
```

### usePriceUpdates Hook

```typescript
const {
  prices,           // Map<string, PriceData>
  isLoading,        // Boolean loading state
  isConnected,      // Boolean connection status
  connectionStatus, // Connection status string
  getPrice,         // Function to get price for market
  getCurrentPrice,  // Function to get current price number
  getPriceChange,   // Function to get price change data
  subscribe,        // Function to subscribe to markets
  unsubscribe,      // Function to unsubscribe from markets
} = usePriceUpdates(options);
```

### PriceData Type

```typescript
interface PriceData {
  marketId: string;
  currentPrice: number;
  previousPrice: number;
  volume: number;
  timestamp: number;
  change: number;
  changePercent: number;
}
```

## License

This implementation is part of the GateDelay project.

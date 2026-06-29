# WebSocket Quick Start Guide

## 🚀 Quick Setup

### 1. Environment Configuration

Create `.env.local` in the Frontend directory:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
```

### 2. Start the Application

```bash
# Terminal 1 - Start Backend
cd Backend
npm run start:dev

# Terminal 2 - Start Frontend
cd Frontend
npm run dev
```

### 3. Test the Implementation

Visit: `http://localhost:3001/test-websocket`

## 📦 What's Included

### Hooks
- ✅ `useWebSocket` - Low-level WebSocket management
- ✅ `usePriceUpdates` - High-level price subscription
- ✅ `useSinglePriceUpdate` - Single market price updates

### Components
- ✅ `WebSocketProvider` - Global WebSocket state
- ✅ `PriceDisplay` - Real-time price display with animations
- ✅ `MarketPriceList` - List of markets with live prices

### Features
- ✅ Real-time price updates
- ✅ Automatic reconnection
- ✅ Polling fallback
- ✅ Connection status indicators
- ✅ Flash animations for price changes
- ✅ Error handling and notifications

## 🎯 Common Use Cases

### Display a Single Market Price

```tsx
import PriceDisplay from "@/app/components/market/PriceDisplay";

<PriceDisplay 
  marketId="market-1" 
  showChange 
  showVolume 
  size="lg" 
/>
```

### Subscribe to Multiple Markets

```tsx
import { usePriceUpdates } from "@/hooks/usePriceUpdates";

const { prices, isConnected } = usePriceUpdates({
  marketIds: ["market-1", "market-2", "market-3"],
  autoSubscribe: true,
});
```

### Get Current Price

```tsx
import { useSinglePriceUpdate } from "@/hooks/usePriceUpdates";

const { price, isLoading } = useSinglePriceUpdate("market-1");
console.log(price?.currentPrice); // Current price
console.log(price?.changePercent); // % change
```

### Check Connection Status

```tsx
import { useWebSocketContext } from "@/app/components/WebSocketProvider";

const { status, isConnected } = useWebSocketContext();
```

## 🔧 Configuration Options

### WebSocketProvider Props

```tsx
<WebSocketProvider
  backendUrl="http://localhost:3000"
  authToken={userToken}
  enablePollingFallback={true}
>
  {children}
</WebSocketProvider>
```

### usePriceUpdates Options

```tsx
usePriceUpdates({
  marketIds: ["market-1"],
  autoSubscribe: true,
  onUpdate: (prices) => console.log(prices),
})
```

## 🐛 Troubleshooting

### WebSocket Not Connecting?

1. Check backend is running: `http://localhost:3000`
2. Verify `NEXT_PUBLIC_BACKEND_URL` in `.env.local`
3. Check browser console for errors
4. Verify CORS settings in backend

### No Price Updates?

1. Check connection status (should be "connected")
2. Verify markets are subscribed
3. Check backend is broadcasting updates
4. Look for errors in browser console

### Polling Fallback Not Working?

1. Ensure `enablePollingFallback={true}`
2. Verify REST API endpoint exists
3. Check network tab for polling requests

## 📚 Documentation

- Full documentation: `Frontend/WEBSOCKET_IMPLEMENTATION.md`
- Test page: `http://localhost:3001/test-websocket`
- Backend gateway: `Backend/src/websocket/price.gateway.ts`

## 🎨 Visual Indicators

- 🟢 **Green Flash**: Price increased
- 🔴 **Red Flash**: Price decreased
- 🟢 **Live Badge**: WebSocket connected
- 🟡 **Connecting**: Attempting connection
- ⚠️ **Offline Mode**: Using polling fallback
- 🔴 **Error**: Connection failed

## 📊 Performance Tips

1. **Limit Subscriptions**: Only subscribe to visible markets
2. **Cleanup**: Unsubscribe when components unmount
3. **Batching**: Subscribe to multiple markets at once
4. **Memoization**: Use React.memo for price components

## 🔐 Authentication

The WebSocket connection uses JWT authentication:

```tsx
<WebSocketProvider authToken={yourJWTToken}>
  {children}
</WebSocketProvider>
```

Token is sent via:
- `auth.token` in handshake
- `Authorization: Bearer <token>` header

## 🚦 Connection States

| State | Description | User Action |
|-------|-------------|-------------|
| `connected` | WebSocket active | None - working normally |
| `connecting` | Attempting connection | Wait for connection |
| `disconnected` | Not connected | Check backend status |
| `error` | Connection failed | Using fallback mode |

## 📈 Next Steps

1. ✅ Test basic connection
2. ✅ Verify price updates
3. ✅ Test reconnection
4. ✅ Test polling fallback
5. ⬜ Integrate with your components
6. ⬜ Add authentication
7. ⬜ Deploy to production

## 🤝 Support

For issues or questions:
1. Check `WEBSOCKET_IMPLEMENTATION.md` for detailed docs
2. Review browser console logs
3. Test with `/test-websocket` page
4. Check backend logs

---

**Ready to use!** The WebSocket implementation is fully integrated and ready for production use.

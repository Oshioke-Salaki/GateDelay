# WebSocket Integration Examples

## Real-World Integration Examples

### Example 1: Market Dashboard

```tsx
// app/dashboard/page.tsx
"use client";

import { usePriceUpdates } from "@/hooks/usePriceUpdates";
import PriceDisplay from "@/app/components/market/PriceDisplay";

export default function DashboardPage() {
  const marketIds = ["market-1", "market-2", "market-3"];
  const { prices, isConnected } = usePriceUpdates({
    marketIds,
    autoSubscribe: true,
  });

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Market Dashboard</h1>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm">{isConnected ? 'Live' : 'Offline'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {marketIds.map((marketId) => (
          <div key={marketId} className="bg-white p-4 rounded-lg shadow">
            <h3 className="font-semibold mb-2">Market {marketId}</h3>
            <PriceDisplay marketId={marketId} showChange showVolume size="lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Example 2: Market Detail Page with Live Updates

```tsx
// app/markets/[id]/page.tsx
"use client";

import { useSinglePriceUpdate } from "@/hooks/usePriceUpdates";
import PriceDisplay from "@/app/components/market/PriceDisplay";
import OrderBook from "@/app/components/market/OrderBook";

export default function MarketDetailPage({ params }: { params: { id: string } }) {
  const { price, isLoading, isConnected } = useSinglePriceUpdate(params.id);

  if (isLoading) {
    return <div>Loading market data...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold">Market {params.id}</h1>
          {!isConnected && (
            <span className="text-sm text-yellow-600 bg-yellow-50 px-3 py-1 rounded">
              ⚠️ Offline Mode
            </span>
          )}
        </div>

        <div className="mb-6">
          <PriceDisplay marketId={params.id} showChange showVolume size="lg" />
        </div>

        {price && (
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">24h Volume:</span>
              <p className="font-semibold">{price.volume.toLocaleString()}</p>
            </div>
            <div>
              <span className="text-gray-600">24h Change:</span>
              <p className={`font-semibold ${price.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {price.changePercent.toFixed(2)}%
              </p>
            </div>
            <div>
              <span className="text-gray-600">Last Update:</span>
              <p className="font-semibold">
                {new Date(price.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        )}
      </div>

      <OrderBook marketId={params.id} />
    </div>
  );
}
```

### Example 3: Portfolio with Live Valuations

```tsx
// app/portfolio/page.tsx
"use client";

import { useMemo } from "react";
import { usePriceUpdates } from "@/hooks/usePriceUpdates";

interface Position {
  marketId: string;
  quantity: number;
  averagePrice: number;
}

export default function PortfolioPage() {
  const positions: Position[] = [
    { marketId: "market-1", quantity: 100, averagePrice: 0.95 },
    { marketId: "market-2", quantity: 50, averagePrice: 1.20 },
    { marketId: "market-3", quantity: 200, averagePrice: 0.80 },
  ];

  const marketIds = positions.map((p) => p.marketId);
  const { prices, isConnected } = usePriceUpdates({
    marketIds,
    autoSubscribe: true,
  });

  const portfolioValue = useMemo(() => {
    return positions.reduce((total, position) => {
      const currentPrice = prices.get(position.marketId)?.currentPrice || position.averagePrice;
      return total + position.quantity * currentPrice;
    }, 0);
  }, [positions, prices]);

  const totalPnL = useMemo(() => {
    return positions.reduce((total, position) => {
      const currentPrice = prices.get(position.marketId)?.currentPrice || position.averagePrice;
      const costBasis = position.quantity * position.averagePrice;
      const currentValue = position.quantity * currentPrice;
      return total + (currentValue - costBasis);
    }, 0);
  }, [positions, prices]);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Portfolio</h1>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-gray-600">Total Value</span>
            <p className="text-3xl font-bold">${portfolioValue.toFixed(2)}</p>
          </div>
          <div>
            <span className="text-gray-600">Total P&L</span>
            <p className={`text-3xl font-bold ${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {positions.map((position) => {
          const priceData = prices.get(position.marketId);
          const currentPrice = priceData?.currentPrice || position.averagePrice;
          const currentValue = position.quantity * currentPrice;
          const costBasis = position.quantity * position.averagePrice;
          const pnl = currentValue - costBasis;
          const pnlPercent = (pnl / costBasis) * 100;

          return (
            <div key={position.marketId} className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Market {position.marketId}</h3>
                  <p className="text-sm text-gray-600">
                    {position.quantity} shares @ ${position.averagePrice.toFixed(4)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold">${currentValue.toFixed(2)}</p>
                  <p className={`text-sm ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} ({pnlPercent.toFixed(2)}%)
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### Example 4: Price Alert Component

```tsx
// app/components/market/PriceAlert.tsx
"use client";

import { useEffect, useState } from "react";
import { useSinglePriceUpdate } from "@/hooks/usePriceUpdates";
import { useToast } from "@/hooks/useToast";

interface PriceAlertProps {
  marketId: string;
  targetPrice: number;
  condition: "above" | "below";
}

export default function PriceAlert({ marketId, targetPrice, condition }: PriceAlertProps) {
  const { price } = useSinglePriceUpdate(marketId);
  const [alerted, setAlerted] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!price || alerted) return;

    const shouldAlert =
      condition === "above"
        ? price.currentPrice >= targetPrice
        : price.currentPrice <= targetPrice;

    if (shouldAlert) {
      toast.success(
        "Price Alert Triggered!",
        `Market ${marketId} is now ${condition} $${targetPrice.toFixed(4)}`
      );
      setAlerted(true);
    }
  }, [price, targetPrice, condition, alerted, marketId, toast]);

  return (
    <div className="bg-blue-50 border border-blue-200 rounded p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Price Alert</p>
          <p className="text-xs text-gray-600">
            Alert when {condition} ${targetPrice.toFixed(4)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold">
            Current: ${price?.currentPrice.toFixed(4) || "—"}
          </p>
          <p className={`text-xs ${alerted ? "text-green-600" : "text-gray-600"}`}>
            {alerted ? "✓ Triggered" : "⏳ Waiting"}
          </p>
        </div>
      </div>
    </div>
  );
}
```

### Example 5: Custom Hook for Price Monitoring

```tsx
// hooks/usePriceMonitor.ts
"use client";

import { useEffect, useRef } from "react";
import { useSinglePriceUpdate } from "./usePriceUpdates";

interface PriceMonitorOptions {
  marketId: string;
  onPriceIncrease?: (price: number, change: number) => void;
  onPriceDecrease?: (price: number, change: number) => void;
  onVolumeSpike?: (volume: number) => void;
  volumeSpikeThreshold?: number;
}

export function usePriceMonitor({
  marketId,
  onPriceIncrease,
  onPriceDecrease,
  onVolumeSpike,
  volumeSpikeThreshold = 1000,
}: PriceMonitorOptions) {
  const { price } = useSinglePriceUpdate(marketId);
  const previousVolumeRef = useRef<number>(0);

  useEffect(() => {
    if (!price) return;

    // Monitor price changes
    if (price.change > 0 && onPriceIncrease) {
      onPriceIncrease(price.currentPrice, price.change);
    } else if (price.change < 0 && onPriceDecrease) {
      onPriceDecrease(price.currentPrice, price.change);
    }

    // Monitor volume spikes
    if (onVolumeSpike) {
      const volumeChange = price.volume - previousVolumeRef.current;
      if (volumeChange > volumeSpikeThreshold) {
        onVolumeSpike(price.volume);
      }
    }

    previousVolumeRef.current = price.volume;
  }, [price, onPriceIncrease, onPriceDecrease, onVolumeSpike, volumeSpikeThreshold]);

  return { price };
}

// Usage:
function MarketMonitor({ marketId }: { marketId: string }) {
  const toast = useToast();

  usePriceMonitor({
    marketId,
    onPriceIncrease: (price, change) => {
      if (change > 0.1) {
        toast.success("Price Surge!", `Market ${marketId} increased by $${change.toFixed(4)}`);
      }
    },
    onPriceDecrease: (price, change) => {
      if (change < -0.1) {
        toast.warning("Price Drop!", `Market ${marketId} decreased by $${Math.abs(change).toFixed(4)}`);
      }
    },
    onVolumeSpike: (volume) => {
      toast.info("Volume Spike!", `High trading activity detected: ${volume.toLocaleString()}`);
    },
  });

  return <div>Monitoring {marketId}...</div>;
}
```

### Example 6: Watchlist with Live Updates

```tsx
// app/watchlist/page.tsx
"use client";

import { useState } from "react";
import { usePriceUpdates } from "@/hooks/usePriceUpdates";
import PriceDisplay from "@/app/components/market/PriceDisplay";

export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState<string[]>([
    "market-1",
    "market-2",
    "market-3",
  ]);
  const [newMarketId, setNewMarketId] = useState("");

  const { prices, isConnected } = usePriceUpdates({
    marketIds: watchlist,
    autoSubscribe: true,
  });

  const addToWatchlist = () => {
    if (newMarketId && !watchlist.includes(newMarketId)) {
      setWatchlist([...watchlist, newMarketId]);
      setNewMarketId("");
    }
  };

  const removeFromWatchlist = (marketId: string) => {
    setWatchlist(watchlist.filter((id) => id !== marketId));
  };

  // Sort by price change
  const sortedWatchlist = [...watchlist].sort((a, b) => {
    const priceA = prices.get(a);
    const priceB = prices.get(b);
    return (priceB?.changePercent || 0) - (priceA?.changePercent || 0);
  });

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Watchlist</h1>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm">{isConnected ? 'Live' : 'Offline'}</span>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex space-x-2">
          <input
            type="text"
            value={newMarketId}
            onChange={(e) => setNewMarketId(e.target.value)}
            placeholder="Enter market ID"
            className="flex-1 px-4 py-2 border rounded"
          />
          <button
            onClick={addToWatchlist}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Add
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {sortedWatchlist.map((marketId) => {
          const priceData = prices.get(marketId);
          return (
            <div key={marketId} className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold mb-2">Market {marketId}</h3>
                  <PriceDisplay marketId={marketId} showChange showVolume size="md" />
                </div>
                <button
                  onClick={() => removeFromWatchlist(marketId)}
                  className="ml-4 px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### Example 7: Connection Status Component

```tsx
// app/components/ConnectionStatus.tsx
"use client";

import { useWebSocketContext } from "./WebSocketProvider";

export default function ConnectionStatus() {
  const { status, isConnected, lastUpdate } = useWebSocketContext();

  const statusConfig = {
    connected: {
      color: "bg-green-500",
      text: "Live",
      icon: "🟢",
    },
    connecting: {
      color: "bg-yellow-500",
      text: "Connecting...",
      icon: "🟡",
    },
    disconnected: {
      color: "bg-gray-500",
      text: "Offline",
      icon: "⚫",
    },
    error: {
      color: "bg-red-500",
      text: "Error",
      icon: "🔴",
    },
  };

  const config = statusConfig[status];

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-3 border">
      <div className="flex items-center space-x-2">
        <div className={`w-2 h-2 rounded-full ${config.color} ${isConnected ? 'animate-pulse' : ''}`} />
        <span className="text-sm font-medium">{config.text}</span>
      </div>
      {lastUpdate && (
        <p className="text-xs text-gray-500 mt-1">
          Last update: {new Date(lastUpdate).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
```

## Integration Checklist

- [ ] Import necessary hooks and components
- [ ] Add WebSocketProvider to root layout (already done)
- [ ] Use `usePriceUpdates` or `useSinglePriceUpdate` in components
- [ ] Handle loading and error states
- [ ] Display connection status to users
- [ ] Test with real backend connection
- [ ] Add authentication token if required
- [ ] Monitor performance with multiple markets

## Best Practices

1. **Always handle loading states**: Check `isLoading` before rendering price data
2. **Show connection status**: Let users know when they're in offline mode
3. **Cleanup subscriptions**: Hooks handle this automatically, but be aware
4. **Batch subscriptions**: Subscribe to multiple markets at once for efficiency
5. **Use memoization**: Prevent unnecessary re-renders with `useMemo`
6. **Error boundaries**: Wrap WebSocket components in error boundaries
7. **Graceful degradation**: Always have a fallback UI for offline mode

## Common Patterns

### Pattern 1: Conditional Rendering Based on Connection
```tsx
{isConnected ? (
  <PriceDisplay marketId={id} />
) : (
  <div className="text-gray-500">Offline - Last known price: ${lastPrice}</div>
)}
```

### Pattern 2: Loading Skeleton
```tsx
{isLoading ? (
  <div className="animate-pulse">
    <div className="h-6 bg-gray-200 rounded w-24" />
  </div>
) : (
  <PriceDisplay marketId={id} />
)}
```

### Pattern 3: Error Handling
```tsx
const { price, isConnected, connectionStatus } = useSinglePriceUpdate(id);

if (connectionStatus === 'error') {
  return <div className="text-red-600">Unable to load price data</div>;
}
```

---

These examples demonstrate real-world integration patterns for the WebSocket implementation. Use them as templates for your own components!

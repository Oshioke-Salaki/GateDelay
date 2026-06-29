# Error Boundary Integration Examples

## Real-World Integration Examples

### Example 1: Market Detail Page

```tsx
// app/markets/[id]/page.tsx
"use client";

import { PageErrorBoundary } from "@/app/components/ui/PageErrorBoundary";
import { SectionErrorBoundary } from "@/app/components/ui/SectionErrorBoundary";
import { ComponentErrorBoundary } from "@/app/components/ui/ComponentErrorBoundary";
import { AsyncErrorBoundary } from "@/app/components/ui/AsyncErrorBoundary";

export default function MarketDetailPage({ params }: { params: { id: string } }) {
  return (
    <PageErrorBoundary>
      <div className="container mx-auto p-4">
        {/* Market Header */}
        <SectionErrorBoundary sectionName="MarketHeader">
          <MarketHeader marketId={params.id} />
        </SectionErrorBoundary>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Price Chart */}
          <ComponentErrorBoundary componentName="PriceChart">
            <AsyncErrorBoundary>
              <PriceChart marketId={params.id} />
            </AsyncErrorBoundary>
          </ComponentErrorBoundary>

          {/* Order Book */}
          <ComponentErrorBoundary componentName="OrderBook">
            <AsyncErrorBoundary>
              <OrderBook marketId={params.id} />
            </AsyncErrorBoundary>
          </ComponentErrorBoundary>
        </div>

        {/* Trading Section */}
        <SectionErrorBoundary sectionName="TradingSection">
          <div className="mt-6">
            <ComponentErrorBoundary componentName="TradingForm">
              <TradingForm marketId={params.id} />
            </ComponentErrorBoundary>
          </div>
        </SectionErrorBoundary>

        {/* Transaction History */}
        <SectionErrorBoundary sectionName="TransactionHistory">
          <div className="mt-6">
            <ComponentErrorBoundary componentName="TransactionHistory">
              <AsyncErrorBoundary>
                <TransactionHistory marketId={params.id} />
              </AsyncErrorBoundary>
            </ComponentErrorBoundary>
          </div>
        </SectionErrorBoundary>
      </div>
    </PageErrorBoundary>
  );
}
```

### Example 2: Dashboard with Multiple Data Sources

```tsx
// app/dashboard/page.tsx
"use client";

import { PageErrorBoundary } from "@/app/components/ui/PageErrorBoundary";
import { ComponentErrorBoundary } from "@/app/components/ui/ComponentErrorBoundary";
import { AsyncErrorBoundary, useAsyncError } from "@/app/components/ui/AsyncErrorBoundary";
import { reportError } from "@/lib/errorReporting";

function PortfolioWidget() {
  const throwError = useAsyncError();
  const [portfolio, setPortfolio] = useState(null);

  useEffect(() => {
    fetchPortfolio();
  }, []);

  const fetchPortfolio = async () => {
    try {
      const response = await fetch("/api/portfolio");
      if (!response.ok) throw new Error("Failed to fetch portfolio");
      const data = await response.json();
      setPortfolio(data);
    } catch (error) {
      reportError(error as Error, {
        component: "PortfolioWidget",
        action: "fetchPortfolio",
      });
      throwError(error as Error);
    }
  };

  return <div>{/* Portfolio UI */}</div>;
}

export default function DashboardPage() {
  return (
    <PageErrorBoundary>
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Portfolio Widget */}
          <ComponentErrorBoundary componentName="PortfolioWidget">
            <AsyncErrorBoundary>
              <PortfolioWidget />
            </AsyncErrorBoundary>
          </ComponentErrorBoundary>

          {/* Active Markets Widget */}
          <ComponentErrorBoundary componentName="ActiveMarketsWidget">
            <AsyncErrorBoundary>
              <ActiveMarketsWidget />
            </AsyncErrorBoundary>
          </ComponentErrorBoundary>

          {/* Recent Activity Widget */}
          <ComponentErrorBoundary componentName="RecentActivityWidget">
            <AsyncErrorBoundary>
              <RecentActivityWidget />
            </AsyncErrorBoundary>
          </ComponentErrorBoundary>
        </div>
      </div>
    </PageErrorBoundary>
  );
}
```

### Example 3: Form with Validation and Error Handling

```tsx
// app/markets/create/page.tsx
"use client";

import { useState } from "react";
import { PageErrorBoundary } from "@/app/components/ui/PageErrorBoundary";
import { ComponentErrorBoundary } from "@/app/components/ui/ComponentErrorBoundary";
import { useAsyncError } from "@/app/components/ui/AsyncErrorBoundary";
import { reportError, reportWarning } from "@/lib/errorReporting";
import { useToast } from "@/hooks/useToast";

function CreateMarketForm() {
  const throwError = useAsyncError();
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);
      const data = Object.fromEntries(formData);

      // Validate data
      if (!data.title || !data.description) {
        reportWarning("Form validation failed", {
          component: "CreateMarketForm",
          missingFields: ["title", "description"],
        });
        throw new Error("Please fill in all required fields");
      }

      // Submit to API
      const response = await fetch("/api/markets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create market");
      }

      toast.success("Market Created", "Your market has been created successfully");
      // Redirect or reset form
    } catch (error) {
      reportError(error as Error, {
        component: "CreateMarketForm",
        action: "submit",
        formData: data,
      });
      throwError(error as Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Form fields */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        {isSubmitting ? "Creating..." : "Create Market"}
      </button>
    </form>
  );
}

export default function CreateMarketPage() {
  return (
    <PageErrorBoundary>
      <div className="container mx-auto p-4 max-w-2xl">
        <h1 className="text-3xl font-bold mb-6">Create New Market</h1>
        <ComponentErrorBoundary componentName="CreateMarketForm">
          <CreateMarketForm />
        </ComponentErrorBoundary>
      </div>
    </PageErrorBoundary>
  );
}
```

### Example 4: WebSocket Component with Error Handling

```tsx
// app/components/market/LivePriceUpdates.tsx
"use client";

import { useEffect, useState } from "react";
import { ComponentErrorBoundary } from "@/app/components/ui/ComponentErrorBoundary";
import { useAsyncError } from "@/app/components/ui/AsyncErrorBoundary";
import { reportError, reportWarning } from "@/lib/errorReporting";
import { useWebSocketContext } from "@/app/components/WebSocketProvider";

function LivePriceUpdatesInner({ marketId }: { marketId: string }) {
  const throwError = useAsyncError();
  const websocket = useWebSocketContext();
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  useEffect(() => {
    try {
      // Subscribe to market updates
      websocket.subscribe([marketId]);

      // Handle connection errors
      if (websocket.status === "error" && retryCount < maxRetries) {
        reportWarning("WebSocket connection error, retrying...", {
          component: "LivePriceUpdates",
          marketId,
          retryCount,
        });
        setRetryCount((prev) => prev + 1);
        setTimeout(() => websocket.connect(), 2000 * (retryCount + 1));
      } else if (websocket.status === "error" && retryCount >= maxRetries) {
        const error = new Error("Failed to establish WebSocket connection after multiple retries");
        reportError(error, {
          component: "LivePriceUpdates",
          marketId,
          retryCount,
        });
        throwError(error);
      }

      return () => {
        websocket.unsubscribe([marketId]);
      };
    } catch (error) {
      reportError(error as Error, {
        component: "LivePriceUpdates",
        marketId,
      });
      throwError(error as Error);
    }
  }, [marketId, websocket, retryCount]);

  return <div>{/* Live price UI */}</div>;
}

export default function LivePriceUpdates({ marketId }: { marketId: string }) {
  return (
    <ComponentErrorBoundary
      componentName="LivePriceUpdates"
      fallback={(error, reset) => (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm font-semibold text-yellow-800 mb-2">
            Unable to load live prices
          </p>
          <p className="text-xs text-yellow-600 mb-3">
            {error.message}
          </p>
          <button
            onClick={reset}
            className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
          >
            Retry Connection
          </button>
        </div>
      )}
    >
      <LivePriceUpdatesInner marketId={marketId} />
    </ComponentErrorBoundary>
  );
}
```

### Example 5: Protected Route with Error Handling

```tsx
// app/profile/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageErrorBoundary } from "@/app/components/ui/PageErrorBoundary";
import { SectionErrorBoundary } from "@/app/components/ui/SectionErrorBoundary";
import { useAsyncError } from "@/app/components/ui/AsyncErrorBoundary";
import { reportError } from "@/lib/errorReporting";

function ProfileContent({ userId }: { userId: string }) {
  const throwError = useAsyncError();
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchUserProfile();
  }, [userId]);

  const fetchUserProfile = async () => {
    try {
      const response = await fetch(`/api/users/${userId}`);

      if (response.status === 401) {
        // Unauthorized - redirect to login
        router.push("/login");
        return;
      }

      if (response.status === 403) {
        // Forbidden - show error
        throw new Error("You don't have permission to view this profile");
      }

      if (!response.ok) {
        throw new Error("Failed to load profile");
      }

      const data = await response.json();
      setUser(data);
    } catch (error) {
      reportError(error as Error, {
        component: "ProfileContent",
        userId,
        action: "fetchUserProfile",
      });
      throwError(error as Error);
    }
  };

  return <div>{/* Profile UI */}</div>;
}

export default function ProfilePage() {
  return (
    <PageErrorBoundary>
      <div className="container mx-auto p-4">
        <SectionErrorBoundary sectionName="ProfileHeader">
          <ProfileHeader />
        </SectionErrorBoundary>

        <SectionErrorBoundary sectionName="ProfileContent">
          <ProfileContent userId="current-user-id" />
        </SectionErrorBoundary>

        <SectionErrorBoundary sectionName="ProfileSettings">
          <ProfileSettings />
        </SectionErrorBoundary>
      </div>
    </PageErrorBoundary>
  );
}
```

### Example 6: List with Individual Item Error Boundaries

```tsx
// app/markets/page.tsx
"use client";

import { PageErrorBoundary } from "@/app/components/ui/PageErrorBoundary";
import { ComponentErrorBoundary } from "@/app/components/ui/ComponentErrorBoundary";
import { AsyncErrorBoundary } from "@/app/components/ui/AsyncErrorBoundary";

function MarketCard({ market }: { market: Market }) {
  // Individual market card logic
  return <div>{/* Market card UI */}</div>;
}

function MarketsList() {
  const [markets, setMarkets] = useState<Market[]>([]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {markets.map((market) => (
        <ComponentErrorBoundary
          key={market.id}
          componentName={`MarketCard-${market.id}`}
          fallback={(error, reset) => (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">Failed to load market</p>
              <button
                onClick={reset}
                className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
              >
                Retry
              </button>
            </div>
          )}
        >
          <AsyncErrorBoundary>
            <MarketCard market={market} />
          </AsyncErrorBoundary>
        </ComponentErrorBoundary>
      ))}
    </div>
  );
}

export default function MarketsPage() {
  return (
    <PageErrorBoundary>
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-6">Markets</h1>
        <MarketsList />
      </div>
    </PageErrorBoundary>
  );
}
```

### Example 7: Modal with Error Handling

```tsx
// app/components/modals/TradeModal.tsx
"use client";

import { ComponentErrorBoundary } from "@/app/components/ui/ComponentErrorBoundary";
import { useAsyncError } from "@/app/components/ui/AsyncErrorBoundary";
import { reportError } from "@/lib/errorReporting";

function TradeModalContent({ marketId, onClose }: TradeModalProps) {
  const throwError = useAsyncError();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTrade = async (data: TradeData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId, ...data }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Trade failed");
      }

      onClose();
    } catch (error) {
      reportError(error as Error, {
        component: "TradeModal",
        marketId,
        action: "handleTrade",
        tradeData: data,
      });
      throwError(error as Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return <div>{/* Trade form UI */}</div>;
}

export default function TradeModal(props: TradeModalProps) {
  return (
    <ComponentErrorBoundary
      componentName="TradeModal"
      fallback={(error, reset) => (
        <div className="bg-white rounded-lg p-6 max-w-md">
          <h3 className="text-lg font-bold text-red-800 mb-2">Trade Error</h3>
          <p className="text-sm text-red-600 mb-4">{error.message}</p>
          <div className="flex space-x-3">
            <button
              onClick={reset}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Try Again
            </button>
            <button
              onClick={props.onClose}
              className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    >
      <TradeModalContent {...props} />
    </ComponentErrorBoundary>
  );
}
```

## Integration Patterns

### Pattern 1: Nested Error Boundaries

```tsx
<PageErrorBoundary>
  <SectionErrorBoundary>
    <ComponentErrorBoundary>
      <AsyncErrorBoundary>
        <Component />
      </AsyncErrorBoundary>
    </ComponentErrorBoundary>
  </SectionErrorBoundary>
</PageErrorBoundary>
```

### Pattern 2: Conditional Error Boundaries

```tsx
{isAuthenticated ? (
  <ComponentErrorBoundary componentName="AuthenticatedContent">
    <AuthenticatedContent />
  </ComponentErrorBoundary>
) : (
  <ComponentErrorBoundary componentName="PublicContent">
    <PublicContent />
  </ComponentErrorBoundary>
)}
```

### Pattern 3: Error Boundary with Reset Keys

```tsx
<ErrorBoundary resetKeys={[userId, marketId]}>
  <UserMarketData userId={userId} marketId={marketId} />
</ErrorBoundary>
```

## Best Practices

1. **Wrap at Multiple Levels**: Use page, section, and component boundaries
2. **Provide Context**: Include relevant data in error reports
3. **Custom Fallbacks**: Design user-friendly error messages
4. **Handle Async Errors**: Always use `useAsyncError` for async operations
5. **Test Error Paths**: Use the test page to verify error handling
6. **Monitor Production**: Integrate with error tracking services
7. **Graceful Degradation**: Ensure app remains functional when components fail

---

These examples demonstrate real-world integration patterns for error boundaries in the GateDelay application.

# Error Boundary Quick Start Guide

## 🚀 Quick Setup

Error boundaries are already integrated into the root layout. Just wrap your components!

## 📦 Available Components

### 1. PageErrorBoundary
Wrap entire pages to prevent full app crashes.

```tsx
import { PageErrorBoundary } from "@/app/components/ui/PageErrorBoundary";

export default function Page() {
  return (
    <PageErrorBoundary>
      <YourPageContent />
    </PageErrorBoundary>
  );
}
```

### 2. SectionErrorBoundary
Wrap page sections for isolated error handling.

```tsx
import { SectionErrorBoundary } from "@/app/components/ui/SectionErrorBoundary";

<SectionErrorBoundary sectionName="UserProfile">
  <UserProfileSection />
</SectionErrorBoundary>
```

### 3. ComponentErrorBoundary
Wrap individual components for granular control.

```tsx
import { ComponentErrorBoundary } from "@/app/components/ui/ComponentErrorBoundary";

<ComponentErrorBoundary componentName="PriceChart">
  <PriceChart marketId={id} />
</ComponentErrorBoundary>
```

### 4. AsyncErrorBoundary
Handle async operation errors.

```tsx
import { AsyncErrorBoundary, useAsyncError } from "@/app/components/ui/AsyncErrorBoundary";

function AsyncComponent() {
  const throwError = useAsyncError();

  const fetchData = async () => {
    try {
      await api.getData();
    } catch (error) {
      throwError(error as Error);
    }
  };

  return <div>...</div>;
}

<AsyncErrorBoundary>
  <AsyncComponent />
</AsyncErrorBoundary>
```

## 🎯 Common Use Cases

### Use Case 1: Protect Critical Components

```tsx
<ComponentErrorBoundary componentName="PaymentForm">
  <PaymentForm />
</ComponentErrorBoundary>
```

### Use Case 2: Handle API Errors

```tsx
function DataComponent() {
  const throwError = useAsyncError();

  useEffect(() => {
    fetch("/api/data")
      .then(res => res.json())
      .catch(throwError);
  }, []);

  return <div>...</div>;
}

<AsyncErrorBoundary>
  <DataComponent />
</AsyncErrorBoundary>
```

### Use Case 3: Custom Error UI

```tsx
<ComponentErrorBoundary
  componentName="CustomComponent"
  fallback={(error, reset) => (
    <div className="custom-error">
      <h3>Oops! {error.message}</h3>
      <button onClick={reset}>Try Again</button>
    </div>
  )}
>
  <YourComponent />
</ComponentErrorBoundary>
```

### Use Case 4: Manual Error Reporting

```tsx
import { reportError, reportWarning } from "@/lib/errorReporting";

// Report an error
try {
  riskyOperation();
} catch (error) {
  reportError(error, { component: "MyComponent", action: "riskyOperation" });
}

// Report a warning
if (slowResponse) {
  reportWarning("Slow API response", { endpoint: "/api/data", duration: 5000 });
}
```

## 🐛 Debugging

### View Error Dashboard

```tsx
import { ErrorDashboard } from "@/app/components/ui/ErrorDashboard";

// Add to your page (development only)
<ErrorDashboard />
```

Or visit the test page: `http://localhost:3001/test-errors`

### Access Error Logs

```typescript
import { errorReporter } from "@/lib/errorReporting";

// Get all errors
const errors = errorReporter.getErrors();

// Download errors
errorReporter.downloadErrors();

// Clear errors
errorReporter.clearErrors();
```

## ✅ Best Practices

1. **Wrap at Multiple Levels**: Use page, section, and component boundaries
2. **Provide Context**: Include relevant data in error reports
3. **Custom Fallbacks**: Design user-friendly error messages
4. **Test Errors**: Use the test page to verify error handling
5. **Monitor Production**: Integrate with error tracking services

## 🎨 Error Boundary Hierarchy

```
PageErrorBoundary (Root)
  └─ SectionErrorBoundary (Header)
  └─ SectionErrorBoundary (Content)
      └─ ComponentErrorBoundary (Chart)
      └─ ComponentErrorBoundary (Table)
  └─ SectionErrorBoundary (Footer)
```

## 🔧 Configuration

### Show Technical Details

```tsx
<ErrorBoundary level="component" showDetails={true}>
  <Component />
</ErrorBoundary>
```

### Custom Error Handler

```tsx
<ErrorBoundary
  onError={(error, errorInfo) => {
    console.log("Custom error handler", error);
    // Send to analytics
  }}
>
  <Component />
</ErrorBoundary>
```

### Reset on Prop Change

```tsx
<ErrorBoundary resetKeys={[userId, marketId]}>
  <Component userId={userId} marketId={marketId} />
</ErrorBoundary>
```

## 📊 Error Levels

| Level | Use Case | Display | Recovery |
|-------|----------|---------|----------|
| `page` | Entire pages | Full screen | Page reload |
| `section` | Page sections | Section area | Section reset |
| `component` | Individual components | Compact | Component reset |

## 🚨 Common Errors to Catch

- ✅ Component render errors
- ✅ Async operation failures
- ✅ API request errors
- ✅ Data parsing errors
- ✅ Missing data errors
- ✅ Permission errors
- ✅ Network errors

## 📝 Example: Complete Page

```tsx
export default function MarketPage({ params }) {
  return (
    <PageErrorBoundary>
      <div className="container">
        {/* Header Section */}
        <SectionErrorBoundary sectionName="Header">
          <MarketHeader marketId={params.id} />
        </SectionErrorBoundary>

        {/* Main Content */}
        <div className="grid grid-cols-2 gap-4">
          <ComponentErrorBoundary componentName="PriceChart">
            <AsyncErrorBoundary>
              <PriceChart marketId={params.id} />
            </AsyncErrorBoundary>
          </ComponentErrorBoundary>

          <ComponentErrorBoundary componentName="OrderBook">
            <AsyncErrorBoundary>
              <OrderBook marketId={params.id} />
            </AsyncErrorBoundary>
          </ComponentErrorBoundary>
        </div>

        {/* Trading Form */}
        <SectionErrorBoundary sectionName="Trading">
          <TradingForm marketId={params.id} />
        </SectionErrorBoundary>
      </div>
    </PageErrorBoundary>
  );
}
```

## 🎯 Testing Checklist

- [ ] Test component errors
- [ ] Test async errors
- [ ] Test error recovery
- [ ] Test custom fallbacks
- [ ] Test error logging
- [ ] Test error dashboard
- [ ] Test production error tracking

## 📚 Documentation

- **Full Documentation**: `ERROR_BOUNDARY_DOCUMENTATION.md`
- **Test Page**: `/test-errors`
- **API Reference**: See full documentation

---

**Ready to use!** Error boundaries are fully integrated and ready for production.

"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * App-wide TanStack Query client.
 *
 * Every `useQuery` caller in the app — `components/audit/AuditLogViewer`,
 * `components/market/MarketSentiment`, `components/wallet/MultisigUI` and the
 * rest — needs a `QueryClientProvider` above it or the hook throws
 * "No QueryClient set" during render.
 *
 * This sits *outside* `ParticleClientWrapper` on purpose. `ParticleProvider`
 * returns its children unwrapped when the wallet env vars are missing
 * (`isParticleConnectKitConfigured()`), which is the normal state for a fresh
 * checkout, so a query client nested inside it would disappear exactly when a
 * collaborator first runs the app.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  // useState (not a module-level const) so each browser session gets its own
  // cache and the client is never shared across requests during SSR.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // The audit log and market data are polled views, not documents;
            // a short stale window keeps first paint instant on back-navigation
            // without pinning stale rows on screen.
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

export default QueryProvider;

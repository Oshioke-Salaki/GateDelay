"use client";
// Root-level catch-all — fires when the root layout segment itself throws.
import RouteErrorFallback from "./components/ui/RouteErrorFallback";
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteErrorFallback error={error} reset={reset} routeName="the application" />;
}

"use client";
import RouteErrorFallback from "../../components/ui/RouteErrorFallback";
export default function MarketDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteErrorFallback error={error} reset={reset} routeName="this market" />;
}

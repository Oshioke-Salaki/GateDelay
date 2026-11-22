"use client";
import RouteErrorFallback from "../components/ui/RouteErrorFallback";
export default function MarketsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteErrorFallback error={error} reset={reset} routeName="the markets page" />;
}

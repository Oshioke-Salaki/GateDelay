"use client";
import RouteErrorFallback from "../components/ui/RouteErrorFallback";
export default function GovernanceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteErrorFallback error={error} reset={reset} routeName="governance" />;
}

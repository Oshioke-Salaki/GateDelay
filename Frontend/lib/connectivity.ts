/**
 * Pure helpers for classifying network/backend failures.
 *
 * The banner UI must not treat every 4xx as "offline", and it must not treat a
 * single recovered request as proof the backend is healthy — recovery is owned
 * by the dedicated `/api/ping` probe in `useConnectivity`.
 */

export const CONNECTIVITY_PROBE_URL = "/api/ping";

/** Consecutive failed API calls required before we treat the backend as down. */
export const NETWORK_FAILURE_THRESHOLD = 2;

/** Probe attempts shown on the reconnect progress bar. */
export const MAX_RECONNECT_ATTEMPTS = 8;

export type UnreachableReason = "browser" | "backend";

export function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  if (typeof Request !== "undefined" && input instanceof Request) return input.url;
  return String(input);
}

export function isConnectivityProbeUrl(url: string): boolean {
  return url.includes(CONNECTIVITY_PROBE_URL);
}

/**
 * HTTP statuses that mean the origin (or our BFF's upstream) is unavailable,
 * not that the user sent a bad request.
 */
export function isNetworkFailureStatus(status: number): boolean {
  return status === 0 || status === 502 || status === 503 || status === 504;
}

export function isNetworkFailureError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === "TypeError" ||
    /failed to fetch|networkerror|econnrefused|enotfound|offline|load failed/i.test(
      error.message,
    )
  );
}

export function reconnectProgressPercent(
  attempt: number,
  maxAttempts: number = MAX_RECONNECT_ATTEMPTS,
): number {
  if (attempt <= 0) return 0;
  const capped = Math.min(attempt, maxAttempts);
  // Never show 100% until the probe actually succeeds — the banner owns that.
  return Math.min(95, Math.round((capped / maxAttempts) * 100));
}

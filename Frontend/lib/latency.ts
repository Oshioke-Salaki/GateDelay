import type { LatencyStatus } from "@/hooks/useLatency";

export const LATENCY_THRESHOLDS_MS = {
  liveMax: 100,
  degradedMax: 300,
} as const;

export const LATENCY_STATUS_COPY: Record<LatencyStatus, { label: string; description: string }> = {
  live: {
    label: "Live",
    description: "Realtime updates are healthy and trade feedback should feel immediate.",
  },
  degraded: {
    label: "Degraded",
    description: "Updates are slower than usual; prices and confirmations may lag briefly.",
  },
  disconnected: {
    label: "Disconnected",
    description: "The probe cannot reach the app reliably. Check connectivity before trading.",
  },
  unknown: {
    label: "Measuring",
    description: "Collecting enough samples to classify the connection.",
  },
};

export function formatLatencyThresholds(): string {
  return `Live <= ${LATENCY_THRESHOLDS_MS.liveMax} ms; degraded ${LATENCY_THRESHOLDS_MS.liveMax + 1}-${LATENCY_THRESHOLDS_MS.degradedMax} ms; disconnected > ${LATENCY_THRESHOLDS_MS.degradedMax} ms or failed probe.`;
}
